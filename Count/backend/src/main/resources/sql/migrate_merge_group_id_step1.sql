-- Step 1 of merging transactions.rate_group_id + transactions.bank_process_posted_id into one `group_id`.
-- ADDITIVE ONLY: adds columns / indexes and backfills them. No old column is touched or dropped (that is step 2,
-- run only after every mapper reads group_id and the amounts reconcile). Safe to re-run.
--
-- group_id convention:  RG-… = Rate   BK-… = Bank Process posting (backfilled as BK-<bank_process_accounting_posted.id>)
--                       DF-… = Domain fee / renewal charge   NULL = single transaction / Data Capture
-- See docs/group-id-merge-plan.md.
-- Example: mysql -u root count_real < backend/src/main/resources/sql/migrate_merge_group_id_step1.sql

-- A. Columns + indexes ------------------------------------------------------------------------------------
ALTER TABLE `transactions`
    ADD COLUMN IF NOT EXISTS `group_id` VARCHAR(50) DEFAULT NULL
        COMMENT 'One operation = one group: RG-=Rate, BK-=Bank Process posting, DF-=Domain fee; NULL=single/Data Capture'
        AFTER `bank_process_id`,
    ADD KEY IF NOT EXISTS `idx_txn_tenant_group` (`tenant_id`, `group_id`);

ALTER TABLE `transactions_deleted`
    ADD COLUMN IF NOT EXISTS `group_id` VARCHAR(50) DEFAULT NULL
        COMMENT 'Mirrors transactions.group_id at archive time',
    ADD KEY IF NOT EXISTS `idx_group` (`tenant_id`, `group_id`);

ALTER TABLE `bank_process_accounting_posted`
    ADD COLUMN IF NOT EXISTS `group_id` VARCHAR(50) DEFAULT NULL
        COMMENT 'BK-…; shared by every transactions row of this posting (NULL for SKIPPED rows: no transactions)';

-- B. Backfill: Bank Process ledger rows, then transactions / transactions_deleted ---------------------------
-- POSTED rows, plus any other row still referenced by a transaction: legacy-migrated ledger rows can be SKIPPED while
-- their (archived) transactions still point at them, and the Bank Process Maintenance "deleted" list joins to them.
UPDATE `bank_process_accounting_posted`
SET `group_id` = CONCAT('BK-', `id`)
WHERE `group_id` IS NULL
  AND (`outcome` = 'POSTED'
       OR `id` IN (SELECT `bank_process_posted_id` FROM `transactions` WHERE `bank_process_posted_id` IS NOT NULL)
       OR `id` IN (SELECT `bank_process_posted_id` FROM `transactions_deleted` WHERE `bank_process_posted_id` IS NOT NULL));

ALTER TABLE `bank_process_accounting_posted`
    ADD UNIQUE KEY IF NOT EXISTS `uk_bpap_group` (`tenant_id`, `group_id`);

UPDATE `transactions` SET `group_id` = `rate_group_id`
WHERE `rate_group_id` IS NOT NULL AND `group_id` IS NULL;

UPDATE `transactions` SET `group_id` = CONCAT('BK-', `bank_process_posted_id`)
WHERE `bank_process_posted_id` IS NOT NULL AND `group_id` IS NULL;

UPDATE `transactions_deleted` SET `group_id` = `rate_group_id`
WHERE `rate_group_id` IS NOT NULL AND `group_id` IS NULL;

UPDATE `transactions_deleted` SET `group_id` = CONCAT('BK-', `bank_process_posted_id`)
WHERE `bank_process_posted_id` IS NOT NULL AND `group_id` IS NULL;

-- C. Backfill: Domain fee / renewal charges ------------------------------------------------------------------
-- One charge = same tenant + same creator + same created_at (chargeDomainFee inserts all its lines in one go).
-- Only well-formed groups are tagged: exactly one DOMAIN_FEE line and at most one DOMAIN_NET_PROFIT line.
-- Anything else is left untouched (group_id stays NULL) for manual review — see the check query in step D.
UPDATE `transactions` t
JOIN (
    SELECT MIN(`id`) AS gid, `tenant_id`, `created_by`, `created_at`
    FROM `transactions`
    WHERE `remark` IN ('DOMAIN_FEE', 'DOMAIN_COMMISSION', 'DOMAIN_NET_PROFIT')
    GROUP BY `tenant_id`, `created_by`, `created_at`
    HAVING SUM(`remark` = 'DOMAIN_FEE') = 1 AND SUM(`remark` = 'DOMAIN_NET_PROFIT') <= 1
) g ON g.`tenant_id` = t.`tenant_id` AND g.`created_by` <=> t.`created_by` AND g.`created_at` = t.`created_at`
SET t.`group_id` = CONCAT('DF-', g.`gid`)
WHERE t.`remark` IN ('DOMAIN_FEE', 'DOMAIN_COMMISSION', 'DOMAIN_NET_PROFIT') AND t.`group_id` IS NULL;

