-- Bank Process data: local count_real (aligned with legacy 2026-10-07) -> production count168_site.
-- Scope: bank_country, bank_option, bank_process(+share, resend guard), bank_process_accounting_posted and the
-- bank-process transactions, plus the accounts the new contracts need (and their access/currency/ACL rows).
--
-- Tokens (replace with sed before running):
--   __TGT__  target schema   (production: count168_site | rehearsal: prod_snap2)
--   __SRC__  source schema   (production: bp_src staging copy | rehearsal: count_real)
-- Example: sed 's/__TGT__/prod_snap2/g; s/__SRC__/count_real/g' prod_bank_process_migration_20261007.sql | mysql -u root
--
-- Decisions (confirmed by the user):
--   * bank_process: local (= legacy) wins on every column of the shared contracts; new contracts are inserted.
--   * ledger: matched by natural key (tenant, bank_process, posted_date, period_type) - ids differ between systems.
--     Local-only keys are inserted with NEW ids; prod-only rows are kept untouched. A key that is SKIPPED in prod
--     but POSTED locally is upgraded to POSTED (legacy truth). A POSTED prod key is never downgraded.
--   * transactions: only those belonging to ledger keys brought over by this script (never to keys prod already
--     posted - that would double count); they get NEW ids; ledger id remapped by natural key.
--   * rows created by the JK user on 2026-10-07 in the local DB are verification clicks: excluded.
--   * not included: transactions_deleted (bank_process_posted_id backfill) and all non-bank data.
--
-- ID COLLISIONS (prod keeps creating rows while local was working on the same id range):
--   * the script never trusts an id: new contracts and new accounts keep their local id only if it is still free in
--     prod, otherwise they get a fresh id (max+n) and every reference (share, guard, ledger, transactions, contract
--     account columns, account ACL) is remapped through _bpmap / _accmap;
--   * the PREFLIGHT below aborts (SIGNAL) when a shared id points at a DIFFERENT row on the two sides, instead of
--     silently overwriting prod data.
-- Idempotent: every INSERT is guarded; re-running changes nothing more. Dry run: replace the final COMMIT by ROLLBACK.

USE __TGT__;
-- the prod client defaults to utf8mb4_general_ci while the tables are utf8mb4_unicode_ci (user variables would clash)
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET @excl_by   = 'JK';
SET @excl_from = '2026-10-07 00:00:00';
-- highest ids that existed in BOTH systems when the local DB was cut from prod (prod backup 2026-10-07 16:13).
-- Above these, an id clash means "different row" and the local row is remapped; at or below, a clash aborts.
SET @max_shared_bp  = 785;

