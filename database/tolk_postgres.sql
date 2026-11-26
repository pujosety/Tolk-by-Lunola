-- ============================================================================
-- Tolk by Lunola — Production SQL Schema (PostgreSQL / Wasmer DB)
-- Clean schema without dummy data.
-- Import directly via Wasmer "Open database explorer" (Adminer) -> Import.
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  email VARCHAR(160) UNIQUE,
  bio TEXT NOT NULL DEFAULT '',
  status_text VARCHAR(180),
  avatar_url TEXT,
  avatar_color VARCHAR(32) NOT NULL DEFAULT '#8B112B',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  role VARCHAR(32) NOT NULL DEFAULT 'user',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  password_hash VARCHAR(255),
  password_salt VARCHAR(128),
  preferences_json TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  last_seen BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, status);

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  device_name VARCHAR(160) NOT NULL,
  platform VARCHAR(64) NOT NULL,
  user_agent VARCHAR(255) NOT NULL,
  ip VARCHAR(128) NOT NULL,
  created_at BIGINT NOT NULL,
  last_active_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions (last_active_at);

CREATE TABLE IF NOT EXISTS chats (
  id VARCHAR(96) PRIMARY KEY,
  type VARCHAR(24) NOT NULL,
  title VARCHAR(160) NOT NULL,
  handle VARCHAR(96),
  description TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  avatar_color VARCHAR(32) NOT NULL DEFAULT '#8B112B',
  member_ids_json TEXT NOT NULL,
  admin_ids_json TEXT NOT NULL,
  moderator_ids_json TEXT NOT NULL,
  admin_only_post BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_message_id VARCHAR(96),
  self_destruct_sec INTEGER NOT NULL DEFAULT 0,
  subscriber_count INTEGER,
  invite_expires_at BIGINT,
  invite_max_uses INTEGER,
  invite_uses INTEGER NOT NULL DEFAULT 0,
  suspended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chats_type ON chats (type);
CREATE INDEX IF NOT EXISTS idx_chats_handle ON chats (handle);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats (created_at);

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(96) PRIMARY KEY,
  chat_id VARCHAR(96) NOT NULL,
  sender_id VARCHAR(64) NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  is_scheduled BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_for BIGINT,
  payload_json TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages (chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_scheduled ON messages (is_scheduled, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id);

CREATE TABLE IF NOT EXISTS stories (
  id VARCHAR(96) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  kind VARCHAR(24) NOT NULL,
  payload_json TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stories_user ON stories (user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories (expires_at);

CREATE TABLE IF NOT EXISTS calls (
  id VARCHAR(96) PRIMARY KEY,
  caller_id VARCHAR(64) NOT NULL,
  callee_id VARCHAR(64) NOT NULL,
  kind VARCHAR(16) NOT NULL,
  status VARCHAR(24) NOT NULL,
  started_at BIGINT NOT NULL,
  ended_at BIGINT,
  duration_sec INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_calls_participants ON calls (caller_id, callee_id);
CREATE INDEX IF NOT EXISTS idx_calls_started ON calls (started_at);

CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(96) PRIMARY KEY,
  reporter_id VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) NOT NULL,
  target_id VARCHAR(96) NOT NULL,
  target_label VARCHAR(200) NOT NULL,
  category VARCHAR(64) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  moderator_note TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports (created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(96) PRIMARY KEY,
  actor_id VARCHAR(64) NOT NULL,
  actor_name VARCHAR(120) NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  action VARCHAR(96) NOT NULL,
  target VARCHAR(160) NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (actor_id);

CREATE TABLE IF NOT EXISTS platform_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  settings_json TEXT NOT NULL,
  admin_passcode_hash VARCHAR(255),
  admin_passcode_salt VARCHAR(128),
  last_backup_at BIGINT,
  updated_at BIGINT NOT NULL
);

INSERT INTO platform_settings (
  id,
  settings_json,
  admin_passcode_hash,
  admin_passcode_salt,
  last_backup_at,
  updated_at
) VALUES (
  1,
  '{"appName":"Tolk by Lunola","allowRegistration":true,"maxUploadMb":10,"storyExpiryHours":24,"maxGroupMembers":500,"rateLimitPerMin":120,"maintenanceMode":false,"globalAnnouncement":"","pushEnabled":true}',
  NULL,
  NULL,
  NULL,
  (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
)
ON CONFLICT (id) DO NOTHING;
