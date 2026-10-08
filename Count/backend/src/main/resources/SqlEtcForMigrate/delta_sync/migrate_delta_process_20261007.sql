-- Incremental DATA sync, STAGE 3: Process domain (GAME category) + per-user PROCESS visibility ACL,
-- legacy c168.net PHP DB -> count_real (local rehearsal).
--
-- Source = `c168_net_legacy_20261007`   Baseline = `c168_net_legacy_20260929`   Target = count_real.
-- Run AFTER migrate_delta_identity_tenant_20261007.sql, migrate_delta_currency_domain_20261007.sql and
-- migrate_delta_user_acl_account_20261007.sql.
--
-- Rules (same as the other stages): NEW rows since the baseline are inserted (ids preserved); CHANGED = only
-- what legacy changed since the baseline, per column; DELETED = only what legacy removed since the baseline.
-- Rows that exist only in count_real are never touched.
--
-- Notes:
--   - process.code is NOT made unique any more (migrate_process_code_allow_duplicate.sql): the same code may repeat
--     under one tenant; what must stay unique is (tenant, category, code, description), enforced by the
--     trg_pdl_* / trg_process_* triggers. So the code is copied as-is (no _1/_2 suffixes) -- if a new row ever
--     collides on (code, description) the trigger aborts this script and the row needs a merge decision.
--   - legacy ids that were merged away earlier (process_duplicate_merge_map) are never re-inserted and are
--     resolved to their canonical id wherever a process id is referenced (ACL, copied_from).
--   - process_submitted is NOT in this script: it needs data_captures (stage 4).
--
-- Usage:
--   mysql -u root count_real < backend/src/main/resources/SqlEtcForMigrate/delta_sync/migrate_delta_process_20261007.sql

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

-- =============================================================================
-- 1. process_description: new rows since the baseline, id preserved.
-- =============================================================================
INSERT INTO process_description (id, tenant_id, name, created_at)
SELECT d.id, m.new_tenant_id, d.name, CURRENT_TIMESTAMP
FROM c168_net_legacy_20261007.description d
JOIN _map_tenant m ON m.old_type = 'COMPANY' AND m.old_id = d.company_id
WHERE d.id NOT IN (SELECT id FROM c168_net_legacy_20260929.description)
  AND d.id NOT IN (SELECT id FROM process_description);
SELECT 'process_description inserted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 2. process: new rows since the baseline, id preserved, code copied as-is.
-- =============================================================================
INSERT INTO process
    (id, tenant_id, category, code, currency_id, remove_word, replace_word_from, replace_word_to,
     remark, status, created_by, updated_by, created_at, updated_at)
SELECT
    x.id, m.new_tenant_id, 'GAME', x.process_id, mc.survivor_id,
    x.remove_word, x.replace_word_from, x.replace_word_to, x.remark,
    CASE WHEN x.status = 'active' THEN 'ACTIVE' ELSE 'INACTIVE' END,
    CASE WHEN x.created_by_type = 'owner' THEN cow.owner_code ELSE cu.login_id END,
    CASE WHEN x.modified_by_type = 'owner' THEN mow.owner_code ELSE mu.login_id END,
    x.dts_created,
    COALESCE(x.dts_modified, x.dts_created)
FROM c168_net_legacy_20261007.process x
JOIN _map_tenant m ON m.old_type = 'COMPANY' AND m.old_id = x.company_id
JOIN _map_currency mc ON mc.old_currency_id = x.currency_id
LEFT JOIN owner cow ON cow.id = x.created_by_owner_id AND x.created_by_type = 'owner'
LEFT JOIN user cu ON cu.id = x.created_by AND x.created_by_type = 'user'
LEFT JOIN owner mow ON mow.id = x.modified_by_owner_id AND x.modified_by_type = 'owner'
LEFT JOIN user mu ON mu.id = x.modified_by AND x.modified_by_type = 'user'
WHERE x.id NOT IN (SELECT id FROM c168_net_legacy_20260929.process)
  AND x.id NOT IN (SELECT id FROM process)
  AND x.id NOT IN (SELECT old_process_id FROM process_duplicate_merge_map);
SELECT 'process inserted' AS step, ROW_COUNT() AS n;

-- copied_from_process_id for the new rows (resolve through the merge map; only if the target exists)
UPDATE process pr
JOIN c168_net_legacy_20261007.process p ON p.id = pr.id
LEFT JOIN process_duplicate_merge_map pm ON pm.old_process_id = p.sync_source_process_id
SET pr.copied_from_process_id = COALESCE(pm.canonical_process_id, p.sync_source_process_id)
WHERE p.sync_source_process_id IS NOT NULL
  AND p.id NOT IN (SELECT id FROM c168_net_legacy_20260929.process)
  AND pr.copied_from_process_id IS NULL
  AND EXISTS (SELECT 1 FROM process t2 WHERE t2.id = COALESCE(pm.canonical_process_id, p.sync_source_process_id));
