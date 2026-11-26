import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import mysql from 'mysql2/promise';
import { GoogleGenAI } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  AdminOverviewPayload,
  AdminRole,
  Attachment,
  AuditLogEntry,
  CallRecord,
  ChatRoom,
  ChatType,
  DeviceSession,
  Message,
  ModerationReport,
  PlatformSettings,
  StoryItem,
  UserAccountStatus,
  UserPrivacySettings,
  UserProfile,
} from './src/types/chat.ts';

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = fs.existsSync('/app/dist/index.html') ? '/app' : process.cwd();
const IS_DEV_SCRIPT =
  process.env.NODE_ENV === 'development' ||
  process.env.npm_lifecycle_event === 'dev' ||
  process.execArgv.some((arg) => arg.includes('tsx'));
const IS_PROD =
  process.env.NODE_ENV === 'production' ||
  process.env.npm_lifecycle_event === 'start' ||
  (!IS_DEV_SCRIPT && fs.existsSync(path.resolve(ROOT_DIR, 'dist', 'index.html')));

function resolveWritableDir(preferred: string, fallbackName: string): string {
  try {
    fs.mkdirSync(preferred, { recursive: true });
    const probe = path.join(preferred, `.write-probe-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), fallbackName);
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

const DATA_DIR = resolveWritableDir(
  process.env.DATA_DIR || (fs.existsSync('/storage') ? '/storage/data' : path.resolve(ROOT_DIR, 'data')),
  'tolk-data'
);
const UPLOADS_DIR = resolveWritableDir(
  process.env.UPLOADS_DIR || (fs.existsSync('/storage') ? '/storage/uploads' : path.resolve(ROOT_DIR, 'uploads')),
  'tolk-uploads'
);
const STORE_PATH = path.resolve(DATA_DIR, 'store.json');
const SERVER_START_MS = Date.now();

// Signing key: reads from env if provided, otherwise ephemeral random secret in memory
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

interface StoredUser extends UserProfile {
  passwordHash?: string;
  passwordSalt?: string;
  pinnedChatIds: string[];
  archivedChatIds: string[];
  markedUnreadChatIds: string[];
  mutedUntilByChat: Record<string, number>;
  lastReadByChat: Record<string, number>;
  blockedUserIds: string[];
  mutedStoryUserIds: string[];
  contactIds?: string[];
  privacy: UserPrivacySettings;
}

interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

interface StoredChat {
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

interface StoreData {
  users: Record<string, StoredUser>;
  sessions: Record<string, DeviceSession>;
  chats: Record<string, StoredChat>;
  messages: Record<string, Message[]>;
  scheduledMessages: Message[];
  stories: StoryItem[];
  calls: CallRecord[];
  friendRequests?: FriendRequest[];
  reports: ModerationReport[];
  auditLogs: AuditLogEntry[];
  settings: PlatformSettings;
  adminPasscodeHash?: string;
  adminPasscodeSalt?: string;
  lastBackupAt: number | null;
}

const AVATAR_COLORS = [
  '#0284C7',
  '#0D9488',
  '#2563EB',
  '#4F46E5',
  '#D97706',
  '#059669',
  '#E11D48',
];

const DEFAULT_PRIVACY: UserPrivacySettings = {
  lastSeenVisibility: 'everyone',
  whoCanMessage: 'everyone',
  storyVisibility: 'everyone',
};

const ROLE_PERMISSIONS: Record<AdminRole, Set<string>> = {
  super_admin: new Set([
    'dashboard',
    'users:read',
    'users:write',
    'roles:write',
    'reports:read',
    'reports:write',
    'groups:read',
    'groups:write',
    'stories:read',
    'stories:write',
    'announcements:write',
    'server:read',
    'server:write',
    'settings:read',
    'settings:write',
    'audit:read',
  ]),
  administrator: new Set([
    'dashboard',
    'users:read',
    'users:write',
    'reports:read',
    'reports:write',
    'groups:read',
    'groups:write',
    'stories:read',
    'stories:write',
    'announcements:write',
    'server:read',
    'settings:read',
    'settings:write',
    'audit:read',
  ]),
  moderator: new Set([
    'dashboard',
    'users:read',
    'users:write',
    'reports:read',
    'reports:write',
    'groups:read',
    'stories:read',
    'stories:write',
    'audit:read',
  ]),
  support: new Set([
    'dashboard',
    'users:read',
    'reports:read',
    'groups:read',
    'stories:read',
  ]),
  server_operator: new Set([
    'dashboard',
    'server:read',
    'server:write',
    'settings:read',
    'audit:read',
  ]),
  audit_viewer: new Set(['dashboard', 'audit:read']),
  user: new Set(),
};

function hasPermission(role: AdminRole, perm: string): boolean {
  return ROLE_PERMISSIONS[role]?.has(perm) || false;
}

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function hashSecret(secret: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(secret, actualSalt, 64).toString('hex');
  return { hash, salt: actualSalt };
}

function verifySecret(secret: string, storedHash: string, storedSalt: string): boolean {
  const derived = crypto.scryptSync(secret, storedSalt, 64);
  const target = Buffer.from(storedHash, 'hex');
  if (derived.length !== target.length) return false;
  return crypto.timingSafeEqual(derived, target);
}

function signToken(payloadObj: { uid: string; sid: string }): string {
  const payload = Buffer.from(
    JSON.stringify({ ...payloadObj, iat: Date.now() }),
    'utf8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): { uid: string; sid: string } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid?: unknown;
      sid?: unknown;
    };
    if (typeof decoded.uid === 'string' && typeof decoded.sid === 'string') {
      return { uid: decoded.uid, sid: decoded.sid };
    }
    return null;
  } catch {
    return null;
  }
}

function createDefaultAdminConfig(now: number): {
  adminUser: StoredUser;
  adminPasscodeHash: string;
  adminPasscodeSalt: string;
} {
  const defaultUsername = (process.env.DEFAULT_ADMIN_USERNAME || 'pujo').trim().toLowerCase();
  const defaultEmail = (process.env.DEFAULT_ADMIN_EMAIL || 'pujosetyo16@gmail.com').trim().toLowerCase();
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Pujopinter';
  const pw = hashSecret(defaultPassword);
  const passcodeSeed = process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.length >= 6
    ? process.env.ADMIN_PASSCODE
    : defaultPassword;
  const adminCode = hashSecret(passcodeSeed);

  const adminUser: StoredUser = {
    id: 'usr_pujo',
    username: defaultUsername,
    displayName: 'Pujo',
    email: defaultEmail,
    bio: 'Super Admin · Tolk by Lunola',
    statusText: 'Administrator Utama Tolk by Lunola',
    avatarUrl: null,
    avatarColor: '#8B112B',
    verified: true,
    role: 'super_admin',
    status: 'active',
    createdAt: now - 35 * 24 * 60 * 60 * 1000,
    lastSeen: now,
    passwordHash: pw.hash,
    passwordSalt: pw.salt,
    pinnedChatIds: [],
    archivedChatIds: [],
    markedUnreadChatIds: [],
    mutedUntilByChat: {},
    lastReadByChat: {},
    blockedUserIds: [],
    mutedStoryUserIds: [],
    privacy: { ...DEFAULT_PRIVACY },
  };

  return {
    adminUser,
    adminPasscodeHash: adminCode.hash,
    adminPasscodeSalt: adminCode.salt,
  };
}

function createSeedStore(): StoreData {
  const now = Date.now();
  const min = 60 * 1000;
  const hour = 60 * min;

  const { adminUser: pujo, adminPasscodeHash, adminPasscodeSalt } = createDefaultAdminConfig(now);

  const raka: StoredUser = {
    id: 'usr_raka',
    username: 'raka_arch',
    displayName: 'Raka Pratama',
    email: 'raka@lunolatalk.id',
    bio: 'Systems Architect · Tinode, Wasmer Edge & WebRTC',
    statusText: 'Membangun fondasi Tolk by Lunola',
    avatarUrl: '/src/assets/images/avatar_raka_1795619677845.jpg',
    avatarColor: '#0284C7',
    verified: true,
    role: 'administrator',
    status: 'active',
    createdAt: now - 30 * 24 * hour,
    lastSeen: now - 3 * min,
    pinnedChatIds: [],
    archivedChatIds: [],
    markedUnreadChatIds: [],
    mutedUntilByChat: {},
    lastReadByChat: {},
    blockedUserIds: [],
    mutedStoryUserIds: [],
    privacy: { ...DEFAULT_PRIVACY },
  };

  const nadia: StoredUser = {
    id: 'usr_nadia',
    username: 'nadia_ui',
    displayName: 'Nadia Kusuma',
    email: 'nadia@lunolatalk.id',
    bio: 'Product Designer · Cross-Platform Web, PWA & Android WebView',
    statusText: 'Review desain Stories 24 jam',
    avatarUrl: '/src/assets/images/avatar_nadia_1795619592146.jpg',
    avatarColor: '#0D9488',
    verified: true,
    role: 'moderator',
    status: 'active',
    createdAt: now - 22 * 24 * hour,
    lastSeen: now - 11 * min,
    pinnedChatIds: [],
    archivedChatIds: [],
    markedUnreadChatIds: [],
    mutedUntilByChat: {},
    lastReadByChat: {},
    blockedUserIds: [],
    mutedStoryUserIds: [],
    privacy: { ...DEFAULT_PRIVACY },
  };

  const dito: StoredUser = {
    id: 'usr_dito',
    username: 'dito_wasm',
    displayName: 'Dito Mahendra',
    email: 'dito@lunolatalk.id',
    bio: 'Self-Hosting & Infrastructure Engineer · Docker & Wasmer',
    statusText: 'Siap deploy Docker Compose',
    avatarUrl: '/src/assets/images/avatar_dito_1795619656045.jpg',
    avatarColor: '#2563EB',
    verified: true,
    role: 'server_operator',
    status: 'active',
    createdAt: now - 18 * 24 * hour,
    lastSeen: now - 24 * min,
    pinnedChatIds: [],
    archivedChatIds: [],
    markedUnreadChatIds: [],
    mutedUntilByChat: {},
    lastReadByChat: {},
    blockedUserIds: [],
    mutedStoryUserIds: [],
    privacy: { ...DEFAULT_PRIVACY },
  };

  const chats: Record<string, StoredChat> = {
    chat_wasmer_id: {
      id: 'chat_wasmer_id',
      type: 'group',
      title: 'Komunitas Lunola & Wasmer',
      handle: 'lunola_wasmer_id',
      description:
        'Diskusi backend self-hosted (Tinode/Node.js), deploy Wasmer Edge, Docker Compose, WebSocket real-time, dan Android WebView.',
      avatarUrl: '/src/assets/images/avatar_wasmer_group_1795619607932.jpg',
      avatarColor: '#0284C7',
      memberIds: ['usr_pujo', 'usr_raka', 'usr_nadia', 'usr_dito'],
      adminIds: ['usr_pujo', 'usr_raka'],
      moderatorIds: ['usr_dito'],
      adminOnlyPost: false,
      pinnedMessageId: 'msg_w_2',
      selfDestructSec: 0,
      inviteExpiresAt: now + 7 * 24 * hour,
      inviteMaxUses: 100,
      inviteUses: 14,
      createdAt: now - 48 * hour,
    },
    chat_lunolatalk_news: {
      id: 'chat_lunolatalk_news',
      type: 'channel',
      title: 'Channel Resmi Tolk by Lunola',
      handle: 'lunolatalk_official',
      description:
        'Pengumuman resmi pembaruan Tolk by Lunola, fitur lintas platform (Web, PWA, Android), serta rilis server self-hosted.',
      avatarUrl: '/src/assets/images/avatar_wasmer_group_1795619607932.jpg',
      avatarColor: '#0369A1',
      memberIds: ['usr_pujo', 'usr_raka', 'usr_nadia', 'usr_dito'],
      adminIds: ['usr_pujo', 'usr_raka'],
      moderatorIds: [],
      adminOnlyPost: true,
      pinnedMessageId: 'msg_ch_1',
      selfDestructSec: 0,
      subscriberCount: 1428,
      createdAt: now - 72 * hour,
    },
    chat_android_webview: {
      id: 'chat_android_webview',
      type: 'group',
      title: 'Tim Android & PWA',
      handle: 'lunola_mobile_dev',
      description:
        'Sinkronisasi Kotlin WebView, JavaScript Bridge, panggilan suara/video WebRTC, dan pemasangan PWA.',
      avatarUrl: null,
      avatarColor: '#0D9488',
      memberIds: ['usr_nadia', 'usr_raka', 'usr_dito'],
      adminIds: ['usr_nadia'],
      moderatorIds: ['usr_raka'],
      adminOnlyPost: false,
      pinnedMessageId: 'msg_aw_1',
      selfDestructSec: 0,
      createdAt: now - 30 * hour,
    },
  };

  const messages: Record<string, Message[]> = {
    chat_wasmer_id: [
      {
        id: 'msg_w_1',
        chatId: 'chat_wasmer_id',
        senderId: 'usr_dito',
        text: 'Halo semua! Konfigurasi `wasmer.toml` dan `docker-compose.yml` (dengan Tinode + PostgreSQL + Caddy Auto-HTTPS) sudah siap dipakai untuk self-hosting.',
        createdAt: now - 5 * hour,
        reactions: [{ emoji: '🔥', userIds: ['usr_raka', 'usr_nadia'] }],
        readBy: ['usr_dito', 'usr_raka', 'usr_nadia'],
      },
      {
        id: 'msg_w_2',
        chatId: 'chat_wasmer_id',
        senderId: 'usr_raka',
        text: 'Coba fitur baru Tolk by Lunola: seret file atau tempel gambar langsung ke kolom chat, gunakan `Ctrl+K` untuk pencarian cepat, jadwalkan pesan, atau klik tombol AI untuk ringkas & terjemahkan percakapan.',
        createdAt: now - 3 * hour,
        reactions: [
          { emoji: '👍', userIds: ['usr_dito', 'usr_nadia'] },
          { emoji: '🎉', userIds: ['usr_dito'] },
        ],
        readBy: ['usr_dito', 'usr_raka', 'usr_nadia'],
      },
      {
        id: 'msg_w_3',
        chatId: 'chat_wasmer_id',
        senderId: 'usr_nadia',
        text: 'Stories 24 jam, QR code undangan grup, dan kontrol kecepatan pesan suara (1x / 1.5x / 2x) juga sudah aktif. @raka_arch silakan cek Admin Panel dari menu samping!',
        createdAt: now - 36 * min,
        replyToId: 'msg_w_2',
        mentions: ['raka_arch'],
        reactions: [{ emoji: '❤️', userIds: ['usr_raka'] }],
        readBy: ['usr_nadia', 'usr_raka'],
      },
    ],
    chat_lunolatalk_news: [
      {
        id: 'msg_ch_1',
        chatId: 'chat_lunolatalk_news',
        senderId: 'usr_raka',
        text: 'Selamat datang di Tolk by Lunola!\n\nPlatform komunikasi lintas perangkat (Web, PWA, Android WebView) dengan kontrol privasi penuh & backend self-hosted:\n• Chat Pribadi, Grup (Admin/Moderator/Mention/QR), Channel & Pesan Tersimpan\n• Stories 24 jam dengan pengaturan privasi & daftar penonton\n• Panggilan Suara & Video real-time (WebRTC) + Riwayat Panggilan\n• Drag-and-drop file, paste gambar, pesan suara dengan kontrol kecepatan, & pesan terjadwal\n• Terjemahan & ringkasan percakapan AI opsional serta Admin Panel 10 modul lengkap.',
        createdAt: now - 18 * hour,
        reactions: [
          { emoji: '🔥', userIds: ['usr_raka', 'usr_nadia', 'usr_dito'] },
          { emoji: '👍', userIds: ['usr_nadia', 'usr_dito'] },
        ],
        readBy: ['usr_raka', 'usr_nadia', 'usr_dito'],
        views: 1218,
      },
    ],
    chat_android_webview: [
      {
        id: 'msg_aw_1',
        chatId: 'chat_android_webview',
        senderId: 'usr_nadia',
        text: 'Bridge `window.LunolaTalkAndroid` sudah aktif untuk status bar gelap/terang, getaran haptic, tombol Back Android, serta izin kamera & mikrofon WebView.',
        createdAt: now - 6 * hour,
        reactions: [{ emoji: '👍', userIds: ['usr_raka'] }],
        readBy: ['usr_nadia', 'usr_raka', 'usr_dito'],
      },
    ],
  };

  const stories: StoryItem[] = [
    {
      id: 'story_raka_1',
      userId: 'usr_raka',
      kind: 'text',
      text: 'Tolk by Lunola kini mendukung WebRTC Call, Stories 24 jam, PWA, dan Admin Panel lengkap!',
      bgColor: '#0284C7',
      privacy: 'everyone',
      allowedUserIds: [],
      excludedUserIds: [],
      viewerIds: ['usr_nadia', 'usr_dito'],
      createdAt: now - 2 * hour,
      expiresAt: now + 22 * hour,
    },
    {
      id: 'story_nadia_1',
      userId: 'usr_nadia',
      kind: 'text',
      text: 'Coba mode Kontras Tinggi & Bahasa Inggris/Indonesia di menu Privasi & Tampilan.',
      bgColor: '#0F766E',
      privacy: 'everyone',
      allowedUserIds: [],
      excludedUserIds: [],
      viewerIds: ['usr_raka'],
      createdAt: now - 45 * min,
      expiresAt: now + 23 * hour,
    },
  ];

  const reports: ModerationReport[] = [
    {
      id: 'rep_seed_1',
      reporterId: 'usr_nadia',
      targetType: 'group',
      targetId: 'chat_wasmer_id',
      targetLabel: 'Contoh Laporan Tautan Spam (Simulasi Antrean)',
      category: 'spam',
      reason: 'Contoh laporan moderasi agar alur antrean Open -> Reviewing -> Resolved bisa langsung diuji di Admin Panel.',
      status: 'open',
      moderatorNote: '',
      createdAt: now - 4 * hour,
      updatedAt: now - 4 * hour,
    },
  ];

  const settings: PlatformSettings = {
    appName: 'Tolk by Lunola',
    allowRegistration: true,
    maxUploadMb: Math.max(1, Math.min(50, Number(process.env.MAX_UPLOAD_MB || 10))),
    storyExpiryHours: 24,
    maxGroupMembers: 500,
    rateLimitPerMin: Math.max(20, Number(process.env.RATE_LIMIT_PER_MIN || 120)),
    maintenanceMode: false,
    globalAnnouncement: '',
    pushEnabled: true,
  };

  const auditLogs: AuditLogEntry[] = [
    {
      id: `aud_${crypto.randomBytes(4).toString('hex')}`,
      actorId: 'usr_pujo',
      actorName: 'Pujo',
      actorRole: 'super_admin',
      action: 'platform:initialized',
      target: 'Tolk by Lunola Server',
      details: 'Inisialisasi awal server komunikasi real-time & akun Super Admin default.',
      createdAt: now - 24 * hour,
    },
  ];

  return {
    users: {
      usr_pujo: pujo,
      usr_raka: raka,
      usr_nadia: nadia,
      usr_dito: dito,
    },
    sessions: {},
    chats,
    messages,
    scheduledMessages: [],
    stories,
    calls: [],
    friendRequests: [],
    reports,
    auditLogs,
    settings,
    adminPasscodeHash,
    adminPasscodeSalt,
    lastBackupAt: null,
  };
}

let dbPool: mysql.Pool | null = null;
let dbWriteQueue: Promise<void> = Promise.resolve();

function mergeAndRepairStore(parsed: Partial<StoreData>): { merged: StoreData; mutated: boolean } {
  const base = createSeedStore();
  const merged: StoreData = {
    ...base,
    ...parsed,
    users: { ...parsed.users },
    sessions: parsed.sessions || {},
    scheduledMessages: parsed.scheduledMessages || [],
    stories: parsed.stories || base.stories,
    calls: parsed.calls || [],
    friendRequests: parsed.friendRequests || [],
    reports: parsed.reports || base.reports,
    auditLogs: parsed.auditLogs || base.auditLogs,
    settings: { ...base.settings, ...(parsed.settings || {}) },
    adminPasscodeHash: parsed.adminPasscodeHash || base.adminPasscodeHash,
    adminPasscodeSalt: parsed.adminPasscodeSalt || base.adminPasscodeSalt,
    lastBackupAt: parsed.lastBackupAt ?? null,
  };

  let mutated = false;
  const defaultAdmin = base.users.usr_pujo;
  if (!merged.users.usr_pujo && defaultAdmin) {
    merged.users.usr_pujo = defaultAdmin;
    mutated = true;
  } else if (merged.users.usr_pujo && merged.users.usr_pujo.role !== 'super_admin') {
    merged.users.usr_pujo.role = 'super_admin';
    mutated = true;
  }
  if (!parsed.adminPasscodeHash && base.adminPasscodeHash) {
    mutated = true;
  }
  for (const cid of ['chat_wasmer_id', 'chat_lunolatalk_news']) {
    const ch = merged.chats[cid];
    if (ch) {
      if (!ch.memberIds.includes('usr_pujo')) {
        ch.memberIds.unshift('usr_pujo');
        mutated = true;
      }
      if (!ch.adminIds.includes('usr_pujo')) {
        ch.adminIds.unshift('usr_pujo');
        mutated = true;
      }
    }
  }
  return { merged, mutated };
}

function loadStore(): StoreData {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoreData>;
      if (parsed && parsed.users && parsed.chats && parsed.messages) {
        const { merged, mutated } = mergeAndRepairStore(parsed);
        if (mutated) {
          saveStore(merged);
        }
        return merged;
      }
    }
  } catch (err) {
    console.error('Failed to read store.json, initializing fresh store:', err);
  }
  const seeded = createSeedStore();
  saveStore(seeded);
  return seeded;
}

function persistStoreToMysql(jsonStr: string): void {
  if (!dbPool) return;
  const pool = dbPool;
  dbWriteQueue = dbWriteQueue
    .then(async () => {
      await pool.execute(
        'INSERT INTO tolk_kv (id, data, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)',
        ['main', jsonStr, Date.now()]
      );
    })
    .catch((err) => {
      console.error('MySQL saveStore error:', err);
    });
}

function saveStore(data: StoreData): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const tmpPath = `${STORE_PATH}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmpPath, jsonStr, 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
  persistStoreToMysql(jsonStr);
}

async function initDatabaseAndLoadStore(): Promise<StoreData> {
  const host = process.env.DB_HOST;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USERNAME || process.env.DB_USER;

  if (!host || !database || !user) {
    return loadStore();
  }

  try {
    const pool = mysql.createPool({
      host,
      port: Number(process.env.DB_PORT || 3306),
      database,
      user,
      password: process.env.DB_PASSWORD || '',
      waitForConnections: true,
      connectionLimit: 5,
    });

    await pool.execute(
      'CREATE TABLE IF NOT EXISTS tolk_kv (id VARCHAR(64) PRIMARY KEY, data LONGTEXT NOT NULL, updated_at BIGINT NOT NULL)'
    );

    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      'SELECT data FROM tolk_kv WHERE id = ? LIMIT 1',
      ['main']
    );

    dbPool = pool;

    if (rows.length > 0 && typeof rows[0].data === 'string') {
      const parsed = JSON.parse(rows[0].data) as Partial<StoreData>;
      if (parsed && parsed.users && parsed.chats && parsed.messages) {
        const { merged, mutated } = mergeAndRepairStore(parsed);
        if (mutated) {
          saveStore(merged);
        } else {
          const tmpPath = `${STORE_PATH}.${crypto.randomBytes(4).toString('hex')}.tmp`;
          fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf8');
          fs.renameSync(tmpPath, STORE_PATH);
        }
        return merged;
      }
    }

    const initial = loadStore();
    persistStoreToMysql(JSON.stringify(initial, null, 2));
    await dbWriteQueue;
    return initial;
  } catch (err) {
    console.error('Failed to initialize Wasmer MySQL, falling back to JSON store:', err);
    dbPool = null;
    return loadStore();
  }
}

let store: StoreData = createSeedStore();

// Active WebSockets keyed by userId and sessionId
const activeSockets = new Map<string, Set<WebSocket>>();
const socketsBySession = new Map<string, Set<WebSocket>>();

// Sliding-window rate limiter
const rateBuckets = new Map<string, number[]>();
let totalRateLimitBlocked = 0;

function checkRateLimit(key: string, maxPerMin: number): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (rateBuckets.get(key) || []).filter((t) => t > windowStart);
  if (timestamps.length >= maxPerMin) {
    rateBuckets.set(key, timestamps);
    totalRateLimitBlocked += 1;
    return false;
  }
  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  return true;
}

