-- PROD count168_site only. Contract 189 (CX), posted period 2026-09-01:
--   legacy already posted it on 2026-09-01 as RESEND_CONSOLIDATED (ledger 1844, txns 19059-19061);
--   on 2026-10-06 JK posted the same month again as DAY_END_TAIL (ledger 3215, txns 133724-133726) -> every amount twice
--   (BS001 +1,416.67, BS002 -1,530.00, BANK +113.33).
-- Fix: move the 3 duplicate transactions to transactions_deleted (same as a normal delete in the app) and turn
--      ledger 3215 into a manual SKIP, as was done in the local DB. Idempotent; dry run: replace COMMIT by ROLLBACK.
-- Replace __TGT__ with the schema (production: count168_site).
USE __TGT__;
START TRANSACTION;

INSERT INTO transactions_deleted
    (tenant_id, transaction_id, transaction_type, account_id, from_account_id, currency_id, amount, transaction_date, description, remark,
     approval_status, approved_by, approved_at, created_by, created_at, deleted_by, deleted_at, bank_process_posted_id, rate_group_id)
SELECT t.tenant_id, t.id, t.transaction_type, t.account_id, t.from_account_id, t.currency_id, t.amount, t.transaction_date, t.description, t.remark,
       'APPROVED', t.approved_by, t.approved_at, t.created_by, t.created_at, 'DUP_FIX_20261007', NOW(), t.bank_process_posted_id, t.rate_group_id
FROM transactions t
WHERE t.id IN (133724, 133725, 133726) AND t.tenant_id = 6 AND t.bank_process_posted_id = 3215
  AND NOT EXISTS (SELECT 1 FROM transactions_deleted d WHERE d.transaction_id = t.id AND d.tenant_id = t.tenant_id);
SELECT ROW_COUNT() AS moved_to_deleted;

DELETE FROM transactions WHERE id IN (133724, 133725, 133726) AND tenant_id = 6 AND bank_process_posted_id = 3215;
SELECT ROW_COUNT() AS transactions_deleted;

UPDATE bank_process_accounting_posted
SET outcome = 'SKIPPED', skip_reason = 'MANUAL'
WHERE id = 3215 AND tenant_id = 6 AND bank_process_id = 189 AND posted_date = '2026-09-01' AND period_type = 'DAY_END_TAIL'
  AND outcome = 'POSTED' AND NOT EXISTS (SELECT 1 FROM transactions x WHERE x.bank_process_posted_id = 3215);
SELECT ROW_COUNT() AS ledger_skipped;

-- check: contract 189 / 2026-09-01 must now have exactly one POSTED ledger (RESEND_CONSOLIDATED) with 3 transactions
SELECT ap.id, ap.period_type, ap.outcome, ap.skip_reason, (SELECT COUNT(*) FROM transactions x WHERE x.bank_process_posted_id = ap.id) AS txns
FROM bank_process_accounting_posted ap WHERE ap.bank_process_id = 189 AND ap.posted_date = '2026-09-01' ORDER BY ap.id;

COMMIT;