-- ---------------------------------------------------------------- 0. PREFLIGHT (aborts on identity conflicts)
DROP PROCEDURE IF EXISTS _bp_preflight;
DELIMITER //
CREATE PROCEDURE _bp_preflight()
BEGIN
  IF EXISTS (SELECT 1 FROM __SRC__.bank_process s JOIN __TGT__.bank_process t ON t.id = s.id
             WHERE s.id <= @max_shared_bp AND NOT (t.tenant_id = s.tenant_id AND t.created_at <=> s.created_at)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PREFLIGHT: a shared bank_process id is a different contract in prod (tenant/created_at differ)';
  END IF;
  IF EXISTS (SELECT 1 FROM __SRC__.bank_country s JOIN __TGT__.bank_country t ON t.id = s.id WHERE NOT (t.tenant_id = s.tenant_id AND t.code = s.code))
     OR EXISTS (SELECT 1 FROM __SRC__.bank_option s JOIN __TGT__.bank_option t ON t.id = s.id
                WHERE NOT (t.tenant_id = s.tenant_id AND t.country_id = s.country_id AND t.name = s.name)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PREFLIGHT: a shared bank_country/bank_option id is a different row in prod';
  END IF;
  IF EXISTS (SELECT 1 FROM __SRC__.bank_process s WHERE NOT EXISTS (SELECT 1 FROM __TGT__.tenant t WHERE t.id = s.tenant_id)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PREFLIGHT: a contract belongs to a tenant that does not exist in prod';
  END IF;
  IF EXISTS (SELECT 1 FROM __SRC__.bank_process s WHERE NOT EXISTS (SELECT 1 FROM __TGT__.bank_country c WHERE c.id = s.country_id)
                                                       AND NOT EXISTS (SELECT 1 FROM __SRC__.bank_country c WHERE c.id = s.country_id AND EXISTS (SELECT 1 FROM __TGT__.tenant t WHERE t.id = c.tenant_id)))
     OR EXISTS (SELECT 1 FROM __SRC__.bank_process s WHERE NOT EXISTS (SELECT 1 FROM __TGT__.bank_option o WHERE o.id = s.bank_option_id)
                                                       AND NOT EXISTS (SELECT 1 FROM __SRC__.bank_option o WHERE o.id = s.bank_option_id AND EXISTS (SELECT 1 FROM __TGT__.tenant t WHERE t.id = o.tenant_id))) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PREFLIGHT: a contract uses a bank_country/bank_option that prod does not have and cannot receive';
  END IF;
END //
DELIMITER ;
CALL _bp_preflight();
DROP PROCEDURE _bp_preflight;

START TRANSACTION;

-- ---------------------------------------------------------------- 1. reference tables (natural key; contracts keep using the same ids, verified by preflight)
INSERT INTO __TGT__.bank_country (id, tenant_id, code, created_at)
SELECT s.id, s.tenant_id, s.code, s.created_at FROM __SRC__.bank_country s
WHERE EXISTS (SELECT 1 FROM __TGT__.tenant tn WHERE tn.id = s.tenant_id)   -- e.g. tenant 38 (TT) does not exist in prod: skipped
  AND NOT EXISTS (SELECT 1 FROM __TGT__.bank_country t WHERE t.tenant_id = s.tenant_id AND t.code = s.code)
  AND NOT EXISTS (SELECT 1 FROM __TGT__.bank_country t WHERE t.id = s.id);
SELECT ROW_COUNT() AS bank_country_inserted;

INSERT INTO __TGT__.bank_option (id, tenant_id, country_id, name, is_selected, created_at)
SELECT s.id, s.tenant_id, s.country_id, s.name, s.is_selected, s.created_at FROM __SRC__.bank_option s
WHERE EXISTS (SELECT 1 FROM __TGT__.tenant tn WHERE tn.id = s.tenant_id)
  AND EXISTS (SELECT 1 FROM __TGT__.bank_country c WHERE c.id = s.country_id)
  AND NOT EXISTS (SELECT 1 FROM __TGT__.bank_option t WHERE t.country_id = s.country_id AND t.name = s.name)
  AND NOT EXISTS (SELECT 1 FROM __TGT__.bank_option t WHERE t.id = s.id);
SELECT ROW_COUNT() AS bank_option_inserted;

-- ---------------------------------------------------------------- 2. accounts the bank data needs but prod lacks (matched by account code)
CREATE TEMPORARY TABLE _need_acc (id INT UNSIGNED PRIMARY KEY);
INSERT IGNORE INTO _need_acc SELECT supplier_account_id FROM __SRC__.bank_process WHERE supplier_account_id IS NOT NULL;
INSERT IGNORE INTO _need_acc SELECT customer_account_id FROM __SRC__.bank_process WHERE customer_account_id IS NOT NULL;
INSERT IGNORE INTO _need_acc SELECT company_account_id FROM __SRC__.bank_process WHERE company_account_id IS NOT NULL;
INSERT IGNORE INTO _need_acc SELECT account_id FROM __SRC__.bank_process_share;
INSERT IGNORE INTO _need_acc SELECT account_id FROM __SRC__.transactions WHERE bank_process_posted_id IS NOT NULL;
INSERT IGNORE INTO _need_acc SELECT from_account_id FROM __SRC__.transactions WHERE bank_process_posted_id IS NOT NULL AND from_account_id IS NOT NULL;
-- an account needs nothing only if prod has the SAME account (same id AND same code); a clash of id with another
-- code (e.g. local 6175 CS009 vs prod 6175 MG, created independently) is remapped below
DELETE FROM _need_acc WHERE id IN (SELECT t.id FROM __TGT__.account t JOIN __SRC__.account s ON s.id = t.id AND s.account_id = t.account_id);

-- _accmap: local account id -> prod account id (only for accounts that must be created or live under another id)
CREATE TEMPORARY TABLE _accmap (lid INT UNSIGNED PRIMARY KEY, pid INT UNSIGNED NULL);
INSERT INTO _accmap (lid, pid)
SELECT n.id, (SELECT t.id FROM __TGT__.account t WHERE t.account_id = s.account_id) FROM _need_acc n JOIN __SRC__.account s ON s.id = n.id;
-- not in prod by code: keep the local id when free, otherwise a fresh id above both sides' maximum
UPDATE _accmap m SET m.pid = m.lid
WHERE m.pid IS NULL AND NOT EXISTS (SELECT 1 FROM __TGT__.account t WHERE t.id = m.lid);
SET @n = GREATEST((SELECT MAX(id) FROM __TGT__.account), (SELECT MAX(id) FROM __SRC__.account));
UPDATE _accmap SET pid = (@n := @n + 1) WHERE pid IS NULL ORDER BY lid;
SELECT lid AS local_account_id, pid AS prod_account_id FROM _accmap ORDER BY lid;

INSERT INTO __TGT__.account (id, account_id, name, password, role, status, created_source, payment_alert, alert_day,
                             alert_specific_date, alert_amount, remark, last_login, last_logout, created_at)
SELECT m.pid, s.account_id, s.name, s.password, s.role, s.status, s.created_source, s.payment_alert, s.alert_day,
       s.alert_specific_date, s.alert_amount, s.remark, s.last_login, s.last_logout, s.created_at
FROM __SRC__.account s JOIN _accmap m ON m.lid = s.id
WHERE NOT EXISTS (SELECT 1 FROM __TGT__.account t WHERE t.account_id = s.account_id);
SELECT ROW_COUNT() AS account_inserted;

INSERT INTO __TGT__.account_tenant_access (account_id, tenant_id, created_at, updated_at)
SELECT m.pid, s.tenant_id, s.created_at, s.updated_at FROM __SRC__.account_tenant_access s JOIN _accmap m ON m.lid = s.account_id
WHERE EXISTS (SELECT 1 FROM __TGT__.tenant tn WHERE tn.id = s.tenant_id)
  AND NOT EXISTS (SELECT 1 FROM __TGT__.account_tenant_access t WHERE t.account_id = m.pid AND t.tenant_id = s.tenant_id);
SELECT ROW_COUNT() AS account_tenant_access_inserted;

INSERT INTO __TGT__.account_currency (account_id, tenant_id, currency_id, sort_order, created_at, updated_at)
SELECT m.pid, s.tenant_id, s.currency_id, s.sort_order, s.created_at, s.updated_at FROM __SRC__.account_currency s JOIN _accmap m ON m.lid = s.account_id
WHERE EXISTS (SELECT 1 FROM __TGT__.currency c WHERE c.id = s.currency_id)
  AND NOT EXISTS (SELECT 1 FROM __TGT__.account_currency t WHERE t.account_id = m.pid AND t.tenant_id = s.tenant_id AND t.currency_id = s.currency_id);
SELECT ROW_COUNT() AS account_currency_inserted;

INSERT INTO __TGT__.user_tenant_account_access (user_tenant_access_id, account_id, created_at)
SELECT s.user_tenant_access_id, m.pid, s.created_at FROM __SRC__.user_tenant_account_access s JOIN _accmap m ON m.lid = s.account_id
WHERE EXISTS (SELECT 1 FROM __TGT__.user_tenant_access u WHERE u.id = s.user_tenant_access_id)
  AND NOT EXISTS (SELECT 1 FROM __TGT__.user_tenant_account_access t WHERE t.user_tenant_access_id = s.user_tenant_access_id AND t.account_id = m.pid);
SELECT ROW_COUNT() AS user_tenant_account_access_inserted;

-- ---------------------------------------------------------------- 3. bank_process (local wins on shared contracts)
-- _bpmap: local contract id -> prod contract id
CREATE TEMPORARY TABLE _bpmap (lid INT UNSIGNED PRIMARY KEY, pid INT UNSIGNED NULL);
-- shared contracts map to themselves; new ones keep their id when free, else get a fresh one (remapped everywhere below)
INSERT INTO _bpmap (lid, pid)
-- 1) the same contract already in prod (tenant + created_at + owner + term + creator; covers a previous run that remapped it)
-- 2) otherwise its own id when free, 3) otherwise NULL -> fresh id below
SELECT s.id,
       COALESCE((SELECT MIN(t.id) FROM __TGT__.bank_process t WHERE t.tenant_id = s.tenant_id AND t.created_at <=> s.created_at
                   AND t.card_owner <=> s.card_owner AND t.day_start <=> s.day_start AND t.created_by <=> s.created_by),
                IF(NOT EXISTS (SELECT 1 FROM __TGT__.bank_process t WHERE t.id = s.id), s.id, NULL))
