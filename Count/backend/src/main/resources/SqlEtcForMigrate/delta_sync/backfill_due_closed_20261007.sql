-- due_closed backfill for contracts that are ALREADY Inactive and ended (today >= day_end).
-- Same rule as BankAccountingDueServiceImpl#closeOnInactive (previous status assumed ACTIVE):
--   * every normal due still without a ledger row is written as SKIPPED (skip_reason = INACTIVE)
--   * the contract is marked due_closed = 1
-- Scope: INACTIVE + FIRST_OF_EVERY_MONTH / MONTHLY + day_end <= today (ONCE / WEEK / DAY / open-ended are untouched).
-- Idempotent: dues that already have a ledger row (any outcome) are not inserted again; due_closed is a plain SET.
-- Dry run: replace the final COMMIT with ROLLBACK. Expected on the local 2026-10-07 run: 30 contracts, 62 SKIPPED rows.
USE count_real;

START TRANSACTION;

CREATE TEMPORARY TABLE _cand AS
SELECT b.id, b.tenant_id, b.frequency, b.day_start, b.day_end, b.day_end_monthly_cap_enabled cap, b.expired_at_creation eac,
       DATE_FORMAT(COALESCE(b.due_generation_floor, b.created_at, b.day_start), '%Y-%m-01') cfloor,
       DATE_FORMAT(b.day_start, '%Y-%m-01') sm, DATE_FORMAT(b.day_end, '%Y-%m-01') em
FROM bank_process b
WHERE b.status = 'INACTIVE' AND b.frequency IN ('FIRST_OF_EVERY_MONTH', 'MONTHLY')
  AND b.day_end IS NOT NULL AND b.day_end <= CURDATE() AND b.day_start <= CURDATE();

CREATE TEMPORARY TABLE _n (i INT PRIMARY KEY);
INSERT INTO _n WITH RECURSIVE r(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM r WHERE i < 150) SELECT i FROM r;

-- All dues the contract would have generated as ACTIVE up to today (cap OFF keeps generating FULL_MONTH / MONTHLY past day_end).
CREATE TEMPORARY TABLE _dues (
    bp INT, tenant_id INT, posted DATE, ptype VARCHAR(30), bstart DATE, bend DATE);

INSERT INTO _dues
SELECT id, tenant_id,
       IF(m = sm, day_start, m),
       CASE WHEN m = sm THEN IF(DAY(day_start) = 1, 'FIRST_MONTH', 'PARTIAL_FIRST_MONTH')
            WHEN m = em AND (cap = 1 OR eac = 1) AND DAY(day_end) < DAY(LAST_DAY(m)) THEN 'DAY_END_TAIL'
            ELSE 'FULL_MONTH' END,
       IF(m = sm, day_start, m),
       CASE WHEN m = sm THEN IF(m = em AND NOT (cap = 1 OR eac = 1), LAST_DAY(m), LEAST(day_end, LAST_DAY(m)))
            WHEN m = em AND (cap = 1 OR eac = 1) AND DAY(day_end) < DAY(LAST_DAY(m)) THEN day_end
            ELSE LAST_DAY(m) END
FROM (SELECT c.*, DATE_ADD(GREATEST(c.sm, c.cfloor), INTERVAL n.i MONTH) m
      FROM _cand c JOIN _n n WHERE c.frequency = 'FIRST_OF_EVERY_MONTH') x
WHERE m <= IF(cap = 0, GREATEST(em, DATE_FORMAT(CURDATE(), '%Y-%m-01')), em)
  AND IF(m = sm, day_start, m) <= CURDATE();

INSERT INTO _dues
SELECT id, tenant_id, posted, 'MONTHLY', posted, DATE_ADD(posted, INTERVAL 1 MONTH)
FROM (SELECT c.id, c.tenant_id, c.cfloor,
             CASE WHEN m = sm THEN day_start
                  WHEN DAY(day_start) - 1 <= 0 THEN LAST_DAY(DATE_SUB(m, INTERVAL 1 MONTH))
                  ELSE DATE_ADD(m, INTERVAL LEAST(DAY(day_start) - 1, DAY(LAST_DAY(m))) - 1 DAY) END posted
      FROM (SELECT c0.*, DATE_ADD(GREATEST(c0.sm, c0.cfloor), INTERVAL n.i MONTH) m
            FROM _cand c0 JOIN _n n WHERE c0.frequency = 'MONTHLY') c) y
WHERE posted <= CURDATE() AND posted >= cfloor;

-- Preview: what will be skipped per contract (compare with the agreed list).
SELECT d.bp, COUNT(*) will_skip
FROM _dues d
WHERE NOT EXISTS (SELECT 1 FROM bank_process_accounting_posted l
                  WHERE l.bank_process_id = d.bp AND l.posted_date = d.posted AND l.period_type = d.ptype)
GROUP BY d.bp ORDER BY d.bp;

INSERT INTO bank_process_accounting_posted
    (tenant_id, bank_process_id, posted_date, period_type, outcome, skip_reason, billing_start, billing_end, created_by)
SELECT d.tenant_id, d.bp, d.posted, d.ptype, 'SKIPPED', 'INACTIVE', d.bstart, d.bend, 'DUE_CLOSED_BACKFILL'
FROM _dues d
WHERE NOT EXISTS (SELECT 1 FROM bank_process_accounting_posted l
                  WHERE l.bank_process_id = d.bp AND l.posted_date = d.posted AND l.period_type = d.ptype);
SELECT ROW_COUNT() AS skipped_rows_inserted;

UPDATE bank_process b JOIN _cand c ON c.id = b.id SET b.due_closed = 1 WHERE b.due_closed = 0;
SELECT ROW_COUNT() AS contracts_marked_due_closed;

COMMIT;
