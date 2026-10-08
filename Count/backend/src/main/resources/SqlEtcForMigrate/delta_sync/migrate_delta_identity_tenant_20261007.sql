-- Incremental DATA sync, STAGE 1: identity/tenant domain, legacy c168.net PHP DB -> count_real (local rehearsal).
--
-- Source  = `c168_net_legacy_20261007` (c168.net export taken 2026-10-07 10:25).
-- Baseline = `c168_net_legacy_20260929` (the 2026-09-29 09:59 export the last full migration was built from).
-- Target  = count_real.
--
-- Rules (user decision 2026-10-07: legacy is the source of truth, deletions are synced too):
--   * NEW      : legacy rows that count_real does not have yet are inserted.
--   * CHANGED  : only rows that legacy itself changed between the baseline and the source (source <> baseline)
--                are written over count_real. Rows legacy did not touch are left alone, so new-system-only
--                conversions/edits survive.
--   * DELETED  : only rows legacy removed between baseline and source (in baseline, not in source) are removed.
--
-- Decisions baked in:
--   - legacy account.role UPLINE -> SUPPLIER (new system only accepts SUPPLIER).
--   - user id clash: count_real.user.id=546 is a different person (new-system test account TEST ANC) from legacy
--     user 546 (JH). A legacy user is "already present" when created_at AND email both match. Anyone else gets a
--     FRESH id (MAX(id)+1) via _map_user; every later statement goes through that map.
--     (Local rehearsal 2026-10-07: TEST ANC was later deleted on request and JH was renumbered 547 -> 546 to match
--     legacy; the script still recognises JH by created_at+email, so it stays re-runnable either way.)
--   - IT_JK/IT_JS/IT_MS (legacy ids 523/524/525) stay excluded (earlier user decision).
--   - user_company_map rows that were merely re-created with a new row id (same user+company pair) are NOT deletions:
--     deletion is judged on (user, tenant) pairs, not row ids.
--   - account.last_login / user.last_login are synced as well (legacy wins).
--   - CHANGED rows are applied PER COLUMN: a column is overwritten only if legacy changed that column since the
--     baseline. (An earlier version overwrote whole rows and re-locked 14 users as read_only=1; fixed 2026-10-07.)
--
-- Out of scope here (later stages): user ACL (user_tenant_account_access / user_tenant_process_access), currency,
-- ownership, tenant_feature_module / fee share, process, data capture, bank process, transactions.
--
-- Usage:
--   mysql -u root count_real < backend/src/main/resources/SqlEtcForMigrate/delta_sync/migrate_delta_identity_tenant_20261007.sql

START TRANSACTION;

CREATE TEMPORARY TABLE _map_tenant (
    old_type      ENUM('COMPANY','GROUP') NOT NULL,
    old_id        INT NOT NULL,
    new_tenant_id INT NOT NULL,
    PRIMARY KEY (old_type, old_id)
);

CREATE TEMPORARY TABLE _map_user (
    old_id INT NOT NULL PRIMARY KEY,
    new_id INT NOT NULL,
    is_new TINYINT NOT NULL
);

-- =============================================================================
-- 1. owner: new rows only (none expected).
-- =============================================================================
INSERT INTO owner (id, owner_code, name, email, password, secondary_password, status, created_by, created_at)
SELECT id, owner_code, name, email, password, secondary_password, UPPER(status), created_by, created_at
FROM c168_net_legacy_20261007.owner
WHERE id NOT IN (SELECT id FROM owner);
SELECT 'owner inserted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 2. tenant: new company / group rows, parent_id, then legacy-side changes.
-- =============================================================================
INSERT INTO tenant (tenant_type, code, name, owner_id, expiration_date, status, created_by, created_at)
SELECT 'COMPANY', c.company_id, NULL, c.owner_id, c.expiration_date, 'ACTIVE', c.created_by, c.created_at
FROM c168_net_legacy_20261007.company c
WHERE NOT EXISTS (SELECT 1 FROM tenant t WHERE t.tenant_type = 'COMPANY' AND t.code = c.company_id);
SELECT 'tenant COMPANY inserted' AS step, ROW_COUNT() AS n;

INSERT INTO tenant (tenant_type, code, name, owner_id, expiration_date, status, created_by, created_at, updated_at)
SELECT 'GROUP', g.group_code, g.group_name, g.owner_id, g.expiration_date, UPPER(g.status), g.created_by, g.created_at, g.updated_at
FROM c168_net_legacy_20261007.groups g
WHERE NOT EXISTS (SELECT 1 FROM tenant t WHERE t.tenant_type = 'GROUP' AND t.code = g.group_code);
SELECT 'tenant GROUP inserted' AS step, ROW_COUNT() AS n;

