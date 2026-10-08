-- Incremental DATA sync, STAGE 5: Bank Process domain, legacy c168.net PHP DB -> count_real (local rehearsal).
--
-- Source = `c168_net_legacy_20261007`   Baseline = `c168_net_legacy_20260929`   Target = count_real.
-- Run AFTER the identity / currency / process stages (needs tenants, accounts).
--
-- User decision 2026-10-07: bank contracts are aligned to legacy COMPLETELY (not only the fields legacy changed
-- since the baseline). So for every contract that exists in both systems every legacy-backed column is written
-- over count_real when it differs (a row with no difference is not touched). Columns that exist only in the new
-- schema are never touched: expired_at_creation, due_generation_floor, due_closed.
--
-- Column mapping = the original migration (migrate_data_bank_process_from_legacy.sql):
--   name -> card_owner, type -> card_owner_type, card_merchant_id -> supplier_account_id, cost -> supplier_price,
--   customer_id -> customer_account_id, price -> customer_price, profit_account_id -> company_account_id,
--   profit -> company_price, insurance -> insurance_price, status folds issue_flag (block/official win over the
--   base status), day_start_frequency -> frequency, accounting_resend_schedule_* -> resend_schedule_*,
--   created_by/modified_by resolved through the *_type discriminator.
--
-- What this script does
--   1. bank_country / bank_option : INSERT IGNORE from every legacy selection source (+ bank_process itself)
--   2. bank_process               : 7 new contracts inserted (id preserved); existing contracts aligned to legacy
--   3. bank_process_share         : profit-sharing free text re-parsed; shares of any contract that differs are rebuilt
--   4. bank_process_resend_daily_guard : new rows for contracts that exist (id preserved)
-- Not handled here: transactions / accounting ledger / descriptions (stage 6).
--
-- Usage:
--   mysql -u root count_real < backend/src/main/resources/SqlEtcForMigrate/delta_sync/migrate_delta_bank_process_20261007.sql

START TRANSACTION;

-- =============================================================================
-- 1. bank_country / bank_option: add whatever is missing (UNIQUE keys dedupe).
-- =============================================================================
INSERT IGNORE INTO bank_country (tenant_id, code, created_at)
SELECT DISTINCT ten.id, x.country, NOW()
FROM (
    SELECT company_id, country FROM c168_net_legacy_20261007.country_bank
    UNION
    SELECT company_id, country FROM c168_net_legacy_20261007.company_countries
    UNION
    SELECT company_id, country FROM c168_net_legacy_20261007.company_selected_countries
    UNION
    SELECT company_id, country FROM c168_net_legacy_20261007.company_selected_banks
    UNION
    SELECT company_id, country FROM c168_net_legacy_20261007.bank_process
) x
JOIN c168_net_legacy_20261007.company c ON c.id = x.company_id
JOIN tenant ten ON ten.tenant_type = 'COMPANY' AND ten.code = c.company_id;
SELECT 'bank_country inserted' AS step, ROW_COUNT() AS n;

