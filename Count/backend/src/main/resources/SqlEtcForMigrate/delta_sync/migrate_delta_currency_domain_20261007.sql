-- Incremental DATA sync, STAGE 2: Currency / account_currency / account_link / Ownership / fee share /
-- feature module / auto-renew, legacy c168.net PHP DB -> count_real (local rehearsal).
--
-- Source   = `c168_net_legacy_20261007`   Baseline = `c168_net_legacy_20260929`   Target = count_real.
-- Run migrate_delta_identity_tenant_20261007.sql FIRST (tenants / accounts / users must exist).
--
-- Rules (same as stage 1): NEW rows are inserted; CHANGED = only what legacy changed since the baseline;
-- DELETED = only what legacy removed since the baseline. Rows that exist only in count_real are never touched.
--
-- Notes:
--   - Ownership / history / fee share / account_link are NOT id-preserved in the new schema, so they are matched
--     on natural keys. legacy `group_ownership` ids 299/300 were merely re-created as 301/302 with identical
--     content -> no net change (natural key already present).
--   - tenant_ownership.account_id is an account id for owner_type 'account', a user id for 'user' (legacy user
--     546 = JH, which has the same id in count_real) and an owner id for 'owner'; 0 -> NULL.
--   - tenant_feature_module / tenant_fee_share_allocation are derived from the company JSON columns ONLY for
--     companies that are new since the baseline (or whose JSON changed), so new-system edits to existing tenants
--     are never re-added.
--   - tenant_auto_renew: mirrors legacy (any request without a legacy counterpart is removed).
--   - Not touched (unchanged in legacy since the baseline): domain_list_fee_price, announcements,
--     maintenance_marquee. account_currency_display_order: the one changed row has account_id -218 (a per-user,
--     per-company order the new schema does not store), so nothing to apply.
--
-- Usage:
--   mysql -u root count_real < backend/src/main/resources/SqlEtcForMigrate/delta_sync/migrate_delta_currency_domain_20261007.sql

START TRANSACTION;

CREATE TEMPORARY TABLE _map_tenant (
    old_type      ENUM('COMPANY','GROUP') NOT NULL,
    old_id        INT NOT NULL,
    new_tenant_id INT NOT NULL,
    PRIMARY KEY (old_type, old_id)
);
INSERT INTO _map_tenant (old_type, old_id, new_tenant_id)
SELECT 'COMPANY', c.id, t.id FROM c168_net_legacy_20261007.company c
JOIN tenant t ON t.tenant_type = 'COMPANY' AND t.code = c.company_id;
INSERT INTO _map_tenant (old_type, old_id, new_tenant_id)
SELECT 'GROUP', g.id, t.id FROM c168_net_legacy_20261007.groups g
JOIN tenant t ON t.tenant_type = 'GROUP' AND t.code = g.group_code;

-- =============================================================================
-- 1. currency (survivor dedup over the full current legacy table, same rule as the full migration)
-- =============================================================================
CREATE TEMPORARY TABLE _map_currency (
    old_currency_id  INT NOT NULL PRIMARY KEY,
    survivor_id      INT NOT NULL
);
INSERT INTO _map_currency (old_currency_id, survivor_id)
SELECT cu.id, s.id
FROM c168_net_legacy_20261007.currency cu
JOIN (
    SELECT id, company_id, code,
           ROW_NUMBER() OVER (PARTITION BY company_id, code ORDER BY (sync_source = 'subsidiary'), id) AS rn
    FROM c168_net_legacy_20261007.currency
) s ON s.company_id = cu.company_id AND s.code = cu.code
WHERE s.rn = 1;

INSERT INTO currency (id, tenant_id, code, sync_source, status)
SELECT mc.survivor_id, m.new_tenant_id, cu.code, UPPER(cu.sync_source), 'ACTIVE'
FROM c168_net_legacy_20261007.currency cu
JOIN _map_currency mc ON mc.old_currency_id = cu.id AND mc.survivor_id = cu.id
JOIN _map_tenant m ON m.old_type = 'COMPANY' AND m.old_id = cu.company_id
WHERE mc.survivor_id NOT IN (SELECT id FROM currency);
SELECT 'currency inserted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 2. account_currency: new (account, currency) pairs; pairs legacy removed since the baseline.
-- =============================================================================
INSERT INTO account_currency (account_id, tenant_id, currency_id, created_at, updated_at)
SELECT ac.account_id, cur.tenant_id, mc.survivor_id, ac.created_at, ac.updated_at
FROM c168_net_legacy_20261007.account_currency ac
JOIN _map_currency mc ON mc.old_currency_id = ac.currency_id
JOIN currency cur ON cur.id = mc.survivor_id
WHERE NOT EXISTS (
    SELECT 1 FROM account_currency x
    WHERE x.account_id = ac.account_id AND x.currency_id = mc.survivor_id
);
SELECT 'account_currency inserted' AS step, ROW_COUNT() AS n;