function appendAudit(
  actor: StoredUser,
  action: string,
  target: string,
  details: string
): void {
  store.auditLogs.unshift({
    id: `aud_${crypto.randomBytes(5).toString('hex')}`,
    actorId: actor.id,
    actorName: actor.displayName,
    actorRole: actor.role,
    action,
    target: target.slice(0, 120),
    details: details.slice(0, 260),
    createdAt: Date.now(),
  });
  if (store.auditLogs.length > 400) {
    store.auditLogs.length = 400;
  }
}

function getOnlineUserIds(): string[] {
  const online: string[] = [];
  for (const [uid, sockets] of activeSockets.entries()) {
    if (sockets.size > 0) online.push(uid);
  }
  return online;
}

function toPublicUser(u: StoredUser, includeSelfFields = false): UserProfile {
  const hidePresence = u.privacy?.lastSeenVisibility === 'nobody' && !includeSelfFields;
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: includeSelfFields ? u.email : undefined,
    bio: u.bio,
    statusText: u.statusText,
    avatarUrl: u.avatarUrl,
    avatarColor: u.avatarColor,
    isGuest: u.isGuest,
    verified: u.verified,
    role: u.role || 'user',
    status: u.status || 'active',
    createdAt: u.createdAt || Date.now(),
    lastSeen: hidePresence ? 0 : u.lastSeen,
    online: hidePresence ? false : (activeSockets.get(u.id)?.size || 0) > 0,
    privacy: includeSelfFields ? u.privacy : undefined,
    blockedUserIds: includeSelfFields ? u.blockedUserIds : undefined,
    mutedStoryUserIds: includeSelfFields ? u.mutedStoryUserIds : undefined,
    contactIds: includeSelfFields ? u.contactIds || [] : undefined,
  };
}

function parseDeviceLabel(ua: string): { deviceName: string; platform: string } {
  if (/LunolaTalkAndroid/i.test(ua)) {
    return { deviceName: 'Tolk by Lunola Android WebView', platform: 'Android' };
  }
  if (/Android/i.test(ua)) return { deviceName: 'Android Browser', platform: 'Android' };
  if (/iPhone|iPad/i.test(ua)) return { deviceName: 'iOS Safari', platform: 'iOS' };
  if (/Mac OS X/i.test(ua)) return { deviceName: 'Web Desktop (macOS)', platform: 'Web' };
  if (/Windows/i.test(ua)) return { deviceName: 'Web Desktop (Windows)', platform: 'Web' };
  if (/Linux/i.test(ua)) return { deviceName: 'Web Desktop (Linux)', platform: 'Web' };
  return { deviceName: 'Tolk by Lunola Web', platform: 'Web' };
}

function createSessionForUser(userId: string, req: Request): { token: string; session: DeviceSession } {
  const sid = `ses_${crypto.randomBytes(8).toString('hex')}`;
  const ua = String(req.headers['user-agent'] || 'Web');
  const { deviceName, platform } = parseDeviceLabel(ua);
  const ip =
    String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1')
      .split(',')[0]
      .trim()
      .slice(0, 64);

  const session: DeviceSession = {
    id: sid,
    userId,
    deviceName,
    platform,
    userAgent: ua.slice(0, 140),
    ip,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };
  store.sessions[sid] = session;
  const token = signToken({ uid: userId, sid });
  return { token, session };
}

function filterActiveMessages(chatId: string): Message[] {
  const list = store.messages[chatId] || [];
  const now = Date.now();
  return list.filter((m) => !m.expiresAt || m.expiresAt > now);
}