INSERT INTO _map_tenant (old_type, old_id, new_tenant_id)
SELECT 'COMPANY', c.id, t.id
FROM c168_net_legacy_20261007.company c
JOIN tenant t ON t.tenant_type = 'COMPANY' AND t.code = c.company_id;

INSERT INTO _map_tenant (old_type, old_id, new_tenant_id)
SELECT 'GROUP', g.id, t.id
FROM c168_net_legacy_20261007.groups g
JOIN tenant t ON t.tenant_type = 'GROUP' AND t.code = g.group_code;

UPDATE tenant t
JOIN c168_net_legacy_20261007.company c ON c.company_id = t.code AND t.tenant_type = 'COMPANY'
JOIN tenant pt ON pt.tenant_type = 'GROUP' AND pt.code = c.group_id
SET t.parent_id = pt.id
WHERE c.group_id IS NOT NULL AND t.parent_id IS NULL;
SELECT 'tenant parent_id backfilled' AS step, ROW_COUNT() AS n;

UPDATE tenant t
JOIN c168_net_legacy_20261007.company a ON t.tenant_type = 'COMPANY' AND t.code = a.company_id
JOIN c168_net_legacy_20260929.company b ON b.id = a.id
SET t.expiration_date = a.expiration_date, t.owner_id = a.owner_id
WHERE NOT (a.expiration_date <=> b.expiration_date AND a.owner_id <=> b.owner_id);
SELECT 'tenant COMPANY changed' AS step, ROW_COUNT() AS n;

UPDATE tenant t
JOIN c168_net_legacy_20261007.groups a ON t.tenant_type = 'GROUP' AND t.code = a.group_code
JOIN c168_net_legacy_20260929.groups b ON b.id = a.id
SET t.expiration_date = a.expiration_date, t.name = a.group_name, t.owner_id = a.owner_id,
    t.status = UPPER(a.status), t.updated_at = a.updated_at
WHERE NOT (a.expiration_date <=> b.expiration_date AND a.group_name <=> b.group_name AND a.owner_id <=> b.owner_id
           AND a.status <=> b.status);
SELECT 'tenant GROUP changed' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 3. account: new rows (UPLINE -> SUPPLIER), then legacy-side changes.
-- =============================================================================
INSERT INTO account (id, account_id, name, password, role, status, created_source,
                      payment_alert, alert_day, alert_specific_date, alert_amount, remark, last_login)
SELECT id, account_id, name, password,
       CASE WHEN UPPER(TRIM(role)) = 'UPLINE' THEN 'SUPPLIER' ELSE role END,
       UPPER(status), created_source,
       payment_alert, alert_day, alert_specific_date, alert_amount, remark, last_login
FROM c168_net_legacy_20261007.account
WHERE id NOT IN (SELECT id FROM account);
SELECT 'account inserted' AS step, ROW_COUNT() AS n;

UPDATE account x
JOIN c168_net_legacy_20261007.account a ON a.id = x.id
JOIN c168_net_legacy_20260929.account b ON b.id = a.id
SET x.account_id = CASE WHEN a.account_id <=> b.account_id THEN x.account_id ELSE a.account_id END,
    x.name = CASE WHEN a.name <=> b.name THEN x.name ELSE a.name END,
    x.password = CASE WHEN a.password <=> b.password THEN x.password ELSE a.password END,
    x.role = CASE WHEN a.role <=> b.role THEN x.role
                  WHEN UPPER(TRIM(a.role)) = 'UPLINE' THEN 'SUPPLIER' ELSE a.role END,
    x.status = CASE WHEN a.status <=> b.status THEN x.status ELSE UPPER(a.status) END,
    x.created_source = CASE WHEN a.created_source <=> b.created_source THEN x.created_source ELSE a.created_source END,
    x.payment_alert = CASE WHEN a.payment_alert <=> b.payment_alert THEN x.payment_alert ELSE a.payment_alert END,
    x.alert_day = CASE WHEN a.alert_day <=> b.alert_day THEN x.alert_day ELSE a.alert_day END,
    x.alert_specific_date = CASE WHEN a.alert_specific_date <=> b.alert_specific_date THEN x.alert_specific_date ELSE a.alert_specific_date END,
    x.alert_amount = CASE WHEN a.alert_amount <=> b.alert_amount THEN x.alert_amount ELSE a.alert_amount END,
    x.remark = CASE WHEN a.remark <=> b.remark THEN x.remark ELSE a.remark END,
    x.last_login = CASE WHEN a.last_login <=> b.last_login THEN x.last_login ELSE a.last_login END