DELETE x
FROM account_currency x
JOIN (
    SELECT b.account_id, b.currency_id
    FROM c168_net_legacy_20260929.account_currency b
    WHERE NOT EXISTS (
        SELECT 1 FROM c168_net_legacy_20261007.account_currency a
        WHERE a.account_id = b.account_id AND a.currency_id = b.currency_id
    )
) gone ON gone.account_id = x.account_id AND gone.currency_id = x.currency_id;
SELECT 'account_currency deleted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 3. account_link: new rows since the baseline, matched on natural key.
-- =============================================================================
INSERT INTO account_link (account_id_1, account_id_2, tenant_id, link_type, source_account_id, created_at, updated_at)
SELECT al.account_id_1, al.account_id_2, m.new_tenant_id, UPPER(al.link_type), al.source_account_id, al.created_at, al.updated_at
FROM c168_net_legacy_20261007.account_link al
JOIN _map_tenant m ON m.old_type = 'COMPANY' AND m.old_id = al.company_id
WHERE al.id NOT IN (SELECT id FROM c168_net_legacy_20260929.account_link)
  AND NOT EXISTS (
      SELECT 1 FROM account_link x
      WHERE x.account_id_1 = al.account_id_1 AND x.account_id_2 = al.account_id_2
        AND x.tenant_id = m.new_tenant_id AND x.link_type = UPPER(al.link_type)
  );
SELECT 'account_link inserted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 4. tenant_ownership: legacy company_ownership + group_ownership, natural key
--    (tenant, owner_type, account_id, partner, percentage).
-- =============================================================================
INSERT INTO tenant_ownership (tenant_id, account_id, owner_type, partner_tenant_id, percentage, read_only, sort_order)
SELECT m.new_tenant_id, NULLIF(co.account_id, 0), co.owner_type, pt.id, co.percentage, co.read_only, co.sort_order
FROM c168_net_legacy_20261007.company_ownership co
JOIN _map_tenant m ON m.old_type = 'COMPANY' AND m.old_id = co.company_id
LEFT JOIN tenant pt ON pt.code = co.partner_group_id AND pt.tenant_type = 'GROUP'
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_ownership x
    WHERE x.tenant_id = m.new_tenant_id AND x.owner_type = co.owner_type
      AND x.account_id <=> NULLIF(co.account_id, 0) AND x.partner_tenant_id <=> pt.id AND x.percentage = co.percentage
);
SELECT 'tenant_ownership inserted (company)' AS step, ROW_COUNT() AS n;

INSERT INTO tenant_ownership (tenant_id, account_id, owner_type, partner_tenant_id, percentage, read_only, sort_order)
SELECT t.id, NULLIF(go.account_id, 0), go.owner_type, pt.id, go.percentage, go.read_only, go.sort_order
FROM c168_net_legacy_20261007.group_ownership go
JOIN tenant t ON t.tenant_type = 'GROUP' AND t.code = go.group_id
LEFT JOIN tenant pt ON pt.code = go.partner_group_id AND pt.tenant_type = 'GROUP'
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_ownership x
    WHERE x.tenant_id = t.id AND x.owner_type = go.owner_type
      AND x.account_id <=> NULLIF(go.account_id, 0) AND x.partner_tenant_id <=> pt.id AND x.percentage = go.percentage
)
AND go.id NOT IN (SELECT id FROM c168_net_legacy_20260929.group_ownership)
AND NOT EXISTS (   -- same content merely re-created under a new legacy id is not a new row
    SELECT 1 FROM c168_net_legacy_20260929.group_ownership o9
    WHERE o9.group_id = go.group_id AND o9.owner_type = go.owner_type AND o9.account_id = go.account_id
      AND o9.percentage = go.percentage
);
SELECT 'tenant_ownership inserted (group)' AS step, ROW_COUNT() AS n;

