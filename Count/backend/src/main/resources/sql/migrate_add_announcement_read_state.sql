-- Adds `announcement_read_state`: per-login-account "announcements last read at" marker, so the
-- unread badge is per account (not per company / per browser).
--
-- Key = (user_type, user_id):
--   user_type 'user'   -> `user`.id     (Admin-tab staff accounts)
--   user_type 'owner'  -> `owner`.id
--   user_type 'member' -> `account`.id
-- The three id spaces overlap, so user_type is part of the key. IT operators have no DB row and
-- are intentionally not tracked (no unread badge for them).
--
-- Unread rule (computed in SQL, DB clock only):
--   unread = ACTIVE C168 announcements with created_at > COALESCE(last_read_at, <account.created_at>)
-- i.e. an account with no row yet only sees announcements published after it was created.
--
-- Backfill: every existing account gets last_read_at = migration time, so nobody suddenly sees a
-- badge for announcements published before this rollout.
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS + INSERT IGNORE.
-- Example: mysql -u root count_real < backend/src/main/resources/sql/migrate_add_announcement_read_state.sql

CREATE TABLE IF NOT EXISTS `announcement_read_state` (
    `user_type`    VARCHAR(16)  NOT NULL,
    `user_id`      INT UNSIGNED NOT NULL,
    `last_read_at` DATETIME     NOT NULL,
    `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_type`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `announcement_read_state` (`user_type`, `user_id`, `last_read_at`)
SELECT 'user', id, NOW() FROM `user`;

INSERT IGNORE INTO `announcement_read_state` (`user_type`, `user_id`, `last_read_at`)
SELECT 'owner', id, NOW() FROM `owner`;

INSERT IGNORE INTO `announcement_read_state` (`user_type`, `user_id`, `last_read_at`)
SELECT 'member', id, NOW() FROM `account`;
