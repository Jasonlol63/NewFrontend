-- Step 2 of merging transactions.rate_group_id + transactions.bank_process_posted_id into one `group_id`.
-- DESTRUCTIVE: drops the two old columns. Run ONLY after step 1 and after the application code no longer reads or
-- writes them (this release). Take a dump first. Safe to re-run (IF EXISTS everywhere).
-- Example: mysql -u root count_real < backend/src/main/resources/sql/migrate_merge_group_id_step2.sql

-- A. Archived Domain charges (deleted before group_id existed): same grouping rule as step 1 -------------------
UPDATE `transactions_deleted` d
JOIN (
    SELECT MIN(`transaction_id`) AS gid, `tenant_id`, `created_by`, `created_at`
    FROM `transactions_deleted`
    WHERE `remark` IN ('DOMAIN_FEE', 'DOMAIN_COMMISSION', 'DOMAIN_NET_PROFIT') AND `group_id` IS NULL
    GROUP BY `tenant_id`, `created_by`, `created_at`
    HAVING SUM(`remark` = 'DOMAIN_FEE') = 1 AND SUM(`remark` = 'DOMAIN_NET_PROFIT') <= 1
) g ON g.`tenant_id` = d.`tenant_id` AND g.`created_by` <=> d.`created_by` AND g.`created_at` <=> d.`created_at`
SET d.`group_id` = CONCAT('DF-', g.`gid`)
WHERE d.`remark` IN ('DOMAIN_FEE', 'DOMAIN_COMMISSION', 'DOMAIN_NET_PROFIT') AND d.`group_id` IS NULL;

-- B. The reporting view reads the old column: re-point it at group_id BEFORE dropping ---------------------------
CREATE OR REPLACE VIEW `v_transactions_detail` AS
SELECT
    tx.id,
    t.code AS company_code,
    tx.transaction_type,
    a.account_id AS account_code,
    a.name AS account_name,
    tx.amount,
    cur.code AS currency_code,
    tx.transaction_date,
    tx.description,
    tx.remark,
    bp.card_owner AS product_name,
    bp.id AS bank_process_id,
    bap.period_type,
    bap.billing_start,
    bap.billing_end,
    bap.outcome AS posted_outcome,
    tx.approval_status,
    tx.created_by,
    tx.updated_by,
    tx.created_at,
    tx.updated_at
FROM transactions tx
JOIN tenant t ON t.id = tx.tenant_id
JOIN account a ON a.id = tx.account_id
LEFT JOIN currency cur ON cur.id = tx.currency_id
LEFT JOIN bank_process_accounting_posted bap ON bap.tenant_id = tx.tenant_id AND bap.group_id = tx.group_id
LEFT JOIN bank_process bp ON bp.id = COALESCE(tx.bank_process_id, bap.bank_process_id);

-- C. transactions_rate: rate_group_id -> group_id (its unique key uk_rate_group follows the column) ------------
ALTER TABLE `transactions_rate`
    CHANGE COLUMN IF EXISTS `rate_group_id` `group_id` VARCHAR(50) NOT NULL
        COMMENT 'Shared with transactions.group_id (RG-…)';

-- D. Drop the old columns --------------------------------------------------------------------------------------
ALTER TABLE `transactions` DROP FOREIGN KEY IF EXISTS `fk_txn_bp_posted`;
ALTER TABLE `transactions`
    DROP KEY IF EXISTS `idx_txn_posted`,
    DROP KEY IF EXISTS `idx_txn_tenant_rate_group`,
    DROP COLUMN IF EXISTS `bank_process_posted_id`,
    DROP COLUMN IF EXISTS `rate_group_id`;

ALTER TABLE `transactions_deleted`
    DROP KEY IF EXISTS `idx_bp_posted`,
    DROP COLUMN IF EXISTS `bank_process_posted_id`,
    DROP COLUMN IF EXISTS `rate_group_id`;

-- E. Verification (read-only) ------------------------------------------------------------------------------------
SELECT 'old columns left (expect 0)' AS what, COUNT(*) AS n
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('bank_process_posted_id', 'rate_group_id')
UNION ALL
SELECT 'view works', COUNT(*) FROM `v_transactions_detail`
UNION ALL
SELECT 'domain rows without group (expect 0)',
       (SELECT COUNT(*) FROM `transactions` WHERE `remark` LIKE 'DOMAIN\_%' AND `group_id` IS NULL)
     + (SELECT COUNT(*) FROM `transactions_deleted` WHERE `remark` LIKE 'DOMAIN\_%' AND `group_id` IS NULL);