-- ownership rows legacy really removed since the baseline (natural key gone from the source)
DELETE x
FROM tenant_ownership x
JOIN tenant t ON t.id = x.tenant_id AND t.tenant_type = 'COMPANY'
JOIN c168_net_legacy_20260929.company c9 ON c9.company_id = t.code
JOIN c168_net_legacy_20260929.company_ownership b ON b.company_id = c9.id
    AND x.owner_type = b.owner_type AND x.account_id <=> NULLIF(b.account_id, 0) AND x.percentage = b.percentage
WHERE NOT EXISTS (
    SELECT 1 FROM c168_net_legacy_20261007.company_ownership a
    JOIN c168_net_legacy_20261007.company c7 ON c7.id = a.company_id
    WHERE c7.company_id = t.code AND a.owner_type = b.owner_type AND NULLIF(a.account_id, 0) <=> NULLIF(b.account_id, 0)
      AND a.percentage = b.percentage
);
SELECT 'tenant_ownership deleted (company)' AS step, ROW_COUNT() AS n;

DELETE x
FROM tenant_ownership x
JOIN tenant t ON t.id = x.tenant_id AND t.tenant_type = 'GROUP'
JOIN c168_net_legacy_20260929.group_ownership b ON b.group_id = t.code
    AND x.owner_type = b.owner_type AND x.account_id <=> NULLIF(b.account_id, 0) AND x.percentage = b.percentage
WHERE NOT EXISTS (
    SELECT 1 FROM c168_net_legacy_20261007.group_ownership a
    WHERE a.group_id = t.code AND a.owner_type = b.owner_type AND NULLIF(a.account_id, 0) <=> NULLIF(b.account_id, 0)
      AND a.percentage = b.percentage
);
SELECT 'tenant_ownership deleted (group)' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 5. tenant_ownership_history: new rows since the baseline, natural key
--    (tenant, effective_month, owner_type, account_id, percentage). saved_by -> owner_code / login_id string.
-- =============================================================================
INSERT INTO tenant_ownership_history
    (tenant_id, effective_month, account_id, owner_type, partner_tenant_id, percentage, read_only, saved_by, saved_at)
SELECT m.new_tenant_id, coh.effective_month, NULLIF(coh.account_id, 0), coh.owner_type, pt.id, coh.percentage, coh.read_only,
       COALESCE(ow.owner_code, u.login_id), coh.saved_at
FROM c168_net_legacy_20261007.company_ownership_history coh
JOIN _map_tenant m ON m.old_type = 'COMPANY' AND m.old_id = coh.company_id
LEFT JOIN tenant pt ON pt.code = coh.partner_group_id AND pt.tenant_type = 'GROUP'
LEFT JOIN owner ow ON ow.id = coh.saved_by
LEFT JOIN user u ON u.id = coh.saved_by
WHERE coh.id NOT IN (SELECT id FROM c168_net_legacy_20260929.company_ownership_history)
  AND NOT EXISTS (
    SELECT 1 FROM tenant_ownership_history h
    WHERE h.tenant_id = m.new_tenant_id AND h.effective_month = coh.effective_month AND h.owner_type = coh.owner_type
      AND h.account_id <=> NULLIF(coh.account_id, 0) AND h.percentage = coh.percentage
);
SELECT 'tenant_ownership_history inserted (company)' AS step, ROW_COUNT() AS n;

INSERT INTO tenant_ownership_history
    (tenant_id, effective_month, account_id, owner_type, partner_tenant_id, percentage, read_only, saved_by, saved_at)
SELECT t.id, goh.effective_month, NULLIF(goh.account_id, 0), goh.owner_type, pt.id, goh.percentage, goh.read_only,
       COALESCE(ow.owner_code, u.login_id), goh.saved_at
FROM c168_net_legacy_20261007.group_ownership_history goh
JOIN tenant t ON t.tenant_type = 'GROUP' AND t.code = goh.group_id
LEFT JOIN tenant pt ON pt.code = goh.partner_group_id AND pt.tenant_type = 'GROUP'
LEFT JOIN owner ow ON ow.id = goh.saved_by
LEFT JOIN user u ON u.id = goh.saved_by
WHERE goh.id NOT IN (SELECT id FROM c168_net_legacy_20260929.group_ownership_history)
  AND NOT EXISTS (
    SELECT 1 FROM tenant_ownership_history h
    WHERE h.tenant_id = t.id AND h.effective_month = goh.effective_month AND h.owner_type = goh.owner_type
      AND h.account_id <=> NULLIF(goh.account_id, 0) AND h.percentage = goh.percentage
);
SELECT 'tenant_ownership_history inserted (group)' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 6. tenant_feature_module + tenant_fee_share_allocation: only for companies NEW since the baseline
--    (or whose JSON changed since the baseline).
-- =============================================================================
INSERT INTO tenant_feature_module (tenant_id, module_id)
SELECT t.id, 1
FROM c168_net_legacy_20261007.company c
LEFT JOIN c168_net_legacy_20260929.company o ON o.id = c.id
JOIN tenant t ON t.tenant_type = 'COMPANY' AND t.code = c.company_id
WHERE c.permissions LIKE '%Games%' AND (o.id IS NULL OR NOT (c.permissions <=> o.permissions))
  AND NOT EXISTS (SELECT 1 FROM tenant_feature_module x WHERE x.tenant_id = t.id AND x.module_id = 1);