FROM __SRC__.bank_process s;
SET @n = GREATEST((SELECT MAX(id) FROM __TGT__.bank_process), (SELECT MAX(id) FROM __SRC__.bank_process));
UPDATE _bpmap SET pid = (@n := @n + 1) WHERE pid IS NULL ORDER BY lid;
SELECT lid AS local_contract_id, pid AS prod_contract_id FROM _bpmap WHERE lid <> pid;

INSERT INTO __TGT__.bank_process
    (id, tenant_id, country_id, bank_option_id, card_owner, card_owner_type, day_start, day_end, day_end_monthly_cap_enabled,
     expired_at_creation, due_generation_floor, due_closed, frequency, supplier_account_id, supplier_price, customer_account_id,
     customer_price, company_account_id, company_price, contract, insurance_price, sop, remark, status, resend_schedule_day_start,
     resend_schedule_day_end, resend_schedule_frequency, created_by, updated_by, created_at, updated_at)
SELECT m.pid, s.tenant_id, s.country_id, s.bank_option_id, s.card_owner, s.card_owner_type, s.day_start, s.day_end,
       s.day_end_monthly_cap_enabled, s.expired_at_creation, s.due_generation_floor, s.due_closed, s.frequency,
       COALESCE((SELECT pid FROM _accmap WHERE lid = s.supplier_account_id), s.supplier_account_id), s.supplier_price,
       COALESCE((SELECT pid FROM _accmap WHERE lid = s.customer_account_id), s.customer_account_id), s.customer_price,
       COALESCE((SELECT pid FROM _accmap WHERE lid = s.company_account_id), s.company_account_id), s.company_price,
       s.contract, s.insurance_price, s.sop, s.remark, s.status, s.resend_schedule_day_start, s.resend_schedule_day_end,
       s.resend_schedule_frequency, s.created_by, s.updated_by, s.created_at, s.updated_at