WHERE NOT (a.account_id <=> b.account_id AND a.name <=> b.name AND a.password <=> b.password AND a.role <=> b.role
           AND a.status <=> b.status AND a.created_source <=> b.created_source AND a.payment_alert <=> b.payment_alert
           AND a.alert_day <=> b.alert_day AND a.alert_specific_date <=> b.alert_specific_date
           AND a.alert_amount <=> b.alert_amount AND a.remark <=> b.remark AND a.last_login <=> b.last_login);
SELECT 'account changed' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 4. account_tenant_access: new (account, tenant) pairs; pairs legacy removed.
-- =============================================================================
INSERT INTO account_tenant_access (account_id, tenant_id, created_at, updated_at)
SELECT ac.account_id, m.new_tenant_id, ac.created_at, ac.updated_at
FROM c168_net_legacy_20261007.account_company ac
JOIN _map_tenant m ON m.old_type = 'COMPANY' AND m.old_id = ac.company_id
WHERE NOT EXISTS (
    SELECT 1 FROM account_tenant_access ata
    WHERE ata.account_id = ac.account_id AND ata.tenant_id = m.new_tenant_id
);
SELECT 'account_tenant_access inserted' AS step, ROW_COUNT() AS n;

DELETE ata
FROM account_tenant_access ata
JOIN (
    SELECT b.account_id, m.id AS tenant_id
    FROM c168_net_legacy_20260929.account_company b
    JOIN c168_net_legacy_20260929.company c9 ON c9.id = b.company_id
    JOIN tenant m ON m.tenant_type = 'COMPANY' AND m.code = c9.company_id
    WHERE NOT EXISTS (
        SELECT 1 FROM c168_net_legacy_20261007.account_company a
        JOIN c168_net_legacy_20261007.company c7 ON c7.id = a.company_id
        WHERE a.account_id = b.account_id AND c7.company_id = c9.company_id
    )
) gone ON gone.account_id = ata.account_id AND gone.tenant_id = ata.tenant_id;
SELECT 'account_tenant_access deleted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 5. user: id mapping (clash-safe), new users, legacy-side changes.
--    "already present" = same created_at AND same email (NOT the id: a user that had to take a fresh id on an earlier
--    run, e.g. JH 546 -> 547, must still be recognised so this script stays re-runnable).
-- =============================================================================
INSERT INTO _map_user (old_id, new_id, is_new)
SELECT u.id, x.id, 0
FROM c168_net_legacy_20261007.user u
JOIN user x ON x.created_at <=> u.created_at AND x.email <=> u.email
WHERE u.id NOT IN (523, 524, 525);

SET @next_user_id := (SELECT MAX(id) FROM user);
INSERT INTO _map_user (old_id, new_id, is_new)
SELECT u.id, (@next_user_id := @next_user_id + 1), 1
FROM c168_net_legacy_20261007.user u
WHERE u.id NOT IN (SELECT old_id FROM _map_user) AND u.id NOT IN (523, 524, 525)
ORDER BY u.id;
SELECT 'users already present' AS step, COUNT(*) AS n FROM _map_user WHERE is_new = 0;
SELECT 'users to insert (fresh id when clashing)' AS step, COUNT(*) AS n FROM _map_user WHERE is_new = 1;

INSERT INTO user (id, login_id, name, email, password, secondary_password, role_id, status,
                   read_only, remember_token, remember_token_expires, last_login, created_by, created_at)
SELECT mu.new_id,
       CASE WHEN EXISTS (SELECT 1 FROM user x WHERE x.login_id = u.login_id)
            THEN CONCAT(u.login_id, '_', (SELECT COUNT(*) FROM user x
                                          WHERE x.login_id = u.login_id OR x.login_id LIKE CONCAT(u.login_id, '\_%')))
            ELSE u.login_id END,
       u.name, u.email, u.password, u.secondary_password, ur.id, UPPER(u.status),
       u.read_only, u.remember_token, u.remember_token_expires, u.last_login, u.created_by, u.created_at
FROM c168_net_legacy_20261007.user u
JOIN _map_user mu ON mu.old_id = u.id AND mu.is_new = 1
JOIN user_role ur ON ur.code = CASE LOWER(TRIM(u.role))
    WHEN 'admin'            THEN 'ADMIN'
    WHEN 'manager'          THEN 'MANAGER'
    WHEN 'supervisor'       THEN 'SUPERVISOR'
    WHEN 'accountant'       THEN 'ACCOUNTANT'
    WHEN 'audit'            THEN 'AUDIT'
    WHEN 'customer service' THEN 'CUSTOMER_SERVICE'
    WHEN 'partnership'      THEN 'PARTNERSHIP'
END;
SELECT 'user inserted' AS step, ROW_COUNT() AS n;