INSERT IGNORE INTO bank_option (tenant_id, country_id, name, created_at)
SELECT DISTINCT ten.id, bc.id, x.bank, NOW()
FROM (
    SELECT company_id, country, bank FROM c168_net_legacy_20261007.country_bank
    UNION
    SELECT company_id, country, bank FROM c168_net_legacy_20261007.company_selected_banks
    UNION
    SELECT company_id, country, bank FROM c168_net_legacy_20261007.bank_process
) x
JOIN c168_net_legacy_20261007.company c ON c.id = x.company_id
JOIN tenant ten ON ten.tenant_type = 'COMPANY' AND ten.code = c.company_id
JOIN bank_country bc ON bc.tenant_id = ten.id AND bc.code = x.country;
SELECT 'bank_option inserted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 2a. Legacy contracts expressed in the new shape (one row per legacy contract that resolves).
-- =============================================================================
CREATE TEMPORARY TABLE _bp (
    id                 INT UNSIGNED PRIMARY KEY,
    tenant_id          INT UNSIGNED NOT NULL,
    country_id         INT UNSIGNED NOT NULL,
    bank_option_id     INT UNSIGNED NOT NULL,
    card_owner         VARCHAR(255),
    card_owner_type    VARCHAR(100),
    day_start          DATE,
    day_end            DATE,
    cap_enabled        TINYINT(1),
    expired_at_creation TINYINT(1),
    frequency          VARCHAR(30),
    supplier_account_id INT UNSIGNED,
    supplier_price     DECIMAL(25,8),
    customer_account_id INT UNSIGNED,
    customer_price     DECIMAL(25,8),
    company_account_id INT UNSIGNED,
    company_price      DECIMAL(25,8),
    contract           VARCHAR(20),
    insurance_price    DECIMAL(25,8),
    sop                TEXT,
    remark             VARCHAR(500),
    status             VARCHAR(20),
    resend_start       DATE,
    resend_end         DATE,
    resend_frequency   VARCHAR(30),
    created_by         VARCHAR(50),
    updated_by         VARCHAR(50),
    created_at         TIMESTAMP NULL,
    updated_at         TIMESTAMP NULL
);
INSERT INTO _bp
SELECT
    bp.id, ten.id, bc.id, bo.id, bp.name, bp.type, bp.day_start, bp.day_end, bp.day_end_monthly_cap_enabled,
    CASE WHEN bp.day_start_frequency IN ('1st_of_every_month', 'monthly') AND bp.day_end IS NOT NULL
              AND LAST_DAY(bp.day_end) < DATE_FORMAT(bp.dts_created, '%Y-%m-01') THEN 1 ELSE 0 END,
    CASE bp.day_start_frequency
        WHEN '1st_of_every_month' THEN 'FIRST_OF_EVERY_MONTH' WHEN 'monthly' THEN 'MONTHLY'
        WHEN 'once' THEN 'ONCE' WHEN 'day' THEN 'DAY' WHEN 'week' THEN 'WEEK' ELSE 'FIRST_OF_EVERY_MONTH' END,
    bp.card_merchant_id, bp.cost, bp.customer_id, bp.price, bp.profit_account_id, bp.profit,
    bp.contract, bp.insurance, bp.sop, bp.remark,
    CASE WHEN bp.issue_flag = 'block' THEN 'BLOCK' WHEN bp.issue_flag = 'official' THEN 'OFFICIAL'
         WHEN bp.status = 'active' THEN 'ACTIVE' WHEN bp.status = 'inactive' THEN 'INACTIVE'
         WHEN bp.status = 'waiting' THEN 'WAITING' ELSE 'ACTIVE' END,
    bp.accounting_resend_schedule_day_start, bp.accounting_resend_schedule_day_end,
    CASE bp.accounting_resend_schedule_frequency
        WHEN '1st_of_every_month' THEN 'FIRST_OF_EVERY_MONTH' WHEN 'monthly' THEN 'MONTHLY'
        WHEN 'once' THEN 'ONCE' WHEN 'day' THEN 'DAY' WHEN 'week' THEN 'WEEK' ELSE NULL END,
    CASE WHEN bp.created_by_type = 'owner' THEN o1.owner_code ELSE u1.login_id END,
    CASE WHEN bp.modified_by IS NULL AND bp.modified_by_owner_id IS NULL THEN NULL
         WHEN bp.modified_by_type = 'owner' THEN o2.owner_code ELSE u2.login_id END,
    bp.dts_created, bp.dts_modified
FROM c168_net_legacy_20261007.bank_process bp
JOIN c168_net_legacy_20261007.company c ON c.id = bp.company_id
JOIN tenant ten ON ten.tenant_type = 'COMPANY' AND ten.code = c.company_id
JOIN bank_country bc ON bc.tenant_id = ten.id AND bc.code = bp.country
JOIN bank_option bo ON bo.country_id = bc.id AND bo.name = bp.bank
LEFT JOIN user u1 ON u1.id = bp.created_by
LEFT JOIN owner o1 ON o1.id = bp.created_by_owner_id
LEFT JOIN user u2 ON u2.id = bp.modified_by
LEFT JOIN owner o2 ON o2.id = bp.modified_by_owner_id;
SELECT 'legacy contracts resolved' AS step, COUNT(*) AS n FROM _bp;

