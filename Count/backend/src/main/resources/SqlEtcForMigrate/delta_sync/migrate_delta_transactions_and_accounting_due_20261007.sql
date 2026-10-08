-- Incremental DATA sync, STAGE 6: Transactions / RATE / deleted transactions + Bank Process accounting-due ledger,
-- legacy c168.net PHP DB -> count_real (local rehearsal).
--
-- Source = `c168_net_legacy_20261007`   Baseline = `c168_net_legacy_20260929`   Target = count_real.
-- Run AFTER the identity / currency / process / data capture / bank process stages.
--
-- Rules (same as the other stages): NEW rows since the baseline are inserted, DELETED = only what legacy removed
-- since the baseline. Rows that exist only in count_real are never touched.
--
-- What this script does
--   1. transactions            : legacy rows new since the baseline get FRESH ids (MAX(id)+n, ordered by legacy id);
--                                legacy ids are not reusable (every id above 43371 is taken by generated rows).
--                                description is copied RAW from legacy; Bank Process lines are converted to the new
--                                description format afterwards by BankProcessDescriptionBackfillTool (--min-txn-id).
--   2. transactions_rate       : new rate groups + rate_group_id on the two legs (ids through the txn map)
--   3. transactions_deleted    : new rows since the baseline (fresh surrogate key)
--   4. bank_process_accounting_posted : legacy process_accounting_posted + process_accounting_due_dismissed mapped to
--                                the new ledger (same mapping as migrate_delta_transactions_and_accounting_due_20260905.sql):
--                                new rows inserted (fresh ids), SKIPPED rows legacy dropped since the baseline deleted.
--   5. transactions.bank_process_posted_id for the NEW Bank Process transactions
--
-- Usage:
--   mysql -u root count_real < backend/src/main/resources/SqlEtcForMigrate/delta_sync/migrate_delta_transactions_and_accounting_due_20261007.sql

START TRANSACTION;

CREATE TEMPORARY TABLE _map_currency (
    old_currency_id  INT NOT NULL PRIMARY KEY,
    survivor_id      INT NOT NULL
);
INSERT INTO _map_currency (old_currency_id, survivor_id)
SELECT cu.id, s.id
FROM c168_net_legacy_20261007.currency cu
JOIN (
    SELECT id, company_id, code,
           ROW_NUMBER() OVER (PARTITION BY company_id, code ORDER BY (sync_source = 'subsidiary'), id) AS rn
    FROM c168_net_legacy_20261007.currency
) s ON s.company_id = cu.company_id AND s.code = cu.code
WHERE s.rn = 1;

-- =============================================================================
-- 1. transactions: fresh-id mapping for the rows new since the baseline.
-- =============================================================================
CREATE TEMPORARY TABLE _new_txn_map (
    legacy_id INT NOT NULL PRIMARY KEY,
    new_id    INT NOT NULL UNIQUE
);
SET @base_txn := (SELECT MAX(id) FROM transactions);
INSERT INTO _new_txn_map (legacy_id, new_id)
SELECT x.legacy_id, @base_txn + x.rn
FROM (
    SELECT t.id AS legacy_id, ROW_NUMBER() OVER (ORDER BY t.id) AS rn
    FROM c168_net_legacy_20261007.transactions t
    JOIN c168_net_legacy_20261007.company c ON c.id = t.company_id
    JOIN tenant ten ON ten.tenant_type = 'COMPANY' AND ten.code = c.company_id
    JOIN _map_currency mc ON mc.old_currency_id = t.currency_id
    WHERE t.id NOT IN (SELECT id FROM c168_net_legacy_20260929.transactions)
      -- re-run guard (description is excluded on purpose: Bank Process lines are rewritten afterwards)
      AND NOT EXISTS (
          SELECT 1 FROM transactions x
          WHERE x.tenant_id = ten.id AND x.transaction_type = t.transaction_type AND x.account_id = t.account_id
            AND x.from_account_id <=> t.from_account_id AND x.currency_id = mc.survivor_id
            AND ABS(x.amount - t.amount) < 0.000001 AND x.transaction_date = t.transaction_date
            AND x.created_at <=> t.created_at
      )
) x;
SELECT 'new legacy transactions mapped to fresh ids' AS step, COUNT(*) AS n FROM _new_txn_map;

