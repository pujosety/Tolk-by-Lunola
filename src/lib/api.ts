import type {
  AdminOverviewPayload,
  AdminRole,
  Attachment,
  AuditLogEntry,
  BootstrapPayload,
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
} from '../types/chat';

export type ServerWsEvent =
  | { type: 'auth:ok'; userId: string; onlineUserIds: string[] }
  | { type: 'auth:error'; error: string }
  | { type: 'session:revoked' }
  | { type: 'presence:update'; userId: string; online: boolean; lastSeen: number }
  | { type: 'typing:update'; chatId: string; userId: string; isTyping: boolean }
  | { type: 'message:created'; message: Message }
  | { type: 'message:updated'; message: Message }
  | { type: 'message:deleted'; chatId: string; messageId: string }
  | { type: 'chat:created'; chat: ChatRoom }
  | { type: 'chat:updated'; chatId: string; patch: Partial<ChatRoom> }
  | { type: 'chat:read'; chatId: string; userId: string; readAt: number }
  | { type: 'user:updated'; user: UserProfile }
  | { type: 'story:created'; story: StoryItem }
  | { type: 'story:updated'; story: StoryItem }
  | { type: 'story:deleted'; storyId: string }
  | { type: 'settings:updated'; settings: PlatformSettings }
  | {
      type: 'call:invite' | 'call:offer' | 'call:answer' | 'call:ice' | 'call:reject' | 'call:end';
      fromUserId: string;
      callId: string;
      kind?: 'voice' | 'video';
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    }
  | { type: 'pong'; ts: number };

async function requestJson<T>(
  path: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || `Permintaan gagal (${res.status})`);
  }
  return data;
}

