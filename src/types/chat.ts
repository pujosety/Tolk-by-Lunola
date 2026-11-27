export type ChatType = 'saved' | 'dm' | 'group' | 'channel';

export type FolderKey = 'all' | 'dm' | 'group' | 'channel' | 'saved' | 'archived';

export type AdminRole =
  | 'super_admin'
  | 'administrator'
  | 'moderator'
  | 'support'
  | 'server_operator'
  | 'audit_viewer'
  | 'user';

export type UserAccountStatus = 'active' | 'suspended' | 'banned_temp' | 'banned_perm';

export type PrivacyScope = 'everyone' | 'contacts' | 'nobody';

export type LanguageCode = 'id' | 'en';

export type TextScale = 'sm' | 'md' | 'lg';

export type NotificationTone = 'lunola' | 'crystal' | 'soft' | 'mute';

export type ChatWallpaperId =
  | 'doodle-animated'
  | 'default'
  | 'sky-breeze'
  | 'butter-warm'
  | 'burgundy-glow'
  | 'minimal'
  | 'custom';

export type BubbleStyleId = 'tiktok' | 'classic' | 'clay' | 'outline';

export type BubbleAccentId = 'burgundy' | 'amber' | 'sky' | 'emerald' | 'violet';

export interface ChatAppearancePrefs {
  wallpaper: ChatWallpaperId;
  customWallpaperUrl?: string | null;
  customDim?: number;
  customBlur?: number;
  customFit?: 'cover' | 'contain';
  bubbleStyle: BubbleStyleId;
  bubbleAccent: BubbleAccentId;
}

export interface UserPrivacySettings {
  lastSeenVisibility: PrivacyScope;
  whoCanMessage: PrivacyScope;
  storyVisibility: PrivacyScope;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  bio: string;
  statusText?: string;
  avatarUrl: string | null;
  avatarColor: string;
  isGuest?: boolean;
  verified?: boolean;
  role: AdminRole;
  status: UserAccountStatus;
  createdAt: number;
  lastSeen: number;
  online?: boolean;
  privacy?: UserPrivacySettings;
  blockedUserIds?: string[];
  mutedStoryUserIds?: string[];
  contactIds?: string[];
  starredMessageIds?: string[];
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

export interface DeviceSession {
  id: string;
  userId: string;
  deviceName: string;
  platform: string;
  userAgent: string;
  ip: string;
  createdAt: number;
  lastActiveAt: number;
  current?: boolean;
}

export interface Attachment {
  id: string;
  kind: 'image' | 'video' | 'audio' | 'file';
  url: string;
  name: string;
  mimeType: string;
  size: number;
  durationSec?: number;
  viewOnce?: boolean;
  viewedBy?: string[];
}

export interface PollOption {
  id: string;
  text: string;
  voterIds: string[];
}

export interface PollData {
  question: string;
  allowMultiple: boolean;
  options: PollOption[];
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: number;
  editedAt?: number;
  scheduledFor?: number | null;
  replyToId?: string | null;
  replyToStory?: {
    storyId: string;
    authorName: string;
    snippet: string;
    kind?: 'text' | 'image' | 'video';
    mediaUrl?: string | null;
    bgColor?: string;
  } | null;
  forwardedFrom?: {
    senderName: string;
    chatTitle?: string;
  } | null;
  mentions?: string[];
  attachment?: Attachment | null;
  poll?: PollData | null;
  reactions: MessageReaction[];
  readBy: string[];
  views?: number;
  expiresAt?: number | null;
  systemEvent?: boolean;
}

export interface ChatRoom {
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
  isPinnedByUser?: boolean;
  isMutedByUser?: boolean;
  mutedUntil?: number | null; // null = not muted, -1 = forever, timestamp = muted until
  isArchivedByUser?: boolean;
  markedUnreadByUser?: boolean;
  selfDestructSec: number; // 0 = off
  subscriberCount?: number;
  inviteExpiresAt?: number | null;
  inviteMaxUses?: number | null;
  inviteUses?: number;
  suspended?: boolean;
  createdAt: number;
  lastMessage?: Message | null;
  unreadCount: number;
  peerUser?: UserProfile | null;
}

export interface StoryItem {
  id: string;
  userId: string;
  kind: 'text' | 'image' | 'video';
  text: string;
  bgColor: string;
  mediaUrl?: string | null;
  privacy: 'everyone' | 'selected' | 'except';
  allowedUserIds: string[];
  excludedUserIds: string[];
  mentionedUserIds?: string[];
  resharedFrom?: {
    storyId: string;
    userId: string;
    displayName: string;
    username: string;
  } | null;
  viewerIds: string[];
  viewerTimes?: Record<string, number>;
  likedUserIds?: string[];
  createdAt: number;
  expiresAt: number;
}

export interface CallRecord {
  id: string;
  callerId: string;
  calleeId: string;
  kind: 'voice' | 'video';
  status: 'ringing' | 'active' | 'completed' | 'missed' | 'rejected';
  startedAt: number;
  endedAt?: number;
  durationSec: number;
}

export interface ModerationReport {
  id: string;
  reporterId: string;
  targetType: 'user' | 'message' | 'group' | 'story';
  targetId: string;
  targetChatId?: string;
  targetLabel: string;
  category: 'spam' | 'scam' | 'harassment' | 'illegal';
  reason: string;
  status: 'open' | 'reviewing' | 'resolved';
  moderatorNote: string;
  resolution?: string;
  appealText?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlatformSettings {
  appName: string;
  allowRegistration: boolean;
  maxUploadMb: number;
  storyExpiryHours: number;
  maxGroupMembers: number;
  rateLimitPerMin: number;
  maintenanceMode: boolean;
  globalAnnouncement: string;
  pushEnabled: boolean;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: AdminRole;
  action: string;
  target: string;
  details: string;
  createdAt: number;
}

export interface AdminOverviewPayload {
  metrics: {
    totalUsers: number;
    dau: number;
    mau: number;
    newUsersToday: number;
    totalMessages: number;
    totalGroups: number;
    totalChannels: number;
    activeStories: number;
    totalCalls: number;
    openReports: number;
    onlineNow: number;
  };
  trafficSeries: Array<{
    label: string;
    messages: number;
    activeUsers: number;
  }>;
  server: {
    runtime: string;
    tinodeMode: string;
    uptimeSec: number;
    cpuCores: number;
    loadAvg1m: number;
    memoryRssMb: number;
    memoryHeapMb: number;
    mediaFilesCount: number;
    mediaStorageMb: number;
    storeSizeKb: number;
    wsConnections: number;
    rateLimitBlocked: number;
    turnStunStatus: string;
    tlsStatus: string;
    lastBackupAt: number | null;
  };
  settings: PlatformSettings;
}

export interface BootstrapPayload {
  user: UserProfile;
  users: Record<string, UserProfile>;
  chats: ChatRoom[];
  stories: StoryItem[];
  calls: CallRecord[];
  friendRequests?: FriendRequest[];
  onlineUserIds: string[];
  settings: PlatformSettings;
  adminAuthState: {
    hasClaimedAdmin: boolean;
    envPasscodeConfigured: boolean;
  };
  serverInfo: {
    runtime: string;
    wasmerReady: boolean;
    wsPath: string;
    maxUploadMb: number;
  };
}