INSERT INTO transactions (
    id, tenant_id, transaction_type, account_id, from_account_id, currency_id, amount,
    transaction_date, description, remark, created_by, approval_status, approved_by, approved_at,
    created_at, updated_at
)
SELECT
    nm.new_id, ten.id, t.transaction_type, t.account_id, t.from_account_id, mc.survivor_id, t.amount,
    t.transaction_date, t.description, t.sms,
    COALESCE(u1.login_id, o1.owner_code), t.approval_status,
    COALESCE(u2.login_id, o2.owner_code), t.approved_at, t.created_at, t.updated_at
FROM c168_net_legacy_20261007.transactions t
JOIN _new_txn_map nm ON nm.legacy_id = t.id
JOIN c168_net_legacy_20261007.company c ON c.id = t.company_id
JOIN tenant ten ON ten.tenant_type = 'COMPANY' AND ten.code = c.company_id
JOIN _map_currency mc ON mc.old_currency_id = t.currency_id
LEFT JOIN user u1 ON u1.id = t.created_by
LEFT JOIN owner o1 ON o1.id = t.created_by_owner
LEFT JOIN user u2 ON u2.id = t.approved_by
LEFT JOIN owner o2 ON o2.id = t.approved_by_owner;
SELECT 'transactions inserted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 2. transactions_rate: new rate groups; rate_group_id on the two legs.
-- =============================================================================
CREATE TEMPORARY TABLE _resolve_rate (
    rate_group_id VARCHAR(50) NOT NULL PRIMARY KEY,
    leg1_id       INT NOT NULL,
    leg2_id       INT NOT NULL
);
INSERT INTO _resolve_rate (rate_group_id, leg1_id, leg2_id)
SELECT tr.rate_group_id, tr.transaction_id, trd.transaction_id
FROM c168_net_legacy_20261007.transactions_rate tr
JOIN c168_net_legacy_20261007.transactions_rate_details trd
    ON trd.rate_group_id = tr.rate_group_id AND trd.record_type = 'transfer_to'
WHERE tr.rate_group_id NOT IN (SELECT rate_group_id FROM c168_net_legacy_20260929.transactions_rate);

INSERT INTO transactions_rate (
    tenant_id, rate_group_id, leg1_transaction_id, leg2_transaction_id, exchange_rate,
    currency_from_id, amount_from, currency_to_id, amount_to,
    middleman_account_id, middleman_rate, middleman_amount, created_at, updated_at
)
SELECT
    ten.id, tr.rate_group_id,
    COALESCE(nm1.new_id, r.leg1_id), COALESCE(nm2.new_id, r.leg2_id),
    tr.exchange_rate, mcf.survivor_id, tr.rate_from_amount, mct.survivor_id, tr.rate_to_amount,
    tr.rate_middleman_account_id, tr.rate_middleman_rate, tr.rate_middleman_amount,
    tr.created_at, tr.updated_at
FROM c168_net_legacy_20261007.transactions_rate tr
JOIN _resolve_rate r ON r.rate_group_id = tr.rate_group_id
JOIN c168_net_legacy_20261007.company c ON c.id = tr.company_id
JOIN tenant ten ON ten.tenant_type = 'COMPANY' AND ten.code = c.company_id
JOIN _map_currency mcf ON mcf.old_currency_id = tr.rate_from_currency_id
JOIN _map_currency mct ON mct.old_currency_id = tr.rate_to_currency_id
LEFT JOIN _new_txn_map nm1 ON nm1.legacy_id = r.leg1_id
LEFT JOIN _new_txn_map nm2 ON nm2.legacy_id = r.leg2_id
WHERE NOT EXISTS (SELECT 1 FROM transactions_rate x WHERE x.rate_group_id = tr.rate_group_id);
SELECT 'transactions_rate inserted' AS step, ROW_COUNT() AS n;

UPDATE transactions t
JOIN transactions_rate x ON x.leg1_transaction_id = t.id OR x.leg2_transaction_id = t.id
SET t.rate_group_id = x.rate_group_id
WHERE t.rate_group_id IS NULL
  AND x.rate_group_id IN (SELECT rate_group_id FROM _resolve_rate);
SELECT 'transactions.rate_group_id set on legs' AS step, ROW_COUNT() AS n;

DROP TEMPORARY TABLE _resolve_rate;

-- =============================================================================
-- 3. transactions_deleted: new rows since the baseline (fresh surrogate key).
-- =============================================================================
INSERT INTO transactions_deleted (
    tenant_id, transaction_id, transaction_type, account_id, from_account_id, currency_id, amount,
    transaction_date, description, remark, created_by, created_at, deleted_by, deleted_at
)
SELECT
    ten.id, td.transaction_id, td.transaction_type, td.account_id, td.from_account_id,
    mc.survivor_id, td.amount, td.transaction_date, td.description, td.sms,
    COALESCE(u1.login_id, o1.owner_code), td.created_at,
    COALESCE(u2.login_id, o2.owner_code), td.deleted_at