export const api = {
  createGuestSession: () =>
    requestJson<{ token: string; user: UserProfile }>('/api/auth/guest', { method: 'POST' }),

  register: (payload: {
    username: string;
    displayName: string;
    email?: string;
    password: string;
    bio?: string;
  }) =>
    requestJson<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: payload,
    }),

  login: (payload: { username: string; password: string }) =>
    requestJson<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: payload,
    }),

  logout: (token: string) =>
    requestJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST', token }),

  getSessions: (token: string) =>
    requestJson<{ sessions: DeviceSession[] }>('/api/sessions', { token }),

  revokeSession: (token: string, sid: string) =>
    requestJson<{ ok: boolean }>(`/api/sessions/${encodeURIComponent(sid)}`, {
      method: 'DELETE',
      token,
    }),

  bootstrap: (token: string) => requestJson<BootstrapPayload>('/api/bootstrap', { token }),

  updateProfile: (
    token: string,
    payload: {
      displayName: string;
      username: string;
      bio: string;
      statusText?: string;
      email?: string;
      avatarUrl?: string | null;
      avatarColor?: string;
    }
  ) =>
    requestJson<{ user: UserProfile }>('/api/profile', {
      method: 'PATCH',
      token,
      body: payload,
    }),

  updatePrivacy: (token: string, payload: Partial<UserPrivacySettings>) =>
    requestJson<{ user: UserProfile }>('/api/privacy', {
      method: 'PATCH',
      token,
      body: payload,
    }),

  toggleBlockUser: (token: string, targetId: string, block: boolean) =>
    requestJson<{ blockedUserIds: string[] }>(
      `/api/users/${encodeURIComponent(targetId)}/block`,
      { method: 'POST', token, body: { block } }
    ),

  searchUsers: (token: string, q: string) =>
    requestJson<{ users: UserProfile[] }>(
      `/api/users/search?q=${encodeURIComponent(q)}`,
      { token }
    ),

  createChat: (
    token: string,
    payload: {
      type: ChatType;
      targetUserId?: string;
      title?: string;
      description?: string;
      handle?: string;
      memberIds?: string[];
    }
  ) =>
    requestJson<{ chat: ChatRoom }>('/api/chats', { method: 'POST', token, body: payload }),

  updateChat: (
    token: string,
    chatId: string,
    payload: { title?: string; description?: string; adminOnlyPost?: boolean }
  ) =>
    requestJson<{ chat: ChatRoom }>(`/api/chats/${encodeURIComponent(chatId)}`, {
      method: 'PATCH',
      token,
      body: payload,
    }),

  updateGroupRole: (token: string, chatId: string, userId: string, moderator: boolean) =>
    requestJson<{ moderatorIds: string[] }>(
      `/api/chats/${encodeURIComponent(chatId)}/roles`,
      { method: 'POST', token, body: { userId, moderator } }
    ),

  leaveChat: (token: string, chatId: string) =>
    requestJson<{ ok: boolean }>(`/api/chats/${encodeURIComponent(chatId)}/leave`, {
      method: 'POST',
      token,
    }),

  getMessages: (token: string, chatId: string) =>
    requestJson<{ messages: Message[]; scheduledMessages: Message[] }>(
      `/api/chats/${encodeURIComponent(chatId)}/messages`,
      { token }
    ),

  sendMessage: (
    token: string,
    chatId: string,
    payload: {
      text: string;
      replyToId?: string | null;
      replyToStory?: { storyId: string; authorName: string; snippet: string } | null;
      forwardedFrom?: { senderName: string; chatTitle?: string } | null;
      attachment?: Attachment | null;
      scheduledFor?: number | null;
    }
  ) =>
    requestJson<{ message: Message; scheduled: boolean }>(
      `/api/chats/${encodeURIComponent(chatId)}/messages`,
      { method: 'POST', token, body: payload }
    ),

  editMessage: (token: string, messageId: string, chatId: string, text: string) =>
    requestJson<{ message: Message }>(`/api/messages/${encodeURIComponent(messageId)}`, {
      method: 'PATCH',
      token,
      body: { chatId, text },
    }),

  deleteMessage: (token: string, chatId: string, messageId: string) =>
    requestJson<{ ok: boolean }>(
      `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
      { method: 'DELETE', token }
    ),

  toggleReaction: (token: string, chatId: string, messageId: string, emoji: string) =>
    requestJson<{ message: Message }>(
      `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/react`,
      { method: 'POST', token, body: { emoji } }
    ),

  pinMessage: (token: string, chatId: string, messageId: string | null) =>
    requestJson<{ pinnedMessageId: string | null }>(
      `/api/chats/${encodeURIComponent(chatId)}/pin-message`,
      { method: 'POST', token, body: { messageId } }
    ),

  setTimer: (token: string, chatId: string, seconds: number) =>
    requestJson<{ selfDestructSec: number }>(
      `/api/chats/${encodeURIComponent(chatId)}/timer`,
      { method: 'POST', token, body: { seconds } }
    ),

  updateChatPreferences: (
    token: string,
    chatId: string,
    payload: {
      pinned?: boolean;
      archived?: boolean;
      markedUnread?: boolean;
      mutedUntil?: number | null;
    }
  ) =>
    requestJson<{
      isPinnedByUser: boolean;
      isArchivedByUser: boolean;
      markedUnreadByUser: boolean;
      isMutedByUser: boolean;
      mutedUntil: number | null;
    }>(`/api/chats/${encodeURIComponent(chatId)}/preferences`, {
      method: 'POST',
      token,
      body: payload,
    }),

  // Upload with real progress callback via XMLHttpRequest
  uploadMediaWithProgress: (
    token: string,
    payload: { dataUrl: string; name: string; durationSec?: number },
    onProgress?: (percent: number) => void
  ): Promise<{ attachment: Attachment }> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && onProgress) {
          onProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
        }
      };
      xhr.onload = () => {
        try {
          const parsed = JSON.parse(xhr.responseText || '{}') as {
            attachment?: Attachment;
            error?: string;
          };
          if (xhr.status >= 200 && xhr.status < 300 && parsed.attachment) {
            onProgress?.(100);
            resolve({ attachment: parsed.attachment });
          } else {
            reject(new Error(parsed.error || `Upload gagal (${xhr.status})`));
          }
        } catch {
          reject(new Error('Respon server tidak valid saat mengunggah file.'));
        }
      };
      xhr.onerror = () => reject(new Error('Koneksi terputus saat mengunggah file.'));
      xhr.send(JSON.stringify(payload));
    }),

  // Stories 24h
  createStory: (
    token: string,
    payload: {
      kind: 'text' | 'image' | 'video';
      text: string;
      bgColor: string;
      mediaUrl?: string | null;
      privacy: 'everyone' | 'selected' | 'except';
      allowedUserIds?: string[];
      excludedUserIds?: string[];
    }
  ) =>
    requestJson<{ story: StoryItem }>('/api/stories', {
      method: 'POST',
      token,
      body: payload,
    }),

  viewStory: (token: string, storyId: string) =>
    requestJson<{ story: StoryItem }>(`/api/stories/${encodeURIComponent(storyId)}/view`, {
      method: 'POST',
      token,
    }),

  deleteStory: (token: string, storyId: string) =>
    requestJson<{ ok: boolean }>(`/api/stories/${encodeURIComponent(storyId)}`, {
      method: 'DELETE',
      token,
    }),

  muteStoryAuthor: (token: string, authorId: string, mute: boolean) =>
    requestJson<{ mutedStoryUserIds: string[] }>(
      `/api/stories/mute/${encodeURIComponent(authorId)}`,
      { method: 'POST', token, body: { mute } }
    ),

  // Calls
  createCall: (token: string, calleeId: string, kind: 'voice' | 'video') =>
    requestJson<{ call: CallRecord }>('/api/calls', {
      method: 'POST',
      token,
      body: { calleeId, kind },
    }),

  updateCall: (
    token: string,
    callId: string,
    payload: { status?: CallRecord['status']; durationSec?: number }
  ) =>
    requestJson<{ call: CallRecord }>(`/api/calls/${encodeURIComponent(callId)}`, {
      method: 'PATCH',
      token,
      body: payload,
    }),

  // Reports
  submitReport: (
    token: string,
    payload: {
      targetType: ModerationReport['targetType'];
      targetId: string;
      targetChatId?: string;
      targetLabel: string;
      category: ModerationReport['category'];
      reason: string;
    }
  ) =>
    requestJson<{ report: ModerationReport }>('/api/reports', {
      method: 'POST',
      token,
      body: payload,
    }),

  // Optional Server-Side Gemini AI
  aiTranslate: (token: string, text: string, targetLang: 'id' | 'en') =>
    requestJson<{ translation: string }>('/api/ai/translate', {
      method: 'POST',
      token,
      body: { text, targetLang },
    }),

  aiSummarize: (token: string, chatId: string, lang: 'id' | 'en') =>
    requestJson<{ summary: string }>('/api/ai/summarize', {
      method: 'POST',
      token,
      body: { chatId, lang },
    }),

  // Admin Panel APIs
  adminClaim: (token: string, passcode: string) =>
    requestJson<{ user: UserProfile }>('/api/admin/claim', {
      method: 'POST',
      token,
      body: { passcode },
    }),

  adminUnlock: (token: string, passcode: string, role?: AdminRole) =>
    requestJson<{ user: UserProfile }>('/api/admin/unlock', {
      method: 'POST',
      token,
      body: { passcode, role },
    }),

  adminOverview: (token: string) =>
    requestJson<AdminOverviewPayload>('/api/admin/overview', { token }),

  adminUsers: (token: string, q = '') =>
    requestJson<{ users: Array<UserProfile & { activeSessionsCount: number }> }>(
      `/api/admin/users?q=${encodeURIComponent(q)}`,
      { token }
    ),

  adminUpdateUser: (
    token: string,
    userId: string,
    payload: {
      status?: UserAccountStatus;
      verified?: boolean;
      role?: AdminRole;
      revokeAllSessions?: boolean;
    }
  ) =>
    requestJson<{ user: UserProfile }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      token,
      body: payload,
    }),

  adminExportUser: (token: string, userId: string) =>
    requestJson<Record<string, unknown>>(
      `/api/admin/users/${encodeURIComponent(userId)}/export`,
      { token }
    ),

  adminReports: (token: string) =>
    requestJson<{ reports: ModerationReport[] }>('/api/admin/reports', { token }),

  adminUpdateReport: (
    token: string,
    reportId: string,
    payload: {
      status?: ModerationReport['status'];
      moderatorNote?: string;
      resolution?: string;
      removeContent?: boolean;
    }
  ) =>
    requestJson<{ report: ModerationReport }>(
      `/api/admin/reports/${encodeURIComponent(reportId)}`,
      { method: 'PATCH', token, body: payload }
    ),

  adminGroups: (token: string) =>
    requestJson<{
      groups: Array<ChatRoom & { messageCount: number; reportCount: number }>;
    }>('/api/admin/groups', { token }),

  adminUpdateGroup: (
    token: string,
    chatId: string,
    payload: { suspended?: boolean; adminOnlyPost?: boolean; inviteMaxUses?: number }
  ) =>
    requestJson<{ group: ChatRoom }>(`/api/admin/groups/${encodeURIComponent(chatId)}`, {
      method: 'PATCH',
      token,
      body: payload,
    }),

  adminStories: (token: string) =>
    requestJson<{ stories: StoryItem[] }>('/api/admin/stories', { token }),

  adminDeleteStory: (token: string, storyId: string) =>
    requestJson<{ ok: boolean }>(`/api/admin/stories/${encodeURIComponent(storyId)}`, {
      method: 'DELETE',
      token,
    }),

  adminSendAnnouncement: (token: string, text: string, pinGlobalBanner: boolean) =>
    requestJson<{ ok: boolean; settings: PlatformSettings }>('/api/admin/announcements', {
      method: 'POST',
      token,
      body: { text, pinGlobalBanner },
    }),

  adminUpdateSettings: (token: string, payload: Partial<PlatformSettings>) =>
    requestJson<{ settings: PlatformSettings }>('/api/admin/settings', {
      method: 'PATCH',
      token,
      body: payload,
    }),

  adminBackup: (token: string) =>
    requestJson<Record<string, unknown>>('/api/admin/backup', { token }),

  adminAuditLogs: (token: string) =>
    requestJson<{ logs: AuditLogEntry[] }>('/api/admin/audit-logs', { token }),
};

export class LunolaTalkSocket {
  private ws: WebSocket | null = null;
  private token: string;
  private closedByClient = false;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private attempt = 0;
  private onEvent: (evt: ServerWsEvent) => void;
  private onStatusChange: (connected: boolean) => void;

  constructor(
    token: string,
    onEvent: (evt: ServerWsEvent) => void,
    onStatusChange: (connected: boolean) => void
  ) {
    this.token = token;
    this.onEvent = onEvent;
    this.onStatusChange = onStatusChange;
  }

  connect(): void {
    this.closedByClient = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const socket = new WebSocket(wsUrl);
    this.ws = socket;

    socket.onopen = () => {
      this.attempt = 0;
      socket.send(JSON.stringify({ type: 'auth', token: this.token }));
      this.onStatusChange(true);

      this.clearPing();
      this.pingTimer = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as ServerWsEvent;
        this.onEvent(parsed);
      } catch {
        // Ignore invalid frame
      }
    };

    socket.onclose = () => {
      this.clearPing();
      this.onStatusChange(false);
      if (!this.closedByClient) {
        const delay = Math.min(8000, 1000 * Math.pow(1.5, this.attempt));
        this.attempt += 1;
        this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
      }
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  sendTyping(chatId: string, isTyping: boolean): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'typing', chatId, isTyping }));
    }
  }

  sendCallSignal(payload: {
    type: 'call:invite' | 'call:offer' | 'call:answer' | 'call:ice' | 'call:reject' | 'call:end';
    targetUserId: string;
    callId: string;
    kind?: 'voice' | 'video';
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  }): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  disconnect(): void {
    this.closedByClient = true;
    this.clearPing();
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private clearPing(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
