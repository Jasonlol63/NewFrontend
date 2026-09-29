-- Adds `bank_option.is_selected`: persists which banks are shown in the "Selected Banks"
-- panel of the Select-or-Add-Bank modal, per (tenant, country). Previously this state lived
-- only in frontend localStorage (`bankProcessCountryChips:<tenantId>`), which meant the
-- selection reset whenever the user switched device/browser or logged in again elsewhere —
-- the field replaces that with real backend persistence.
--
-- DEFAULT 1: `ADD COLUMN ... DEFAULT 1` backfills every existing row to 1 automatically, so
-- current users don't see their whole bank list wiped after this deploys (matches the
-- "everything was effectively selected" behavior they're used to from the old localStorage
-- flow). New rows inserted after this migration also default to selected, matching the
-- current "new bank appears immediately" UX. No separate UPDATE step is needed.
--
-- Safe to re-run: uses information_schema checks before ADD COLUMN.
-- Example: mysql -u root count_real < backend/src/main/resources/sql/migrate_add_is_selected_to_bank_option.sql

-- 1. Add the column if missing.
SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bank_option' AND COLUMN_NAME = 'is_selected'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE `bank_option` ADD COLUMN `is_selected` TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''1=selected (shown as Selected Bank in Bank Process form), 0=available only'' AFTER `name`',
    'SELECT ''is_selected already present, skipping''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