FROM c168_net_legacy_20261007.transactions_deleted td
JOIN c168_net_legacy_20261007.company c ON c.id = td.company_id
JOIN tenant ten ON ten.tenant_type = 'COMPANY' AND ten.code = c.company_id
JOIN account a ON a.id = td.account_id
LEFT JOIN _map_currency mc ON mc.old_currency_id = td.currency_id
LEFT JOIN user u1 ON u1.id = td.created_by
LEFT JOIN owner o1 ON o1.id = td.created_by_owner
LEFT JOIN user u2 ON u2.id = td.deleted_by_user_id
LEFT JOIN owner o2 ON o2.id = td.deleted_by_owner_id
WHERE td.transaction_type IN ('WIN','LOSE','PAYMENT','CONTRA','CLAIM','RATE','CLEAR','ADJUSTMENT')
  AND td.id NOT IN (SELECT id FROM c168_net_legacy_20260929.transactions_deleted)
  AND NOT EXISTS (
      SELECT 1 FROM transactions_deleted x
      WHERE x.tenant_id = ten.id AND x.transaction_id = td.transaction_id AND x.deleted_at = td.deleted_at
  );
SELECT 'transactions_deleted inserted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 4. bank_process_accounting_posted ledger.
--    _pap7 / _pap9 = legacy process_accounting_posted (source / baseline) in the new shape;
--    _dis7 / _dis9 = legacy process_accounting_due_dismissed (always SKIPPED).
-- =============================================================================
CREATE TEMPORARY TABLE _pap7 (
    id INT PRIMARY KEY, tenant_id INT UNSIGNED, bank_process_id INT UNSIGNED, posted_date DATE,
    raw_type VARCHAR(60), period_type VARCHAR(30), outcome VARCHAR(10), created_at TIMESTAMP NULL, rn INT,
    KEY k (tenant_id, bank_process_id, posted_date, period_type)
);
INSERT INTO _pap7 (id, tenant_id, bank_process_id, posted_date, raw_type, period_type, outcome, created_at, rn)
SELECT q.id, q.tenant_id, q.bank_process_id, q.posted_date, q.raw_type, q.period_type, q.outcome, q.created_at,
       ROW_NUMBER() OVER (PARTITION BY q.tenant_id, q.bank_process_id, q.posted_date, q.period_type
                          ORDER BY (q.outcome = 'SKIPPED') ASC, q.id ASC)
FROM (
    SELECT p.id, ten.id AS tenant_id, p.process_id AS bank_process_id, p.posted_date, p.period_type AS raw_type,
        CASE
            WHEN p.base_type = 'day_end_tail'              THEN 'DAY_END_TAIL'
            WHEN p.base_type = 'manual_inactive'           THEN 'COMPENSATION'
            WHEN p.base_type = 'once_one_off'              THEN 'ONCE_ONE_OFF'
            WHEN p.base_type = 'partial_first_month'       THEN 'PARTIAL_FIRST_MONTH'
            WHEN p.base_type = 'resend_consolidated_range' THEN 'RESEND_CONSOLIDATED'
            WHEN p.base_type = 'monthly' AND bp.frequency = 'FIRST_OF_EVERY_MONTH'
                 AND YEAR(p.posted_date) = YEAR(bp.day_start) AND MONTH(p.posted_date) = MONTH(bp.day_start) THEN 'FIRST_MONTH'
            WHEN p.base_type = 'monthly' AND bp.frequency = 'FIRST_OF_EVERY_MONTH' THEN 'FULL_MONTH'
            WHEN p.base_type = 'monthly'                   THEN 'MONTHLY'
        END AS period_type,
        CASE WHEN p.period_type LIKE '%\_skipped' OR p.period_type = 'resend_consolidated_range_skippe' THEN 'SKIPPED' ELSE 'POSTED' END AS outcome,
        p.created_at
    FROM (
        SELECT pp.*,
            CASE
                WHEN pp.period_type = 'resend_consolidated_range_skippe' THEN 'resend_consolidated_range'
                WHEN pp.period_type LIKE '%\_skipped' THEN LEFT(pp.period_type, LENGTH(pp.period_type) - 8)
                ELSE pp.period_type
            END AS base_type
        FROM c168_net_legacy_20261007.process_accounting_posted pp
    ) p
    JOIN c168_net_legacy_20261007.company c ON c.id = p.company_id
    JOIN tenant ten ON ten.tenant_type = 'COMPANY' AND ten.code = c.company_id
    JOIN bank_process bp ON bp.id = p.process_id
    WHERE p.base_type <> 'rejected'
) q
WHERE q.period_type IS NOT NULL;
SELECT 'legacy posted rows (L07) resolved to the new ledger shape' AS step, COUNT(*) AS n FROM _pap7;