FROM __SRC__.bank_process s JOIN _bpmap m ON m.lid = s.id
WHERE NOT EXISTS (SELECT 1 FROM __TGT__.bank_process t WHERE t.id = m.pid);
SELECT ROW_COUNT() AS bank_process_inserted;

UPDATE __TGT__.bank_process t JOIN _bpmap m ON m.pid = t.id JOIN __SRC__.bank_process s ON s.id = m.lid
SET t.tenant_id = s.tenant_id, t.country_id = s.country_id, t.bank_option_id = s.bank_option_id, t.card_owner = s.card_owner,
    t.card_owner_type = s.card_owner_type, t.day_start = s.day_start, t.day_end = s.day_end,
    t.day_end_monthly_cap_enabled = s.day_end_monthly_cap_enabled, t.expired_at_creation = s.expired_at_creation,
    t.due_generation_floor = s.due_generation_floor, t.due_closed = s.due_closed, t.frequency = s.frequency,
    t.supplier_account_id = COALESCE((SELECT pid FROM _accmap WHERE lid = s.supplier_account_id), s.supplier_account_id),
    t.supplier_price = s.supplier_price,
    t.customer_account_id = COALESCE((SELECT pid FROM _accmap WHERE lid = s.customer_account_id), s.customer_account_id),
    t.customer_price = s.customer_price,
    t.company_account_id = COALESCE((SELECT pid FROM _accmap WHERE lid = s.company_account_id), s.company_account_id),
    t.company_price = s.company_price, t.contract = s.contract,
    t.insurance_price = s.insurance_price, t.sop = s.sop, t.remark = s.remark, t.status = s.status,
    t.resend_schedule_day_start = s.resend_schedule_day_start, t.resend_schedule_day_end = s.resend_schedule_day_end,
    t.resend_schedule_frequency = s.resend_schedule_frequency, t.created_by = s.created_by, t.updated_by = s.updated_by,
    t.created_at = s.created_at, t.updated_at = s.updated_at
