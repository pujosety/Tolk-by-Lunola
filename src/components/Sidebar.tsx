import { useMemo, useRef, useState, type RefObject } from 'react';
import { motion } from 'motion/react';
import {
  Archive,
  Bell,
  BellOff,
  Camera,
  Check,
  CheckCheck,
  CircleDot,
  Edit3,
  FileText,
  Film,
  Image as ImageIcon,
  Menu,
  MessageCircle,
  Mic,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Pin,
  Radio,
  Search,
  Sparkles,
  Timer,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  Attachment,
  CallRecord,
  ChatRoom,
  FolderKey,
  FriendRequest,
  LanguageCode,
  PlatformSettings,
  StoryItem,
  UserProfile,
} from '../types/chat';
import { formatChatListTime } from '../lib/androidBridge';
import { t } from '../lib/i18n';
import { Avatar } from './Avatar';
import { CallsView } from './CallsView';
import { NotificationsUpdatesView } from './NotificationsUpdatesView';
import { UpdatesView } from './StoriesBar';
import { YouView } from './YouView';

export type MainNavTab = 'chats' | 'status' | 'updates' | 'calls' | 'you';

interface SidebarProps {
  lang: LanguageCode;
  activeTab: MainNavTab;
  onSelectTab: (tab: MainNavTab) => void;
  chats: ChatRoom[];
  calls: CallRecord[];
  users: Record<string, UserProfile>;
  currentUser: UserProfile;
  stories: StoryItem[];
  friendRequests: FriendRequest[];
  settings: PlatformSettings | null;
  onlineUserIds: Set<string>;
  typingByChat: Record<string, string[]>;
  draftsByChat: Record<string, string>;
  activeChatId: string | null;
  activeFolder: FolderKey;
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  wsConnected: boolean;
  minimized: boolean;
  darkMode: boolean;
  notificationCount: number;
  onToggleMinimize: () => void;
  onToggleDarkMode: () => void;
  onQuickSearch: () => void;
  onSelectFolder: (folder: FolderKey) => void;
  onSearchChange: (q: string) => void;
  onSelectChat: (chatId: string) => void;
  onOpenOverflowMenu: () => void;
  onOpenQuickCamera: () => void;
  onOpenNewChat: () => void;
  onOpenNewChannel: () => void;
  onRespondRequest: (requestId: string, action: 'accept' | 'reject') => Promise<void>;
  onStartCall: (peerId: string, kind: 'voice' | 'video') => void;
  onOpenProfile: () => void;
  onOpenQrCard: () => void;
  onOpenStarred: () => void;
  onOpenDevices: () => void;
  onOpenSettings: () => void;
  onOpenAdminPanel: () => void;
  onLogout: () => void;
  onDeleteChat: (chatId: string) => Promise<void>;
  onTogglePinChat: (chatId: string) => Promise<void>;
  onToggleArchiveChat: (chatId: string) => Promise<void>;
  onCreateStory: (payload: {
    kind: 'text' | 'image' | 'video';
    text: string;
    bgColor: string;
    mediaUrl?: string | null;
    privacy: 'everyone' | 'selected' | 'except';
    allowedUserIds?: string[];
    excludedUserIds?: string[];
  }) => Promise<void>;
  onUploadStoryMedia: (file: File, onProgress?: (pct: number) => void) => Promise<Attachment>;
  onViewStory: (storyId: string) => void;
  onDeleteStory: (storyId: string) => Promise<void>;
  onMuteStoryAuthor: (authorId: string) => Promise<void>;
  onReplyToStory: (story: StoryItem, text: string) => Promise<void>;
}