CREATE TEMPORARY TABLE _pap9 (
    id INT PRIMARY KEY, tenant_id INT UNSIGNED, bank_process_id INT UNSIGNED, posted_date DATE, period_type VARCHAR(30)
);
INSERT INTO _pap9 (id, tenant_id, bank_process_id, posted_date, period_type)
SELECT p.id, ten.id, p.process_id, p.posted_date,
    CASE
        WHEN p.base_type = 'day_end_tail'              THEN 'DAY_END_TAIL'
        WHEN p.base_type = 'manual_inactive'           THEN 'COMPENSATION'
        WHEN p.base_type = 'once_one_off'              THEN 'ONCE_ONE_OFF'
        WHEN p.base_type = 'partial_first_month'       THEN 'PARTIAL_FIRST_MONTH'
        WHEN p.base_type = 'resend_consolidated_range' THEN 'RESEND_CONSOLIDATED'
        WHEN p.base_type = 'monthly' AND bp.frequency = 'FIRST_OF_EVERY_MONTH'
             AND YEAR(p.posted_date) = YEAR(bp.day_start) AND MONTH(p.posted_date) = MONTH(bp.day_start) THEN 'FIRST_MONTH'
        WHEN p.base_type = 'monthly' AND bp.frequency = 'FIRST_OF_EVERY_MONTH' THEN 'FULL_MONTH'
        WHEN p.base_type = 'monthly'                   THEN 'MONTHLY'
    END
FROM (
    SELECT pp.*,
        CASE
            WHEN pp.period_type = 'resend_consolidated_range_skippe' THEN 'resend_consolidated_range'
            WHEN pp.period_type LIKE '%\_skipped' THEN LEFT(pp.period_type, LENGTH(pp.period_type) - 8)
            ELSE pp.period_type
        END AS base_type
    FROM c168_net_legacy_20260929.process_accounting_posted pp
) p
JOIN c168_net_legacy_20260929.company c ON c.id = p.company_id
JOIN tenant ten ON ten.tenant_type = 'COMPANY' AND ten.code = c.company_id
JOIN bank_process bp ON bp.id = p.process_id
WHERE p.base_type <> 'rejected';

CREATE TEMPORARY TABLE _dis7 (
    id INT PRIMARY KEY, tenant_id INT UNSIGNED, bank_process_id INT UNSIGNED, posted_date DATE, period_type VARCHAR(30),
    created_at TIMESTAMP NULL, KEY k (tenant_id, bank_process_id, posted_date, period_type)
);
INSERT INTO _dis7 (id, tenant_id, bank_process_id, posted_date, period_type, created_at)
SELECT d.id, ten.id, d.process_id, d.anchor_date,
    CASE
        WHEN d.period_type = 'resend_monthly_reopen' THEN
            CASE WHEN bp.frequency = 'FIRST_OF_EVERY_MONTH' AND YEAR(d.anchor_date) = YEAR(bp.day_start)
                      AND MONTH(d.anchor_date) = MONTH(bp.day_start) THEN 'FIRST_MONTH'
                 WHEN bp.frequency = 'FIRST_OF_EVERY_MONTH' THEN 'FULL_MONTH'
                 ELSE 'MONTHLY' END
        WHEN d.period_type = 'resend_consolidated_range' THEN 'RESEND_CONSOLIDATED'
        WHEN d.period_type = 'monthly' AND bp.frequency = 'FIRST_OF_EVERY_MONTH'
             AND YEAR(d.anchor_date) = YEAR(bp.day_start) AND MONTH(d.anchor_date) = MONTH(bp.day_start) THEN 'FIRST_MONTH'
        WHEN d.period_type = 'monthly' AND bp.frequency = 'FIRST_OF_EVERY_MONTH' THEN 'FULL_MONTH'
        WHEN d.period_type = 'monthly' THEN 'MONTHLY'
    END,
    d.created_at
