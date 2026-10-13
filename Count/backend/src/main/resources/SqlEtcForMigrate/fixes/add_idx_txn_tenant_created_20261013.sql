-- Payment Maintenance list is read newest-first in batches (ORDER BY created_at DESC, id DESC LIMIT n for one
-- tenant). This index lets the database walk it backwards and stop after n rows instead of sorting every
-- transaction in the date range. The query forces it (FORCE INDEX), so run this BEFORE deploying the backend.
-- transactions is large: run off-peak.
ALTER TABLE transactions
    ADD KEY idx_txn_tenant_created (tenant_id, created_at, id);
