import mysql from 'mysql2/promise';
import pg from 'pg';
import type {
  AdminRole,
  AuditLogEntry,
  CallRecord,
  ChatType,
  DeviceSession,
  Message,
  ModerationReport,
  PlatformSettings,
  StoryItem,
  UserAccountStatus,
  UserPrivacySettings,
  UserProfile,
} from '../types/chat.ts';

export interface StoredUserRecord extends UserProfile {
  passwordHash?: string;
  passwordSalt?: string;
  pinnedChatIds: string[];
  archivedChatIds: string[];
  markedUnreadChatIds: string[];
  mutedUntilByChat: Record<string, number>;
  lastReadByChat: Record<string, number>;
  blockedUserIds: string[];
  mutedStoryUserIds: string[];
  privacy: UserPrivacySettings;
}

export interface StoredChatRecord {
  id: string;
  type: ChatType;
  title: string;
  handle?: string;
  description: string;
  avatarUrl: string | null;
  avatarColor: string;
  memberIds: string[];
  adminIds: string[];
  moderatorIds: string[];
  adminOnlyPost?: boolean;
  pinnedMessageId: string | null;
  selfDestructSec: number;
  subscriberCount?: number;
  inviteExpiresAt?: number | null;
  inviteMaxUses?: number | null;
  inviteUses?: number;
  suspended?: boolean;
  createdAt: number;
}

export interface StoreSnapshot {
  users: Record<string, StoredUserRecord>;
  sessions: Record<string, DeviceSession>;
  chats: Record<string, StoredChatRecord>;
  messages: Record<string, Message[]>;
  scheduledMessages: Message[];
  stories: StoryItem[];
  calls: CallRecord[];
  reports: ModerationReport[];
  auditLogs: AuditLogEntry[];
  settings: PlatformSettings;
  adminPasscodeHash?: string;
  adminPasscodeSalt?: string;
  lastBackupAt: number | null;
}

type DbEngine = 'mysql' | 'postgres';

interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  sslMode: 'auto' | 'true' | 'false';
  preferredEngine?: DbEngine;
}

const DEFAULT_PRIVACY: UserPrivacySettings = {
  lastSeenVisibility: 'everyone',
  whoCanMessage: 'everyone',
  storyVisibility: 'everyone',
};