FROM c168_net_legacy_20261007.process_accounting_due_dismissed d
JOIN c168_net_legacy_20261007.company c ON c.id = d.company_id
JOIN tenant ten ON ten.tenant_type = 'COMPANY' AND ten.code = c.company_id
JOIN bank_process bp ON bp.id = d.process_id;

CREATE TEMPORARY TABLE _dis9 (
    id INT PRIMARY KEY, tenant_id INT UNSIGNED, bank_process_id INT UNSIGNED, posted_date DATE, period_type VARCHAR(30)
);
INSERT INTO _dis9 (id, tenant_id, bank_process_id, posted_date, period_type)
SELECT d.id, ten.id, d.process_id, d.anchor_date,
    CASE
        WHEN d.period_type = 'resend_monthly_reopen' THEN
            CASE WHEN bp.frequency = 'FIRST_OF_EVERY_MONTH' AND YEAR(d.anchor_date) = YEAR(bp.day_start)
                      AND MONTH(d.anchor_date) = MONTH(bp.day_start) THEN 'FIRST_MONTH'
                 WHEN bp.frequency = 'FIRST_OF_EVERY_MONTH' THEN 'FULL_MONTH'
                 ELSE 'MONTHLY' END
        WHEN d.period_type = 'resend_consolidated_range' THEN 'RESEND_CONSOLIDATED'
        WHEN d.period_type = 'monthly' AND bp.frequency = 'FIRST_OF_EVERY_MONTH'
             AND YEAR(d.anchor_date) = YEAR(bp.day_start) AND MONTH(d.anchor_date) = MONTH(bp.day_start) THEN 'FIRST_MONTH'
        WHEN d.period_type = 'monthly' AND bp.frequency = 'FIRST_OF_EVERY_MONTH' THEN 'FULL_MONTH'
        WHEN d.period_type = 'monthly' THEN 'MONTHLY'
    END
FROM c168_net_legacy_20260929.process_accounting_due_dismissed d
JOIN c168_net_legacy_20260929.company c ON c.id = d.company_id
JOIN tenant ten ON ten.tenant_type = 'COMPANY' AND ten.code = c.company_id
JOIN bank_process bp ON bp.id = d.process_id;

-- 4a. SKIPPED rows legacy no longer wants: key was wanted at the baseline (posted-skipped or dismissed) and is not
--     wanted by the source any more. Only plain SKIPPED rows without a linked transaction, never the INACTIVE auto-skips.
DELETE b
FROM bank_process_accounting_posted b
WHERE b.outcome = 'SKIPPED'
  AND (b.skip_reason IS NULL OR b.skip_reason <> 'INACTIVE')
  AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.bank_process_posted_id = b.id)
  AND (
        EXISTS (SELECT 1 FROM _pap9 o WHERE o.tenant_id = b.tenant_id AND o.bank_process_id = b.bank_process_id
                AND o.posted_date = b.posted_date AND o.period_type = b.period_type)
     OR EXISTS (SELECT 1 FROM _dis9 o WHERE o.tenant_id = b.tenant_id AND o.bank_process_id = b.bank_process_id
                AND o.posted_date = b.posted_date AND o.period_type = b.period_type)
  )
  AND NOT EXISTS (SELECT 1 FROM _pap7 n WHERE n.tenant_id = b.tenant_id AND n.bank_process_id = b.bank_process_id
                  AND n.posted_date = b.posted_date AND n.period_type = b.period_type)
  AND NOT EXISTS (SELECT 1 FROM _dis7 n WHERE n.tenant_id = b.tenant_id AND n.bank_process_id = b.bank_process_id
                  AND n.posted_date = b.posted_date AND n.period_type = b.period_type);
SELECT 'ledger SKIPPED rows deleted (legacy dropped them)' AS step, ROW_COUNT() AS n;

-- 4b. new ledger rows from process_accounting_posted (fresh ids; POSTED wins over SKIPPED for the same key).
CREATE TEMPORARY TABLE _new_bap_map (
    legacy_id INT NOT NULL PRIMARY KEY,
    new_id    INT NOT NULL UNIQUE
);
SET @base_bap := (SELECT MAX(id) FROM bank_process_accounting_posted);
INSERT INTO _new_bap_map (legacy_id, new_id)
SELECT x.id, @base_bap + ROW_NUMBER() OVER (ORDER BY x.id)
FROM (
    SELECT n.id
    FROM _pap7 n
    WHERE n.rn = 1
      AND n.id NOT IN (SELECT id FROM c168_net_legacy_20260929.process_accounting_posted)
      AND NOT EXISTS (
          SELECT 1 FROM bank_process_accounting_posted bap
          WHERE bap.tenant_id = n.tenant_id AND bap.bank_process_id = n.bank_process_id
            AND bap.posted_date = n.posted_date AND bap.period_type = n.period_type
      )
) x;