-- C2. A charge's lines can straddle a second boundary (e.g. 04:34:17 / 04:34:18 — the NET PROFIT line is inserted last).
-- Attach a leftover NET_PROFIT line to the DF- group of the same tenant + creator whose DOMAIN_FEE is at most 1s earlier
-- and which has no NET_PROFIT line yet. (Derived table avoids MariaDB error 1093: no sub-select on the table being updated.)
UPDATE `transactions` n
JOIN `transactions` f
  ON f.`tenant_id` = n.`tenant_id` AND f.`created_by` <=> n.`created_by`
 AND f.`remark` = 'DOMAIN_FEE' AND f.`group_id` LIKE 'DF-%'
 AND f.`created_at` BETWEEN n.`created_at` - INTERVAL 1 SECOND AND n.`created_at`
LEFT JOIN (SELECT DISTINCT `group_id` FROM `transactions`
           WHERE `remark` = 'DOMAIN_NET_PROFIT' AND `group_id` LIKE 'DF-%') hn ON hn.`group_id` = f.`group_id`
SET n.`group_id` = f.`group_id`
WHERE n.`remark` = 'DOMAIN_NET_PROFIT' AND n.`group_id` IS NULL AND hn.`group_id` IS NULL;

-- D. Verification (read-only; every pair must be equal, and the last query must return no rows to be "clean") ----
SELECT 'rate rows'    AS what, (SELECT COUNT(*) FROM `transactions` WHERE `rate_group_id` IS NOT NULL) AS old_cnt,
       (SELECT COUNT(*) FROM `transactions` WHERE `group_id` IS NOT NULL AND `rate_group_id` IS NOT NULL
            AND `group_id` = `rate_group_id`) AS new_cnt
UNION ALL
SELECT 'bank rows',    (SELECT COUNT(*) FROM `transactions` WHERE `bank_process_posted_id` IS NOT NULL),
       (SELECT COUNT(*) FROM `transactions` WHERE `group_id` LIKE 'BK-%')
UNION ALL
SELECT 'bank ledger',  (SELECT COUNT(*) FROM `bank_process_accounting_posted` WHERE `outcome` = 'POSTED'),
       (SELECT COUNT(*) FROM `bank_process_accounting_posted` WHERE `group_id` IS NOT NULL)
UNION ALL
SELECT 'deleted rate', (SELECT COUNT(*) FROM `transactions_deleted` WHERE `rate_group_id` IS NOT NULL),
       (SELECT COUNT(*) FROM `transactions_deleted` WHERE `group_id` IS NOT NULL AND `rate_group_id` IS NOT NULL)
UNION ALL
SELECT 'deleted bank', (SELECT COUNT(*) FROM `transactions_deleted` WHERE `bank_process_posted_id` IS NOT NULL),
       (SELECT COUNT(*) FROM `transactions_deleted` WHERE `group_id` LIKE 'BK-%')
UNION ALL
SELECT 'domain rows',  (SELECT COUNT(*) FROM `transactions` WHERE `remark` IN ('DOMAIN_FEE','DOMAIN_COMMISSION','DOMAIN_NET_PROFIT')),
       (SELECT COUNT(*) FROM `transactions` WHERE `group_id` LIKE 'DF-%');

-- Domain charges that were NOT tagged (expected on the current local data: none)
SELECT `tenant_id`, `created_by`, `created_at`,
       SUM(`remark` = 'DOMAIN_FEE') AS fee, SUM(`remark` = 'DOMAIN_COMMISSION') AS commission,
       SUM(`remark` = 'DOMAIN_NET_PROFIT') AS net_profit, GROUP_CONCAT(`id`) AS ids
FROM `transactions`
WHERE `remark` IN ('DOMAIN_FEE', 'DOMAIN_COMMISSION', 'DOMAIN_NET_PROFIT') AND `group_id` IS NULL
GROUP BY `tenant_id`, `created_by`, `created_at`;
