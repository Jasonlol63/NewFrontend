-- Incremental DATA sync, STAGE 1b: per-user ACCOUNT visibility (legacy user_company_permissions.account_permissions)
-- -> user_tenant_access.account_acl_mode + user_tenant_account_access, legacy c168.net -> count_real (local rehearsal).
--
-- Source = `c168_net_legacy_20261007`   Baseline = `c168_net_legacy_20260929`   Target = count_real.
-- Run after migrate_delta_identity_tenant_20261007.sql (user_tenant_access rows must exist).
--
-- Why: the stage-1 script only created user/tenant/account rows. Each user's allow-list of visible accounts is a
-- separate table, so users with a CUSTOM list (e.g. JK on AG/C168/CX) could not see any account added since 9/29.
--
-- Rules (same as the other stages): only legacy permission rows that are NEW since the baseline, or whose
-- account_permissions JSON changed since the baseline, are applied. For those rows the allow-list is mirrored to
-- legacy (missing entries added, entries legacy no longer has removed). Entries that reference an account that no
-- longer exists are skipped. Rows that cannot be resolved to a user_tenant_access row (e.g. the IT_* users) are left
-- alone.
--
-- NOT handled here: process_permissions / process_acl_mode (needs the Process stage first -- run the process ACL
-- sync after migrate_delta_process_20261007.sql).
--
-- Usage:
--   mysql -u root count_real < backend/src/main/resources/SqlEtcForMigrate/delta_sync/migrate_delta_user_acl_account_20261007.sql

START TRANSACTION;

CREATE TEMPORARY TABLE _numbers (i INT PRIMARY KEY);
INSERT INTO _numbers (i)
SELECT (h.n + t.n + o.n)
FROM (SELECT 0 n UNION ALL SELECT 100 UNION ALL SELECT 200 UNION ALL SELECT 300 UNION ALL SELECT 400
      UNION ALL SELECT 500 UNION ALL SELECT 600 UNION ALL SELECT 700) h,
     (SELECT 0 n UNION ALL SELECT 10 UNION ALL SELECT 20 UNION ALL SELECT 30 UNION ALL SELECT 40
      UNION ALL SELECT 50 UNION ALL SELECT 60 UNION ALL SELECT 70 UNION ALL SELECT 80 UNION ALL SELECT 90) t,
     (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) o;

-- legacy permission rows in scope (new or account_permissions changed), resolved to a user_tenant_access row
CREATE TEMPORARY TABLE _scope (
    ucp_id BIGINT NOT NULL PRIMARY KEY,
    uta_id BIGINT UNSIGNED NOT NULL,
    n_perm INT NOT NULL
);
INSERT INTO _scope (ucp_id, uta_id, n_perm)
SELECT p.id, uta.id, IFNULL(JSON_LENGTH(p.account_permissions), 0)
FROM c168_net_legacy_20261007.user_company_permissions p
JOIN c168_net_legacy_20261007.company c ON c.id = p.company_id
JOIN tenant t ON t.tenant_type = 'COMPANY' AND t.code = c.company_id
JOIN user_tenant_access uta ON uta.user_id = p.user_id AND uta.tenant_id = t.id
LEFT JOIN c168_net_legacy_20260929.user_company_permissions o ON o.id = p.id
WHERE o.id IS NULL OR NOT (p.account_permissions <=> o.account_permissions);
SELECT 'permission rows in scope' AS step, COUNT(*) AS n FROM _scope;

-- the legacy allow-list for those rows (accounts that still exist only)
CREATE TEMPORARY TABLE _want (
    uta_id     BIGINT UNSIGNED NOT NULL,
    account_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (uta_id, account_id)
);
INSERT INTO _want (uta_id, account_id)
SELECT DISTINCT s.uta_id, a.id
FROM _scope s
JOIN c168_net_legacy_20261007.user_company_permissions p ON p.id = s.ucp_id
JOIN _numbers n ON n.i < s.n_perm
JOIN account a ON a.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(p.account_permissions, CONCAT('$[', n.i, '].id'))) AS UNSIGNED);

-- 1. mode: CUSTOM for a non-empty list, NONE for an explicit empty list (same rule as the full migration)
UPDATE user_tenant_access uta
JOIN _scope s ON s.uta_id = uta.id
SET uta.account_acl_mode = IF(s.n_perm > 0, 'CUSTOM', 'NONE')
WHERE uta.account_acl_mode <> IF(s.n_perm > 0, 'CUSTOM', 'NONE');
SELECT 'account_acl_mode changed' AS step, ROW_COUNT() AS n;

-- 2. entries legacy has that count_real does not
INSERT INTO user_tenant_account_access (user_tenant_access_id, account_id)
SELECT w.uta_id, w.account_id
FROM _want w
WHERE NOT EXISTS (SELECT 1 FROM user_tenant_account_access x WHERE x.user_tenant_access_id = w.uta_id AND x.account_id = w.account_id);
SELECT 'account allow-list entries added' AS step, ROW_COUNT() AS n;

-- 3. entries count_real has that legacy no longer has (only for rows in scope)
DELETE x
FROM user_tenant_account_access x
JOIN _scope s ON s.uta_id = x.user_tenant_access_id
WHERE NOT EXISTS (SELECT 1 FROM _want w WHERE w.uta_id = x.user_tenant_access_id AND w.account_id = x.account_id);
SELECT 'account allow-list entries removed' AS step, ROW_COUNT() AS n;

DROP TEMPORARY TABLE _want;
DROP TEMPORARY TABLE _scope;
DROP TEMPORARY TABLE _numbers;

COMMIT;