INSERT INTO bank_process_accounting_posted (id, tenant_id, bank_process_id, posted_date, period_type, outcome, created_at)
SELECT nm.new_id, n.tenant_id, n.bank_process_id, n.posted_date, n.period_type, n.outcome, n.created_at
FROM _pap7 n
JOIN _new_bap_map nm ON nm.legacy_id = n.id;
SELECT 'ledger rows inserted from process_accounting_posted' AS step, ROW_COUNT() AS n;

-- 4c. new ledger rows from process_accounting_due_dismissed (always SKIPPED, auto-increment id).
INSERT INTO bank_process_accounting_posted (tenant_id, bank_process_id, posted_date, period_type, outcome, created_at)
SELECT d.tenant_id, d.bank_process_id, d.posted_date, d.period_type, 'SKIPPED', d.created_at
FROM _dis7 d
WHERE d.period_type IS NOT NULL
  AND d.id NOT IN (SELECT id FROM c168_net_legacy_20260929.process_accounting_due_dismissed)
  AND NOT EXISTS (
      SELECT 1 FROM bank_process_accounting_posted bap
      WHERE bap.tenant_id = d.tenant_id AND bap.bank_process_id = d.bank_process_id
        AND bap.posted_date = d.posted_date AND bap.period_type = d.period_type
  );
SELECT 'ledger rows inserted from process_accounting_due_dismissed' AS step, ROW_COUNT() AS n;

-- 4d. A ledger row that existed as SKIPPED while legacy has since POSTED the same period: legacy wins, the row becomes
--     POSTED (otherwise its new transactions would hang on a SKIPPED row). INACTIVE auto-skips are never flipped.
UPDATE bank_process_accounting_posted b
JOIN _pap7 n ON n.tenant_id = b.tenant_id AND n.bank_process_id = b.bank_process_id
            AND n.posted_date = b.posted_date AND n.period_type = b.period_type
SET b.outcome = 'POSTED', b.skip_reason = NULL
WHERE b.outcome = 'SKIPPED' AND (b.skip_reason IS NULL OR b.skip_reason <> 'INACTIVE')
  AND n.outcome = 'POSTED' AND n.rn = 1;
SELECT 'ledger rows flipped SKIPPED -> POSTED (legacy posted them)' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 5. transactions.bank_process_posted_id for the NEW Bank Process transactions
--    (legacy transaction -> legacy posted row -> ledger row through the natural key).
-- =============================================================================
UPDATE transactions t
JOIN _new_txn_map ntm ON ntm.new_id = t.id
JOIN c168_net_legacy_20261007.transactions lt ON lt.id = ntm.legacy_id
JOIN _pap7 lp ON lp.bank_process_id = lt.source_bank_process_id
             AND lp.posted_date = lt.transaction_date
             AND lp.raw_type = lt.source_bank_process_period_type
             AND lp.outcome = 'POSTED'
JOIN bank_process_accounting_posted bap
    ON bap.tenant_id = lp.tenant_id AND bap.bank_process_id = lp.bank_process_id
   AND bap.posted_date = lp.posted_date AND bap.period_type = lp.period_type
SET t.bank_process_posted_id = bap.id
WHERE lt.source_bank_process_id IS NOT NULL AND t.bank_process_posted_id IS NULL;
SELECT 'new Bank Process transactions linked to the ledger' AS step, ROW_COUNT() AS n;

SELECT 'new Bank Process transactions NOT linked (should be 0)' AS step, COUNT(*) AS n
FROM transactions t
JOIN _new_txn_map ntm ON ntm.new_id = t.id
JOIN c168_net_legacy_20261007.transactions lt ON lt.id = ntm.legacy_id
WHERE lt.source_bank_process_id IS NOT NULL AND t.bank_process_posted_id IS NULL;

DROP TEMPORARY TABLE _new_bap_map;
DROP TEMPORARY TABLE _dis9;
DROP TEMPORARY TABLE _dis7;
DROP TEMPORARY TABLE _pap9;
DROP TEMPORARY TABLE _pap7;
DROP TEMPORARY TABLE _new_txn_map;
DROP TEMPORARY TABLE _map_currency;

COMMIT;