UPDATE user x
JOIN _map_user mu ON mu.new_id = x.id AND mu.is_new = 0
JOIN c168_net_legacy_20261007.user a ON a.id = mu.old_id
JOIN c168_net_legacy_20260929.user b ON b.id = a.id
SET x.name = CASE WHEN a.name <=> b.name THEN x.name ELSE a.name END,
    x.email = CASE WHEN a.email <=> b.email THEN x.email ELSE a.email END,
    x.password = CASE WHEN a.password <=> b.password THEN x.password ELSE a.password END,
    x.secondary_password = CASE WHEN a.secondary_password <=> b.secondary_password THEN x.secondary_password ELSE a.secondary_password END,
    x.status = CASE WHEN a.status <=> b.status THEN x.status ELSE UPPER(a.status) END,
    -- read_only: new system deliberately resets it to 0 for everyone except Partnership/Audit
    -- (migrate_admin_read_only_default_false.sql), so only a real legacy change may overwrite it.
    x.read_only = CASE WHEN a.read_only <=> b.read_only THEN x.read_only ELSE a.read_only END,
    x.remember_token = CASE WHEN a.remember_token <=> b.remember_token THEN x.remember_token ELSE a.remember_token END,
    x.remember_token_expires = CASE WHEN a.remember_token_expires <=> b.remember_token_expires THEN x.remember_token_expires ELSE a.remember_token_expires END,
    x.last_login = CASE WHEN a.last_login <=> b.last_login THEN x.last_login ELSE a.last_login END
WHERE NOT (a.name <=> b.name AND a.email <=> b.email AND a.password <=> b.password
           AND a.secondary_password <=> b.secondary_password AND a.status <=> b.status
           AND a.read_only <=> b.read_only AND a.remember_token <=> b.remember_token
           AND a.remember_token_expires <=> b.remember_token_expires AND a.last_login <=> b.last_login);
SELECT 'user changed' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 6. user_tenant_access: new (user, tenant) pairs from user_company_map + user_group_map;
--    pairs that no longer exist in legacy (judged on pairs, not row ids).
-- =============================================================================
INSERT INTO user_tenant_access (user_id, tenant_id)
SELECT DISTINCT mu.new_id, m.new_tenant_id
FROM c168_net_legacy_20261007.user_company_map m2
JOIN _map_user mu ON mu.old_id = m2.user_id
JOIN _map_tenant m ON m.old_type = 'COMPANY' AND m.old_id = m2.company_id
WHERE NOT EXISTS (SELECT 1 FROM user_tenant_access uta WHERE uta.user_id = mu.new_id AND uta.tenant_id = m.new_tenant_id);
SELECT 'user_tenant_access inserted (company)' AS step, ROW_COUNT() AS n;

INSERT INTO user_tenant_access (user_id, tenant_id)
SELECT DISTINCT mu.new_id, m.new_tenant_id
FROM c168_net_legacy_20261007.user_group_map g2
JOIN _map_user mu ON mu.old_id = g2.user_id
JOIN _map_tenant m ON m.old_type = 'GROUP' AND m.old_id = g2.group_id
WHERE NOT EXISTS (SELECT 1 FROM user_tenant_access uta WHERE uta.user_id = mu.new_id AND uta.tenant_id = m.new_tenant_id);
SELECT 'user_tenant_access inserted (group)' AS step, ROW_COUNT() AS n;

DELETE uta
FROM user_tenant_access uta
JOIN (
    SELECT b.user_id, t.id AS tenant_id
    FROM c168_net_legacy_20260929.user_company_map b
    JOIN c168_net_legacy_20260929.company c9 ON c9.id = b.company_id
    JOIN tenant t ON t.tenant_type = 'COMPANY' AND t.code = c9.company_id
    WHERE NOT EXISTS (
        SELECT 1 FROM c168_net_legacy_20261007.user_company_map a
        JOIN c168_net_legacy_20261007.company c7 ON c7.id = a.company_id
        WHERE a.user_id = b.user_id AND c7.company_id = c9.company_id
    )
    UNION
    SELECT b.user_id, t.id
    FROM c168_net_legacy_20260929.user_group_map b
    JOIN c168_net_legacy_20260929.groups g9 ON g9.id = b.group_id
    JOIN tenant t ON t.tenant_type = 'GROUP' AND t.code = g9.group_code
    WHERE NOT EXISTS (
        SELECT 1 FROM c168_net_legacy_20261007.user_group_map a
        JOIN c168_net_legacy_20261007.groups g7 ON g7.id = a.group_id
        WHERE a.user_id = b.user_id AND g7.group_code = g9.group_code
    )
) gone ON gone.user_id = uta.user_id AND gone.tenant_id = uta.tenant_id;
SELECT 'user_tenant_access deleted' AS step, ROW_COUNT() AS n;

DROP TEMPORARY TABLE _map_user;
DROP TEMPORARY TABLE _map_tenant;

COMMIT;
