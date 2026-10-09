-- Adds the AUTORENEW sidebar permission (C168-only, like DOMAIN / ANNOUNCEMENTS).
--
-- Sidebar order becomes: HOME, DOMAIN, ANNOUNCEMENTS, AUTORENEW, ADMIN, ACCOUNT, OWNERSHIP,
-- PROCESS, DATACAPTURE, PAYMENT, REPORT, MAINTENANCE.
--
-- AUTORENEW is deliberately NOT bound to any role in user_role_permission: PermissionServiceImpl
-- injects it at runtime for C168 sessions (C168_EXTRA_PERMISSION_CODES), same as DOMAIN / ANNOUNCEMENTS.
--
-- Safe to re-run: INSERT IGNORE + absolute sort_order values (no relative "+1").
-- Example: mysql -u root count_real < backend/src/main/resources/sql/migrate_add_auto_renew_permission.sql

INSERT IGNORE INTO `permission` (`id`, `code`, `name`, `sort_order`, `requires_feature_id`, `status`)
VALUES (12, 'AUTORENEW', 'Auto Renew', 4, NULL, 'ACTIVE');

UPDATE `permission`
SET `sort_order` = CASE `code`
    WHEN 'HOME'          THEN 1
    WHEN 'DOMAIN'        THEN 2
    WHEN 'ANNOUNCEMENTS' THEN 3
    WHEN 'AUTORENEW'    THEN 4
    WHEN 'ADMIN'         THEN 5
    WHEN 'ACCOUNT'       THEN 6
    WHEN 'OWNERSHIP'     THEN 7
    WHEN 'PROCESS'       THEN 8
    WHEN 'DATACAPTURE'   THEN 9
    WHEN 'PAYMENT'       THEN 10
    WHEN 'REPORT'        THEN 11
    WHEN 'MAINTENANCE'   THEN 12
    ELSE `sort_order`
END
WHERE `code` IN ('HOME', 'DOMAIN', 'ANNOUNCEMENTS', 'AUTORENEW', 'ADMIN', 'ACCOUNT', 'OWNERSHIP',
                 'PROCESS', 'DATACAPTURE', 'PAYMENT', 'REPORT', 'MAINTENANCE');
