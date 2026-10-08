-- Stage 7: apply the post-migration conversions to the rows inserted by stages 4 and 6
-- (new transactions use fresh ids >= @min_new_txn_id). Run AFTER stage 6/6b, in a transaction.
-- Idempotent, except the RATE leg2 swap, which is guarded by a marker row (runs once).
-- Reference semantics: count_real_backup (leg1 = legacy verbatim, leg2 account_id<->from_account_id swapped).
-- Dry run: replace the final COMMIT with ROLLBACK.
USE count_real;
-- First transaction id inserted by stage 6 (local run: 136790). Set per environment.
SET @min_new_txn_id = 136790;

START TRANSACTION;

CREATE TABLE IF NOT EXISTS delta_sync_marker (name VARCHAR(100) PRIMARY KEY, done_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

-- 1. RATE leg2 swap (join snapshot, NOT an inline SET swap: MariaDB assigns left to right). Once only.
UPDATE transactions t
JOIN (SELECT t2.id, t2.account_id a, t2.from_account_id f
      FROM transactions t2 JOIN transactions_rate tr ON tr.leg2_transaction_id = t2.id
      WHERE t2.id >= @min_new_txn_id AND t2.from_account_id IS NOT NULL) s ON s.id = t.id
SET t.account_id = s.f, t.from_account_id = s.a
WHERE NOT EXISTS (SELECT 1 FROM delta_sync_marker WHERE name = 'rate_leg2_swap_20261007');
INSERT IGNORE INTO delta_sync_marker (name) VALUES ('rate_leg2_swap_20261007');

-- 2. Rate-charge single-sided pair (A: account=X, from NULL; B: account=from=Y) -> one row B(account=Y, from=X) + rate_group_id
CREATE TEMPORARY TABLE _rc AS
SELECT a.id a_id, b.id b_id, a.account_id x, tr.rate_group_id g
FROM transactions a
JOIN transactions b ON b.id = a.id + 1 AND b.tenant_id = a.tenant_id AND b.description = a.description
     AND b.from_account_id = b.account_id
JOIN transactions_rate tr ON tr.tenant_id = a.tenant_id
     AND tr.amount_from = CAST(SUBSTRING_INDEX(a.description, ' ', -1) AS DECIMAL(25,8))
WHERE a.id >= @min_new_txn_id AND a.transaction_type = 'RATE' AND a.description LIKE 'Rate charge%'
  AND a.from_account_id IS NULL AND a.rate_group_id IS NULL;
UPDATE transactions b JOIN _rc ON _rc.b_id = b.id SET b.from_account_id = _rc.x, b.rate_group_id = _rc.g;
DELETE a FROM transactions a JOIN _rc ON _rc.a_id = a.id;

-- 3. Manual transfer descriptions: "TYPE FROM a TO b"
UPDATE transactions t
JOIN (SELECT t2.id, CONCAT(t2.transaction_type,' FROM ',a_from.account_id,' TO ',a_to.account_id) nd
      FROM transactions t2 JOIN account a_to ON a_to.id = t2.account_id JOIN account a_from ON a_from.id = t2.from_account_id
      WHERE t2.id >= @min_new_txn_id AND t2.transaction_type IN ('PAYMENT','CLAIM','CLEAR','CONTRA')
        AND UPPER(t2.description) LIKE CONCAT(UPPER(t2.transaction_type),' FROM %')
        AND UPPER(t2.description) NOT LIKE '% TO %') s ON s.id = t.id
SET t.description = s.nd;

-- 4. Domain fee family (account 4837 = C168 domain profit account; ids are local - verify on the target)
--    "Pay Domain Fee" [DOMAIN_LIST_FEE|x]: swap direction -> PAY DOMAIN FEE / DOMAIN_FEE
UPDATE transactions t
JOIN (SELECT id, account_id a, from_account_id f FROM transactions
      WHERE id >= @min_new_txn_id AND remark LIKE '[DOMAIN_LIST_FEE|%' AND account_id = 4837
        AND from_account_id IS NOT NULL AND from_account_id <> 4837) s ON s.id = t.id
SET t.account_id = s.f, t.from_account_id = s.a, t.description = 'PAY DOMAIN FEE', t.remark = 'DOMAIN_FEE';
--    "Profit By K" [DOMAIN_NET_PROFIT|x]: self-reference + NET PROFIT FROM K
UPDATE transactions
SET from_account_id = account_id,
    description = CONCAT('NET PROFIT FROM ', SUBSTRING_INDEX(description, ' ', -1)),
    remark = 'DOMAIN_NET_PROFIT'
WHERE id >= @min_new_txn_id AND remark LIKE '[DOMAIN_NET_PROFIT|%' AND from_account_id IS NULL AND description LIKE 'Profit By %';

-- 5. Manual PROFIT: blank-description WIN/LOSE with from_account, no capture line, not bank-process
UPDATE transactions t SET t.transaction_type = 'PROFIT'
WHERE t.id >= @min_new_txn_id AND t.transaction_type IN ('WIN','LOSE') AND t.from_account_id IS NOT NULL
  AND t.bank_process_posted_id IS NULL AND (t.description IS NULL OR t.description = '')
  AND NOT EXISTS (SELECT 1 FROM data_capture_line l WHERE l.transaction_id = t.id);

-- 6. data_capture_line currency = the legacy line's own currency (survivor map), then sync the transaction currency
--    (source DB name is fixed in this script: c168_net_legacy_20261007)
CREATE TEMPORARY TABLE _m (old_id INT PRIMARY KEY, sv INT NOT NULL);
INSERT INTO _m SELECT cu.id, s.id FROM c168_net_legacy_20261007.currency cu
JOIN (SELECT id, company_id, code, ROW_NUMBER() OVER (PARTITION BY company_id, code ORDER BY (sync_source='subsidiary'), id) rn
      FROM c168_net_legacy_20261007.currency) s ON s.company_id = cu.company_id AND s.code = cu.code WHERE s.rn = 1;
UPDATE data_capture_line dcl
JOIN c168_net_legacy_20261007.data_capture_details d ON d.id = dcl.id
JOIN c168_net_legacy_20261007.data_captures dc ON dc.id = d.capture_id
JOIN _m ON _m.old_id = d.currency_id
SET dcl.currency_id = _m.sv WHERE d.currency_id <> dc.currency_id AND dcl.currency_id <> _m.sv;
UPDATE transactions t JOIN data_capture_line dcl ON dcl.transaction_id = t.id SET t.currency_id = dcl.currency_id
WHERE dcl.currency_id <> t.currency_id;

-- 7. Formula body (legacy formula_operators), not the formula_display snapshot
UPDATE data_capture_formula f JOIN c168_net_legacy_20261007.data_capture_templates t ON t.id = f.id
SET f.formula = TRIM(t.formula_operators)
WHERE t.formula_operators IS NOT NULL AND TRIM(t.formula_operators) <> '' AND NOT (f.formula <=> TRIM(t.formula_operators));

-- 8. transactions_deleted.bank_process_posted_id backfill from legacy source_bank_process_*
CREATE TEMPORARY TABLE _r AS
SELECT td.id td_id, MIN(bap.id) bap_id, COUNT(DISTINCT bap.id) c
FROM transactions_deleted td JOIN tenant ten ON ten.id = td.tenant_id
JOIN c168_net_legacy_20261007.company co ON co.company_id = ten.code
JOIN c168_net_legacy_20261007.transactions_deleted ltd ON ltd.company_id = co.id AND ltd.transaction_id = td.transaction_id
     AND ltd.transaction_type = td.transaction_type AND ltd.amount = td.amount
JOIN bank_process bp ON bp.id = ltd.source_bank_process_id AND bp.tenant_id = td.tenant_id
JOIN bank_process_accounting_posted bap ON bap.tenant_id = td.tenant_id AND bap.bank_process_id = ltd.source_bank_process_id
     AND bap.posted_date = ltd.transaction_date
     AND bap.period_type = (CASE
        WHEN ltd.source_bank_process_period_type = 'day_end_tail' THEN 'DAY_END_TAIL'
        WHEN ltd.source_bank_process_period_type = 'manual_inactive' THEN 'COMPENSATION'
        WHEN ltd.source_bank_process_period_type = 'once_one_off' THEN 'ONCE_ONE_OFF'
        WHEN ltd.source_bank_process_period_type = 'partial_first_month' THEN 'PARTIAL_FIRST_MONTH'
        WHEN ltd.source_bank_process_period_type = 'resend_consolidated_range' THEN 'RESEND_CONSOLIDATED'
        WHEN ltd.source_bank_process_period_type = 'monthly' AND bp.frequency = 'FIRST_OF_EVERY_MONTH'
             AND YEAR(ltd.transaction_date) = YEAR(bp.day_start) AND MONTH(ltd.transaction_date) = MONTH(bp.day_start) THEN 'FIRST_MONTH'
        WHEN ltd.source_bank_process_period_type = 'monthly' AND bp.frequency = 'FIRST_OF_EVERY_MONTH' THEN 'FULL_MONTH'
        WHEN ltd.source_bank_process_period_type = 'monthly' THEN 'MONTHLY'
        ELSE 'NO_MATCH_SENTINEL' END)
WHERE td.transaction_type IN ('WIN','LOSE') AND td.bank_process_posted_id IS NULL AND ltd.source_bank_process_id IS NOT NULL
GROUP BY td.id;
UPDATE transactions_deleted td JOIN _r ON _r.td_id = td.id SET td.bank_process_posted_id = _r.bap_id WHERE _r.c = 1;

COMMIT;
