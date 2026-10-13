-- Capture Maintenance list is read newest-first in batches (ORDER BY created_at DESC, id DESC LIMIT n,
-- one tenant + category). This index lets the database walk it backwards and stop after n rows instead of
-- sorting every capture in the date range.
ALTER TABLE data_captures
    ADD KEY idx_dc_tenant_cat_created (tenant_id, category, created_at, id);