-- =============================================================================
-- 2b. New contracts (id preserved).
-- =============================================================================
INSERT INTO bank_process (
    id, tenant_id, country_id, bank_option_id, card_owner, card_owner_type,
    day_start, day_end, day_end_monthly_cap_enabled, expired_at_creation, frequency,
    supplier_account_id, supplier_price, customer_account_id, customer_price,
    company_account_id, company_price, contract, insurance_price, sop, remark, status,
    resend_schedule_day_start, resend_schedule_day_end, resend_schedule_frequency,
    created_by, updated_by, created_at, updated_at
)
SELECT b.id, b.tenant_id, b.country_id, b.bank_option_id, b.card_owner, b.card_owner_type,
       b.day_start, b.day_end, b.cap_enabled, b.expired_at_creation, b.frequency,
       b.supplier_account_id, b.supplier_price, b.customer_account_id, b.customer_price,
       b.company_account_id, b.company_price, b.contract, b.insurance_price, b.sop, b.remark, b.status,
       b.resend_start, b.resend_end, b.resend_frequency,
       b.created_by, b.updated_by, b.created_at, b.updated_at
FROM _bp b
WHERE b.id NOT IN (SELECT id FROM bank_process);
SELECT 'bank_process inserted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 2c. Existing contracts: align every legacy-backed column (only rows that differ). updated_by / updated_at follow
--     legacy too (explicit updated_at so ON UPDATE CURRENT_TIMESTAMP does not stamp "now").
-- =============================================================================
UPDATE bank_process n
JOIN _bp b ON b.id = n.id
SET n.tenant_id = b.tenant_id, n.country_id = b.country_id, n.bank_option_id = b.bank_option_id,
    n.card_owner = b.card_owner, n.card_owner_type = b.card_owner_type,
    n.day_start = b.day_start, n.day_end = b.day_end, n.day_end_monthly_cap_enabled = b.cap_enabled,
    n.frequency = b.frequency,
    n.supplier_account_id = b.supplier_account_id, n.supplier_price = b.supplier_price,
    n.customer_account_id = b.customer_account_id, n.customer_price = b.customer_price,
    n.company_account_id = b.company_account_id, n.company_price = b.company_price,
    n.contract = b.contract, n.insurance_price = b.insurance_price, n.sop = b.sop, n.remark = b.remark,
    n.status = b.status,
    n.resend_schedule_day_start = b.resend_start, n.resend_schedule_day_end = b.resend_end,
    n.resend_schedule_frequency = b.resend_frequency,
    n.updated_by = b.updated_by,
    n.updated_at = COALESCE(b.updated_at, n.updated_at)
WHERE NOT (n.tenant_id <=> b.tenant_id AND n.country_id <=> b.country_id AND n.bank_option_id <=> b.bank_option_id
           AND n.card_owner <=> b.card_owner AND n.card_owner_type <=> b.card_owner_type
           AND n.day_start <=> b.day_start AND n.day_end <=> b.day_end
           AND n.day_end_monthly_cap_enabled <=> b.cap_enabled AND n.frequency <=> b.frequency
           AND n.supplier_account_id <=> b.supplier_account_id AND ABS(IFNULL(n.supplier_price,0) - IFNULL(b.supplier_price,0)) < 0.000001
           AND n.customer_account_id <=> b.customer_account_id AND ABS(IFNULL(n.customer_price,0) - IFNULL(b.customer_price,0)) < 0.000001
           AND n.company_account_id <=> b.company_account_id AND ABS(IFNULL(n.company_price,0) - IFNULL(b.company_price,0)) < 0.000001
           AND n.contract <=> b.contract AND ABS(IFNULL(n.insurance_price,0) - IFNULL(b.insurance_price,0)) < 0.000001
           AND n.sop <=> b.sop AND n.remark <=> b.remark AND n.status <=> b.status
           AND n.resend_schedule_day_start <=> b.resend_start AND n.resend_schedule_day_end <=> b.resend_end
           AND n.resend_schedule_frequency <=> b.resend_frequency);