SELECT 'process copied_from set' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 3. process_description_link: one row per newly inserted process.
-- =============================================================================
INSERT INTO process_description_link (process_id, description_id)
SELECT p.id, p.description_id
FROM c168_net_legacy_20261007.process p
WHERE p.id NOT IN (SELECT id FROM c168_net_legacy_20260929.process)
  AND EXISTS (SELECT 1 FROM process pr2 WHERE pr2.id = p.id)
  AND EXISTS (SELECT 1 FROM process_description d WHERE d.id = p.description_id)
  AND NOT EXISTS (SELECT 1 FROM process_description_link l WHERE l.process_id = p.id);
SELECT 'process_description_link inserted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 4. process: legacy-side changes since the baseline, per column.
-- =============================================================================
UPDATE process pr
JOIN c168_net_legacy_20261007.process a ON a.id = pr.id
JOIN c168_net_legacy_20260929.process b ON b.id = a.id
LEFT JOIN owner mow ON mow.id = a.modified_by_owner_id AND a.modified_by_type = 'owner'
LEFT JOIN user mu ON mu.id = a.modified_by AND a.modified_by_type = 'user'
LEFT JOIN _map_currency mc ON mc.old_currency_id = a.currency_id
SET pr.remove_word = CASE WHEN a.remove_word <=> b.remove_word THEN pr.remove_word ELSE a.remove_word END,
    pr.replace_word_from = CASE WHEN a.replace_word_from <=> b.replace_word_from THEN pr.replace_word_from ELSE a.replace_word_from END,
    pr.replace_word_to = CASE WHEN a.replace_word_to <=> b.replace_word_to THEN pr.replace_word_to ELSE a.replace_word_to END,
    pr.remark = CASE WHEN a.remark <=> b.remark THEN pr.remark ELSE a.remark END,
    pr.status = CASE WHEN a.status <=> b.status THEN pr.status
                     WHEN a.status = 'active' THEN 'ACTIVE' ELSE 'INACTIVE' END,
    pr.currency_id = CASE WHEN a.currency_id <=> b.currency_id THEN pr.currency_id ELSE COALESCE(mc.survivor_id, pr.currency_id) END,
    pr.updated_by = CASE WHEN a.modified_by_type <=> b.modified_by_type AND a.modified_by <=> b.modified_by
                              AND a.modified_by_owner_id <=> b.modified_by_owner_id AND a.dts_modified <=> b.dts_modified
                         THEN pr.updated_by
                         WHEN a.modified_by_type = 'owner' THEN mow.owner_code ELSE mu.login_id END,
    pr.updated_at = CASE WHEN a.dts_modified <=> b.dts_modified THEN pr.updated_at
                         ELSE COALESCE(a.dts_modified, pr.updated_at) END
WHERE NOT (a.remove_word <=> b.remove_word AND a.replace_word_from <=> b.replace_word_from
           AND a.replace_word_to <=> b.replace_word_to AND a.remark <=> b.remark AND a.status <=> b.status
           AND a.currency_id <=> b.currency_id AND a.modified_by_type <=> b.modified_by_type
           AND a.modified_by <=> b.modified_by AND a.modified_by_owner_id <=> b.modified_by_owner_id
           AND a.dts_modified <=> b.dts_modified);
SELECT 'process changed' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 5. process_day: new pairs for processes that exist; pairs legacy removed since the baseline.
-- =============================================================================
INSERT INTO process_day (process_id, day_of_week)
SELECT pd.process_id, pd.day_id
FROM c168_net_legacy_20261007.process_day pd
WHERE EXISTS (SELECT 1 FROM process pr2 WHERE pr2.id = pd.process_id)
  AND NOT EXISTS (SELECT 1 FROM process_day x WHERE x.process_id = pd.process_id AND x.day_of_week = pd.day_id)
  AND NOT EXISTS (SELECT 1 FROM c168_net_legacy_20260929.process_day o WHERE o.process_id = pd.process_id AND o.day_id = pd.day_id);
SELECT 'process_day inserted' AS step, ROW_COUNT() AS n;