function isChatMuted(user: StoredUser | undefined, chatId: string): { muted: boolean; mutedUntil: number | null } {
  const until = user?.mutedUntilByChat?.[chatId];
  if (!until) return { muted: false, mutedUntil: null };
  if (until === -1) return { muted: true, mutedUntil: -1 };
  if (until > Date.now()) return { muted: true, mutedUntil: until };
  return { muted: false, mutedUntil: null };
}

function buildChatRoomForUser(chat: StoredChat, userId: string): ChatRoom {
  const user = store.users[userId];
  const activeMsgs = filterActiveMessages(chat.id);
  const lastMessage = activeMsgs.length > 0 ? activeMsgs[activeMsgs.length - 1] : null;
  const lastReadAt = user?.lastReadByChat?.[chat.id] || 0;
  const markedUnread = user?.markedUnreadChatIds?.includes(chat.id) || false;
  const rawUnread = activeMsgs.filter(
    (m) => m.senderId !== userId && m.createdAt > lastReadAt
  ).length;
  const unreadCount = markedUnread ? Math.max(1, rawUnread) : rawUnread;
  const muteState = isChatMuted(user, chat.id);

  let title = chat.title;
  let avatarUrl = chat.avatarUrl;
  let avatarColor = chat.avatarColor;
  let peerUser: UserProfile | null = null;

  if (chat.type === 'dm') {
    const peerId = chat.memberIds.find((id) => id !== userId) || userId;
    const peer = store.users[peerId];
    if (peer) {
      peerUser = toPublicUser(peer);
      title = peer.displayName;
      avatarUrl = peer.avatarUrl;
      avatarColor = peer.avatarColor;
    }
  }

  return {
    id: chat.id,
    type: chat.type,
    title,
    handle: chat.handle,
    description: chat.description,
    avatarUrl,
    avatarColor,
    memberIds: chat.memberIds,
    adminIds: chat.adminIds,
    moderatorIds: chat.moderatorIds || [],
    adminOnlyPost: Boolean(chat.adminOnlyPost),
    pinnedMessageId: chat.pinnedMessageId,
    isPinnedByUser: user?.pinnedChatIds?.includes(chat.id) || false,
    isMutedByUser: muteState.muted,
    mutedUntil: muteState.mutedUntil,
    isArchivedByUser: user?.archivedChatIds?.includes(chat.id) || false,
    markedUnreadByUser: markedUnread,
    selfDestructSec: chat.selfDestructSec || 0,
    subscriberCount: chat.subscriberCount,
    inviteExpiresAt: chat.inviteExpiresAt ?? null,
    inviteMaxUses: chat.inviteMaxUses ?? null,
    inviteUses: chat.inviteUses ?? 0,
    suspended: Boolean(chat.suspended),
    createdAt: chat.createdAt,
    lastMessage,
    unreadCount,
    peerUser,
  };
}

function getVisibleStoriesForUser(userId: string): StoryItem[] {
  const now = Date.now();
  const viewer = store.users[userId];
  const mutedAuthors = new Set(viewer?.mutedStoryUserIds || []);
  return store.stories
    .filter((s) => s.expiresAt > now)
    .filter((s) => {
      if (s.userId === userId) return true;
      if (mutedAuthors.has(s.userId)) return false;
      const author = store.users[s.userId];
      if (!author || author.status !== 'active') return false;
      if (author.blockedUserIds?.includes(userId)) return false;
      if (s.privacy === 'selected') return s.allowedUserIds.includes(userId);
      if (s.privacy === 'except') return !s.excludedUserIds.includes(userId);
      return true;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

function ensureDefaultChatsForUser(userId: string): void {
  const now = Date.now();
  const savedChatId = `saved_${userId}`;
  if (!store.chats[savedChatId]) {
    store.chats[savedChatId] = {
      id: savedChatId,
      type: 'saved',
      title: 'Pesan Tersimpan',
      description: 'Catatan pribadi, tautan, foto, dokumen, dan pesan yang diteruskan.',
      avatarUrl: null,
      avatarColor: '#0284C7',
      memberIds: [userId],
      adminIds: [userId],
      moderatorIds: [],
      pinnedMessageId: null,
      selfDestructSec: 0,
      createdAt: now,
    };
    store.messages[savedChatId] = [
      {
        id: `msg_saved_${crypto.randomBytes(4).toString('hex')}`,
        chatId: savedChatId,
        senderId: userId,
        text: 'Selamat datang di Pesan Tersimpan Tolk by Lunola. Simpan catatan pribadi, file penting, atau teruskan pesan dari percakapan lain ke sini.',
        createdAt: now,
        reactions: [],
        readBy: [userId],
      },
    ];
  }

  const starterGroupIds = ['chat_wasmer_id', 'chat_lunolatalk_news', 'chat_android_webview'];
  for (const cid of starterGroupIds) {
    const c = store.chats[cid];
    if (c && !c.memberIds.includes(userId)) {
      c.memberIds.push(userId);
    }
  }

  const dmId = `dm_${[userId, 'usr_raka'].sort().join('_')}`;
  if (userId !== 'usr_raka' && !store.chats[dmId] && store.users['usr_raka']) {
    store.chats[dmId] = {
      id: dmId,
      type: 'dm',
      title: 'Raka Pratama',
      description: 'Percakapan pribadi',
      avatarUrl: store.users['usr_raka'].avatarUrl,
      avatarColor: store.users['usr_raka'].avatarColor,
      memberIds: [userId, 'usr_raka'],
      adminIds: [userId, 'usr_raka'],
      moderatorIds: [],
      pinnedMessageId: null,
      selfDestructSec: 0,
      createdAt: now - 15 * 60 * 1000,
    };
    store.messages[dmId] = [
      {
        id: `msg_dm_${crypto.randomBytes(4).toString('hex')}`,
        chatId: dmId,
        senderId: 'usr_raka',
        text: 'Halo! Selamat datang di Tolk by Lunola. Kamu bisa langsung coba kirim pesan, seret file/gambar, panggil suara/video, buat Stories 24 jam, atau buka Admin Panel dari menu samping.',
        createdAt: now - 14 * 60 * 1000,
        reactions: [],
        readBy: ['usr_raka'],
      },
    ];
  }

  const u = store.users[userId];
  if (u && (!u.pinnedChatIds || u.pinnedChatIds.length === 0)) {
    u.pinnedChatIds = [savedChatId, 'chat_wasmer_id'];
  }
}

function sendWsToUser(userId: string, event: unknown): void {
  const sockets = activeSockets.get(userId);
  if (!sockets || sockets.size === 0) return;
  const serialized = JSON.stringify(event);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(serialized);
    }
  }
}

function broadcastAll(event: unknown): void {
  const serialized = JSON.stringify(event);
  for (const sockets of activeSockets.values()) {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized);
      }
    }
  }
}

function broadcastToChat(chat: StoredChat, event: unknown, excludeUserId?: string): void {
  const serialized = JSON.stringify(event);
  for (const memberId of chat.memberIds) {
    if (excludeUserId && memberId === excludeUserId) continue;
    const sockets = activeSockets.get(memberId);
    if (!sockets) continue;
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized);
      }
    }
  }
}

function broadcastPresence(userId: string, online: boolean): void {
  const u = store.users[userId];
  if (!u || u.privacy?.lastSeenVisibility === 'nobody') return;
  broadcastAll({
    type: 'presence:update',
    userId,
    online,
    lastSeen: u.lastSeen,
  });
}

function revokeSessionSockets(sessionId: string): void {
  const set = socketsBySession.get(sessionId);
  if (!set) return;
  for (const ws of set) {
    try {
      ws.send(JSON.stringify({ type: 'session:revoked' }));
      ws.close(4003, 'Session revoked');
    } catch {
      // Ignore close error
    }
  }
  socketsBySession.delete(sessionId);
}

interface AuthedRequest extends Request {
  userId?: string;
  sessionId?: string;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    res.status(401).json({ error: 'Sesi tidak valid. Silakan masuk kembali.' });
    return;
  }
  const verified = verifyToken(match[1]);
  if (!verified || !store.users[verified.uid] || !store.sessions[verified.sid]) {
    res.status(401).json({ error: 'Sesi telah dicabut atau kedaluwarsa.' });
    return;
  }
  const user = store.users[verified.uid];
  if (user.status !== 'active') {
    res.status(403).json({
      error: `Akun Anda berstatus ${user.status}. Hubungi tim dukungan untuk banding.`,
    });
    return;
  }

  if (!checkRateLimit(`user:${verified.uid}`, store.settings.rateLimitPerMin)) {
    res.status(429).json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' });
    return;
  }

  store.sessions[verified.sid].lastActiveAt = Date.now();
  req.userId = verified.uid;
  req.sessionId = verified.sid;
  next();
}

function requireAdminPermission(permission: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const user = req.userId ? store.users[req.userId] : null;
    if (!user || !hasPermission(user.role, permission)) {
      res.status(403).json({
        error: 'Akses ditolak. Peran admin Anda tidak memiliki izin untuk tindakan ini.',
      });
      return;
    }
    next();
  };
}

function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLen);
}

function sanitizeUsername(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
}

const ALLOWED_MIME_EXT: Record<string, { ext: string; kind: Attachment['kind'] }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/gif': { ext: 'gif', kind: 'image' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
  'audio/webm': { ext: 'webm', kind: 'audio' },
  'audio/ogg': { ext: 'ogg', kind: 'audio' },
  'audio/mp4': { ext: 'm4a', kind: 'audio' },
  'audio/mpeg': { ext: 'mp3', kind: 'audio' },
  'application/pdf': { ext: 'pdf', kind: 'file' },
  'text/plain': { ext: 'txt', kind: 'file' },
  'text/csv': { ext: 'csv', kind: 'file' },
  'application/json': { ext: 'json', kind: 'file' },
  'application/zip': { ext: 'zip', kind: 'file' },
};

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function computeStorageStats(): { filesCount: number; mediaMb: number; storeKb: number } {
  let filesCount = 0;
  let totalBytes = 0;
  try {
    const entries = fs.readdirSync(UPLOADS_DIR);
    for (const file of entries) {
      const full = path.resolve(UPLOADS_DIR, file);
      if (!full.startsWith(UPLOADS_DIR + path.sep)) continue;
      const st = fs.statSync(full);
      if (st.isFile()) {
        filesCount += 1;
        totalBytes += st.size;
      }
    }
  } catch {
    // Ignore read errors
  }
  let storeBytes = 0;
  try {
    if (fs.existsSync(STORE_PATH)) {
      storeBytes = fs.statSync(STORE_PATH).size;
    }
  } catch {
    // Ignore
  }
  return {
    filesCount,
    mediaMb: Number((totalBytes / (1024 * 1024)).toFixed(2)),
    storeKb: Number((storeBytes / 1024).toFixed(1)),
  };
}