SELECT 'bank_process aligned (rows that differed)' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 3. bank_process_share: parse legacy "CODE [Name] - amount, CODE [Name] - amount" for every contract; a contract
--    whose share set differs from count_real gets its shares rebuilt.
-- =============================================================================
CREATE TEMPORARY TABLE _want_share (
    bank_process_id INT UNSIGNED NOT NULL,
    account_id      INT UNSIGNED NOT NULL,
    amount          DECIMAL(25,8) NOT NULL,
    sort_order      INT NOT NULL,
    PRIMARY KEY (bank_process_id, sort_order)
);
INSERT IGNORE INTO _want_share (bank_process_id, account_id, amount, sort_order)
SELECT bp.id, a.id, CAST(TRIM(SUBSTRING_INDEX(parts.part, '-', -1)) AS DECIMAL(25, 8)), parts.i
FROM c168_net_legacy_20261007.bank_process bp
JOIN _bp b ON b.id = bp.id
CROSS JOIN (SELECT 0 AS i UNION ALL SELECT 1 UNION ALL SELECT 2) parts_idx
JOIN (
    SELECT bp2.id AS bp_id, p2.i,
           TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(bp2.profit_sharing, ',', p2.i + 1), ',', -1)) AS part
    FROM c168_net_legacy_20261007.bank_process bp2
    CROSS JOIN (SELECT 0 AS i UNION ALL SELECT 1 UNION ALL SELECT 2) p2
    WHERE bp2.profit_sharing IS NOT NULL AND bp2.profit_sharing != ''
      AND p2.i < (LENGTH(bp2.profit_sharing) - LENGTH(REPLACE(bp2.profit_sharing, ',', '')) + 1)
) parts ON parts.bp_id = bp.id AND parts.i = parts_idx.i
JOIN account_tenant_access ata ON ata.tenant_id = b.tenant_id
-- account code = everything before ' [' or ' - ' (codes may contain spaces, e.g. 'ER SHAO - 50.00')
JOIN account a ON a.id = ata.account_id
    AND a.account_id = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(parts.part, ' [', 1), ' - ', 1))
WHERE bp.profit_sharing IS NOT NULL AND bp.profit_sharing != '';
SELECT 'legacy share lines parsed' AS step, COUNT(*) AS n FROM _want_share;

CREATE TEMPORARY TABLE _share_diff (bank_process_id INT UNSIGNED PRIMARY KEY);
INSERT INTO _share_diff (bank_process_id)
SELECT b.id
FROM _bp b
WHERE b.id IN (SELECT id FROM bank_process)
  AND ( EXISTS (SELECT 1 FROM _want_share w WHERE w.bank_process_id = b.id
                AND NOT EXISTS (SELECT 1 FROM bank_process_share s WHERE s.bank_process_id = w.bank_process_id
                                AND s.account_id = w.account_id AND ABS(s.amount - w.amount) < 0.000001))
        OR EXISTS (SELECT 1 FROM bank_process_share s WHERE s.bank_process_id = b.id
                   AND NOT EXISTS (SELECT 1 FROM _want_share w WHERE w.bank_process_id = s.bank_process_id
                                   AND w.account_id = s.account_id AND ABS(s.amount - w.amount) < 0.000001)) );
SELECT 'contracts whose shares differ' AS step, COUNT(*) AS n FROM _share_diff;

DELETE s FROM bank_process_share s JOIN _share_diff d ON d.bank_process_id = s.bank_process_id;
SELECT 'bank_process_share deleted' AS step, ROW_COUNT() AS n;

INSERT INTO bank_process_share (bank_process_id, account_id, amount, sort_order)
SELECT w.bank_process_id, w.account_id, w.amount, w.sort_order
FROM _want_share w
JOIN _share_diff d ON d.bank_process_id = w.bank_process_id;
SELECT 'bank_process_share inserted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 4. bank_process_resend_daily_guard: new rows for contracts that exist (id preserved).
-- =============================================================================
INSERT INTO bank_process_resend_daily_guard (id, tenant_id, bank_process_id, resend_day_start, guard_date, created_at)
SELECT g.id, ten.id, g.bank_process_id, g.resend_day_start, g.guard_date, g.created_at
FROM c168_net_legacy_20261007.bank_process_accounting_resend_daily_guard g
JOIN c168_net_legacy_20261007.company c ON c.id = g.company_id
JOIN tenant ten ON ten.tenant_type = 'COMPANY' AND ten.code = c.company_id
JOIN bank_process bp ON bp.id = g.bank_process_id
WHERE g.id NOT IN (SELECT id FROM bank_process_resend_daily_guard);
SELECT 'resend_daily_guard inserted' AS step, ROW_COUNT() AS n;

DROP TEMPORARY TABLE _share_diff;
DROP TEMPORARY TABLE _want_share;
DROP TEMPORARY TABLE _bp;

COMMIT;
