-- Transaction Payment Search: the Win/Loss and Cr/Dr aggregates filter on (tenant_id, transaction_type, approval_status) and
-- sum by transaction_date, but no index started with (tenant_id, transaction_type): MySQL walked idx_txn_currency (every row of
-- each currency) and filtered the type afterwards, so even a type with 12 rows (PROFIT) cost a scan of the whole company.
-- ADDITIVE ONLY, safe to re-run. Example: mysql -u root count_real < backend/src/main/resources/sql/migrate_add_txn_tenant_type_index.sql
ALTER TABLE `transactions`
    ADD KEY IF NOT EXISTS `idx_txn_tenant_type_date` (`tenant_id`, `transaction_type`, `approval_status`, `transaction_date`);

-- Covering index of the WIN/LOSE aggregates (aggregateBankProcessWinLoss / aggregateDataCaptureWinLoss): they read tenant, type,
-- status, account, currency, date, amount and group_id only, so the sum runs on the index without touching the table rows.
ALTER TABLE `transactions`
    ADD KEY IF NOT EXISTS `idx_txn_winlose_cover` (`tenant_id`, `transaction_type`, `approval_status`, `account_id`, `currency_id`, `transaction_date`, `amount`, `group_id`);