WHERE NOT (t.tenant_id <=> s.tenant_id AND t.country_id <=> s.country_id AND t.bank_option_id <=> s.bank_option_id
       AND t.card_owner <=> s.card_owner AND t.card_owner_type <=> s.card_owner_type AND t.day_start <=> s.day_start
       AND t.day_end <=> s.day_end AND t.day_end_monthly_cap_enabled <=> s.day_end_monthly_cap_enabled
       AND t.expired_at_creation <=> s.expired_at_creation AND t.due_generation_floor <=> s.due_generation_floor
       AND t.due_closed <=> s.due_closed AND t.frequency <=> s.frequency AND t.supplier_account_id <=> s.supplier_account_id
       AND t.supplier_price <=> s.supplier_price AND t.customer_account_id <=> s.customer_account_id
       AND t.customer_price <=> s.customer_price AND t.company_account_id <=> s.company_account_id
       AND t.company_price <=> s.company_price AND t.contract <=> s.contract AND t.insurance_price <=> s.insurance_price
       AND t.sop <=> s.sop AND t.remark <=> s.remark AND t.status <=> s.status
       AND t.resend_schedule_day_start <=> s.resend_schedule_day_start AND t.resend_schedule_day_end <=> s.resend_schedule_day_end
       AND t.resend_schedule_frequency <=> s.resend_schedule_frequency AND t.created_by <=> s.created_by
       AND t.updated_by <=> s.updated_by AND t.created_at <=> s.created_at AND t.updated_at <=> s.updated_at);
SELECT ROW_COUNT() AS bank_process_updated;

-- share: natural key (contract, account, amount, sort_order), new ids
INSERT INTO __TGT__.bank_process_share (bank_process_id, account_id, amount, sort_order)
SELECT m.pid, COALESCE((SELECT pid FROM _accmap WHERE lid = s.account_id), s.account_id), s.amount, s.sort_order
FROM __SRC__.bank_process_share s JOIN _bpmap m ON m.lid = s.bank_process_id
WHERE NOT EXISTS (SELECT 1 FROM __TGT__.bank_process_share t WHERE t.bank_process_id = m.pid
                  AND t.account_id = COALESCE((SELECT pid FROM _accmap WHERE lid = s.account_id), s.account_id)
                  AND t.amount = s.amount AND t.sort_order = s.sort_order);
SELECT ROW_COUNT() AS bank_process_share_inserted;

INSERT IGNORE INTO __TGT__.bank_process_resend_daily_guard (tenant_id, bank_process_id, resend_day_start, guard_date, created_at)
SELECT s.tenant_id, m.pid, s.resend_day_start, s.guard_date, s.created_at FROM __SRC__.bank_process_resend_daily_guard s JOIN _bpmap m ON m.lid = s.bank_process_id;
SELECT ROW_COUNT() AS resend_guard_inserted;

-- ---------------------------------------------------------------- 4. ledger (natural key; contract id remapped)
-- plan: INSERT = key missing in prod; UPGRADE = SKIPPED in prod but POSTED locally
CREATE TEMPORARY TABLE _plan AS
SELECT l.id lid, l.tenant_id, m.pid bank_process_id, l.posted_date, l.period_type,
       IF(p.id IS NULL, 'INSERT', 'UPGRADE') action
FROM __SRC__.bank_process_accounting_posted l
JOIN _bpmap m ON m.lid = l.bank_process_id
LEFT JOIN __TGT__.bank_process_accounting_posted p
       ON p.tenant_id = l.tenant_id AND p.bank_process_id = m.pid AND p.posted_date = l.posted_date AND p.period_type = l.period_type
WHERE NOT (l.created_by = @excl_by AND l.created_at >= @excl_from)
  AND (p.id IS NULL OR (p.outcome = 'SKIPPED' AND l.outcome = 'POSTED'));
SELECT action, COUNT(*) AS n FROM _plan GROUP BY action;