DELETE x
FROM process_day x
JOIN c168_net_legacy_20260929.process_day b ON b.process_id = x.process_id AND b.day_id = x.day_of_week
WHERE NOT EXISTS (SELECT 1 FROM c168_net_legacy_20261007.process_day a WHERE a.process_id = b.process_id AND a.day_id = b.day_id);
SELECT 'process_day deleted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 6. Per-user PROCESS visibility ACL (legacy user_company_permissions.process_permissions):
--    only rows that are NEW or whose process_permissions changed since the baseline; mirror the allow-list.
--    Entries are legacy process ids resolved through process_duplicate_merge_map; missing processes are skipped.
-- =============================================================================
CREATE TEMPORARY TABLE _numbers (i INT PRIMARY KEY);
INSERT INTO _numbers (i)
SELECT (h.n + t.n + o.n)
FROM (SELECT 0 n UNION ALL SELECT 100 UNION ALL SELECT 200 UNION ALL SELECT 300 UNION ALL SELECT 400
      UNION ALL SELECT 500 UNION ALL SELECT 600 UNION ALL SELECT 700) h,
     (SELECT 0 n UNION ALL SELECT 10 UNION ALL SELECT 20 UNION ALL SELECT 30 UNION ALL SELECT 40
      UNION ALL SELECT 50 UNION ALL SELECT 60 UNION ALL SELECT 70 UNION ALL SELECT 80 UNION ALL SELECT 90) t,
     (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) o;

CREATE TEMPORARY TABLE _pscope (
    ucp_id BIGINT NOT NULL PRIMARY KEY,
    uta_id BIGINT UNSIGNED NOT NULL,
    n_perm INT NOT NULL
);
INSERT INTO _pscope (ucp_id, uta_id, n_perm)
SELECT p.id, uta.id, IFNULL(JSON_LENGTH(p.process_permissions), 0)
FROM c168_net_legacy_20261007.user_company_permissions p
JOIN c168_net_legacy_20261007.company c ON c.id = p.company_id
JOIN tenant t ON t.tenant_type = 'COMPANY' AND t.code = c.company_id
JOIN user_tenant_access uta ON uta.user_id = p.user_id AND uta.tenant_id = t.id
LEFT JOIN c168_net_legacy_20260929.user_company_permissions o ON o.id = p.id
WHERE o.id IS NULL OR NOT (p.process_permissions <=> o.process_permissions);
SELECT 'process-permission rows in scope' AS step, COUNT(*) AS n FROM _pscope;

CREATE TEMPORARY TABLE _pwant (
    uta_id     BIGINT UNSIGNED NOT NULL,
    process_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (uta_id, process_id)
);
INSERT INTO _pwant (uta_id, process_id)
SELECT DISTINCT s.uta_id,
       COALESCE(pm.canonical_process_id,
                CAST(JSON_UNQUOTE(JSON_EXTRACT(p.process_permissions, CONCAT('$[', n.i, '].id'))) AS UNSIGNED))
FROM _pscope s
JOIN c168_net_legacy_20261007.user_company_permissions p ON p.id = s.ucp_id
JOIN _numbers n ON n.i < s.n_perm
LEFT JOIN process_duplicate_merge_map pm
    ON pm.old_process_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(p.process_permissions, CONCAT('$[', n.i, '].id'))) AS UNSIGNED)
JOIN process pr
    ON pr.id = COALESCE(pm.canonical_process_id,
                        CAST(JSON_UNQUOTE(JSON_EXTRACT(p.process_permissions, CONCAT('$[', n.i, '].id'))) AS UNSIGNED));

UPDATE user_tenant_access uta
JOIN _pscope s ON s.uta_id = uta.id
SET uta.process_acl_mode = IF(s.n_perm > 0, 'CUSTOM', 'NONE')
WHERE uta.process_acl_mode <> IF(s.n_perm > 0, 'CUSTOM', 'NONE');
SELECT 'process_acl_mode changed' AS step, ROW_COUNT() AS n;

INSERT INTO user_tenant_process_access (user_tenant_access_id, process_id)
SELECT w.uta_id, w.process_id
FROM _pwant w
WHERE NOT EXISTS (SELECT 1 FROM user_tenant_process_access x WHERE x.user_tenant_access_id = w.uta_id AND x.process_id = w.process_id);
SELECT 'process allow-list entries added' AS step, ROW_COUNT() AS n;

DELETE x
FROM user_tenant_process_access x
JOIN _pscope s ON s.uta_id = x.user_tenant_access_id
WHERE NOT EXISTS (SELECT 1 FROM _pwant w WHERE w.uta_id = x.user_tenant_access_id AND w.process_id = x.process_id);
SELECT 'process allow-list entries removed' AS step, ROW_COUNT() AS n;

DROP TEMPORARY TABLE _pwant;
DROP TEMPORARY TABLE _pscope;
DROP TEMPORARY TABLE _numbers;
DROP TEMPORARY TABLE _map_tenant;
DROP TEMPORARY TABLE _map_currency;

COMMIT;
