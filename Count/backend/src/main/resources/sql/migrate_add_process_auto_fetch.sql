-- Process > Auto Fetch: the report website a GAME process reads its Data Capture Table from (Citibet sites such as
-- riding168.com). One row per process; the password and PIN are AES-GCM encrypted with the server's AUTOFETCH_SECRET_KEY
-- (application.yml autofetch.secret-key), so the database alone never holds them in clear text.
-- The days it runs on are the process's own Day Use (process_day); the report week is "Last week" of the capture date.
CREATE TABLE IF NOT EXISTS `process_auto_fetch` (
    `id`                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `process_id`         INT UNSIGNED NOT NULL COMMENT 'FK process.id（一个 process 一行）',
    `tenant_id`          INT UNSIGNED NOT NULL COMMENT 'FK tenant.id（与 process.tenant_id 相同，便于按租户取）',
    `provider`           VARCHAR(20)  NOT NULL DEFAULT 'CITIBET' COMMENT '报表网站类型；目前只有 CITIBET',
    `enabled`            TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '0=关闭（保留账号，打开时不用重填）',
    `site_url`           VARCHAR(255) NOT NULL COMMENT '网站地址，如 https://www.riding168.com',
    `login_username`     VARCHAR(100) NOT NULL COMMENT '网站登录用户名',
    `login_password_enc` VARCHAR(512) NOT NULL COMMENT '网站登录密码，AES-GCM 密文',
    `login_pin_enc`      VARCHAR(512) DEFAULT NULL COMMENT '网站 PIN，AES-GCM 密文',
    `created_by`         VARCHAR(50)  DEFAULT NULL COMMENT '创建人 login_id',
    `updated_by`         VARCHAR(50)  DEFAULT NULL COMMENT '修改人 login_id',
    `created_at`         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_process_auto_fetch_process` (`process_id`),
    KEY `idx_process_auto_fetch_tenant` (`tenant_id`),
    CONSTRAINT `fk_process_auto_fetch_process` FOREIGN KEY (`process_id`) REFERENCES `process` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_process_auto_fetch_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Process 自动抓取报表的网站与账号（密码/PIN 加密）';