INSERT INTO __TGT__.bank_process_accounting_posted
    (tenant_id, bank_process_id, posted_date, period_type, outcome, skip_reason, billing_start, billing_end, created_at, created_by)
SELECT l.tenant_id, pl.bank_process_id, l.posted_date, l.period_type, l.outcome, l.skip_reason, l.billing_start, l.billing_end, l.created_at, l.created_by
FROM __SRC__.bank_process_accounting_posted l JOIN _plan pl ON pl.lid = l.id AND pl.action = 'INSERT'
ORDER BY l.id;
SELECT ROW_COUNT() AS ledger_inserted;

UPDATE __TGT__.bank_process_accounting_posted p
JOIN _plan pl ON pl.action = 'UPGRADE' AND pl.tenant_id = p.tenant_id AND pl.bank_process_id = p.bank_process_id
             AND pl.posted_date = p.posted_date AND pl.period_type = p.period_type
JOIN __SRC__.bank_process_accounting_posted l ON l.id = pl.lid
SET p.outcome = 'POSTED', p.skip_reason = NULL, p.billing_start = l.billing_start, p.billing_end = l.billing_end,
    p.created_at = l.created_at, p.created_by = l.created_by
WHERE p.outcome = 'SKIPPED';
SELECT ROW_COUNT() AS ledger_upgraded_to_posted;

-- ---------------------------------------------------------------- 5. transactions (new ids, ledger/contract/account remapped)
CREATE TEMPORARY TABLE _map AS
SELECT pl.lid, p.id pid FROM _plan pl
JOIN __TGT__.bank_process_accounting_posted p
  ON p.tenant_id = pl.tenant_id AND p.bank_process_id = pl.bank_process_id AND p.posted_date = pl.posted_date AND p.period_type = pl.period_type;

INSERT INTO __TGT__.transactions
    (tenant_id, transaction_type, account_id, from_account_id, currency_id, amount, transaction_date, description, remark,
     created_by, updated_by, approval_status, approved_by, approved_at, bank_process_posted_id, bank_process_id, rate_group_id,
     created_at, updated_at)
SELECT t.tenant_id, t.transaction_type,
       COALESCE((SELECT pid FROM _accmap WHERE lid = t.account_id), t.account_id),
       COALESCE((SELECT pid FROM _accmap WHERE lid = t.from_account_id), t.from_account_id),
       t.currency_id, t.amount, t.transaction_date, t.description, t.remark,
       t.created_by, t.updated_by, t.approval_status, t.approved_by, t.approved_at, m.pid,
       (SELECT pid FROM _bpmap WHERE lid = t.bank_process_id), t.rate_group_id,
       t.created_at, t.updated_at
FROM __SRC__.transactions t JOIN _map m ON m.lid = t.bank_process_posted_id
WHERE NOT EXISTS (SELECT 1 FROM __TGT__.transactions x WHERE x.bank_process_posted_id = m.pid)
ORDER BY t.id;
SELECT ROW_COUNT() AS transactions_inserted;

-- ---------------------------------------------------------------- 6. checks
SELECT 'ledger rows without bank_process' k, COUNT(*) FROM __TGT__.bank_process_accounting_posted p WHERE NOT EXISTS (SELECT 1 FROM __TGT__.bank_process b WHERE b.id = p.bank_process_id);
SELECT 'POSTED ledger keys that should have transactions but have none' k, COUNT(*) FROM _map m JOIN __SRC__.bank_process_accounting_posted l ON l.id = m.lid
WHERE l.outcome = 'POSTED' AND EXISTS (SELECT 1 FROM __SRC__.transactions t WHERE t.bank_process_posted_id = l.id)
  AND NOT EXISTS (SELECT 1 FROM __TGT__.transactions x WHERE x.bank_process_posted_id = m.pid);
SELECT 'contracts pointing at a missing account' k, COUNT(*) FROM __TGT__.bank_process b
WHERE (b.supplier_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM __TGT__.account a WHERE a.id = b.supplier_account_id))
   OR (b.customer_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM __TGT__.account a WHERE a.id = b.customer_account_id))
   OR (b.company_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM __TGT__.account a WHERE a.id = b.company_account_id));
SELECT 'bank_process total / due_closed' k, COUNT(*), SUM(due_closed) FROM __TGT__.bank_process;

COMMIT;
