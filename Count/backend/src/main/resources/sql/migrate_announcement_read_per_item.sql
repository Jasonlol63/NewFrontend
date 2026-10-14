-- Replaces `announcement_read_state` (one "last read at" per account) with `announcement_read`
-- (one row per account per announcement), so announcements can be marked read one by one.
--
-- Key = (user_type, user_id, announcement_id); user_type is 'user' | 'owner' | 'member' (the three id
-- spaces overlap). IT operators have no DB row and are not tracked.
--
-- Unread rule (computed in SQL, DB clock only):
--   ACTIVE C168 announcement, created_at > the account's own created_at, and no row here.
-- "Mark all as read" inserts a row for every announcement that is currently unread.
-- Deleting an announcement deletes its read rows (ON DELETE CASCADE).
--
-- Backfill: whatever an account had already read by its old last_read_at stays read.
-- Safe to re-run. Example: mysql -u root count_real < backend/src/main/resources/sql/migrate_announcement_read_per_item.sql

CREATE TABLE IF NOT EXISTS `announcement_read` (
    `user_type`       VARCHAR(16)  NOT NULL,
    `user_id`         INT UNSIGNED NOT NULL,
    `announcement_id` INT UNSIGNED NOT NULL,
    `read_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_type`, `user_id`, `announcement_id`),
    KEY `idx_announcement_read_announcement` (`announcement_id`),
    CONSTRAINT `fk_announcement_read_announcement`
        FOREIGN KEY (`announcement_id`) REFERENCES `announcements` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `announcement_read` (`user_type`, `user_id`, `announcement_id`, `read_at`)
SELECT rs.user_type, rs.user_id, a.id, rs.last_read_at
FROM `announcement_read_state` rs
JOIN `announcements` a ON a.created_at <= rs.last_read_at;

-- Once the new backend is live and checked, the old table is not used any more:
-- DROP TABLE `announcement_read_state`;