SELECT 'tenant_feature_module Games inserted' AS step, ROW_COUNT() AS n;

INSERT INTO tenant_feature_module (tenant_id, module_id)
SELECT t.id, 2
FROM c168_net_legacy_20261007.company c
LEFT JOIN c168_net_legacy_20260929.company o ON o.id = c.id
JOIN tenant t ON t.tenant_type = 'COMPANY' AND t.code = c.company_id
WHERE c.permissions LIKE '%Bank%' AND (o.id IS NULL OR NOT (c.permissions <=> o.permissions))
  AND NOT EXISTS (SELECT 1 FROM tenant_feature_module x WHERE x.tenant_id = t.id AND x.module_id = 2);
SELECT 'tenant_feature_module Bank inserted' AS step, ROW_COUNT() AS n;

INSERT INTO tenant_fee_share_allocation (tenant_id, share_type, account_id, owner_type, percentage, sort_order)
SELECT m.new_tenant_id, cat.share_type,
       CAST(JSON_UNQUOTE(JSON_EXTRACT(c.fee_share_allocations, CONCAT('$.', cat.json_key, '[', idx.i, '].account_id'))) AS UNSIGNED),
       'owner',
       CAST(JSON_UNQUOTE(JSON_EXTRACT(c.fee_share_allocations, CONCAT('$.', cat.json_key, '[', idx.i, '].percentage'))) AS DECIMAL(7,4)),
       idx.i
FROM c168_net_legacy_20261007.company c
LEFT JOIN c168_net_legacy_20260929.company o ON o.id = c.id
JOIN _map_tenant m ON m.old_type = 'COMPANY' AND m.old_id = c.id
CROSS JOIN (
    SELECT 'SALES' AS share_type, 'sales' AS json_key
    UNION ALL SELECT 'CS', 'cs'
    UNION ALL SELECT 'IT', 'it'
    UNION ALL SELECT 'PROFIT', 'profit'
) cat
CROSS JOIN (SELECT 0 AS i UNION ALL SELECT 1) idx
WHERE c.fee_share_allocations IS NOT NULL
  AND (o.id IS NULL OR NOT (c.fee_share_allocations <=> o.fee_share_allocations))
  AND JSON_EXTRACT(c.fee_share_allocations, CONCAT('$.', cat.json_key, '[', idx.i, '].account_id')) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_fee_share_allocation f WHERE f.tenant_id = m.new_tenant_id AND f.share_type = cat.share_type AND f.sort_order = idx.i);
SELECT 'tenant_fee_share_allocation inserted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 7. tenant_auto_renew: follow legacy (user decision 2026-10-07 "跟着旧版的"): any request that has no legacy
--    counterpart (tenant + created_at + status) is removed -- both requests legacy cleaned since the baseline
--    and the pending requests the local backend generated on 2026-10-07 12:22 (ASIA / GT / AJ).
-- =============================================================================
DELETE r
FROM tenant_auto_renew r
WHERE NOT EXISTS (
    SELECT 1
    FROM c168_net_legacy_20261007.company_auto_renew_request a
    JOIN _map_tenant m ON (
        (a.entity_type = 'company' AND m.old_type = 'COMPANY' AND m.old_id = a.company_id)
        OR (a.entity_type = 'group' AND m.old_type = 'GROUP' AND m.old_id = a.group_id))
    WHERE m.new_tenant_id = r.tenant_id AND a.created_at <=> r.created_at AND a.status <=> r.status
);
SELECT 'tenant_auto_renew deleted' AS step, ROW_COUNT() AS n;

DROP TEMPORARY TABLE _map_tenant;
DROP TEMPORARY TABLE _map_currency;

COMMIT;
