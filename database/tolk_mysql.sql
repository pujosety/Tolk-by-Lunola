-- ============================================================================
-- Tolk by Lunola — Production SQL Schema (MySQL 8 / MariaDB / Wasmer DB)
-- Clean schema without dummy data.
-- Import directly via Wasmer "Open database explorer" (Adminer) -> Import.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `username` VARCHAR(64) NOT NULL,
  `display_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(160) DEFAULT NULL,
  `bio` TEXT NOT NULL,
  `status_text` VARCHAR(180) DEFAULT NULL,
  `avatar_url` TEXT DEFAULT NULL,
  `avatar_color` VARCHAR(32) NOT NULL DEFAULT '#8B112B',
  `verified` TINYINT(1) NOT NULL DEFAULT 0,
  `is_guest` TINYINT(1) NOT NULL DEFAULT 0,
  `role` VARCHAR(32) NOT NULL DEFAULT 'user',
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `password_hash` VARCHAR(255) DEFAULT NULL,
  `password_salt` VARCHAR(128) DEFAULT NULL,
  `preferences_json` LONGTEXT NOT NULL,
  `created_at` BIGINT NOT NULL,
  `last_seen` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role_status` (`role`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `device_name` VARCHAR(160) NOT NULL,
  `platform` VARCHAR(64) NOT NULL,
  `user_agent` VARCHAR(255) NOT NULL,
  `ip` VARCHAR(128) NOT NULL,
  `created_at` BIGINT NOT NULL,
  `last_active_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sessions_user_id` (`user_id`),
  KEY `idx_sessions_last_active` (`last_active_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chats` (
  `id` VARCHAR(96) NOT NULL,
  `type` VARCHAR(24) NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `handle` VARCHAR(96) DEFAULT NULL,
  `description` TEXT NOT NULL,
  `avatar_url` TEXT DEFAULT NULL,
  `avatar_color` VARCHAR(32) NOT NULL DEFAULT '#8B112B',
  `member_ids_json` LONGTEXT NOT NULL,
  `admin_ids_json` LONGTEXT NOT NULL,
  `moderator_ids_json` LONGTEXT NOT NULL,
  `admin_only_post` TINYINT(1) NOT NULL DEFAULT 0,
  `pinned_message_id` VARCHAR(96) DEFAULT NULL,
  `self_destruct_sec` INT NOT NULL DEFAULT 0,
  `subscriber_count` INT DEFAULT NULL,
  `invite_expires_at` BIGINT DEFAULT NULL,
  `invite_max_uses` INT DEFAULT NULL,
  `invite_uses` INT NOT NULL DEFAULT 0,
  `suspended` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_chats_type` (`type`),
  KEY `idx_chats_handle` (`handle`),
  KEY `idx_chats_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `messages` (
  `id` VARCHAR(96) NOT NULL,
  `chat_id` VARCHAR(96) NOT NULL,
  `sender_id` VARCHAR(64) NOT NULL,
  `text` LONGTEXT NOT NULL,
  `is_scheduled` TINYINT(1) NOT NULL DEFAULT 0,
  `scheduled_for` BIGINT DEFAULT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `created_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_messages_chat_created` (`chat_id`, `created_at`),
  KEY `idx_messages_scheduled` (`is_scheduled`, `scheduled_for`),
  KEY `idx_messages_sender` (`sender_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stories` (
  `id` VARCHAR(96) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `kind` VARCHAR(24) NOT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `created_at` BIGINT NOT NULL,
  `expires_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_stories_user` (`user_id`),
  KEY `idx_stories_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `calls` (
  `id` VARCHAR(96) NOT NULL,
  `caller_id` VARCHAR(64) NOT NULL,
  `callee_id` VARCHAR(64) NOT NULL,
  `kind` VARCHAR(16) NOT NULL,
  `status` VARCHAR(24) NOT NULL,
  `started_at` BIGINT NOT NULL,
  `ended_at` BIGINT DEFAULT NULL,
  `duration_sec` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_calls_participants` (`caller_id`, `callee_id`),
  KEY `idx_calls_started` (`started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reports` (
  `id` VARCHAR(96) NOT NULL,
  `reporter_id` VARCHAR(64) NOT NULL,
  `target_type` VARCHAR(32) NOT NULL,
  `target_id` VARCHAR(96) NOT NULL,
  `target_label` VARCHAR(200) NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `reason` TEXT NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'open',
  `moderator_note` TEXT NOT NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_reports_status` (`status`),
  KEY `idx_reports_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(96) NOT NULL,
  `actor_id` VARCHAR(64) NOT NULL,
  `actor_name` VARCHAR(120) NOT NULL,
  `actor_role` VARCHAR(32) NOT NULL,
  `action` VARCHAR(96) NOT NULL,
  `target` VARCHAR(160) NOT NULL,
  `details` TEXT NOT NULL,
  `created_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_created` (`created_at`),
  KEY `idx_audit_actor` (`actor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `platform_settings` (
  `id` TINYINT NOT NULL DEFAULT 1,
  `settings_json` LONGTEXT NOT NULL,
  `admin_passcode_hash` VARCHAR(255) DEFAULT NULL,
  `admin_passcode_salt` VARCHAR(128) DEFAULT NULL,
  `last_backup_at` BIGINT DEFAULT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `platform_settings` (
  `id`,
  `settings_json`,
  `admin_passcode_hash`,
  `admin_passcode_salt`,
  `last_backup_at`,
  `updated_at`
) VALUES (
  1,
  '{"appName":"Tolk by Lunola","allowRegistration":true,"maxUploadMb":10,"storyExpiryHours":24,"maxGroupMembers":500,"rateLimitPerMin":120,"maintenanceMode":false,"globalAnnouncement":"","pushEnabled":true}',
  NULL,
  NULL,
  NULL,
  UNIX_TIMESTAMP() * 1000
);
