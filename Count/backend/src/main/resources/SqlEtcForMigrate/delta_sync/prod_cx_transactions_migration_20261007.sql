-- CX company only: bring the legacy (2026-10-07) non-bank transactions that production lacks.
-- Source = local count_real (aligned with legacy), target = production count168_site.
--
-- Tokens (replace with sed before running):
--   __TGT__  target schema   (production: count168_site | rehearsal: prod_snap2)
--   __SRC__  source schema   (production: bp_src staging copy | rehearsal: count_real)
--
-- Scope / decisions (confirmed by the user):
--   * only tenant CX (id 6); every other company is untouched;
--   * non-bank transactions only (Bank Process transactions were migrated by prod_bank_process_migration_*.sql);
--   * the SALARY / COMMISSION WIN/LOSE rows (they come from 2 Data Capture records) are migrated as plain
--     transactions, WITHOUT the capture header/lines (option A);
--   * transactions get NEW ids (legacy ids are occupied by other companies' rows in prod, e.g. 133686-133689 = DEMO);
--     RATE groups are re-linked to the new ids;
--   * "already in prod" is decided by natural key (type, account, from-account, amount, date) with a COUNT, so two
--     identical legacy rows are both inserted once and a re-run inserts nothing.
-- Dry run: replace the final COMMIT by ROLLBACK.

USE __TGT__;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET @cx = 6;
SET @from_date = '2026-09-29';

DROP PROCEDURE IF EXISTS _cx_preflight;
DELIMITER //
CREATE PROCEDURE _cx_preflight()
BEGIN
  IF (SELECT code FROM __TGT__.tenant WHERE id = @cx) <> 'CX' OR (SELECT code FROM __SRC__.tenant WHERE id = @cx) <> 'CX' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PREFLIGHT: tenant 6 is not CX on both sides';
  END IF;
  IF EXISTS (SELECT 1 FROM __SRC__.transactions s
             WHERE s.tenant_id = @cx AND s.bank_process_posted_id IS NULL AND s.transaction_date >= @from_date
               AND (NOT EXISTS (SELECT 1 FROM __TGT__.account a WHERE a.id = s.account_id)
                    OR (s.from_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM __TGT__.account a WHERE a.id = s.from_account_id))
                    OR (s.currency_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM __TGT__.currency c WHERE c.id = s.currency_id)))) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PREFLIGHT: a CX transaction uses an account/currency that prod does not have';
  END IF;
END //
DELIMITER ;
CALL _cx_preflight();
DROP PROCEDURE _cx_preflight;

START TRANSACTION;

-- candidates: CX non-bank transactions (from the cut date on) that prod does not have yet
CREATE TEMPORARY TABLE _cand AS
SELECT s.id lid, s.rn
FROM (SELECT t.id, ROW_NUMBER() OVER (PARTITION BY t.transaction_type, t.account_id, t.from_account_id, t.amount, t.transaction_date ORDER BY t.id) rn,
             t.transaction_type, t.account_id, t.from_account_id, t.amount, t.transaction_date
      FROM __SRC__.transactions t
      WHERE t.tenant_id = @cx AND t.bank_process_posted_id IS NULL AND t.transaction_date >= @from_date) s
WHERE s.rn > (SELECT COUNT(*) FROM __TGT__.transactions p
              WHERE p.tenant_id = @cx AND p.transaction_type = s.transaction_type AND p.account_id = s.account_id
                AND p.from_account_id <=> s.from_account_id AND p.amount = s.amount AND p.transaction_date = s.transaction_date);
SELECT t.transaction_type, COUNT(*) AS to_insert FROM _cand c JOIN __SRC__.transactions t ON t.id = c.lid GROUP BY t.transaction_type;

INSERT INTO __TGT__.transactions
    (tenant_id, transaction_type, account_id, from_account_id, currency_id, amount, transaction_date, description, remark,
     created_by, updated_by, approval_status, approved_by, approved_at, bank_process_posted_id, bank_process_id, rate_group_id,
     created_at, updated_at)
SELECT t.tenant_id, t.transaction_type, t.account_id, t.from_account_id, t.currency_id, t.amount, t.transaction_date, t.description, t.remark,
       t.created_by, t.updated_by, t.approval_status, t.approved_by, t.approved_at, NULL, NULL, t.rate_group_id,
       t.created_at, t.updated_at
FROM __SRC__.transactions t JOIN _cand c ON c.lid = t.id
ORDER BY t.id;
SELECT ROW_COUNT() AS transactions_inserted;

-- RATE groups: re-link the two legs to the new ids (resolved by group id + description, unique within a group)
INSERT INTO __TGT__.transactions_rate
    (tenant_id, rate_group_id, leg1_transaction_id, leg2_transaction_id, exchange_rate, rate_expression, currency_from_id, amount_from,
     currency_to_id, amount_to, middleman_account_id, middleman_rate, middleman_rate_expression, middleman_amount, platform_fee_amount,
     created_at, updated_at)
SELECT r.tenant_id, r.rate_group_id,
       (SELECT MAX(p.id) FROM __TGT__.transactions p JOIN __SRC__.transactions s1 ON s1.id = r.leg1_transaction_id
         WHERE p.tenant_id = @cx AND p.rate_group_id = r.rate_group_id AND p.description <=> s1.description AND p.transaction_type = 'RATE'),
       (SELECT MAX(p.id) FROM __TGT__.transactions p JOIN __SRC__.transactions s2 ON s2.id = r.leg2_transaction_id
         WHERE p.tenant_id = @cx AND p.rate_group_id = r.rate_group_id AND p.description <=> s2.description AND p.transaction_type = 'RATE'),
       r.exchange_rate, r.rate_expression, r.currency_from_id, r.amount_from, r.currency_to_id, r.amount_to, r.middleman_account_id,
       r.middleman_rate, r.middleman_rate_expression, r.middleman_amount, r.platform_fee_amount, r.created_at, r.updated_at
FROM __SRC__.transactions_rate r
WHERE r.tenant_id = @cx
  AND EXISTS (SELECT 1 FROM _cand c WHERE c.lid IN (r.leg1_transaction_id, r.leg2_transaction_id))
  AND NOT EXISTS (SELECT 1 FROM __TGT__.transactions_rate x WHERE x.tenant_id = r.tenant_id AND x.rate_group_id = r.rate_group_id);
SELECT ROW_COUNT() AS transactions_rate_inserted;

-- checks
SELECT 'rate rows with an unresolved leg' k, COUNT(*) FROM __TGT__.transactions_rate
WHERE tenant_id = @cx AND (leg1_transaction_id IS NULL OR leg2_transaction_id IS NULL);
SELECT 'CX non-bank txns from cut date still missing in prod' k, COUNT(*) FROM __SRC__.transactions s
WHERE s.tenant_id = @cx AND s.bank_process_posted_id IS NULL AND s.transaction_date >= @from_date
  AND (SELECT COUNT(*) FROM __SRC__.transactions q WHERE q.tenant_id = @cx AND q.bank_process_posted_id IS NULL AND q.transaction_date >= @from_date
         AND q.transaction_type = s.transaction_type AND q.account_id = s.account_id AND q.from_account_id <=> s.from_account_id
         AND q.amount = s.amount AND q.transaction_date = s.transaction_date)
    > (SELECT COUNT(*) FROM __TGT__.transactions p WHERE p.tenant_id = @cx AND p.transaction_type = s.transaction_type AND p.account_id = s.account_id
         AND p.from_account_id <=> s.from_account_id AND p.amount = s.amount AND p.transaction_date = s.transaction_date);

COMMIT;