export function Sidebar({
  lang,
  activeTab,
  onSelectTab,
  chats,
  calls,
  users,
  currentUser,
  stories,
  friendRequests,
  settings,
  onlineUserIds,
  typingByChat,
  draftsByChat,
  activeChatId,
  activeFolder,
  searchQuery,
  searchInputRef,
  wsConnected,
  minimized,
  darkMode,
  notificationCount,
  onToggleMinimize,
  onToggleDarkMode,
  onQuickSearch,
  onSelectFolder,
  onSearchChange,
  onSelectChat,
  onOpenOverflowMenu,
  onOpenQuickCamera,
  onOpenNewChat,
  onOpenNewChannel,
  onRespondRequest,
  onStartCall,
  onOpenProfile,
  onOpenQrCard,
  onOpenStarred,
  onOpenDevices,
  onOpenSettings,
  onOpenAdminPanel,
  onLogout,
  onDeleteChat,
  onTogglePinChat,
  onToggleArchiveChat,
  onCreateStory,
  onUploadStoryMedia,
  onViewStory,
  onDeleteStory,
  onMuteStoryAuthor,
  onReplyToStory,
}: SidebarProps) {
  const [previewChat, setPreviewChat] = useState<ChatRoom | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const startLongPress = (chat: ChatRoom) => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      setConfirmDeleteId(null);
      setPreviewChat(chat);
    }, 480);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const archivedCount = useMemo(
    () => chats.filter((c) => Boolean(c.isArchivedByUser)).length,
    [chats]
  );

  const folders: { key: FolderKey; label: string }[] = [
    { key: 'all', label: t(lang, 'all') },
    { key: 'dm', label: t(lang, 'dm') },
    { key: 'group', label: t(lang, 'group') },
    { key: 'channel', label: t(lang, 'channel') },
    ...(archivedCount > 0 ? [{ key: 'archived' as FolderKey, label: t(lang, 'archived') }] : []),
  ];

  const filteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return chats.filter((chat) => {
      if (activeFolder === 'archived') {
        if (!chat.isArchivedByUser) return false;
      } else {
        if (chat.isArchivedByUser && !q) return false;
        if (activeFolder !== 'all' && chat.type !== activeFolder) return false;
      }

      if (!q) return true;
      const inTitle = chat.title.toLowerCase().includes(q);
      const inHandle = (chat.handle || '').toLowerCase().includes(q);
      const inPeer = (chat.peerUser?.username || '').toLowerCase().includes(q);
      const inLast = (chat.lastMessage?.text || '').toLowerCase().includes(q);
      return inTitle || inHandle || inPeer || inLast;
    });
  }, [chats, activeFolder, searchQuery]);

  const unreadByFolder = useMemo(() => {
    const counts: Record<FolderKey, number> = {
      all: 0,
      dm: 0,
      group: 0,
      channel: 0,
      saved: 0,
      archived: 0,
    };
    for (const c of chats) {
      const hasUnread = c.unreadCount > 0 || Boolean(c.markedUnreadByUser);
      const amount = c.unreadCount > 0 ? c.unreadCount : hasUnread ? 1 : 0;
      if (c.isArchivedByUser) {
        counts.archived += amount;
      } else {
        counts.all += amount;
        counts[c.type] += amount;
      }
    }
    return counts;
  }, [chats]);

  if (minimized) {
    return (
      <aside
        key="sidebar-mini"
        className="p5-sidebar-swap flex flex-col items-center h-full w-full bg-[#FFFFFF] dark:bg-[#171E2C] border-r-2 border-[#E6ECF2] dark:border-[#2A364B] select-none overflow-hidden"
      >
        {/* Compact Minimized Top Controls */}
        <div className="pt-safe-3 w-full px-2 pb-2.5 flex flex-col items-center gap-2 border-b-2 border-[#E6ECF2] dark:border-[#2A364B] bg-[#FFFFFF] dark:bg-[#171E2C] shrink-0">
          <button
            type="button"
            onClick={onToggleMinimize}
            aria-label="Perluas sidebar"
            title="Perluas sidebar (Ctrl+B)"
            className="h-10 w-10 rounded-xl border border-[#E6ECF2] dark:border-[#F5F7FA] bg-[#8C0027] hover:bg-[#6E001F] text-[#FFFFFF] brutal-shadow-sm brutal-press p5-slash-btn flex items-center justify-center shrink-0"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onOpenOverflowMenu}
            aria-label="Buka menu navigasi"
            title="Menu Tolk by Lunola"
            className="h-10 w-10 rounded-xl border border-[#E6ECF2] dark:border-[#2A364B] bg-[#FFFFFF] dark:bg-[#232D40] hover:bg-[#EAF4FF] dark:hover:bg-[#2B364B] brutal-shadow-sm brutal-press flex items-center justify-center p-1.5 shrink-0"
          >
            <img
              src="/assets/aistudio/tolk-symbol-small_cb061777.svg"
              alt="Tolk by Lunola"
              className="tolk-logo-adaptive w-full h-full object-contain"
            />
          </button>

          <button
            type="button"
            onClick={onQuickSearch}
            aria-label={t(lang, 'searchPlaceholder')}
            title="Cari chat (Ctrl+K)"
            className="h-9 w-10 rounded-xl border border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-shadow-sm brutal-press flex items-center justify-center shrink-0"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Chat Avatar Rail */}
        <div className="flex-1 w-full overflow-y-auto thin-scrollbar py-2.5 px-1.5 flex flex-col items-center gap-2">
          {filteredChats.map((chat) => {
            const isSelected = chat.id === activeChatId;
            const isPeerOnline =
              chat.type === 'dm' && chat.peerUser ? onlineUserIds.has(chat.peerUser.id) : false;
            const showUnread = chat.unreadCount > 0 || Boolean(chat.markedUnreadByUser);

            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => onSelectChat(chat.id)}
                title={chat.title}
                aria-label={chat.title}
                className={`relative p-1 rounded-2xl border brutal-press flex items-center justify-center shrink-0 ${
                  isSelected
                    ? 'bg-[#8C0027] border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm'
                    : 'bg-transparent border-transparent hover:border-[#E6ECF2] dark:hover:border-[#8C0027] hover:bg-[#EAF4FF] dark:hover:bg-[#1E2738]'
                }`}
              >
                <Avatar
                  name={chat.title}
                  imageUrl={chat.avatarUrl}
                  color={chat.avatarColor}
                  chatType={chat.type}
                  online={isPeerOnline}
                  size="sm"
                />
                {showUnread && (
                  <span
                    className={`p5-skew p5-reaction-pop absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-mono font-bold tabular-nums flex items-center justify-center border border-[#E6ECF2] ${
                      isSelected
                        ? 'bg-[#FFFFFF] text-[#8C0027]'
                        : 'bg-[#8C0027] text-[#FFFFFF]'
                    }`}
                  >
                    <span className="p5-unskew">
                      {chat.unreadCount > 0 ? (chat.unreadCount > 9 ? '9+' : chat.unreadCount) : '•'}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Compact Compose Action */}
        <div className="pt-3 pb-safe-3 w-full px-2 border-t-2 border-[#E6ECF2] dark:border-[#2A364B] bg-[#F5F7FA] dark:bg-[#131924] flex justify-center shrink-0">
          <button
            type="button"
            onClick={onOpenNewChat}
            aria-label={t(lang, 'newChat')}
            title={t(lang, 'newChat')}
            className="h-11 w-11 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] text-[#FFFFFF] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm brutal-press p5-slash-btn flex items-center justify-center"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      key="sidebar-full"
      className="p5-sidebar-swap relative flex flex-col h-full w-full bg-[#FFFFFF] dark:bg-[#171E2C] border-r-2 border-[#E6ECF2] dark:border-[#2A364B] select-none overflow-hidden"
    >
      {/* Top Header */}
      <div className="pt-safe-3 px-3 pb-2.5 space-y-2.5 border-b border-[#E6ECF2] dark:border-[#2A364B] bg-[#FFFFFF] dark:bg-[#171E2C] shrink-0">
        <div className="flex items-center justify-between gap-2">
          {/* Clean Left Logo (Chats) or Tab Title */}
          <div className="h-10 px-1 flex items-center min-w-0">
            {activeTab === 'chats' ? (
              <img
                src="/assets/aistudio/tolk-horizontal_7a55fc8d.svg"
                alt="Tolk by Lunola"
                className="tolk-logo-adaptive h-8 w-auto object-contain select-none"
              />
            ) : (
              <h1 className="font-display font-extrabold text-xl text-[#161B26] dark:text-[#F5F7FA] truncate">
                {activeTab === 'status'
                  ? 'Status'
                  : activeTab === 'updates'
                    ? 'Update'
                    : activeTab === 'calls'
                      ? 'Panggilan'
                      : 'Kamu'}
              </h1>
            )}
          </div>

          {/* Right Actions: Camera Shortcut, Overflow Menu (top-right dropdown), Minimize (desktop) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenQuickCamera}
              aria-label="Buka kamera"
              title="Kamera Cepat"
              className="h-10 w-10 rounded-xl border border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-shadow-sm brutal-press flex items-center justify-center shrink-0"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenOverflowMenu}
              aria-label="Menu opsi"
              title="Menu"
              className="h-10 w-10 rounded-xl border border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-shadow-sm brutal-press flex items-center justify-center shrink-0"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onToggleMinimize}
              aria-label="Perkecil sidebar"
              title="Perkecil sidebar (Ctrl+B)"
              className="hidden md:flex h-10 w-10 rounded-xl border border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-shadow-sm brutal-press items-center justify-center shrink-0"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Desktop 5-Tab Switcher (Morphing Pill) */}
        <div className="hidden md:grid grid-cols-5 gap-1 p-1 rounded-2xl bg-[#F5F7FA] dark:bg-[#131924] border border-[#E6ECF2] dark:border-[#2A364B]">
          {(
            [
              { key: 'chats', label: 'Obrolan' },
              { key: 'status', label: 'Status' },
              { key: 'updates', label: 'Update' },
              { key: 'calls', label: 'Panggilan' },
              { key: 'you', label: 'Kamu' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onSelectTab(tab.key)}
                className={`relative py-1.5 rounded-xl text-[10px] font-bold transition-colors z-10 ${
                  active
                    ? 'text-white'
                    : 'text-[#5A6578] dark:text-[#94A3B8] hover:text-[#161B26] dark:hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-desktop-tab-pill"
                    transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.9 }}
                    className="absolute inset-0 rounded-xl bg-[#8C0027] brutal-shadow-sm -z-10"
                  />
                )}
                {tab.label}
                {tab.key === 'updates' && notificationCount > 0 && (
                  <span className="ml-1 inline-flex min-w-[14px] h-[14px] px-1 rounded-full bg-[#F59B00] text-white text-[9px] font-mono items-center justify-center">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === 'chats' && (
          <div className="relative">
            <Search className="w-4 h-4 text-[#5A6578] dark:text-[#CBD5E1] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t(lang, 'searchPlaceholder')}
              aria-label={t(lang, 'searchPlaceholder')}
              className="w-full h-10 pl-9 pr-8 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] placeholder:text-[#6B768A] dark:placeholder:text-[#7E8DA4] focus:outline-none focus:border-[#8C0027] dark:focus:border-[#8C0027] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A6578] hover:text-[#8C0027]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {activeTab === 'status' ? (
        <div key="tab-status" className="p5-tab-enter flex-1 flex flex-col min-h-0">
          <UpdatesView
            stories={stories}
            channels={chats.filter((c) => c.type === 'channel')}
            currentUser={currentUser}
            users={users}
            onSelectChat={onSelectChat}
            onOpenNewChannel={onOpenNewChannel}
            onCreateStory={onCreateStory}
            onUploadStoryMedia={onUploadStoryMedia}
            onViewStory={onViewStory}
            onDeleteStory={onDeleteStory}
            onMuteStoryAuthor={onMuteStoryAuthor}
            onReplyToStory={onReplyToStory}
          />
        </div>
      ) : activeTab === 'updates' ? (
        <div key="tab-updates" className="p5-tab-enter flex-1 flex flex-col min-h-0">
          <NotificationsUpdatesView
            currentUserId={currentUser.id}
            users={users}
            friendRequests={friendRequests}
            settings={settings}
            onRespondRequest={onRespondRequest}
          />
        </div>
      ) : activeTab === 'calls' ? (
        <div key="tab-calls" className="p5-tab-enter flex-1 flex flex-col min-h-0">
          <CallsView
            calls={calls}
            currentUser={currentUser}
            users={users}
            onlineUserIds={onlineUserIds}
            onStartCall={onStartCall}
          />
        </div>
      ) : activeTab === 'you' ? (
        <div key="tab-you" className="p5-tab-enter flex-1 flex flex-col min-h-0">
          <YouView
            lang={lang}
            user={currentUser}
            darkMode={darkMode}
            onToggleDarkMode={onToggleDarkMode}
            onOpenProfile={onOpenProfile}
            onOpenQrCard={onOpenQrCard}
            onOpenStarred={onOpenStarred}
            onOpenDevices={onOpenDevices}
            onOpenSettings={onOpenSettings}
            onOpenAdminPanel={onOpenAdminPanel}
            onLogout={onLogout}
          />
        </div>
      ) : (
        <div key="tab-chats" className="p5-tab-enter flex-1 flex flex-col min-h-0">
          {/* Folder Tabs */}
          <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto thin-scrollbar border-b-2 border-[#E6ECF2] dark:border-[#2A364B] bg-[#F5F7FA] dark:bg-[#131924] shrink-0">
        {folders.map((folder) => {
          const isActive = activeFolder === folder.key;
          const badge = unreadByFolder[folder.key];
          return (
            <button
              key={folder.key}
              type="button"
              onClick={() => onSelectFolder(folder.key)}
              className={`p5-skew brutal-press px-2.5 py-1 text-xs font-display font-bold tracking-wide whitespace-nowrap flex items-center gap-1.5 border shrink-0 ${
                isActive
                  ? 'bg-[#8C0027] text-[#FFFFFF] border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm p5-slash-btn'
                  : 'bg-[#FFFFFF] dark:bg-[#1E2738] text-[#161B26] dark:text-[#E2E8F0] border-[#161B26]/25 dark:border-[#324058] hover:border-[#8C0027]'
              }`}
            >
              <span className="p5-unskew flex items-center gap-1">
                {folder.key === 'archived' && <Archive className="w-3 h-3" />}
                <span>{folder.label}</span>
                {badge > 0 && (
                  <span
                    className={`font-mono text-[10px] font-bold tabular-nums ${
                      isActive ? 'text-[#FFF2A7]' : 'text-[#8C0027] dark:text-[#F47296]'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto thin-scrollbar p-2.5 md:pb-20 space-y-2 bg-[#F5F7FA] dark:bg-[#0F141E]">
        {filteredChats.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-display font-bold text-base text-[#161B26] dark:text-[#F5F7FA]">
              {lang === 'en' ? 'No conversations found' : 'Tidak ada percakapan ditemukan'}
            </p>
            <p className="mt-1 text-xs text-[#6B768A] dark:text-[#7E8DA4]">
              {lang === 'en'
                ? 'Try another keyword or start a new chat.'
                : 'Coba kata kunci lain atau mulai obrolan baru.'}
            </p>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isSelected = chat.id === activeChatId;
            const typingIds = (typingByChat[chat.id] || []).filter((id) => id !== currentUser.id);
            const isPeerOnline =
              chat.type === 'dm' && chat.peerUser ? onlineUserIds.has(chat.peerUser.id) : false;
            const draftText = (draftsByChat[chat.id] || '').trim();
            const lastMsg = chat.lastMessage;
            const isOwnLast = lastMsg?.senderId === currentUser.id;
            const isReadByPeer =
              isOwnLast &&
              lastMsg &&
              lastMsg.readBy.some((uid) => uid !== currentUser.id);

            let previewText = chat.description || (lang === 'en' ? 'No messages yet' : 'Belum ada pesan');
            let previewIcon: React.ReactNode = null;

            if (typingIds.length > 0) {
              const typerName = users[typingIds[0]]?.displayName || 'Seseorang';
              previewText =
                chat.type === 'dm'
                  ? t(lang, 'typing')
                  : `${typerName} ${t(lang, 'typing')}`;
            } else if (draftText && !isSelected) {
              previewText = draftText;
            } else if (lastMsg) {
              const senderPrefix =
                chat.type === 'group' && lastMsg.senderId !== currentUser.id
                  ? `${users[lastMsg.senderId]?.displayName?.split(' ')[0] || 'Anggota'}: `
                  : '';

              if (lastMsg.attachment?.kind === 'image') {
                previewIcon = <ImageIcon className="w-3.5 h-3.5 shrink-0" />;
                previewText = `${senderPrefix}${lastMsg.text || 'Foto'}`;
              } else if (lastMsg.attachment?.kind === 'video') {
                previewIcon = <Film className="w-3.5 h-3.5 shrink-0" />;
                previewText = `${senderPrefix}${lastMsg.text || 'Video'}`;
              } else if (lastMsg.attachment?.kind === 'audio') {
                previewIcon = <Mic className="w-3.5 h-3.5 shrink-0" />;
                previewText = `${senderPrefix}Pesan suara`;
              } else if (lastMsg.attachment?.kind === 'file') {
                previewIcon = <FileText className="w-3.5 h-3.5 shrink-0" />;
                previewText = `${senderPrefix}${lastMsg.attachment.name}`;
              } else {
                previewText = `${senderPrefix}${lastMsg.text}`;
              }
            }

            const showUnread = chat.unreadCount > 0 || Boolean(chat.markedUnreadByUser);

            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => onSelectChat(chat.id)}
                onPointerDown={() => startLongPress(chat)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setConfirmDeleteId(null);
                  setPreviewChat(chat);
                }}
                className={`p5-row-motion w-full px-2.5 py-2.5 rounded-xl flex items-center gap-3 text-left border select-none ${
                  isSelected
                    ? 'bg-[#8C0027] text-[#FFFFFF] border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm'
                    : 'bg-[#FFFFFF] dark:bg-[#1E2738] text-[#161B26] dark:text-[#F5F7FA] border-transparent hover:border-[#E6ECF2] dark:hover:border-[#8C0027] hover:bg-[#EAF4FF] dark:hover:bg-[#1E2738]'
                }`}
              >
                <Avatar
                  name={chat.title}
                  imageUrl={chat.avatarUrl}
                  color={chat.avatarColor}
                  chatType={chat.type}
                  online={isPeerOnline}
                  size="md"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {chat.type === 'channel' && (
                        <Radio
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-[#FFF2A7]' : 'text-[#8C0027] dark:text-[#F47296]'
                          }`}
                        />
                      )}
                      {chat.type === 'group' && (
                        <Users
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-[#FFF2A7]' : 'text-[#5A6578] dark:text-[#CBD5E1]'
                          }`}
                        />
                      )}
                      <span className="font-display font-bold text-base leading-tight truncate">
                        {chat.title}
                      </span>
                      {chat.isMutedByUser && (
                        <BellOff
                          className={`w-3 h-3 shrink-0 ${
                            isSelected ? 'text-[#FFF2A7]/80' : 'text-[#6B768A]'
                          }`}
                        />
                      )}
                      {chat.selfDestructSec > 0 && (
                        <Timer
                          className={`w-3 h-3 shrink-0 ${
                            isSelected ? 'text-[#FDE68A]' : 'text-amber-600'
                          }`}
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isOwnLast && lastMsg && !draftText && (
                        isReadByPeer ? (
                          <CheckCheck
                            className={`w-3.5 h-3.5 ${
                              isSelected ? 'text-[#FFFFFF]' : 'text-[#F59B00] dark:text-[#BEDEFF]'
                            }`}
                          />
                        ) : (
                          <Check
                            className={`w-3.5 h-3.5 ${
                              isSelected ? 'text-[#FFF2A7]/80' : 'text-[#6B768A]'
                            }`}
                          />
                        )
                      )}
                      {lastMsg && (
                        <span
                          className={`font-mono text-[11px] tabular-nums ${
                            isSelected
                              ? 'text-[#FFF2A7]'
                              : 'text-[#6B768A] dark:text-[#7E8DA4]'
                          }`}
                        >
                          {formatChatListTime(lastMsg.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <div
                      className={`flex items-center gap-1 text-xs truncate ${
                        typingIds.length > 0
                          ? isSelected
                            ? 'text-[#FFFFFF] font-semibold'
                            : 'text-[#F59B00] dark:text-[#BEDEFF] font-semibold'
                          : isSelected
                            ? 'text-[#FFF2A7]'
                            : 'text-[#5A6578] dark:text-[#94A3B8]'
                      }`}
                    >
                      {draftText && !isSelected && typingIds.length === 0 ? (
                        <span className="truncate">
                          <span className="text-[#8C0027] dark:text-[#F47296] font-bold">
                            {t(lang, 'draft')}:{' '}
                          </span>
                          {draftText}
                        </span>
                      ) : (
                        <>
                          {previewIcon}
                          <span className="truncate">{previewText}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {chat.isPinnedByUser && !showUnread && (
                        <Pin
                          className={`w-3 h-3 rotate-45 ${
                            isSelected ? 'text-[#FFF2A7]' : 'text-[#6B768A]'
                          }`}
                        />
                      )}
                      {showUnread && (
                        <span
                          className={`p5-skew p5-reaction-pop min-w-[22px] h-5 px-1.5 text-[11px] font-mono font-bold tabular-nums flex items-center justify-center border border-[#E6ECF2] ${
                            isSelected
                              ? 'bg-[#FFFFFF] text-[#8C0027]'
                              : chat.isMutedByUser
                                ? 'bg-[#E7E0D8] dark:bg-[#3A2F36] text-[#161B26] dark:text-[#F5F7FA]'
                                : 'bg-[#8C0027] text-[#FFFFFF]'
                          }`}
                        >
                          <span className="p5-unskew">
                            {chat.unreadCount > 0 ? chat.unreadCount : '•'}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}

      </div>

      {/* Floating Compose FAB (visible on Obrolan tab) */}
      <button
        type="button"
        onClick={onOpenNewChat}
        aria-label={t(lang, 'newChat')}
        title={t(lang, 'newChat')}
        className="flex absolute bottom-[78px] md:bottom-6 right-4 md:right-5 h-12 w-12 rounded-2xl bg-[#8C0027] hover:bg-[#6E001F] text-[#FFFFFF] border border-white/60 dark:border-[#F5F7FA]/40 brutal-shadow-maroon brutal-press p5-slash-btn items-center justify-center z-20"
      >
        <Edit3 className="w-5 h-5" />
      </button>
      </div>
      )}

      {/* WhatsApp-Style 5-Tab Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navigasi utama"
        className="md:hidden pt-1.5 pb-safe-2 px-1 bg-[#FFFFFF]/95 dark:bg-[#171E2C]/95 backdrop-blur-md border-t border-[#E6ECF2] dark:border-[#2A364B] grid grid-cols-5 gap-0.5 shrink-0 z-20"
      >
        <button
          type="button"
          onClick={() => onSelectTab('chats')}
          className="py-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold"
        >
          <span
            className={`relative px-3 py-1 rounded-full transition-colors ${
              activeTab === 'chats'
                ? 'bg-[#BEDEFF] dark:bg-[#1F2C44] text-[#8C0027] dark:text-[#BEDEFF]'
                : 'text-[#5A6578] dark:text-[#94A3B8]'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            {unreadByFolder.all > 0 && (
              <span className="absolute -top-0.5 right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[#8C0027] text-white text-[9px] font-mono font-bold flex items-center justify-center">
                {unreadByFolder.all > 99 ? '99+' : unreadByFolder.all}
              </span>
            )}
          </span>
          <span className={activeTab === 'chats' ? 'text-[#161B26] dark:text-white' : 'text-[#5A6578] dark:text-[#94A3B8]'}>
            Obrolan
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('status')}
          className="py-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold"
        >
          <span
            className={`relative px-3 py-1 rounded-full transition-colors ${
              activeTab === 'status'
                ? 'bg-[#FFF2A7] dark:bg-[#2B2618] text-[#161B26] dark:text-[#FFF2A7]'
                : 'text-[#5A6578] dark:text-[#94A3B8]'
            }`}
          >
            <CircleDot className="w-5 h-5" />
            {stories.length > 0 && (
              <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-[#F59B00]" />
            )}
          </span>
          <span className={activeTab === 'status' ? 'text-[#161B26] dark:text-white' : 'text-[#5A6578] dark:text-[#94A3B8]'}>
            Status
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('updates')}
          className="py-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold"
        >
          <span
            className={`relative px-3 py-1 rounded-full transition-colors ${
              activeTab === 'updates'
                ? 'bg-[#8C0027] text-white brutal-shadow-sm'
                : 'text-[#5A6578] dark:text-[#94A3B8]'
            }`}
          >
            <Bell className="w-5 h-5" />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[#F59B00] text-white text-[9px] font-mono font-bold flex items-center justify-center">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </span>
          <span className={activeTab === 'updates' ? 'text-[#161B26] dark:text-white' : 'text-[#5A6578] dark:text-[#94A3B8]'}>
            Update
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('calls')}
          className="py-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold"
        >
          <span
            className={`px-3 py-1 rounded-full transition-colors ${
              activeTab === 'calls'
                ? 'bg-[#BEDEFF] dark:bg-[#1F2C44] text-[#8C0027] dark:text-[#BEDEFF]'
                : 'text-[#5A6578] dark:text-[#94A3B8]'
            }`}
          >
            <Phone className="w-5 h-5" />
          </span>
          <span className={activeTab === 'calls' ? 'text-[#161B26] dark:text-white' : 'text-[#5A6578] dark:text-[#94A3B8]'}>
            Panggilan
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('you')}
          className="py-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold"
        >
          <span
            className={`px-2.5 py-0.5 rounded-full flex items-center justify-center transition-colors ${
              activeTab === 'you'
                ? 'ring-2 ring-[#8C0027] dark:ring-[#F47296]'
                : ''
            }`}
          >
            <Avatar
              name={currentUser.displayName}
              imageUrl={currentUser.avatarUrl}
              color={currentUser.avatarColor}
              size="xs"
            />
          </span>
          <span className={activeTab === 'you' ? 'text-[#161B26] dark:text-white' : 'text-[#5A6578] dark:text-[#94A3B8]'}>
            Kamu
          </span>
        </button>
      </nav>

      {/* Long-Press Chat Preview & Quick Actions Popup */}
      {previewChat && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div
            className="p5-backdrop-in fixed inset-0 bg-[#0F141E]/60 backdrop-blur-[2px]"
            onClick={() => setPreviewChat(null)}
          />
          <div className="p5-modal-impact relative z-10 w-full max-w-sm rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] brutal-shadow-lg overflow-hidden">
            <div className="p-4 border-b border-[#E6ECF2] dark:border-[#2A364B] bg-[#F5F7FA] dark:bg-[#131924] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  name={previewChat.title}
                  imageUrl={previewChat.avatarUrl}
                  color={previewChat.avatarColor}
                  chatType={previewChat.type}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA] truncate">
                    {previewChat.title}
                  </div>
                  <div className="text-[11px] text-[#5A6578] dark:text-[#94A3B8] truncate">
                    {previewChat.type === 'saved'
                      ? 'Pesan Tersimpan'
                      : previewChat.type === 'dm'
                        ? 'Obrolan Pribadi'
                        : `${previewChat.memberIds.length} anggota`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewChat(null)}
                aria-label="Tutup pratinjau"
                className="h-8 w-8 rounded-xl border border-[#E6ECF2] dark:border-[#2A364B] bg-[#FFFFFF] dark:bg-[#232D40] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="p-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B]">
                <div className="text-[11px] font-bold text-[#5A6578] dark:text-[#94A3B8] mb-1">
                  Pratinjau Pesan Terakhir
                </div>
                <p className="text-xs text-[#161B26] dark:text-[#F5F7FA] line-clamp-3 leading-relaxed">
                  {previewChat.lastMessage?.text ||
                    previewChat.lastMessage?.attachment?.name ||
                    previewChat.description ||
                    'Belum ada pesan di percakapan ini.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const id = previewChat.id;
                    setPreviewChat(null);
                    onSelectChat(id);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] text-white text-xs font-bold brutal-shadow-sm brutal-press"
                >
                  Buka Chat
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const id = previewChat.id;
                    setPreviewChat(null);
                    await onTogglePinChat(id);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#2A364B] text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] flex items-center justify-center gap-1.5"
                >
                  <Pin className="w-3.5 h-3.5 text-[#8C0027]" />
                  <span>{previewChat.isPinnedByUser ? 'Lepas Semat' : 'Sematkan'}</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const id = previewChat.id;
                    setPreviewChat(null);
                    await onToggleArchiveChat(id);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#2A364B] text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] flex items-center justify-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5 text-[#F59B00]" />
                  <span>{previewChat.isArchivedByUser ? 'Buka Arsip' : 'Arsipkan'}</span>
                </button>

                {previewChat.type !== 'saved' && (
                  confirmDeleteId === previewChat.id ? (
                    <button
                      type="button"
                      onClick={async () => {
                        const id = previewChat.id;
                        setPreviewChat(null);
                        setConfirmDeleteId(null);
                        await onDeleteChat(id);
                      }}
                      className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold brutal-shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Konfirmasi Hapus</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(previewChat.id)}
                      className="py-2.5 px-3 rounded-xl bg-[#EAF4FF] dark:bg-[#1B2436] border border-[#8C0027]/40 text-xs font-bold text-[#6E001F] dark:text-[#F47296] flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Chat</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
