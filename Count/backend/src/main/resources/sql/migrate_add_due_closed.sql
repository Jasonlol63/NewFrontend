-- Accounting Due: "closed" contracts that must not auto-bill again after being re-opened.
--
-- 1. bank_process.due_closed (TINYINT, default 0)
--    Decided at the moment a contract enters INACTIVE: 1 when the contract had ended (today >= day_end;
--    WEEK / DAY have no day_end so this is not checked; ONCE never). Recomputed on every entry into INACTIVE.
--    When it is set, every due still pending at that moment is auto-SKIPPED (skip_reason = INACTIVE).
--    On INACTIVE -> ACTIVE with due_closed = 1:
--      * 1st of Every Month / Monthly: unsettled periods before the current month are auto-SKIPPED,
--        current month onward generates as usual.
--      * Week / Day: no automatic due is generated any more (Resend only).
--    0 (default, all existing rows) keeps the previous behavior untouched.
--
-- 2. bank_process_accounting_posted.skip_reason (ENUM MANUAL / INACTIVE, NULL)
--    INACTIVE marks rows auto-SKIPPED by the flow above (on entering INACTIVE, and past months on re-activation),
--    so "Refresh" (restoreSkipped) never restores them.
--    NULL / MANUAL = skipped by the user's Delete.
--
-- Safe to re-run: columns are added only when missing; step 3 re-applies the column comments.
-- Example: mysql -u root count_real < backend/src/main/resources/sql/migrate_add_due_closed.sql

-- 1. bank_process.due_closed
SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bank_process' AND COLUMN_NAME = 'due_closed'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE `bank_process` ADD COLUMN `due_closed` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1=contract ended when it entered INACTIVE (pending dues were auto-SKIPPED then); after re-activation 1st/Monthly auto-skip past months, Week/Day stop auto dues'' AFTER `due_generation_floor`',
    'SELECT ''bank_process.due_closed already present, skipping''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. bank_process_accounting_posted.skip_reason
SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bank_process_accounting_posted' AND COLUMN_NAME = 'skip_reason'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE `bank_process_accounting_posted` ADD COLUMN `skip_reason` ENUM(''MANUAL'', ''INACTIVE'') DEFAULT NULL COMMENT ''SKIPPED rows only: INACTIVE=auto-skipped by the INACTIVE flow (on entering INACTIVE, or past months on re-activation), never restored by Refresh; NULL/MANUAL=user Delete'' AFTER `outcome`',
    'SELECT ''bank_process_accounting_posted.skip_reason already present, skipping''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Re-apply the column comments (meaning changed: pending dues are auto-skipped on entering INACTIVE instead of
--    being a precondition). Comment-only change, data untouched; no-op when the definition already matches.
ALTER TABLE `bank_process`
    MODIFY COLUMN `due_closed` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=contract ended when it entered INACTIVE (pending dues were auto-SKIPPED then); after re-activation 1st/Monthly auto-skip past months, Week/Day stop auto dues';
ALTER TABLE `bank_process_accounting_posted`
    MODIFY COLUMN `skip_reason` ENUM('MANUAL', 'INACTIVE') DEFAULT NULL COMMENT 'SKIPPED rows only: INACTIVE=auto-skipped by the INACTIVE flow (on entering INACTIVE, or past months on re-activation), never restored by Refresh; NULL/MANUAL=user Delete';