const MYSQL_SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(160) DEFAULT NULL,
    bio TEXT NOT NULL,
    status_text VARCHAR(180) DEFAULT NULL,
    avatar_url TEXT DEFAULT NULL,
    avatar_color VARCHAR(32) NOT NULL DEFAULT '#8B112B',
    verified TINYINT(1) NOT NULL DEFAULT 0,
    is_guest TINYINT(1) NOT NULL DEFAULT 0,
    role VARCHAR(32) NOT NULL DEFAULT 'user',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    password_hash VARCHAR(255) DEFAULT NULL,
    password_salt VARCHAR(128) DEFAULT NULL,
    preferences_json LONGTEXT NOT NULL,
    created_at BIGINT NOT NULL,
    last_seen BIGINT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role_status (role, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    device_name VARCHAR(160) NOT NULL,
    platform VARCHAR(64) NOT NULL,
    user_agent VARCHAR(255) NOT NULL,
    ip VARCHAR(128) NOT NULL,
    created_at BIGINT NOT NULL,
    last_active_at BIGINT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_sessions_user_id (user_id),
    KEY idx_sessions_last_active (last_active_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS chats (
    id VARCHAR(96) NOT NULL,
    type VARCHAR(24) NOT NULL,
    title VARCHAR(160) NOT NULL,
    handle VARCHAR(96) DEFAULT NULL,
    description TEXT NOT NULL,
    avatar_url TEXT DEFAULT NULL,
    avatar_color VARCHAR(32) NOT NULL DEFAULT '#8B112B',
    member_ids_json LONGTEXT NOT NULL,
    admin_ids_json LONGTEXT NOT NULL,
    moderator_ids_json LONGTEXT NOT NULL,
    admin_only_post TINYINT(1) NOT NULL DEFAULT 0,
    pinned_message_id VARCHAR(96) DEFAULT NULL,
    self_destruct_sec INT NOT NULL DEFAULT 0,
    subscriber_count INT DEFAULT NULL,
    invite_expires_at BIGINT DEFAULT NULL,
    invite_max_uses INT DEFAULT NULL,
    invite_uses INT NOT NULL DEFAULT 0,
    suspended TINYINT(1) NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_chats_type (type),
    KEY idx_chats_handle (handle),
    KEY idx_chats_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(96) NOT NULL,
    chat_id VARCHAR(96) NOT NULL,
    sender_id VARCHAR(64) NOT NULL,
    text LONGTEXT NOT NULL,
    is_scheduled TINYINT(1) NOT NULL DEFAULT 0,
    scheduled_for BIGINT DEFAULT NULL,
    payload_json LONGTEXT NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_messages_chat_created (chat_id, created_at),
    KEY idx_messages_scheduled (is_scheduled, scheduled_for),
    KEY idx_messages_sender (sender_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS stories (
    id VARCHAR(96) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    kind VARCHAR(24) NOT NULL,
    payload_json LONGTEXT NOT NULL,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_stories_user (user_id),
    KEY idx_stories_expires (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS calls (
    id VARCHAR(96) NOT NULL,
    caller_id VARCHAR(64) NOT NULL,
    callee_id VARCHAR(64) NOT NULL,
    kind VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL,
    started_at BIGINT NOT NULL,
    ended_at BIGINT DEFAULT NULL,
    duration_sec INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_calls_participants (caller_id, callee_id),
    KEY idx_calls_started (started_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS reports (
    id VARCHAR(96) NOT NULL,
    reporter_id VARCHAR(64) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(96) NOT NULL,
    target_label VARCHAR(200) NOT NULL,
    category VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'open',
    moderator_note TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_reports_status (status),
    KEY idx_reports_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(96) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(120) NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    action VARCHAR(96) NOT NULL,
    target VARCHAR(160) NOT NULL,
    details TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_audit_created (created_at),
    KEY idx_audit_actor (actor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS platform_settings (
    id TINYINT NOT NULL DEFAULT 1,
    settings_json LONGTEXT NOT NULL,
    admin_passcode_hash VARCHAR(255) DEFAULT NULL,
    admin_passcode_salt VARCHAR(128) DEFAULT NULL,
    last_backup_at BIGINT DEFAULT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

const POSTGRES_SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
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
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    device_name VARCHAR(160) NOT NULL,
    platform VARCHAR(64) NOT NULL,
    user_agent VARCHAR(255) NOT NULL,
    ip VARCHAR(128) NOT NULL,
    created_at BIGINT NOT NULL,
    last_active_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS chats (
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
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(96) PRIMARY KEY,
    chat_id VARCHAR(96) NOT NULL,
    sender_id VARCHAR(64) NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    is_scheduled BOOLEAN NOT NULL DEFAULT FALSE,
    scheduled_for BIGINT,
    payload_json TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS stories (
    id VARCHAR(96) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    kind VARCHAR(24) NOT NULL,
    payload_json TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS calls (
    id VARCHAR(96) PRIMARY KEY,
    caller_id VARCHAR(64) NOT NULL,
    callee_id VARCHAR(64) NOT NULL,
    kind VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL,
    started_at BIGINT NOT NULL,
    ended_at BIGINT,
    duration_sec INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS reports (
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
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(96) PRIMARY KEY,
    actor_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(120) NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    action VARCHAR(96) NOT NULL,
    target VARCHAR(160) NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS platform_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    settings_json TEXT NOT NULL,
    admin_passcode_hash VARCHAR(255),
    admin_passcode_salt VARCHAR(128),
    last_backup_at BIGINT,
    updated_at BIGINT NOT NULL
  )`,
];

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toNullableNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true';
}

function readDbConfigFromEnv(): DbConfig | null {
  const host = (process.env.DB_HOST || '').trim();
  const database = (process.env.DB_NAME || '').trim();
  const user = (process.env.DB_USERNAME || process.env.DB_USER || '').trim();
  const password = process.env.DB_PASSWORD || '';
  if (!host || !database || !user) return null;

  const port = Number(process.env.DB_PORT || 3306);
  const rawEngine = (process.env.DB_ENGINE || '').trim().toLowerCase();
  const preferredEngine: DbEngine | undefined =
    rawEngine === 'postgres' || rawEngine === 'postgresql' || rawEngine === 'pg'
      ? 'postgres'
      : rawEngine === 'mysql' || rawEngine === 'mariadb'
      ? 'mysql'
      : port === 5432
      ? 'postgres'
      : undefined;

  const rawSsl = (process.env.DB_SSL || 'auto').trim().toLowerCase();
  const sslMode: 'auto' | 'true' | 'false' =
    rawSsl === 'true' || rawSsl === '1'
      ? 'true'
      : rawSsl === 'false' || rawSsl === '0'
      ? 'false'
      : 'auto';

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 3306,
    database,
    user,
    password,
    sslMode,
    preferredEngine,
  };
}

class SqlDatabaseAdapter {
  private engine: DbEngine | null = null;
  private mysqlPool: mysql.Pool | null = null;
  private pgPool: pg.Pool | null = null;
  private syncInFlight = false;
  private pendingSnapshot: StoreSnapshot | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  getEngine(): DbEngine | null {
    return this.engine;
  }

  isConnected(): boolean {
    return this.engine !== null;
  }

  private async tryConnectMysql(cfg: DbConfig): Promise<mysql.Pool | null> {
    const sslOptions =
      cfg.sslMode === 'false'
        ? [undefined]
        : cfg.sslMode === 'true'
        ? [{ rejectUnauthorized: false }]
        : [undefined, { rejectUnauthorized: false }];

    for (const ssl of sslOptions) {
      let pool: mysql.Pool | null = null;
      try {
        pool = mysql.createPool({
          host: cfg.host,
          port: cfg.port,
          database: cfg.database,
          user: cfg.user,
          password: cfg.password,
          ssl,
          waitForConnections: true,
          connectionLimit: 8,
          connectTimeout: 8000,
          charset: 'utf8mb4',
        });
        await pool.query('SELECT 1');
        return pool;
      } catch {
        if (pool) {
          await pool.end().catch(() => {});
        }
      }
    }
    return null;
  }

  private async tryConnectPostgres(cfg: DbConfig): Promise<pg.Pool | null> {
    const sslOptions =
      cfg.sslMode === 'false'
        ? [false]
        : cfg.sslMode === 'true'
        ? [{ rejectUnauthorized: false }]
        : [false, { rejectUnauthorized: false }];

    for (const ssl of sslOptions) {
      let pool: pg.Pool | null = null;
      try {
        pool = new pg.Pool({
          host: cfg.host,
          port: cfg.port,
          database: cfg.database,
          user: cfg.user,
          password: cfg.password,
          ssl,
          max: 8,
          connectionTimeoutMillis: 8000,
        });
        await pool.query('SELECT 1');
        return pool;
      } catch {
        if (pool) {
          await pool.end().catch(() => {});
        }
      }
    }
    return null;
  }

  async init(): Promise<DbEngine | null> {
    const cfg = readDbConfigFromEnv();
    if (!cfg) return null;

    const order: DbEngine[] =
      cfg.preferredEngine === 'postgres' ? ['postgres', 'mysql'] : ['mysql', 'postgres'];

    for (const candidate of order) {
      if (candidate === 'mysql') {
        const pool = await this.tryConnectMysql(cfg);
        if (pool) {
          this.mysqlPool = pool;
          this.engine = 'mysql';
          for (const stmt of MYSQL_SCHEMA_STATEMENTS) {
            await pool.query(stmt);
          }
          console.log('[DB] Connected to MySQL/MariaDB database via DB_HOST.');
          return 'mysql';
        }
      } else {
        const pool = await this.tryConnectPostgres(cfg);
        if (pool) {
          this.pgPool = pool;
          this.engine = 'postgres';
          for (const stmt of POSTGRES_SCHEMA_STATEMENTS) {
            await pool.query(stmt);
          }
          console.log('[DB] Connected to PostgreSQL database via DB_HOST.');
          return 'postgres';
        }
      }
    }

    console.error('[DB] Failed to connect using DB_HOST env vars. Falling back to local store.');
    return null;
  }

  private async queryRows(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
    if (this.engine === 'mysql' && this.mysqlPool) {
      const [rows] = await this.mysqlPool.query(sql, params);
      return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
    }
    if (this.engine === 'postgres' && this.pgPool) {
      const res = await this.pgPool.query(sql, params);
      return (res.rows || []) as Record<string, unknown>[];
    }
    return [];
  }

  async loadSnapshot(base: StoreSnapshot): Promise<StoreSnapshot | null> {
    if (!this.engine) return null;

    const [
      userRows,
      sessionRows,
      chatRows,
      messageRows,
      storyRows,
      callRows,
      reportRows,
      auditRows,
      settingRows,
    ] = await Promise.all([
      this.queryRows('SELECT * FROM users'),
      this.queryRows('SELECT * FROM sessions'),
      this.queryRows('SELECT * FROM chats'),
      this.queryRows('SELECT * FROM messages ORDER BY created_at ASC'),
      this.queryRows('SELECT * FROM stories ORDER BY created_at ASC'),
      this.queryRows('SELECT * FROM calls ORDER BY started_at DESC'),
      this.queryRows('SELECT * FROM reports ORDER BY created_at DESC'),
      this.queryRows('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 400'),
      this.queryRows('SELECT * FROM platform_settings WHERE id = 1'),
    ]);

    const users: Record<string, StoredUserRecord> = {};
    for (const r of userRows) {
      const id = String(r.id);
      const prefs = safeJsonParse<Partial<StoredUserRecord>>(r.preferences_json, {});
      users[id] = {
        id,
        username: String(r.username),
        displayName: String(r.display_name),
        email: r.email ? String(r.email) : undefined,
        bio: String(r.bio ?? ''),
        statusText: r.status_text ? String(r.status_text) : undefined,
        avatarUrl: r.avatar_url ? String(r.avatar_url) : null,
        avatarColor: String(r.avatar_color || '#8B112B'),
        verified: toBool(r.verified),
        isGuest: toBool(r.is_guest),
        role: (String(r.role || 'user') as AdminRole),
        status: (String(r.status || 'active') as UserAccountStatus),
        passwordHash: r.password_hash ? String(r.password_hash) : undefined,
        passwordSalt: r.password_salt ? String(r.password_salt) : undefined,
        createdAt: toNum(r.created_at, Date.now()),
        lastSeen: toNum(r.last_seen, Date.now()),
        pinnedChatIds: Array.isArray(prefs.pinnedChatIds) ? prefs.pinnedChatIds : [],
        archivedChatIds: Array.isArray(prefs.archivedChatIds) ? prefs.archivedChatIds : [],
        markedUnreadChatIds: Array.isArray(prefs.markedUnreadChatIds)
          ? prefs.markedUnreadChatIds
          : [],
        mutedUntilByChat: prefs.mutedUntilByChat || {},
        lastReadByChat: prefs.lastReadByChat || {},
        blockedUserIds: Array.isArray(prefs.blockedUserIds) ? prefs.blockedUserIds : [],
        mutedStoryUserIds: Array.isArray(prefs.mutedStoryUserIds) ? prefs.mutedStoryUserIds : [],
        privacy: { ...DEFAULT_PRIVACY, ...(prefs.privacy || {}) },
      };
    }

    const sessions: Record<string, DeviceSession> = {};
    for (const r of sessionRows) {
      const id = String(r.id);
      sessions[id] = {
        id,
        userId: String(r.user_id),
        deviceName: String(r.device_name ?? 'Perangkat Web'),
        platform: String(r.platform ?? 'Web'),
        userAgent: String(r.user_agent ?? ''),
        ip: String(r.ip),
        createdAt: toNum(r.created_at, Date.now()),
        lastActiveAt: toNum(r.last_active_at, Date.now()),
      };
    }

    const chats: Record<string, StoredChatRecord> = {};
    for (const r of chatRows) {
      const id = String(r.id);
      chats[id] = {
        id,
        type: String(r.type) as ChatType,
        title: String(r.title),
        handle: r.handle ? String(r.handle) : undefined,
        description: String(r.description ?? ''),
        avatarUrl: r.avatar_url ? String(r.avatar_url) : null,
        avatarColor: String(r.avatar_color || '#8B112B'),
        memberIds: safeJsonParse<string[]>(r.member_ids_json, []),
        adminIds: safeJsonParse<string[]>(r.admin_ids_json, []),
        moderatorIds: safeJsonParse<string[]>(r.moderator_ids_json, []),
        adminOnlyPost: toBool(r.admin_only_post),
        pinnedMessageId: r.pinned_message_id ? String(r.pinned_message_id) : null,
        selfDestructSec: toNum(r.self_destruct_sec, 0),
        subscriberCount: toNullableNum(r.subscriber_count) ?? undefined,
        inviteExpiresAt: toNullableNum(r.invite_expires_at),
        inviteMaxUses: toNullableNum(r.invite_max_uses),
        inviteUses: toNum(r.invite_uses, 0),
        suspended: toBool(r.suspended),
        createdAt: toNum(r.created_at, Date.now()),
      };
    }

    const messages: Record<string, Message[]> = {};
    const scheduledMessages: Message[] = [];
    for (const r of messageRows) {
      const parsed = safeJsonParse<Message | null>(r.payload_json, null);
      const msg: Message = parsed || {
        id: String(r.id),
        chatId: String(r.chat_id),
        senderId: String(r.sender_id),
        text: String(r.text ?? ''),
        createdAt: toNum(r.created_at, Date.now()),
        reactions: [],
        readBy: [],
      };
      if (toBool(r.is_scheduled)) {
        scheduledMessages.push(msg);
      } else {
        messages[msg.chatId] = messages[msg.chatId] || [];
        messages[msg.chatId].push(msg);
      }
    }

    const stories: StoryItem[] = [];
    for (const r of storyRows) {
      const parsed = safeJsonParse<StoryItem | null>(r.payload_json, null);
      if (parsed) stories.push(parsed);
    }

    const calls: CallRecord[] = callRows.map((r) => {
      const ended = toNullableNum(r.ended_at);
      return {
        id: String(r.id),
        callerId: String(r.caller_id),
        calleeId: String(r.callee_id),
        kind: String(r.kind) === 'video' ? 'video' : 'voice',
        status: String(r.status) as CallRecord['status'],
        startedAt: toNum(r.started_at, Date.now()),
        endedAt: ended !== null ? ended : undefined,
        durationSec: toNum(r.duration_sec, 0),
      };
    });

    const reports: ModerationReport[] = reportRows.map((r) => ({
      id: String(r.id),
      reporterId: String(r.reporter_id),
      targetType: String(r.target_type) as ModerationReport['targetType'],
      targetId: String(r.target_id),
      targetLabel: String(r.target_label),
      category: String(r.category) as ModerationReport['category'],
      reason: String(r.reason),
      status: String(r.status) as ModerationReport['status'],
      moderatorNote: String(r.moderator_note ?? ''),
      createdAt: toNum(r.created_at, Date.now()),
      updatedAt: toNum(r.updated_at, Date.now()),
    }));

    const auditLogs: AuditLogEntry[] = auditRows.map((r) => ({
      id: String(r.id),
      actorId: String(r.actor_id),
      actorName: String(r.actor_name),
      actorRole: String(r.actor_role) as AdminRole,
      action: String(r.action),
      target: String(r.target),
      details: String(r.details ?? ''),
      createdAt: toNum(r.created_at, Date.now()),
    }));

    const settingsRow = settingRows[0];
    const settingsParsed = settingsRow
      ? safeJsonParse<Partial<PlatformSettings>>(settingsRow.settings_json, {})
      : {};

    return {
      users,
      sessions,
      chats,
      messages,
      scheduledMessages,
      stories,
      calls,
      reports,
      auditLogs,
      settings: { ...base.settings, ...settingsParsed },
      adminPasscodeHash: settingsRow?.admin_passcode_hash
        ? String(settingsRow.admin_passcode_hash)
        : base.adminPasscodeHash,
      adminPasscodeSalt: settingsRow?.admin_passcode_salt
        ? String(settingsRow.admin_passcode_salt)
        : base.adminPasscodeSalt,
      lastBackupAt: settingsRow ? toNullableNum(settingsRow.last_backup_at) : null,
    };
  }

  scheduleSync(snapshot: StoreSnapshot): void {
    if (!this.engine) return;
    this.pendingSnapshot = JSON.parse(JSON.stringify(snapshot)) as StoreSnapshot;
    if (this.syncTimer) return;
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      void this.flushSync();
    }, 180);
  }

  async flushSync(): Promise<void> {
    if (!this.engine || this.syncInFlight || !this.pendingSnapshot) return;
    const snap = this.pendingSnapshot;
    this.pendingSnapshot = null;
    this.syncInFlight = true;
    try {
      if (this.engine === 'mysql' && this.mysqlPool) {
        await this.syncToMysql(this.mysqlPool, snap);
      } else if (this.engine === 'postgres' && this.pgPool) {
        await this.syncToPostgres(this.pgPool, snap);
      }
    } catch (err) {
      console.error('[DB] Failed to persist state to SQL database:', err);
    } finally {
      this.syncInFlight = false;
      if (this.pendingSnapshot) {
        void this.flushSync();
      }
    }
  }

  private async syncToMysql(pool: mysql.Pool, snap: StoreSnapshot): Promise<void> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Clear and re-insert inside one atomic transaction with strictly parameterized queries
      await conn.query('DELETE FROM sessions');
      await conn.query('DELETE FROM messages');
      await conn.query('DELETE FROM stories');
      await conn.query('DELETE FROM calls');
      await conn.query('DELETE FROM reports');
      await conn.query('DELETE FROM audit_logs');
      await conn.query('DELETE FROM chats');
      await conn.query('DELETE FROM users');

      for (const u of Object.values(snap.users)) {
        const prefs = JSON.stringify({
          pinnedChatIds: u.pinnedChatIds || [],
          archivedChatIds: u.archivedChatIds || [],
          markedUnreadChatIds: u.markedUnreadChatIds || [],
          mutedUntilByChat: u.mutedUntilByChat || {},
          lastReadByChat: u.lastReadByChat || {},
          blockedUserIds: u.blockedUserIds || [],
          mutedStoryUserIds: u.mutedStoryUserIds || [],
          privacy: u.privacy || DEFAULT_PRIVACY,
        });
        await conn.query(
          `INSERT INTO users (
            id, username, display_name, email, bio, status_text, avatar_url, avatar_color,
            verified, is_guest, role, status, password_hash, password_salt, preferences_json,
            created_at, last_seen
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            u.id,
            u.username,
            u.displayName,
            u.email || null,
            u.bio || '',
            u.statusText || null,
            u.avatarUrl || null,
            u.avatarColor || '#8B112B',
            u.verified ? 1 : 0,
            u.isGuest ? 1 : 0,
            u.role,
            u.status,
            u.passwordHash || null,
            u.passwordSalt || null,
            prefs,
            u.createdAt,
            u.lastSeen,
          ]
        );
      }

      for (const s of Object.values(snap.sessions)) {
        await conn.query(
          `INSERT INTO sessions (id, user_id, device_name, platform, user_agent, ip, created_at, last_active_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            s.userId,
            s.deviceName || 'Perangkat Web',
            s.platform || 'Web',
            s.userAgent || '',
            s.ip,
            s.createdAt,
            s.lastActiveAt,
          ]
        );
      }

      for (const c of Object.values(snap.chats)) {
        await conn.query(
          `INSERT INTO chats (
            id, type, title, handle, description, avatar_url, avatar_color,
            member_ids_json, admin_ids_json, moderator_ids_json, admin_only_post,
            pinned_message_id, self_destruct_sec, subscriber_count,
            invite_expires_at, invite_max_uses, invite_uses, suspended, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            c.id,
            c.type,
            c.title,
            c.handle || null,
            c.description || '',
            c.avatarUrl || null,
            c.avatarColor || '#8B112B',
            JSON.stringify(c.memberIds || []),
            JSON.stringify(c.adminIds || []),
            JSON.stringify(c.moderatorIds || []),
            c.adminOnlyPost ? 1 : 0,
            c.pinnedMessageId || null,
            c.selfDestructSec || 0,
            c.subscriberCount ?? null,
            c.inviteExpiresAt ?? null,
            c.inviteMaxUses ?? null,
            c.inviteUses || 0,
            c.suspended ? 1 : 0,
            c.createdAt,
          ]
        );
      }

      for (const list of Object.values(snap.messages)) {
        for (const m of list) {
          await conn.query(
            `INSERT INTO messages (id, chat_id, sender_id, text, is_scheduled, scheduled_for, payload_json, created_at)
             VALUES (?, ?, ?, ?, 0, NULL, ?, ?)`,
            [m.id, m.chatId, m.senderId, m.text || '', JSON.stringify(m), m.createdAt]
          );
        }
      }

      for (const m of snap.scheduledMessages) {
        await conn.query(
          `INSERT INTO messages (id, chat_id, sender_id, text, is_scheduled, scheduled_for, payload_json, created_at)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
          [
            m.id,
            m.chatId,
            m.senderId,
            m.text || '',
            m.scheduledFor ?? null,
            JSON.stringify(m),
            m.createdAt,
          ]
        );
      }

      for (const st of snap.stories) {
        await conn.query(
          `INSERT INTO stories (id, user_id, kind, payload_json, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [st.id, st.userId, st.kind, JSON.stringify(st), st.createdAt, st.expiresAt]
        );
      }

      for (const cl of snap.calls) {
        await conn.query(
          `INSERT INTO calls (id, caller_id, callee_id, kind, status, started_at, ended_at, duration_sec)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cl.id,
            cl.callerId,
            cl.calleeId,
            cl.kind,
            cl.status,
            cl.startedAt,
            cl.endedAt ?? null,
            cl.durationSec || 0,
          ]
        );
      }

      for (const rp of snap.reports) {
        await conn.query(
          `INSERT INTO reports (
            id, reporter_id, target_type, target_id, target_label, category,
            reason, status, moderator_note, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rp.id,
            rp.reporterId,
            rp.targetType,
            rp.targetId,
            rp.targetLabel,
            rp.category,
            rp.reason,
            rp.status,
            rp.moderatorNote || '',
            rp.createdAt,
            rp.updatedAt,
          ]
        );
      }

      for (const lg of snap.auditLogs.slice(0, 400)) {
        await conn.query(
          `INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, target, details, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            lg.id,
            lg.actorId,
            lg.actorName,
            lg.actorRole,
            lg.action,
            lg.target,
            lg.details || '',
            lg.createdAt,
          ]
        );
      }

      await conn.query(
        `INSERT INTO platform_settings (id, settings_json, admin_passcode_hash, admin_passcode_salt, last_backup_at, updated_at)
         VALUES (1, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           settings_json = VALUES(settings_json),
           admin_passcode_hash = VALUES(admin_passcode_hash),
           admin_passcode_salt = VALUES(admin_passcode_salt),
           last_backup_at = VALUES(last_backup_at),
           updated_at = VALUES(updated_at)`,
        [
          JSON.stringify(snap.settings),
          snap.adminPasscodeHash || null,
          snap.adminPasscodeSalt || null,
          snap.lastBackupAt ?? null,
          Date.now(),
        ]
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  }

  private async syncToPostgres(pool: pg.Pool, snap: StoreSnapshot): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query('DELETE FROM sessions');
      await client.query('DELETE FROM messages');
      await client.query('DELETE FROM stories');
      await client.query('DELETE FROM calls');
      await client.query('DELETE FROM reports');
      await client.query('DELETE FROM audit_logs');
      await client.query('DELETE FROM chats');
      await client.query('DELETE FROM users');

      for (const u of Object.values(snap.users)) {
        const prefs = JSON.stringify({
          pinnedChatIds: u.pinnedChatIds || [],
          archivedChatIds: u.archivedChatIds || [],
          markedUnreadChatIds: u.markedUnreadChatIds || [],
          mutedUntilByChat: u.mutedUntilByChat || {},
          lastReadByChat: u.lastReadByChat || {},
          blockedUserIds: u.blockedUserIds || [],
          mutedStoryUserIds: u.mutedStoryUserIds || [],
          privacy: u.privacy || DEFAULT_PRIVACY,
        });
        await client.query(
          `INSERT INTO users (
            id, username, display_name, email, bio, status_text, avatar_url, avatar_color,
            verified, is_guest, role, status, password_hash, password_salt, preferences_json,
            created_at, last_seen
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
          [
            u.id,
            u.username,
            u.displayName,
            u.email || null,
            u.bio || '',
            u.statusText || null,
            u.avatarUrl || null,
            u.avatarColor || '#8B112B',
            Boolean(u.verified),
            Boolean(u.isGuest),
            u.role,
            u.status,
            u.passwordHash || null,
            u.passwordSalt || null,
            prefs,
            u.createdAt,
            u.lastSeen,
          ]
        );
      }

      for (const s of Object.values(snap.sessions)) {
        await client.query(
          `INSERT INTO sessions (id, user_id, device_name, platform, user_agent, ip, created_at, last_active_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            s.id,
            s.userId,
            s.deviceName || 'Perangkat Web',
            s.platform || 'Web',
            s.userAgent || '',
            s.ip,
            s.createdAt,
            s.lastActiveAt,
          ]
        );
      }

      for (const c of Object.values(snap.chats)) {
        await client.query(
          `INSERT INTO chats (
            id, type, title, handle, description, avatar_url, avatar_color,
            member_ids_json, admin_ids_json, moderator_ids_json, admin_only_post,
            pinned_message_id, self_destruct_sec, subscriber_count,
            invite_expires_at, invite_max_uses, invite_uses, suspended, created_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
          [
            c.id,
            c.type,
            c.title,
            c.handle || null,
            c.description || '',
            c.avatarUrl || null,
            c.avatarColor || '#8B112B',
            JSON.stringify(c.memberIds || []),
            JSON.stringify(c.adminIds || []),
            JSON.stringify(c.moderatorIds || []),
            Boolean(c.adminOnlyPost),
            c.pinnedMessageId || null,
            c.selfDestructSec || 0,
            c.subscriberCount ?? null,
            c.inviteExpiresAt ?? null,
            c.inviteMaxUses ?? null,
            c.inviteUses || 0,
            Boolean(c.suspended),
            c.createdAt,
          ]
        );
      }

      for (const list of Object.values(snap.messages)) {
        for (const m of list) {
          await client.query(
            `INSERT INTO messages (id, chat_id, sender_id, text, is_scheduled, scheduled_for, payload_json, created_at)
             VALUES ($1,$2,$3,$4,FALSE,NULL,$5,$6)`,
            [m.id, m.chatId, m.senderId, m.text || '', JSON.stringify(m), m.createdAt]
          );
        }
      }

      for (const m of snap.scheduledMessages) {
        await client.query(
          `INSERT INTO messages (id, chat_id, sender_id, text, is_scheduled, scheduled_for, payload_json, created_at)
           VALUES ($1,$2,$3,$4,TRUE,$5,$6,$7)`,
          [
            m.id,
            m.chatId,
            m.senderId,
            m.text || '',
            m.scheduledFor ?? null,
            JSON.stringify(m),
            m.createdAt,
          ]
        );
      }

      for (const st of snap.stories) {
        await client.query(
          `INSERT INTO stories (id, user_id, kind, payload_json, created_at, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [st.id, st.userId, st.kind, JSON.stringify(st), st.createdAt, st.expiresAt]
        );
      }

      for (const cl of snap.calls) {
        await client.query(
          `INSERT INTO calls (id, caller_id, callee_id, kind, status, started_at, ended_at, duration_sec)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            cl.id,
            cl.callerId,
            cl.calleeId,
            cl.kind,
            cl.status,
            cl.startedAt,
            cl.endedAt ?? null,
            cl.durationSec || 0,
          ]
        );
      }

      for (const rp of snap.reports) {
        await client.query(
          `INSERT INTO reports (
            id, reporter_id, target_type, target_id, target_label, category,
            reason, status, moderator_note, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            rp.id,
            rp.reporterId,
            rp.targetType,
            rp.targetId,
            rp.targetLabel,
            rp.category,
            rp.reason,
            rp.status,
            rp.moderatorNote || '',
            rp.createdAt,
            rp.updatedAt,
          ]
        );
      }

      for (const lg of snap.auditLogs.slice(0, 400)) {
        await client.query(
          `INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, target, details, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            lg.id,
            lg.actorId,
            lg.actorName,
            lg.actorRole,
            lg.action,
            lg.target,
            lg.details || '',
            lg.createdAt,
          ]
        );
      }

      await client.query(
        `INSERT INTO platform_settings (id, settings_json, admin_passcode_hash, admin_passcode_salt, last_backup_at, updated_at)
         VALUES (1, $1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           settings_json = EXCLUDED.settings_json,
           admin_passcode_hash = EXCLUDED.admin_passcode_hash,
           admin_passcode_salt = EXCLUDED.admin_passcode_salt,
           last_backup_at = EXCLUDED.last_backup_at,
           updated_at = EXCLUDED.updated_at`,
        [
          JSON.stringify(snap.settings),
          snap.adminPasscodeHash || null,
          snap.adminPasscodeSalt || null,
          snap.lastBackupAt ?? null,
          Date.now(),
        ]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}

export const sqlDb = new SqlDatabaseAdapter();