async function startServer(): Promise<void> {
  store = await initDatabaseAndLoadStore();
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self)');
    next();
  });
  app.use(express.json({ limit: '24mb' }));

  // Healthcheck for Wasmer Edge, Docker Compose & Android WebView
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'lunola-talk',
      runtime: process.env.WASMER_RUNTIME || 'node-wasmer-compatible',
      database: dbPool ? 'mysql' : 'json-file',
      tinodeHost: process.env.TINODE_HOST ? 'configured' : 'embedded-realtime-ws',
      maintenanceMode: store.settings.maintenanceMode,
      uptimeSec: Math.floor((Date.now() - SERVER_START_MS) / 1000),
      onlineUsers: getOnlineUserIds().length,
    });
  });

  // Guest Session Bootstrap (disabled — mandatory login enabled)
  app.post('/api/auth/guest', (_req, res) => {
    res.status(403).json({ error: 'Akses tamu dinonaktifkan. Silakan masuk atau daftar akun.' });
  });

  // Register Real Account
  app.post('/api/auth/register', (req, res) => {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local');
    if (!checkRateLimit(`auth:${ip}`, 15)) {
      res.status(429).json({ error: 'Terlalu banyak percobaan pendaftaran. Coba 1 menit lagi.' });
      return;
    }
    if (!store.settings.allowRegistration) {
      res.status(403).json({ error: 'Pendaftaran akun baru sedang dinonaktifkan oleh admin.' });
      return;
    }

    const username = sanitizeUsername(req.body?.username);
    const displayName = sanitizeText(req.body?.displayName, 48);
    const email = sanitizeText(req.body?.email, 96).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const bio = sanitizeText(req.body?.bio, 140) || 'Aktif di Tolk by Lunola';

    if (username.length < 3) {
      res.status(400).json({ error: 'Username minimal 3 karakter (huruf, angka, garis bawah).' });
      return;
    }
    if (displayName.length < 2) {
      res.status(400).json({ error: 'Nama tampilan minimal 2 karakter.' });
      return;
    }
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'Kata sandi harus antara 6 sampai 128 karakter.' });
      return;
    }

    const exists = Object.values(store.users).some(
      (u) => u.username.toLowerCase() === username
    );
    if (exists) {
      res.status(409).json({ error: `Username @${username} sudah digunakan.` });
      return;
    }

    const { hash, salt } = hashSecret(password);
    const userId = `usr_${crypto.randomBytes(6).toString('hex')}`;
    const now = Date.now();
    const newUser: StoredUser = {
      id: userId,
      username,
      displayName,
      email: email || undefined,
      bio,
      statusText: 'Tersedia',
      avatarUrl: null,
      avatarColor: pickColor(username),
      isGuest: false,
      verified: false,
      role: 'user',
      status: 'active',
      createdAt: now,
      lastSeen: now,
      passwordHash: hash,
      passwordSalt: salt,
      pinnedChatIds: [],
      archivedChatIds: [],
      markedUnreadChatIds: [],
      mutedUntilByChat: {},
      lastReadByChat: {},
      blockedUserIds: [],
      mutedStoryUserIds: [],
      privacy: { ...DEFAULT_PRIVACY },
    };
    store.users[userId] = newUser;
    ensureDefaultChatsForUser(userId);
    const { token } = createSessionForUser(userId, req);
    saveStore(store);

    broadcastAll({ type: 'user:updated', user: toPublicUser(newUser) });
    res.status(201).json({ token, user: toPublicUser(newUser, true) });
  });

  // Login Existing Account
  app.post('/api/auth/login', (req, res) => {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local');
    if (!checkRateLimit(`login:${ip}`, 10)) {
      res.status(429).json({ error: 'Terlalu banyak percobaan login. Tunggu 1 menit.' });
      return;
    }

    const rawIdentifier =
      typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const cleanUsername = sanitizeUsername(rawIdentifier);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!rawIdentifier || !password) {
      res.status(400).json({ error: 'Masukkan username/email dan kata sandi.' });
      return;
    }

    const user = Object.values(store.users).find(
      (u) =>
        (cleanUsername && u.username.toLowerCase() === cleanUsername) ||
        (u.email && u.email.toLowerCase() === rawIdentifier)
    );
    if (!user || !user.passwordHash || !user.passwordSalt) {
      res.status(401).json({ error: 'Username/email atau kata sandi tidak cocok.' });
      return;
    }
    if (user.status !== 'active') {
      res.status(403).json({ error: `Akun ini berstatus ${user.status}.` });
      return;
    }

    const valid = verifySecret(password, user.passwordHash, user.passwordSalt);
    if (!valid) {
      res.status(401).json({ error: 'Username atau kata sandi tidak cocok.' });
      return;
    }

    user.lastSeen = Date.now();
    ensureDefaultChatsForUser(user.id);
    const { token } = createSessionForUser(user.id, req);
    saveStore(store);

    res.json({ token, user: toPublicUser(user, true) });
  });

  // Logout Current Session
  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res) => {
    const sid = req.sessionId!;
    delete store.sessions[sid];
    saveStore(store);
    revokeSessionSockets(sid);
    res.json({ ok: true });
  });

  // Active Devices & Session Management
  app.get('/api/sessions', requireAuth, (req: AuthedRequest, res) => {
    const list = Object.values(store.sessions)
      .filter((s) => s.userId === req.userId)
      .map((s) => ({ ...s, current: s.id === req.sessionId }))
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    res.json({ sessions: list });
  });

  app.delete('/api/sessions/:sid', requireAuth, (req: AuthedRequest, res) => {
    const target = store.sessions[req.params.sid];
    if (!target || target.userId !== req.userId) {
      res.status(404).json({ error: 'Sesi perangkat tidak ditemukan.' });
      return;
    }
    delete store.sessions[target.id];
    saveStore(store);
    revokeSessionSockets(target.id);
    res.json({ ok: true });
  });

  // Bootstrap Full Workspace State
  app.get('/api/bootstrap', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const user = store.users[userId];
    ensureDefaultChatsForUser(userId);

    const usersMap: Record<string, UserProfile> = {};
    for (const u of Object.values(store.users)) {
      usersMap[u.id] = toPublicUser(u, u.id === userId);
    }

    const chats: ChatRoom[] = Object.values(store.chats)
      .filter((c) => c.memberIds.includes(userId))
      .map((c) => buildChatRoomForUser(c, userId))
      .sort((a, b) => {
        if (a.isPinnedByUser !== b.isPinnedByUser) return a.isPinnedByUser ? -1 : 1;
        return (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt);
      });

    const userCalls = store.calls
      .filter((c) => c.callerId === userId || c.calleeId === userId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 50);

    const userFriendRequests = (store.friendRequests || [])
      .filter((r) => r.fromUserId === userId || r.toUserId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json({
      user: toPublicUser(user, true),
      users: usersMap,
      chats,
      stories: getVisibleStoriesForUser(userId),
      calls: userCalls,
      friendRequests: userFriendRequests,
      onlineUserIds: getOnlineUserIds(),
      settings: store.settings,
      adminAuthState: {
        hasClaimedAdmin: Boolean(store.adminPasscodeHash),
        envPasscodeConfigured: Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.length >= 6),
      },
      serverInfo: {
        runtime: process.env.WASMER_RUNTIME || 'Node.js / Wasmer Edge & Tinode Ready',
        wasmerReady: true,
        wsPath: '/ws',
        maxUploadMb: store.settings.maxUploadMb,
      },
    });
  });

  // Update Own Profile
  app.patch('/api/profile', requireAuth, (req: AuthedRequest, res) => {
    const user = store.users[req.userId!];
    const displayName = sanitizeText(req.body?.displayName, 48);
    const bio = sanitizeText(req.body?.bio, 140);
    const statusText = sanitizeText(req.body?.statusText, 64);
    const email = sanitizeText(req.body?.email, 96).toLowerCase();
    const username = req.body?.username ? sanitizeUsername(req.body.username) : user.username;

    if (displayName.length < 2) {
      res.status(400).json({ error: 'Nama tampilan minimal 2 karakter.' });
      return;
    }
    if (username.length < 3) {
      res.status(400).json({ error: 'Username minimal 3 karakter.' });
      return;
    }

    const duplicate = Object.values(store.users).some(
      (u) => u.id !== user.id && u.username.toLowerCase() === username
    );
    if (duplicate) {
      res.status(409).json({ error: `Username @${username} sudah dipakai pengguna lain.` });
      return;
    }

    user.displayName = displayName;
    user.bio = bio;
    user.statusText = statusText;
    if (email) user.email = email;
    user.username = username;

    if (req.body?.avatarUrl === null || req.body?.avatarUrl === '') {
      user.avatarUrl = null;
    } else if (typeof req.body?.avatarUrl === 'string') {
      const candidate = req.body.avatarUrl.trim();
      if (
        (candidate.startsWith('/uploads/') || candidate.startsWith('/src/assets/images/')) &&
        !candidate.includes('..') &&
        candidate.length <= 240
      ) {
        user.avatarUrl = candidate;
      } else {
        res.status(400).json({ error: 'URL foto profil tidak valid.' });
        return;
      }
    }

    if (typeof req.body?.avatarColor === 'string') {
      const hex = req.body.avatarColor.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        user.avatarColor = hex;
      }
    }

    saveStore(store);

    broadcastAll({ type: 'user:updated', user: toPublicUser(user) });
    res.json({ user: toPublicUser(user, true) });
  });

  // Privacy Settings & User Blocking
  app.patch('/api/privacy', requireAuth, (req: AuthedRequest, res) => {
    const user = store.users[req.userId!];
    const validScopes = new Set(['everyone', 'contacts', 'nobody']);
    const nextPrivacy: UserPrivacySettings = { ...user.privacy };

    if (validScopes.has(req.body?.lastSeenVisibility)) {
      nextPrivacy.lastSeenVisibility = req.body.lastSeenVisibility;
    }
    if (validScopes.has(req.body?.whoCanMessage)) {
      nextPrivacy.whoCanMessage = req.body.whoCanMessage;
    }
    if (validScopes.has(req.body?.storyVisibility)) {
      nextPrivacy.storyVisibility = req.body.storyVisibility;
    }

    user.privacy = nextPrivacy;
    saveStore(store);
    res.json({ user: toPublicUser(user, true) });
  });

  app.post('/api/users/:targetId/block', requireAuth, (req: AuthedRequest, res) => {
    const user = store.users[req.userId!];
    const targetId = req.params.targetId;
    if (!store.users[targetId] || targetId === user.id) {
      res.status(400).json({ error: 'Pengguna target tidak valid.' });
      return;
    }
    const block = Boolean(req.body?.block);
    if (block) {
      if (!user.blockedUserIds.includes(targetId)) user.blockedUserIds.push(targetId);
    } else {
      user.blockedUserIds = user.blockedUserIds.filter((id) => id !== targetId);
    }
    saveStore(store);
    res.json({ blockedUserIds: user.blockedUserIds });
  });

  // Search Users
  app.get('/api/users/search', requireAuth, (req: AuthedRequest, res) => {
    const q = sanitizeText(req.query.q, 48).toLowerCase();
    const list = Object.values(store.users)
      .filter((u) => u.id !== req.userId && u.status === 'active')
      .filter((u) => {
        if (!q) return true;
        return (
          u.displayName.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q)
        );
      })
      .slice(0, 30)
      .map((u) => toPublicUser(u));
    res.json({ users: list });
  });

  // Lookup user by @username or display name (for adding contacts)
  app.get('/api/users/lookup', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const raw = sanitizeText(req.query?.q, 64).replace(/^@/, '').toLowerCase();
    if (raw.length < 2) {
      res.json({ users: [] });
      return;
    }
    const matches = Object.values(store.users)
      .filter(
        (u) =>
          u.id !== userId &&
          u.status === 'active' &&
          (u.username.toLowerCase().includes(raw) || u.displayName.toLowerCase().includes(raw))
      )
      .slice(0, 15)
      .map((u) => toPublicUser(u, false));
    res.json({ users: matches });
  });

  // Send contact / friend request
  app.post('/api/contacts/request', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const user = store.users[userId];
    const targetUserId = sanitizeText(req.body?.targetUserId, 64);
    const usernameInput = sanitizeUsername(req.body?.username || '');

    const target = targetUserId
      ? store.users[targetUserId]
      : Object.values(store.users).find((u) => u.username.toLowerCase() === usernameInput);

    if (!target || target.id === userId || target.status !== 'active') {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }
    if (target.blockedUserIds?.includes(userId)) {
      res.status(403).json({ error: 'Tidak dapat mengirim permintaan kontak ke pengguna ini.' });
      return;
    }

    user.contactIds = user.contactIds || [];
    target.contactIds = target.contactIds || [];
    if (user.contactIds.includes(target.id)) {
      res.status(409).json({ error: 'Pengguna ini sudah ada di daftar kontak Anda.' });
      return;
    }

    store.friendRequests = store.friendRequests || [];
    // If target already sent a pending request to user, auto-accept
    const reversePending = store.friendRequests.find(
      (r) => r.fromUserId === target.id && r.toUserId === userId && r.status === 'pending'
    );
    if (reversePending) {
      reversePending.status = 'accepted';
      if (!user.contactIds.includes(target.id)) user.contactIds.push(target.id);
      if (!target.contactIds.includes(userId)) target.contactIds.push(userId);
      saveStore(store);
      sendWsToUser(target.id, {
        type: 'contact:accepted',
        request: reversePending,
        user: toPublicUser(user, false),
      });
      res.json({
        request: reversePending,
        autoAccepted: true,
        targetUser: toPublicUser(target, false),
      });
      return;
    }

    const existingPending = store.friendRequests.find(
      (r) => r.fromUserId === userId && r.toUserId === target.id && r.status === 'pending'
    );
    if (existingPending) {
      res.status(409).json({ error: 'Permintaan kontak sudah dikirim dan menunggu persetujuan.' });
      return;
    }

    const requestObj: FriendRequest = {
      id: `freq_${crypto.randomBytes(6).toString('hex')}`,
      fromUserId: userId,
      toUserId: target.id,
      status: 'pending',
      createdAt: Date.now(),
    };
    store.friendRequests.unshift(requestObj);
    saveStore(store);

    sendWsToUser(target.id, {
      type: 'contact:request',
      request: requestObj,
      fromUser: toPublicUser(user, false),
    });

    res.status(201).json({
      request: requestObj,
      autoAccepted: false,
      targetUser: toPublicUser(target, false),
    });
  });

  // Respond to incoming contact request
  app.post('/api/contacts/respond', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const user = store.users[userId];
    const requestId = sanitizeText(req.body?.requestId, 64);
    const action = req.body?.action as 'accept' | 'reject';
    if (action !== 'accept' && action !== 'reject') {
      res.status(400).json({ error: 'Aksi tidak valid.' });
      return;
    }

    store.friendRequests = store.friendRequests || [];
    const freq = store.friendRequests.find(
      (r) => r.id === requestId && r.toUserId === userId && r.status === 'pending'
    );
    if (!freq) {
      res.status(404).json({ error: 'Permintaan kontak tidak ditemukan.' });
      return;
    }

    freq.status = action === 'accept' ? 'accepted' : 'rejected';
    const sender = store.users[freq.fromUserId];

    if (action === 'accept' && sender) {
      user.contactIds = user.contactIds || [];
      sender.contactIds = sender.contactIds || [];
      if (!user.contactIds.includes(sender.id)) user.contactIds.push(sender.id);
      if (!sender.contactIds.includes(userId)) sender.contactIds.push(userId);

      sendWsToUser(sender.id, {
        type: 'contact:accepted',
        request: freq,
        user: toPublicUser(user, false),
      });
    }

    saveStore(store);
    res.json({ request: freq, contactIds: user.contactIds || [] });
  });

  // Create Chat (DM, Group, Channel)
  app.post('/api/chats', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const type = req.body?.type as ChatType;

    if (type === 'dm') {
      const targetUserId = sanitizeText(req.body?.targetUserId, 64);
      const target = store.users[targetUserId];
      if (!targetUserId || !target || targetUserId === userId) {
        res.status(400).json({ error: 'Pengguna tujuan tidak valid.' });
        return;
      }
      if (target.blockedUserIds?.includes(userId)) {
        res.status(403).json({ error: 'Pengguna ini tidak menerima pesan dari Anda.' });
        return;
      }
      const dmId = `dm_${[userId, targetUserId].sort().join('_')}`;
      let chat = store.chats[dmId];
      if (!chat) {
        const caller = store.users[userId];
        const isMutualContact =
          Boolean(caller?.contactIds?.includes(targetUserId)) ||
          Boolean(target.contactIds?.includes(userId));
        if (!isMutualContact) {
          res.status(403).json({
            error: 'Tambahkan pengguna ke kontak terlebih dahulu dan tunggu persetujuan.',
          });
          return;
        }
        chat = {
          id: dmId,
          type: 'dm',
          title: target.displayName,
          description: 'Percakapan pribadi',
          avatarUrl: target.avatarUrl,
          avatarColor: target.avatarColor,
          memberIds: [userId, targetUserId],
          adminIds: [userId, targetUserId],
          moderatorIds: [],
          pinnedMessageId: null,
          selfDestructSec: 0,
          createdAt: Date.now(),
        };
        store.chats[dmId] = chat;
        store.messages[dmId] = [];
        saveStore(store);

        sendWsToUser(targetUserId, {
          type: 'chat:created',
          chat: buildChatRoomForUser(chat, targetUserId),
        });
      }
      res.status(201).json({ chat: buildChatRoomForUser(chat, userId) });
      return;
    }

    if (type === 'group' || type === 'channel') {
      const title = sanitizeText(req.body?.title, 64);
      const description = sanitizeText(req.body?.description, 200);
      const handle = sanitizeUsername(req.body?.handle || title.replace(/\s+/g, '_'));
      const rawMembers = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];

      if (title.length < 2) {
        res.status(400).json({ error: 'Nama grup atau channel minimal 2 karakter.' });
        return;
      }

      const memberSet = new Set<string>([userId]);
      for (const m of rawMembers) {
        if (
          typeof m === 'string' &&
          store.users[m] &&
          memberSet.size < store.settings.maxGroupMembers
        ) {
          memberSet.add(m);
        }
      }

      const chatId = `${type}_${crypto.randomBytes(6).toString('hex')}`;
      const newChat: StoredChat = {
        id: chatId,
        type,
        title,
        handle: handle || undefined,
        description:
          description ||
          (type === 'channel'
            ? 'Channel siaran publik Tolk by Lunola'
            : 'Grup komunitas Tolk by Lunola'),
        avatarUrl: null,
        avatarColor: pickColor(title),
        memberIds: Array.from(memberSet),
        adminIds: [userId],
        moderatorIds: [],
        adminOnlyPost: type === 'channel',
        pinnedMessageId: null,
        selfDestructSec: 0,
        subscriberCount: type === 'channel' ? memberSet.size : undefined,
        createdAt: Date.now(),
      };

      const welcomeMsg: Message = {
        id: `msg_${crypto.randomBytes(6).toString('hex')}`,
        chatId,
        senderId: userId,
        text: type === 'channel' ? `Channel "${title}" dibuat` : `Grup "${title}" dibuat`,
        createdAt: Date.now(),
        reactions: [],
        readBy: [userId],
        views: type === 'channel' ? 1 : undefined,
        systemEvent: true,
      };

      store.chats[chatId] = newChat;
      store.messages[chatId] = [welcomeMsg];
      saveStore(store);

      for (const mid of newChat.memberIds) {
        sendWsToUser(mid, {
          type: 'chat:created',
          chat: buildChatRoomForUser(newChat, mid),
        });
      }

      res.status(201).json({ chat: buildChatRoomForUser(newChat, userId) });
      return;
    }

    res.status(400).json({ error: 'Tipe percakapan tidak valid.' });
  });

  // Update Group / Channel Metadata & Settings (Admin or Moderator)
  app.patch('/api/chats/:chatId', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const chat = store.chats[req.params.chatId];
    if (!chat || !chat.memberIds.includes(userId)) {
      res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
      return;
    }
    const isAdminOrMod =
      chat.adminIds.includes(userId) || (chat.moderatorIds || []).includes(userId);
    if (!isAdminOrMod) {
      res.status(403).json({ error: 'Hanya admin atau moderator yang dapat mengubah info grup.' });
      return;
    }

    if (typeof req.body?.title === 'string') {
      const t = sanitizeText(req.body.title, 64);
      if (t.length >= 2) chat.title = t;
    }
    if (typeof req.body?.description === 'string') {
      chat.description = sanitizeText(req.body.description, 220);
    }
    if (typeof req.body?.adminOnlyPost === 'boolean' && chat.adminIds.includes(userId)) {
      chat.adminOnlyPost = req.body.adminOnlyPost;
    }
    saveStore(store);

    broadcastToChat(chat, {
      type: 'chat:updated',
      chatId: chat.id,
      patch: {
        title: chat.title,
        description: chat.description,
        adminOnlyPost: chat.adminOnlyPost,
      },
    });
    res.json({ chat: buildChatRoomForUser(chat, userId) });
  });

  // Manage Group Moderator Role (Admin only)
  app.post('/api/chats/:chatId/roles', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const chat = store.chats[req.params.chatId];
    if (!chat || !chat.adminIds.includes(userId)) {
      res.status(403).json({ error: 'Hanya admin grup yang dapat mengatur peran anggota.' });
      return;
    }
    const targetUserId = sanitizeText(req.body?.userId, 64);
    const makeModerator = Boolean(req.body?.moderator);
    if (!chat.memberIds.includes(targetUserId)) {
      res.status(404).json({ error: 'Anggota tidak ditemukan dalam grup.' });
      return;
    }
    chat.moderatorIds = chat.moderatorIds || [];
    if (makeModerator) {
      if (!chat.moderatorIds.includes(targetUserId)) chat.moderatorIds.push(targetUserId);
    } else {
      chat.moderatorIds = chat.moderatorIds.filter((id) => id !== targetUserId);
    }
    saveStore(store);
    broadcastToChat(chat, {
      type: 'chat:updated',
      chatId: chat.id,
      patch: { moderatorIds: chat.moderatorIds },
    });
    res.json({ moderatorIds: chat.moderatorIds });
  });

  // Leave Group / Channel
  app.post('/api/chats/:chatId/leave', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const chat = store.chats[req.params.chatId];
    if (!chat || !chat.memberIds.includes(userId) || chat.type === 'saved') {
      res.status(400).json({ error: 'Tidak dapat keluar dari percakapan ini.' });
      return;
    }
    chat.memberIds = chat.memberIds.filter((id) => id !== userId);
    chat.adminIds = chat.adminIds.filter((id) => id !== userId);
    chat.moderatorIds = (chat.moderatorIds || []).filter((id) => id !== userId);
    saveStore(store);
    broadcastToChat(chat, {
      type: 'chat:updated',
      chatId: chat.id,
      patch: { memberIds: chat.memberIds },
    });
    res.json({ ok: true });
  });

  // Delete Chat (DM by participant, Group/Channel by chat admin or platform admin)
  app.delete('/api/chats/:chatId', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const actor = store.users[userId];
    const chat = store.chats[req.params.chatId];
    if (!chat || !chat.memberIds.includes(userId)) {
      res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
      return;
    }
    if (chat.type === 'saved') {
      res.status(400).json({ error: 'Pesan Tersimpan tidak dapat dihapus.' });
      return;
    }
    const isPlatformAdmin = actor?.role === 'super_admin' || actor?.role === 'administrator';
    if ((chat.type === 'group' || chat.type === 'channel') && !chat.adminIds.includes(userId) && !isPlatformAdmin) {
      res.status(403).json({
        error: 'Hanya admin grup/channel yang dapat menghapus percakapan ini. Gunakan Keluar untuk meninggalkan ruang.',
      });
      return;
    }

    const chatSnapshot = { ...chat, memberIds: [...chat.memberIds] };
    delete store.chats[chat.id];
    delete store.messages[chat.id];
    store.scheduledMessages = store.scheduledMessages.filter((m) => m.chatId !== chat.id);
    for (const memberId of chatSnapshot.memberIds) {
      const u = store.users[memberId];
      if (!u) continue;
      u.pinnedChatIds = u.pinnedChatIds.filter((id) => id !== chat.id);
      u.archivedChatIds = u.archivedChatIds.filter((id) => id !== chat.id);
      u.markedUnreadChatIds = u.markedUnreadChatIds.filter((id) => id !== chat.id);
      delete u.mutedUntilByChat[chat.id];
      delete u.lastReadByChat[chat.id];
    }

    saveStore(store);
    broadcastToChat(chatSnapshot, { type: 'chat:deleted', chatId: chat.id });
    res.json({ ok: true, chatId: chat.id });
  });

  // Get Messages for a Chat
  app.get('/api/chats/:chatId/messages', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const chat = store.chats[req.params.chatId];
    if (!chat || !chat.memberIds.includes(userId)) {
      res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
      return;
    }

    const activeMsgs = filterActiveMessages(chat.id);
    const user = store.users[userId];
    user.lastReadByChat[chat.id] = Date.now();
    user.markedUnreadChatIds = (user.markedUnreadChatIds || []).filter((id) => id !== chat.id);
    let changed = false;
    for (const msg of activeMsgs) {
      if (!msg.readBy.includes(userId)) {
        msg.readBy.push(userId);
        changed = true;
      }
      if (chat.type === 'channel' && typeof msg.views === 'number') {
        msg.views += 1;
        changed = true;
      }
    }
    if (changed) {
      saveStore(store);
      broadcastToChat(
        chat,
        { type: 'chat:read', chatId: chat.id, userId, readAt: Date.now() },
        userId
      );
    }

    const scheduledForChat = store.scheduledMessages.filter(
      (m) => m.chatId === chat.id && m.senderId === userId
    );
    res.json({ messages: activeMsgs, scheduledMessages: scheduledForChat });
  });

  // Send or Schedule a Message
  app.post('/api/chats/:chatId/messages', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const chat = store.chats[req.params.chatId];
    if (!chat || !chat.memberIds.includes(userId)) {
      res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
      return;
    }
    if (chat.suspended) {
      res.status(403).json({ error: 'Grup atau channel ini sedang dibekukan oleh moderator.' });
      return;
    }

    if (chat.type === 'dm') {
      const peerId = chat.memberIds.find((id) => id !== userId);
      if (peerId && store.users[peerId]?.blockedUserIds?.includes(userId)) {
        res.status(403).json({ error: 'Anda tidak dapat mengirim pesan ke pengguna ini.' });
        return;
      }
    }

    const isAdminOrMod =
      chat.adminIds.includes(userId) || (chat.moderatorIds || []).includes(userId);
    if ((chat.type === 'channel' || chat.adminOnlyPost) && !isAdminOrMod) {
      res.status(403).json({ error: 'Hanya admin yang dapat mengirim pesan di sini.' });
      return;
    }

    const text = sanitizeText(req.body?.text, 4000);
    const replyToId =
      typeof req.body?.replyToId === 'string' ? req.body.replyToId.slice(0, 64) : null;
    const replyToStory =
      req.body?.replyToStory && typeof req.body.replyToStory.storyId === 'string'
        ? {
            storyId: sanitizeText(req.body.replyToStory.storyId, 64),
            authorName: sanitizeText(req.body.replyToStory.authorName, 64),
            snippet: sanitizeText(req.body.replyToStory.snippet, 120),
          }
        : null;
    const forwardedFrom =
      req.body?.forwardedFrom && typeof req.body.forwardedFrom.senderName === 'string'
        ? {
            senderName: sanitizeText(req.body.forwardedFrom.senderName, 64),
            chatTitle: sanitizeText(req.body.forwardedFrom.chatTitle, 64) || undefined,
          }
        : null;

    let attachment: Attachment | null = null;
    if (req.body?.attachment && typeof req.body.attachment === 'object') {
      const rawAtt = req.body.attachment as Partial<Attachment>;
      if (
        typeof rawAtt.url === 'string' &&
        rawAtt.url.startsWith('/uploads/') &&
        (rawAtt.kind === 'image' ||
          rawAtt.kind === 'video' ||
          rawAtt.kind === 'audio' ||
          rawAtt.kind === 'file')
      ) {
        attachment = {
          id: sanitizeText(rawAtt.id, 64) || crypto.randomUUID(),
          kind: rawAtt.kind,
          url: rawAtt.url,
          name: sanitizeText(rawAtt.name, 120) || 'lampiran',
          mimeType: sanitizeText(rawAtt.mimeType, 64) || 'application/octet-stream',
          size: typeof rawAtt.size === 'number' ? Math.max(0, rawAtt.size) : 0,
          durationSec:
            typeof rawAtt.durationSec === 'number'
              ? Math.max(1, Math.min(600, Math.round(rawAtt.durationSec)))
              : undefined,
        };
      }
    }

    if (!text && !attachment) {
      res.status(400).json({ error: 'Pesan atau lampiran tidak boleh kosong.' });
      return;
    }

    const mentionMatches = text.match(/@([a-z0-9_]{3,24})/gi) || [];
    const mentions = Array.from(
      new Set(mentionMatches.map((m) => m.slice(1).toLowerCase()))
    );

    const now = Date.now();
    const scheduledFor =
      typeof req.body?.scheduledFor === 'number' && req.body.scheduledFor > now + 5000
        ? req.body.scheduledFor
        : null;

    const message: Message = {
      id: `msg_${crypto.randomBytes(6).toString('hex')}`,
      chatId: chat.id,
      senderId: userId,
      text,
      createdAt: scheduledFor || now,
      scheduledFor,
      replyToId,
      replyToStory,
      forwardedFrom,
      mentions: mentions.length > 0 ? mentions : undefined,
      attachment,
      reactions: [],
      readBy: [userId],
      views: chat.type === 'channel' ? 1 : undefined,
      expiresAt: chat.selfDestructSec > 0 ? (scheduledFor || now) + chat.selfDestructSec * 1000 : null,
    };

    if (scheduledFor) {
      store.scheduledMessages.push(message);
      saveStore(store);
      res.status(201).json({ message, scheduled: true });
      return;
    }

    if (!store.messages[chat.id]) store.messages[chat.id] = [];
    store.messages[chat.id].push(message);
    store.users[userId].lastReadByChat[chat.id] = now;
    saveStore(store);

    broadcastToChat(chat, { type: 'message:created', message });
    res.status(201).json({ message, scheduled: false });
  });

  // Edit Own Message
  app.patch('/api/messages/:messageId', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const chatId = sanitizeText(req.body?.chatId, 64);
    const text = sanitizeText(req.body?.text, 4000);
    if (!text) {
      res.status(400).json({ error: 'Teks pesan tidak boleh kosong.' });
      return;
    }
    const chat = store.chats[chatId];
    if (!chat || !chat.memberIds.includes(userId)) {
      res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
      return;
    }
    const list = store.messages[chatId] || [];
    const msg = list.find((m) => m.id === req.params.messageId);
    if (!msg) {
      res.status(404).json({ error: 'Pesan tidak ditemukan.' });
      return;
    }
    if (msg.senderId !== userId) {
      res.status(403).json({ error: 'Anda hanya dapat mengedit pesan sendiri.' });
      return;
    }
    msg.text = text;
    msg.editedAt = Date.now();
    saveStore(store);
    broadcastToChat(chat, { type: 'message:updated', message: msg });
    res.json({ message: msg });
  });

  // Delete Message
  app.delete('/api/chats/:chatId/messages/:messageId', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const chat = store.chats[req.params.chatId];
    if (!chat || !chat.memberIds.includes(userId)) {
      res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
      return;
    }
    const list = store.messages[chat.id] || [];
    const idx = list.findIndex((m) => m.id === req.params.messageId);
    if (idx === -1) {
      res.status(404).json({ error: 'Pesan tidak ditemukan.' });
      return;
    }
    const msg = list[idx];
    const isAdminOrMod =
      chat.adminIds.includes(userId) || (chat.moderatorIds || []).includes(userId);
    if (msg.senderId !== userId && !isAdminOrMod) {
      res.status(403).json({ error: 'Anda tidak memiliki izin menghapus pesan ini.' });
      return;
    }
    list.splice(idx, 1);
    if (chat.pinnedMessageId === msg.id) chat.pinnedMessageId = null;
    saveStore(store);
    broadcastToChat(chat, { type: 'message:deleted', chatId: chat.id, messageId: msg.id });
    res.json({ ok: true });
  });

  // Toggle Emoji Reaction
  app.post('/api/chats/:chatId/messages/:messageId/react', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const emoji = sanitizeText(req.body?.emoji, 12);
    if (!emoji) {
      res.status(400).json({ error: 'Emoji reaksi diperlukan.' });
      return;
    }
    const chat = store.chats[req.params.chatId];
    if (!chat || !chat.memberIds.includes(userId)) {
      res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
      return;
    }
    const msg = (store.messages[chat.id] || []).find((m) => m.id === req.params.messageId);
    if (!msg) {
      res.status(404).json({ error: 'Pesan tidak ditemukan.' });
      return;
    }
    const existing = msg.reactions.find((r) => r.emoji === emoji);
    if (existing) {
      if (existing.userIds.includes(userId)) {
        existing.userIds = existing.userIds.filter((id) => id !== userId);
      } else {
        existing.userIds.push(userId);
      }
      msg.reactions = msg.reactions.filter((r) => r.userIds.length > 0);
    } else {
      msg.reactions.push({ emoji, userIds: [userId] });
    }
    saveStore(store);
    broadcastToChat(chat, { type: 'message:updated', message: msg });
    res.json({ message: msg });
  });

  // Pin Message
  app.post('/api/chats/:chatId/pin-message', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const chat = store.chats[req.params.chatId];
    if (!chat || !chat.memberIds.includes(userId)) {
      res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
      return;
    }
    const messageId =
      typeof req.body?.messageId === 'string' ? req.body.messageId.slice(0, 64) : null;
    if (messageId && !(store.messages[chat.id] || []).some((m) => m.id === messageId)) {
      res.status(404).json({ error: 'Pesan tidak ditemukan.' });
      return;
    }
    chat.pinnedMessageId = messageId;
    saveStore(store);
    broadcastToChat(chat, {
      type: 'chat:updated',
      chatId: chat.id,
      patch: { pinnedMessageId: chat.pinnedMessageId },
    });
    res.json({ pinnedMessageId: chat.pinnedMessageId });
  });

  // Self-Destruct Timer
  app.post('/api/chats/:chatId/timer', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const chat = store.chats[req.params.chatId];
    if (!chat || !chat.memberIds.includes(userId)) {
      res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
      return;
    }
    const seconds = Number(req.body?.seconds);
    if (![0, 30, 300, 3600].includes(seconds)) {
      res.status(400).json({ error: 'Durasi timer tidak valid.' });
      return;
    }
    chat.selfDestructSec = seconds;
    saveStore(store);
    broadcastToChat(chat, {
      type: 'chat:updated',
      chatId: chat.id,
      patch: { selfDestructSec: seconds },
    });
    res.json({ selfDestructSec: seconds });
  });

  // Chat Preferences: Pin, Timed Mute, Archive, Mark Unread
  app.post('/api/chats/:chatId/preferences', requireAuth, (req: AuthedRequest, res) => {
    const user = store.users[req.userId!];
    const chat = store.chats[req.params.chatId];
    if (!chat || !chat.memberIds.includes(user.id)) {
      res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
      return;
    }

    if (typeof req.body?.pinned === 'boolean') {
      user.pinnedChatIds = req.body.pinned
        ? Array.from(new Set([...user.pinnedChatIds, chat.id]))
        : user.pinnedChatIds.filter((id) => id !== chat.id);
    }
    if (typeof req.body?.archived === 'boolean') {
      user.archivedChatIds = req.body.archived
        ? Array.from(new Set([...(user.archivedChatIds || []), chat.id]))
        : (user.archivedChatIds || []).filter((id) => id !== chat.id);
    }
    if (typeof req.body?.markedUnread === 'boolean') {
      user.markedUnreadChatIds = req.body.markedUnread
        ? Array.from(new Set([...(user.markedUnreadChatIds || []), chat.id]))
        : (user.markedUnreadChatIds || []).filter((id) => id !== chat.id);
    }
    if (req.body?.mutedUntil !== undefined) {
      user.mutedUntilByChat = user.mutedUntilByChat || {};
      if (req.body.mutedUntil === null || req.body.mutedUntil === 0) {
        delete user.mutedUntilByChat[chat.id];
      } else if (typeof req.body.mutedUntil === 'number') {
        user.mutedUntilByChat[chat.id] = req.body.mutedUntil;
      }
    }

    saveStore(store);
    const muteState = isChatMuted(user, chat.id);
    res.json({
      isPinnedByUser: user.pinnedChatIds.includes(chat.id),
      isArchivedByUser: (user.archivedChatIds || []).includes(chat.id),
      markedUnreadByUser: (user.markedUnreadChatIds || []).includes(chat.id),
      isMutedByUser: muteState.muted,
      mutedUntil: muteState.mutedUntil,
    });
  });

  // 24-Hour Stories Endpoints
  app.get('/api/stories', requireAuth, (req: AuthedRequest, res) => {
    res.json({ stories: getVisibleStoriesForUser(req.userId!) });
  });

  app.post('/api/stories', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const kind =
      req.body?.kind === 'image' || req.body?.kind === 'video' ? req.body.kind : 'text';
    const text = sanitizeText(req.body?.text, 300);
    const bgColor = sanitizeText(req.body?.bgColor, 16) || '#0284C7';
    const mediaUrl =
      typeof req.body?.mediaUrl === 'string' && req.body.mediaUrl.startsWith('/uploads/')
        ? req.body.mediaUrl
        : null;
    const privacy =
      req.body?.privacy === 'selected' || req.body?.privacy === 'except'
        ? req.body.privacy
        : 'everyone';
    const allowedUserIds = Array.isArray(req.body?.allowedUserIds)
      ? req.body.allowedUserIds.filter((id: unknown) => typeof id === 'string')
      : [];
    const excludedUserIds = Array.isArray(req.body?.excludedUserIds)
      ? req.body.excludedUserIds.filter((id: unknown) => typeof id === 'string')
      : [];

    if (!text && !mediaUrl) {
      res.status(400).json({ error: 'Isi status teks atau lampirkan media.' });
      return;
    }

    const now = Date.now();
    const expiryMs = store.settings.storyExpiryHours * 60 * 60 * 1000;
    const story: StoryItem = {
      id: `story_${crypto.randomBytes(6).toString('hex')}`,
      userId,
      kind,
      text,
      bgColor,
      mediaUrl,
      privacy,
      allowedUserIds,
      excludedUserIds,
      viewerIds: [userId],
      createdAt: now,
      expiresAt: now + expiryMs,
    };

    store.stories.unshift(story);
    saveStore(store);
    broadcastAll({ type: 'story:created', story });
    res.status(201).json({ story });
  });

  app.post('/api/stories/:storyId/view', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const story = store.stories.find((s) => s.id === req.params.storyId);
    if (!story) {
      res.status(404).json({ error: 'Status tidak ditemukan.' });
      return;
    }
    if (!story.viewerIds.includes(userId)) {
      story.viewerIds.push(userId);
      saveStore(store);
      sendWsToUser(story.userId, { type: 'story:updated', story });
    }
    res.json({ story });
  });

  app.delete('/api/stories/:storyId', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const idx = store.stories.findIndex((s) => s.id === req.params.storyId);
    if (idx === -1) {
      res.status(404).json({ error: 'Status tidak ditemukan.' });
      return;
    }
    const story = store.stories[idx];
    const user = store.users[userId];
    if (story.userId !== userId && !hasPermission(user.role, 'stories:write')) {
      res.status(403).json({ error: 'Anda tidak memiliki izin menghapus status ini.' });
      return;
    }
    store.stories.splice(idx, 1);
    saveStore(store);
    broadcastAll({ type: 'story:deleted', storyId: story.id });
    res.json({ ok: true });
  });

  app.post('/api/stories/mute/:authorId', requireAuth, (req: AuthedRequest, res) => {
    const user = store.users[req.userId!];
    const authorId = req.params.authorId;
    const mute = Boolean(req.body?.mute);
    user.mutedStoryUserIds = mute
      ? Array.from(new Set([...(user.mutedStoryUserIds || []), authorId]))
      : (user.mutedStoryUserIds || []).filter((id) => id !== authorId);
    saveStore(store);
    res.json({ mutedStoryUserIds: user.mutedStoryUserIds });
  });

  // Voice & Video Call History
  app.get('/api/calls', requireAuth, (req: AuthedRequest, res) => {
    const list = store.calls
      .filter((c) => c.callerId === req.userId || c.calleeId === req.userId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 50);
    res.json({ calls: list });
  });

  app.post('/api/calls', requireAuth, (req: AuthedRequest, res) => {
    const callerId = req.userId!;
    const calleeId = sanitizeText(req.body?.calleeId, 64);
    const kind = req.body?.kind === 'video' ? 'video' : 'voice';
    if (!store.users[calleeId] || calleeId === callerId) {
      res.status(400).json({ error: 'Penerima panggilan tidak valid.' });
      return;
    }
    const call: CallRecord = {
      id: `call_${crypto.randomBytes(6).toString('hex')}`,
      callerId,
      calleeId,
      kind,
      status: 'ringing',
      startedAt: Date.now(),
      durationSec: 0,
    };
    store.calls.unshift(call);
    saveStore(store);
    res.status(201).json({ call });
  });

  app.patch('/api/calls/:callId', requireAuth, (req: AuthedRequest, res) => {
    const call = store.calls.find((c) => c.id === req.params.callId);
    if (!call || (call.callerId !== req.userId && call.calleeId !== req.userId)) {
      res.status(404).json({ error: 'Riwayat panggilan tidak ditemukan.' });
      return;
    }
    if (['active', 'completed', 'missed', 'rejected'].includes(req.body?.status)) {
      call.status = req.body.status;
    }
    if (typeof req.body?.durationSec === 'number') {
      call.durationSec = Math.max(0, Math.round(req.body.durationSec));
      call.endedAt = Date.now();
    }
    saveStore(store);
    res.json({ call });
  });

  // User Report & Appeal Endpoints
  app.post('/api/reports', requireAuth, (req: AuthedRequest, res) => {
    const targetType = req.body?.targetType;
    const category = req.body?.category;
    if (!['user', 'message', 'group', 'story'].includes(targetType)) {
      res.status(400).json({ error: 'Tipe target laporan tidak valid.' });
      return;
    }
    if (!['spam', 'scam', 'harassment', 'illegal'].includes(category)) {
      res.status(400).json({ error: 'Kategori laporan tidak valid.' });
      return;
    }
    const targetId = sanitizeText(req.body?.targetId, 64);
    const targetChatId = sanitizeText(req.body?.targetChatId, 64) || undefined;
    const targetLabel = sanitizeText(req.body?.targetLabel, 120) || targetId;
    const reason = sanitizeText(req.body?.reason, 400);
    if (!targetId || reason.length < 4) {
      res.status(400).json({ error: 'Jelaskan alasan laporan minimal 4 karakter.' });
      return;
    }

    const now = Date.now();
    const report: ModerationReport = {
      id: `rep_${crypto.randomBytes(5).toString('hex')}`,
      reporterId: req.userId!,
      targetType,
      targetId,
      targetChatId,
      targetLabel,
      category,
      reason,
      status: 'open',
      moderatorNote: '',
      createdAt: now,
      updatedAt: now,
    };
    store.reports.unshift(report);
    saveStore(store);
    res.status(201).json({ report });
  });

  // Safe Media & Document Upload Endpoint
  app.post('/api/upload', requireAuth, (req: AuthedRequest, res) => {
    const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
    const originalName = sanitizeText(req.body?.name, 100) || 'lampiran';
    const durationSec =
      typeof req.body?.durationSec === 'number' ? req.body.durationSec : undefined;

    const match = /^data:([a-z0-9/+.-]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
    if (!match) {
      res.status(400).json({ error: 'Format file tidak valid.' });
      return;
    }

    const mimeType = match[1].toLowerCase();
    const mimeMeta = ALLOWED_MIME_EXT[mimeType];
    if (!mimeMeta) {
      res.status(400).json({
        error: 'Tipe file tidak didukung. Gunakan foto, video MP4/WebM, audio, PDF, TXT, CSV, JSON, atau ZIP.',
      });
      return;
    }

    const maxBytes = store.settings.maxUploadMb * 1024 * 1024;
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0 || buffer.length > maxBytes) {
      res.status(413).json({
        error: `Ukuran file melebihi batas server (${store.settings.maxUploadMb} MB).`,
      });
      return;
    }

    const fileId = crypto.randomUUID();
    const filename = `${fileId}.${mimeMeta.ext}`;
    const resolvedPath = path.resolve(UPLOADS_DIR, filename);
    if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(400).json({ error: 'Path file tidak valid.' });
      return;
    }

    fs.writeFileSync(resolvedPath, buffer);
    const attachment: Attachment = {
      id: fileId,
      kind: mimeMeta.kind,
      url: `/uploads/${filename}`,
      name: originalName,
      mimeType,
      size: buffer.length,
      durationSec: mimeMeta.kind === 'audio' ? durationSec : undefined,
    };

    res.status(201).json({ attachment });
  });

  // Confined Static File Serving
  app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    if (!/^[a-f0-9-]+\.(jpg|png|webp|gif|mp4|webm|ogg|m4a|mp3|pdf|txt|csv|json|zip)$/i.test(filename)) {
      res.status(400).send('Invalid file name');
      return;
    }
    const resolvedPath = path.resolve(UPLOADS_DIR, filename);
    if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(resolvedPath)) {
      res.status(404).send('Not found');
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', 'sandbox');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(resolvedPath);
  });

  // Server-Side Optional Gemini AI: Translate Message
  app.post('/api/ai/translate', requireAuth, async (req: AuthedRequest, res) => {
    const text = sanitizeText(req.body?.text, 2000);
    const targetLang = req.body?.targetLang === 'en' ? 'English' : 'Indonesian';
    if (!text) {
      res.status(400).json({ error: 'Teks untuk diterjemahkan kosong.' });
      return;
    }
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY belum dikonfigurasi di Settings > Secrets server.',
      });
      return;
    }
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Terjemahkan teks percakapan berikut secara natural ke bahasa ${targetLang}. Balas hanya dengan hasil terjemahan tanpa penjelasan tambahan:\n\n${text}`,
      });
      res.json({ translation: (response.text || '').trim() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menerjemahkan pesan.';
      res.status(502).json({ error: message });
    }
  });

  // Server-Side Optional Gemini AI: Summarize Conversation
  app.post('/api/ai/summarize', requireAuth, async (req: AuthedRequest, res) => {
    const chatId = sanitizeText(req.body?.chatId, 64);
    const lang = req.body?.lang === 'en' ? 'English' : 'Indonesian';
    const chat = store.chats[chatId];
    if (!chat || !chat.memberIds.includes(req.userId!)) {
      res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
      return;
    }
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY belum dikonfigurasi di Settings > Secrets server.',
      });
      return;
    }
    const recent = filterActiveMessages(chatId)
      .filter((m) => !m.systemEvent && m.text)
      .slice(-30)
      .map((m) => `${store.users[m.senderId]?.displayName || 'User'}: ${m.text}`)
      .join('\n');

    if (!recent) {
      res.status(400).json({ error: 'Belum cukup pesan teks untuk diringkas.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Ringkas diskusi berikut dalam 3-5 poin singkat dan jelas menggunakan bahasa ${lang}:\n\n${recent}`,
      });
      res.json({ summary: (response.text || '').trim() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal meringkas percakapan.';
      res.status(502).json({ error: message });
    }
  });

  // =========================================================================
  // ADMIN PANEL ROUTES (Server-Verified Auth + Least-Privilege RBAC)
  // =========================================================================

  // First-Run Admin Claim (only allowed if env ADMIN_PASSCODE is unset and not yet claimed)
  app.post('/api/admin/claim', requireAuth, (req: AuthedRequest, res) => {
    const envCode = process.env.ADMIN_PASSCODE || '';
    if (envCode.length >= 6) {
      res.status(403).json({ error: 'ADMIN_PASSCODE sudah dikonfigurasi di server.' });
      return;
    }
    if (store.adminPasscodeHash) {
      res.status(409).json({ error: 'Kunci Admin sudah pernah diklaim. Gunakan form masuk admin.' });
      return;
    }
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    if (passcode.length < 8 || passcode.length > 128) {
      res.status(400).json({ error: 'Kode sandi admin minimal 8 karakter.' });
      return;
    }
    const { hash, salt } = hashSecret(passcode);
    store.adminPasscodeHash = hash;
    store.adminPasscodeSalt = salt;

    const user = store.users[req.userId!];
    user.role = 'super_admin';
    appendAudit(user, 'admin:claimed', user.username, 'Klaim awal Super Admin Tolk by Lunola.');
    saveStore(store);

    res.json({ user: toPublicUser(user, true) });
  });

  // Unlock Admin Panel with Passcode (Env ADMIN_PASSCODE overrides claimed hash)
  app.post('/api/admin/unlock', requireAuth, (req: AuthedRequest, res) => {
    if (!checkRateLimit(`admin-unlock:${req.userId}`, 8)) {
      res.status(429).json({ error: 'Terlalu banyak percobaan kunci admin. Tunggu 1 menit.' });
      return;
    }
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    const envCode = process.env.ADMIN_PASSCODE || '';
    let valid = false;

    if (envCode.length >= 6) {
      const a = Buffer.from(passcode);
      const b = Buffer.from(envCode);
      valid = a.length === b.length && crypto.timingSafeEqual(a, b);
    } else if (store.adminPasscodeHash && store.adminPasscodeSalt) {
      valid = verifySecret(passcode, store.adminPasscodeHash, store.adminPasscodeSalt);
    }

    if (!valid) {
      res.status(401).json({ error: 'Kode sandi admin tidak valid.' });
      return;
    }

    const user = store.users[req.userId!];
    const requestedRole = req.body?.role as AdminRole | undefined;
    const allowedRoles: AdminRole[] = [
      'super_admin',
      'administrator',
      'moderator',
      'support',
      'server_operator',
      'audit_viewer',
    ];
    user.role = requestedRole && allowedRoles.includes(requestedRole) ? requestedRole : 'super_admin';
    appendAudit(user, 'admin:login', user.username, `Akses Admin Panel sebagai ${user.role}.`);
    saveStore(store);

    res.json({ user: toPublicUser(user, true) });
  });

  // 1. Admin Dashboard Overview + 7. Server Telemetry + 8. Analytics
  app.get('/api/admin/overview', requireAuth, requireAdminPermission('dashboard'), (_req, res) => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const allUsers = Object.values(store.users);
    const allChats = Object.values(store.chats);
    const allMessages = Object.values(store.messages).flat();

    const dau = allUsers.filter((u) => u.lastSeen >= dayAgo || (activeSockets.get(u.id)?.size || 0) > 0).length;
    const mau = allUsers.filter((u) => u.lastSeen >= monthAgo).length;
    const newUsersToday = allUsers.filter((u) => (u.createdAt || 0) >= dayAgo).length;
    const activeStories = store.stories.filter((s) => s.expiresAt > now).length;
    const openReports = store.reports.filter((r) => r.status !== 'resolved').length;

    // 6-bucket real activity series over last 24h
    const trafficSeries: AdminOverviewPayload['trafficSeries'] = [];
    const bucketMs = 4 * 60 * 60 * 1000;
    for (let i = 5; i >= 0; i -= 1) {
      const start = now - (i + 1) * bucketMs;
      const end = now - i * bucketMs;
      const msgsInBucket = allMessages.filter((m) => m.createdAt >= start && m.createdAt < end);
      const uniqueSenders = new Set(msgsInBucket.map((m) => m.senderId)).size;
      const d = new Date(end);
      trafficSeries.push({
        label: `${String(d.getHours()).padStart(2, '0')}:00`,
        messages: msgsInBucket.length,
        activeUsers: uniqueSenders,
      });
    }

    const mem = process.memoryUsage();
    const storage = computeStorageStats();
    let wsCount = 0;
    for (const s of activeSockets.values()) wsCount += s.size;

    const payload: AdminOverviewPayload = {
      metrics: {
        totalUsers: allUsers.length,
        dau,
        mau,
        newUsersToday,
        totalMessages: allMessages.length,
        totalGroups: allChats.filter((c) => c.type === 'group').length,
        totalChannels: allChats.filter((c) => c.type === 'channel').length,
        activeStories,
        totalCalls: store.calls.length,
        openReports,
        onlineNow: getOnlineUserIds().length,
      },
      trafficSeries,
      server: {
        runtime: process.env.WASMER_RUNTIME || `Node.js ${process.version}`,
        tinodeMode: process.env.TINODE_HOST
          ? `Tinode Proxy (${process.env.TINODE_HOST})`
          : 'Embedded WebSocket + Tinode Docker Ready',
        uptimeSec: Math.floor((now - SERVER_START_MS) / 1000),
        cpuCores: os.cpus().length,
        loadAvg1m: Number((os.loadavg()[0] || 0).toFixed(2)),
        memoryRssMb: Number((mem.rss / (1024 * 1024)).toFixed(1)),
        memoryHeapMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(1)),
        mediaFilesCount: storage.filesCount,
        mediaStorageMb: storage.mediaMb,
        storeSizeKb: storage.storeKb,
        wsConnections: wsCount,
        rateLimitBlocked: totalRateLimitBlocked,
        turnStunStatus: 'WebRTC STUN Ready (stun.l.google.com:19302)',
        tlsStatus: process.env.APP_URL?.startsWith('https://') ? 'HTTPS/TLS Aktif' : 'Reverse Proxy / Caddy TLS Ready',
        lastBackupAt: store.lastBackupAt,
      },
      settings: store.settings,
    };

    res.json(payload);
  });

  // 2. Admin Users & Roles Management
  app.get('/api/admin/users', requireAuth, requireAdminPermission('users:read'), (req, res) => {
    const q = sanitizeText(req.query.q, 64).toLowerCase();
    const list = Object.values(store.users)
      .filter((u) => {
        if (!q) return true;
        return (
          u.username.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q)
        );
      })
      .map((u) => ({
        ...toPublicUser(u, true),
        activeSessionsCount: Object.values(store.sessions).filter((s) => s.userId === u.id).length,
      }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    res.json({ users: list });
  });

  app.patch('/api/admin/users/:targetId', requireAuth, requireAdminPermission('users:write'), (req: AuthedRequest, res) => {
    const actor = store.users[req.userId!];
    const target = store.users[req.params.targetId];
    if (!target) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }

    const changes: string[] = [];
    if (
      typeof req.body?.status === 'string' &&
      ['active', 'suspended', 'banned_temp', 'banned_perm'].includes(req.body.status)
    ) {
      target.status = req.body.status as UserAccountStatus;
      changes.push(`status=${target.status}`);
      if (target.status !== 'active') {
        for (const ses of Object.values(store.sessions)) {
          if (ses.userId === target.id) {
            delete store.sessions[ses.id];
            revokeSessionSockets(ses.id);
          }
        }
      }
    }

    if (typeof req.body?.verified === 'boolean') {
      target.verified = req.body.verified;
      changes.push(`verified=${target.verified}`);
    }

    if (typeof req.body?.role === 'string') {
      if (!hasPermission(actor.role, 'roles:write')) {
        res.status(403).json({ error: 'Hanya Super Admin yang dapat mengubah role pengguna.' });
        return;
      }
      const allowed: AdminRole[] = [
        'super_admin',
        'administrator',
        'moderator',
        'support',
        'server_operator',
        'audit_viewer',
        'user',
      ];
      if (allowed.includes(req.body.role as AdminRole)) {
        target.role = req.body.role as AdminRole;
        changes.push(`role=${target.role}`);
      }
    }

    if (req.body?.revokeAllSessions === true) {
      let revoked = 0;
      for (const ses of Object.values(store.sessions)) {
        if (ses.userId === target.id) {
          delete store.sessions[ses.id];
          revokeSessionSockets(ses.id);
          revoked += 1;
        }
      }
      changes.push(`revokedSessions=${revoked}`);
    }

    if (changes.length > 0) {
      appendAudit(actor, 'user:moderated', `@${target.username}`, changes.join(', '));
      saveStore(store);
      broadcastAll({ type: 'user:updated', user: toPublicUser(target) });
    }

    res.json({ user: toPublicUser(target, true) });
  });

  app.delete('/api/admin/users/:targetId', requireAuth, requireAdminPermission('users:write'), (req: AuthedRequest, res) => {
    const actor = store.users[req.userId!];
    const target = store.users[req.params.targetId];
    if (!target) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }
    if (target.id === actor.id) {
      res.status(400).json({ error: 'Tidak dapat menghapus akun Anda sendiri.' });
      return;
    }
    if (target.id === 'usr_pujo' || (target.role === 'super_admin' && actor.role !== 'super_admin')) {
      res.status(403).json({ error: 'Pengguna Super Admin tidak dapat dihapus.' });
      return;
    }

    for (const ses of Object.values(store.sessions)) {
      if (ses.userId === target.id) {
        delete store.sessions[ses.id];
        revokeSessionSockets(ses.id);
      }
    }

    store.stories = store.stories.filter((s) => s.userId !== target.id);
    for (const [chatId, chat] of Object.entries(store.chats)) {
      chat.memberIds = chat.memberIds.filter((id) => id !== target.id);
      chat.adminIds = chat.adminIds.filter((id) => id !== target.id);
      chat.moderatorIds = chat.moderatorIds.filter((id) => id !== target.id);
      if ((chat.type === 'saved' || chat.type === 'dm') && chat.memberIds.length <= 1) {
        delete store.chats[chatId];
        delete store.messages[chatId];
      }
    }

    delete store.users[target.id];
    appendAudit(actor, 'user:deleted', `@${target.username}`, 'Akun pengguna dihapus permanen oleh admin.');
    saveStore(store);
    broadcastAll({ type: 'user:deleted', userId: target.id });
    res.json({ ok: true, deletedUserId: target.id });
  });

  // Export User Data (GDPR / Privacy Policy Export — excludes password hashes)
  app.get('/api/admin/users/:targetId/export', requireAuth, requireAdminPermission('users:read'), (req: AuthedRequest, res) => {
    const actor = store.users[req.userId!];
    const target = store.users[req.params.targetId];
    if (!target) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }
    const profile = toPublicUser(target, true);
    const chatsCount = Object.values(store.chats).filter((c) => c.memberIds.includes(target.id)).length;
    const storiesCount = store.stories.filter((s) => s.userId === target.id).length;
    const callsCount = store.calls.filter((c) => c.callerId === target.id || c.calleeId === target.id).length;

    appendAudit(actor, 'user:exported_data', `@${target.username}`, 'Ekspor metadata akun sesuai kebijakan privasi.');
    saveStore(store);

    res.json({
      exportedAt: new Date().toISOString(),
      privacyNotice: 'Konten pesan pribadi tidak diekspor secara otomatis untuk menjaga privasi pengguna.',
      profile,
      summary: { chatsCount, storiesCount, callsCount },
    });
  });

  // 3. Moderation & Reports Queue
  app.get('/api/admin/reports', requireAuth, requireAdminPermission('reports:read'), (_req, res) => {
    res.json({ reports: store.reports });
  });

  app.patch('/api/admin/reports/:reportId', requireAuth, requireAdminPermission('reports:write'), (req: AuthedRequest, res) => {
    const actor = store.users[req.userId!];
    const report = store.reports.find((r) => r.id === req.params.reportId);
    if (!report) {
      res.status(404).json({ error: 'Laporan tidak ditemukan.' });
      return;
    }

    if (['open', 'reviewing', 'resolved'].includes(req.body?.status)) {
      report.status = req.body.status;
    }
    if (typeof req.body?.moderatorNote === 'string') {
      report.moderatorNote = sanitizeText(req.body.moderatorNote, 400);
    }
    if (typeof req.body?.resolution === 'string') {
      report.resolution = sanitizeText(req.body.resolution, 200);
    }

    // Optional enforcement action
    if (req.body?.removeContent === true) {
      if (report.targetType === 'story') {
        store.stories = store.stories.filter((s) => s.id !== report.targetId);
        broadcastAll({ type: 'story:deleted', storyId: report.targetId });
      } else if (report.targetType === 'message' && report.targetChatId) {
        const list = store.messages[report.targetChatId] || [];
        store.messages[report.targetChatId] = list.filter((m) => m.id !== report.targetId);
        const chat = store.chats[report.targetChatId];
        if (chat) {
          broadcastToChat(chat, {
            type: 'message:deleted',
            chatId: chat.id,
            messageId: report.targetId,
          });
        }
      } else if (report.targetType === 'group' && store.chats[report.targetId]) {
        store.chats[report.targetId].suspended = true;
      }
      report.status = 'resolved';
      report.resolution = 'Konten/grup ditindak dan dihapus';
    }

    report.updatedAt = Date.now();
    appendAudit(
      actor,
      'report:updated',
      report.id,
      `status=${report.status}${report.resolution ? `, resolution=${report.resolution}` : ''}`
    );
    saveStore(store);
    res.json({ report });
  });

  // 4. Groups & Channels Admin Management
  app.get('/api/admin/groups', requireAuth, requireAdminPermission('groups:read'), (_req, res) => {
    const list = Object.values(store.chats)
      .filter((c) => c.type === 'group' || c.type === 'channel')
      .map((c) => ({
        ...c,
        messageCount: (store.messages[c.id] || []).length,
        reportCount: store.reports.filter((r) => r.targetId === c.id).length,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
    res.json({ groups: list });
  });

  app.patch('/api/admin/groups/:chatId', requireAuth, requireAdminPermission('groups:write'), (req: AuthedRequest, res) => {
    const actor = store.users[req.userId!];
    const chat = store.chats[req.params.chatId];
    if (!chat) {
      res.status(404).json({ error: 'Grup/channel tidak ditemukan.' });
      return;
    }
    if (typeof req.body?.suspended === 'boolean') chat.suspended = req.body.suspended;
    if (typeof req.body?.adminOnlyPost === 'boolean') chat.adminOnlyPost = req.body.adminOnlyPost;
    if (typeof req.body?.inviteMaxUses === 'number') {
      chat.inviteMaxUses = Math.max(1, Math.min(10000, Math.round(req.body.inviteMaxUses)));
    }
    appendAudit(actor, 'group:updated', chat.title, `suspended=${Boolean(chat.suspended)}`);
    saveStore(store);
    broadcastToChat(chat, {
      type: 'chat:updated',
      chatId: chat.id,
      patch: { suspended: chat.suspended, adminOnlyPost: chat.adminOnlyPost },
    });
    res.json({ group: chat });
  });

  // 5. Stories Moderation
  app.get('/api/admin/stories', requireAuth, requireAdminPermission('stories:read'), (_req, res) => {
    res.json({ stories: store.stories });
  });

  app.delete('/api/admin/stories/:storyId', requireAuth, requireAdminPermission('stories:write'), (req: AuthedRequest, res) => {
    const actor = store.users[req.userId!];
    const before = store.stories.length;
    store.stories = store.stories.filter((s) => s.id !== req.params.storyId);
    if (store.stories.length === before) {
      res.status(404).json({ error: 'Status tidak ditemukan.' });
      return;
    }
    appendAudit(actor, 'story:deleted', req.params.storyId, 'Status dihapus oleh moderator/admin.');
    saveStore(store);
    broadcastAll({ type: 'story:deleted', storyId: req.params.storyId });
    res.json({ ok: true });
  });

  // 6. Official Broadcast Announcements
  app.post('/api/admin/announcements', requireAuth, requireAdminPermission('announcements:write'), (req: AuthedRequest, res) => {
    const actor = store.users[req.userId!];
    const text = sanitizeText(req.body?.text, 2000);
    const pinGlobalBanner = Boolean(req.body?.pinGlobalBanner);
    if (!text) {
      res.status(400).json({ error: 'Isi pengumuman tidak boleh kosong.' });
      return;
    }

    if (pinGlobalBanner) {
      store.settings.globalAnnouncement = text.slice(0, 220);
    }

    const officialChannel = store.chats['chat_lunolatalk_news'];
    if (officialChannel) {
      const msg: Message = {
        id: `msg_ann_${crypto.randomBytes(5).toString('hex')}`,
        chatId: officialChannel.id,
        senderId: actor.id,
        text,
        createdAt: Date.now(),
        reactions: [],
        readBy: [actor.id],
        views: 1,
      };
      store.messages[officialChannel.id] = store.messages[officialChannel.id] || [];
      store.messages[officialChannel.id].push(msg);
      broadcastToChat(officialChannel, { type: 'message:created', message: msg });
    }

    appendAudit(actor, 'announcement:sent', 'Global Broadcast', text.slice(0, 100));
    saveStore(store);
    broadcastAll({ type: 'settings:updated', settings: store.settings });
    res.status(201).json({ ok: true, settings: store.settings });
  });

  // 7. Backup Export & Verification
  app.get('/api/admin/backup', requireAuth, requireAdminPermission('server:write'), (req: AuthedRequest, res) => {
    const actor = store.users[req.userId!];
    store.lastBackupAt = Date.now();
    appendAudit(actor, 'server:backup_exported', 'store.json', 'Backup database tanpa kredensial rahasia.');
    saveStore(store);

    // Strip password hashes & admin passcode hashes from exported backup
    const safeUsers: Record<string, UserProfile> = {};
    for (const [id, u] of Object.entries(store.users)) {
      safeUsers[id] = toPublicUser(u, true);
    }
    res.json({
      exportedAt: new Date().toISOString(),
      service: 'lunola-talk',
      counts: {
        users: Object.keys(safeUsers).length,
        chats: Object.keys(store.chats).length,
        stories: store.stories.length,
        reports: store.reports.length,
      },
      settings: store.settings,
      users: safeUsers,
      chats: store.chats,
    });
  });

  // 9. Platform Settings
  app.patch('/api/admin/settings', requireAuth, requireAdminPermission('settings:write'), (req: AuthedRequest, res) => {
    const actor = store.users[req.userId!];
    const s = store.settings;
    if (typeof req.body?.appName === 'string' && req.body.appName.trim().length >= 2) {
      s.appName = sanitizeText(req.body.appName, 40);
    }
    if (typeof req.body?.allowRegistration === 'boolean') {
      s.allowRegistration = req.body.allowRegistration;
    }
    if (typeof req.body?.maxUploadMb === 'number') {
      s.maxUploadMb = Math.max(1, Math.min(50, Math.round(req.body.maxUploadMb)));
    }
    if (typeof req.body?.storyExpiryHours === 'number') {
      s.storyExpiryHours = Math.max(1, Math.min(72, Math.round(req.body.storyExpiryHours)));
    }
    if (typeof req.body?.maxGroupMembers === 'number') {
      s.maxGroupMembers = Math.max(10, Math.min(5000, Math.round(req.body.maxGroupMembers)));
    }
    if (typeof req.body?.rateLimitPerMin === 'number') {
      s.rateLimitPerMin = Math.max(20, Math.min(1000, Math.round(req.body.rateLimitPerMin)));
    }
    if (typeof req.body?.maintenanceMode === 'boolean') {
      s.maintenanceMode = req.body.maintenanceMode;
    }
    if (typeof req.body?.globalAnnouncement === 'string') {
      s.globalAnnouncement = sanitizeText(req.body.globalAnnouncement, 220);
    }
    if (typeof req.body?.pushEnabled === 'boolean') {
      s.pushEnabled = req.body.pushEnabled;
    }

    appendAudit(actor, 'settings:updated', 'PlatformSettings', JSON.stringify({
      appName: s.appName,
      maxUploadMb: s.maxUploadMb,
      rateLimitPerMin: s.rateLimitPerMin,
      maintenanceMode: s.maintenanceMode,
    }));
    saveStore(store);
    broadcastAll({ type: 'settings:updated', settings: s });
    res.json({ settings: s });
  });

  // 10. Audit Logs
  app.get('/api/admin/audit-logs', requireAuth, requireAdminPermission('audit:read'), (_req, res) => {
    res.json({ logs: store.auditLogs.slice(0, 150) });
  });

  // Mount Vite Dev Middleware or Static Production Build
  const httpServer = http.createServer(app);

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (reqUrl.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
        return;
      }
    } catch {
      // Ignore malformed URL on non-app upgrade
    }
    if (IS_PROD) {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    let authedUserId: string | null = null;
    let authedSessionId: string | null = null;

    ws.on('message', (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString()) as {
          type?: string;
          token?: string;
          chatId?: string;
          isTyping?: boolean;
          targetUserId?: string;
          callId?: string;
          kind?: 'voice' | 'video';
          sdp?: unknown;
          candidate?: unknown;
        };

        if (msg.type === 'auth') {
          const verified = verifyToken(msg.token || '');
          if (!verified || !store.users[verified.uid] || !store.sessions[verified.sid]) {
            ws.send(JSON.stringify({ type: 'auth:error', error: 'Unauthorized' }));
            ws.close(4001, 'Unauthorized');
            return;
          }
          authedUserId = verified.uid;
          authedSessionId = verified.sid;
          if (!activeSockets.has(authedUserId)) activeSockets.set(authedUserId, new Set());
          activeSockets.get(authedUserId)!.add(ws);
          if (!socketsBySession.has(authedSessionId)) {
            socketsBySession.set(authedSessionId, new Set());
          }
          socketsBySession.get(authedSessionId)!.add(ws);

          store.users[authedUserId].lastSeen = Date.now();
          ws.send(
            JSON.stringify({
              type: 'auth:ok',
              userId: authedUserId,
              onlineUserIds: getOnlineUserIds(),
            })
          );
          broadcastPresence(authedUserId, true);
          return;
        }

        if (!authedUserId) return;

        if (msg.type === 'typing' && typeof msg.chatId === 'string') {
          const chat = store.chats[msg.chatId];
          if (chat && chat.memberIds.includes(authedUserId)) {
            broadcastToChat(
              chat,
              {
                type: 'typing:update',
                chatId: chat.id,
                userId: authedUserId,
                isTyping: Boolean(msg.isTyping),
              },
              authedUserId
            );
          }
          return;
        }

        // WebRTC Voice & Video Call Signaling Relay
        if (
          msg.type &&
          ['call:invite', 'call:offer', 'call:answer', 'call:ice', 'call:reject', 'call:end'].includes(
            msg.type
          ) &&
          typeof msg.targetUserId === 'string'
        ) {
          sendWsToUser(msg.targetUserId, {
            type: msg.type,
            fromUserId: authedUserId,
            callId: msg.callId,
            kind: msg.kind,
            sdp: msg.sdp,
            candidate: msg.candidate,
          });
          return;
        }

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      if (authedSessionId) {
        const sSet = socketsBySession.get(authedSessionId);
        if (sSet) {
          sSet.delete(ws);
          if (sSet.size === 0) socketsBySession.delete(authedSessionId);
        }
      }
      if (!authedUserId) return;
      const set = activeSockets.get(authedUserId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          activeSockets.delete(authedUserId);
          if (store.users[authedUserId]) {
            store.users[authedUserId].lastSeen = Date.now();
            saveStore(store);
          }
          broadcastPresence(authedUserId, false);
        }
      }
    });
  });

  // Periodic background scheduler for: (1) self-destructing messages, (2) scheduled messages, (3) 24h expired stories
  setInterval(() => {
    const now = Date.now();
    let changed = false;

    // 1. Self-destructing messages
    for (const [chatId, list] of Object.entries(store.messages)) {
      const expired = list.filter((m) => m.expiresAt && m.expiresAt <= now);
      if (expired.length > 0) {
        store.messages[chatId] = list.filter((m) => !m.expiresAt || m.expiresAt > now);
        changed = true;
        const chat = store.chats[chatId];
        if (chat) {
          for (const exp of expired) {
            if (chat.pinnedMessageId === exp.id) chat.pinnedMessageId = null;
            broadcastToChat(chat, { type: 'message:deleted', chatId, messageId: exp.id });
          }
        }
      }
    }

    // 2. Deliver due scheduled messages
    if (store.scheduledMessages.length > 0) {
      const due = store.scheduledMessages.filter((m) => (m.scheduledFor || 0) <= now);
      if (due.length > 0) {
        store.scheduledMessages = store.scheduledMessages.filter(
          (m) => (m.scheduledFor || 0) > now
        );
        for (const msg of due) {
          msg.scheduledFor = null;
          msg.createdAt = now;
          const chat = store.chats[msg.chatId];
          if (chat) {
            store.messages[chat.id] = store.messages[chat.id] || [];
            store.messages[chat.id].push(msg);
            broadcastToChat(chat, { type: 'message:created', message: msg });
          }
        }
        changed = true;
      }
    }

    // 3. Expire 24h stories
    const expiredStories = store.stories.filter((s) => s.expiresAt <= now);
    if (expiredStories.length > 0) {
      store.stories = store.stories.filter((s) => s.expiresAt > now);
      for (const s of expiredStories) {
        broadcastAll({ type: 'story:deleted', storyId: s.id });
      }
      changed = true;
    }

    if (changed) saveStore(store);
  }, 10000);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Tolk by Lunola server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Tolk by Lunola server:', err);
  process.exit(1);
});
