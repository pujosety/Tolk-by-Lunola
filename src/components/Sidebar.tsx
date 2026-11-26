import { useMemo, type RefObject } from 'react';
import {
  Archive,
  BellOff,
  Check,
  CheckCheck,
  Edit3,
  FileText,
  Film,
  Image as ImageIcon,
  Menu,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Radio,
  Search,
  Timer,
  Users,
  X,
} from 'lucide-react';
import type {
  Attachment,
  ChatRoom,
  FolderKey,
  LanguageCode,
  StoryItem,
  UserProfile,
} from '../types/chat';
import { formatChatListTime } from '../lib/androidBridge';
import { t } from '../lib/i18n';
import { Avatar } from './Avatar';
import { StoriesBar } from './StoriesBar';

interface SidebarProps {
  lang: LanguageCode;
  chats: ChatRoom[];
  users: Record<string, UserProfile>;
  currentUser: UserProfile;
  stories: StoryItem[];
  onlineUserIds: Set<string>;
  typingByChat: Record<string, string[]>;
  draftsByChat: Record<string, string>;
  activeChatId: string | null;
  activeFolder: FolderKey;
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  wsConnected: boolean;
  minimized: boolean;
  onToggleMinimize: () => void;
  onQuickSearch: () => void;
  onSelectFolder: (folder: FolderKey) => void;
  onSearchChange: (q: string) => void;
  onSelectChat: (chatId: string) => void;
  onOpenDrawer: () => void;
  onOpenNewChat: () => void;
  onCreateStory: (payload: {
    kind: 'text' | 'image' | 'video';
    text: string;
    bgColor: string;
    mediaUrl?: string | null;
    privacy: 'everyone' | 'selected' | 'except';
    allowedUserIds?: string[];
    excludedUserIds?: string[];
  }) => Promise<void>;
  onUploadStoryMedia: (file: File) => Promise<Attachment>;
  onViewStory: (storyId: string) => void;
  onDeleteStory: (storyId: string) => Promise<void>;
  onMuteStoryAuthor: (authorId: string) => Promise<void>;
  onReplyToStory: (story: StoryItem, text: string) => Promise<void>;
}

export function Sidebar({
  lang,
  chats,
  users,
  currentUser,
  stories,
  onlineUserIds,
  typingByChat,
  draftsByChat,
  activeChatId,
  activeFolder,
  searchQuery,
  searchInputRef,
  wsConnected,
  minimized,
  onToggleMinimize,
  onQuickSearch,
  onSelectFolder,
  onSearchChange,
  onSelectChat,
  onOpenDrawer,
  onOpenNewChat,
  onCreateStory,
  onUploadStoryMedia,
  onViewStory,
  onDeleteStory,
  onMuteStoryAuthor,
  onReplyToStory,
}: SidebarProps) {
  const archivedCount = useMemo(
    () => chats.filter((c) => Boolean(c.isArchivedByUser)).length,
    [chats]
  );

  const folders: { key: FolderKey; label: string }[] = [
    { key: 'all', label: t(lang, 'all') },
    { key: 'dm', label: t(lang, 'dm') },
    { key: 'group', label: t(lang, 'group') },
    { key: 'channel', label: t(lang, 'channel') },
    { key: 'saved', label: t(lang, 'saved') },
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
        className="p5-sidebar-swap flex flex-col items-center h-full w-full bg-[#FBF9F6] dark:bg-[#1E241C] border-r-2 border-[#E3E1DC] dark:border-[#364032] select-none overflow-hidden"
      >
        {/* Compact Minimized Top Controls */}
        <div className="pt-safe-3 w-full px-2 pb-2.5 flex flex-col items-center gap-2 border-b-2 border-[#E3E1DC] dark:border-[#364032] bg-[#FBF9F6] dark:bg-[#1E241C] shrink-0">
          <button
            type="button"
            onClick={onToggleMinimize}
            aria-label="Perluas sidebar"
            title="Perluas sidebar (Ctrl+B)"
            className="h-10 w-10 rounded-xl border border-[#E3E1DC] dark:border-[#F2F2F2] bg-[#D96868] hover:bg-[#C45454] text-[#FBF9F6] brutal-shadow-sm brutal-press p5-slash-btn flex items-center justify-center shrink-0"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Buka menu navigasi"
            title="Menu Tolk by Lunola"
            className="h-10 w-10 rounded-xl border border-[#E3E1DC] dark:border-[#F2F2F2] bg-[#FBF9F6] hover:bg-[#FCEAEA] brutal-shadow-sm brutal-press flex items-center justify-center p-1.5 shrink-0"
          >
            <img
              src="/assets/aistudio/tolk-symbol-small_cb061777.svg"
              alt="Tolk by Lunola"
              className="w-full h-full object-contain"
            />
          </button>

          <button
            type="button"
            onClick={onQuickSearch}
            aria-label={t(lang, 'searchPlaceholder')}
            title="Cari chat (Ctrl+K)"
            className="h-9 w-10 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] bg-[#F2F2F2] dark:bg-[#2B3328] text-[#252A24] dark:text-[#F2F2F2] hover:bg-[#D96868] hover:text-white brutal-shadow-sm brutal-press flex items-center justify-center shrink-0"
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
                    ? 'bg-[#D96868] border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm'
                    : 'bg-transparent border-transparent hover:border-[#E3E1DC] dark:hover:border-[#D96868] hover:bg-[#FCEAEA] dark:hover:bg-[#2B2424]'
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
                    className={`p5-skew p5-reaction-pop absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-mono font-bold tabular-nums flex items-center justify-center border border-[#E3E1DC] ${
                      isSelected
                        ? 'bg-[#FBF9F6] text-[#D96868]'
                        : 'bg-[#D96868] text-[#FBF9F6]'
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
        <div className="pt-3 pb-safe-3 w-full px-2 border-t-2 border-[#E3E1DC] dark:border-[#364032] bg-[#F2F2F2] dark:bg-[#191E17] flex justify-center shrink-0">
          <button
            type="button"
            onClick={onOpenNewChat}
            aria-label={t(lang, 'newChat')}
            title={t(lang, 'newChat')}
            className="h-11 w-11 rounded-xl bg-[#D96868] hover:bg-[#C45454] text-[#FBF9F6] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm brutal-press p5-slash-btn flex items-center justify-center"
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
      className="p5-sidebar-swap relative flex flex-col h-full w-full bg-[#FBF9F6] dark:bg-[#1E241C] border-r-2 border-[#E3E1DC] dark:border-[#364032] select-none overflow-hidden"
    >
      {/* Top Neo-Brutalist Brand & Search Header */}
      <div className="pt-safe-3 px-3 pb-2.5 space-y-2.5 border-b-2 border-[#E3E1DC] dark:border-[#364032] bg-[#FBF9F6] dark:bg-[#1E241C]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onOpenDrawer}
              aria-label="Buka menu navigasi"
              className="h-10 w-10 rounded-xl border border-[#E3E1DC] dark:border-[#F2F2F2] bg-[#FBF9F6] dark:bg-[#2B3328] text-[#252A24] dark:text-[#F2F2F2] hover:bg-[#D96868] hover:text-white brutal-shadow-sm brutal-press flex items-center justify-center shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="h-10 px-2.5 py-1 rounded-xl bg-[#FBF9F6] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm flex items-center min-w-0">
              <img
                src="/assets/aistudio/tolk-horizontal_7a55fc8d.svg"
                alt="Tolk by Lunola"
                className="h-7 w-auto object-contain select-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleMinimize}
            aria-label="Perkecil sidebar"
            title="Perkecil sidebar (Ctrl+B)"
            className="hidden md:flex h-10 w-10 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] bg-[#F2F2F2] dark:bg-[#2B3328] text-[#252A24] dark:text-[#F2F2F2] hover:bg-[#D96868] hover:text-white brutal-shadow-sm brutal-press items-center justify-center shrink-0"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-[#5E645C] dark:text-[#B7C0B3] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t(lang, 'searchPlaceholder')}
            aria-label={t(lang, 'searchPlaceholder')}
            className="w-full h-10 pl-9 pr-8 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] placeholder:text-[#787F75] dark:placeholder:text-[#8F9A8A] focus:outline-none focus:border-[#D96868] dark:focus:border-[#D96868] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Hapus pencarian"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5E645C] hover:text-[#D96868]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stories 24h Strip */}
      <StoriesBar
        stories={stories}
        currentUser={currentUser}
        users={users}
        onCreateStory={onCreateStory}
        onUploadStoryMedia={onUploadStoryMedia}
        onViewStory={onViewStory}
        onDeleteStory={onDeleteStory}
        onMuteStoryAuthor={onMuteStoryAuthor}
        onReplyToStory={onReplyToStory}
      />

      {/* Persona 5 Skewed Folder Tabs */}
      <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto thin-scrollbar border-b-2 border-[#E3E1DC] dark:border-[#364032] bg-[#F2F2F2] dark:bg-[#191E17]">
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
                  ? 'bg-[#D96868] text-[#FBF9F6] border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm p5-slash-btn'
                  : 'bg-[#FBF9F6] dark:bg-[#252C22] text-[#252A24] dark:text-[#E2E6DF] border-[#252A24]/25 dark:border-[#3C4738] hover:border-[#D96868]'
              }`}
            >
              <span className="p5-unskew flex items-center gap-1">
                {folder.key === 'archived' && <Archive className="w-3 h-3" />}
                <span>{folder.label}</span>
                {badge > 0 && (
                  <span
                    className={`font-mono text-[10px] font-bold tabular-nums ${
                      isActive ? 'text-[#F9DADA]' : 'text-[#D96868] dark:text-[#E58383]'
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
      <div className="flex-1 overflow-y-auto thin-scrollbar p-2 pb-20 space-y-1.5">
        {filteredChats.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-display font-bold text-base text-[#252A24] dark:text-[#F2F2F2]">
              {lang === 'en' ? 'No conversations found' : 'Tidak ada percakapan ditemukan'}
            </p>
            <p className="mt-1 text-xs text-[#787F75] dark:text-[#8F9A8A]">
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
                className={`p5-row-motion w-full px-2.5 py-2.5 rounded-xl flex items-center gap-3 text-left border ${
                  isSelected
                    ? 'bg-[#D96868] text-[#FBF9F6] border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm'
                    : 'bg-[#FBF9F6] dark:bg-[#252C22] text-[#252A24] dark:text-[#F2F2F2] border-transparent hover:border-[#E3E1DC] dark:hover:border-[#D96868] hover:bg-[#FCEAEA] dark:hover:bg-[#2B2424]'
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
                            isSelected ? 'text-[#F9DADA]' : 'text-[#D96868] dark:text-[#E58383]'
                          }`}
                        />
                      )}
                      {chat.type === 'group' && (
                        <Users
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-[#F9DADA]' : 'text-[#5E645C] dark:text-[#B7C0B3]'
                          }`}
                        />
                      )}
                      <span className="font-display font-bold text-base leading-tight truncate">
                        {chat.title}
                      </span>
                      {chat.isMutedByUser && (
                        <BellOff
                          className={`w-3 h-3 shrink-0 ${
                            isSelected ? 'text-[#F9DADA]/80' : 'text-[#787F75]'
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
                              isSelected ? 'text-[#FBF9F6]' : 'text-[#6A994E] dark:text-[#8FA86C]'
                            }`}
                          />
                        ) : (
                          <Check
                            className={`w-3.5 h-3.5 ${
                              isSelected ? 'text-[#F9DADA]/80' : 'text-[#787F75]'
                            }`}
                          />
                        )
                      )}
                      {lastMsg && (
                        <span
                          className={`font-mono text-[11px] tabular-nums ${
                            isSelected
                              ? 'text-[#F9DADA]'
                              : 'text-[#787F75] dark:text-[#8F9A8A]'
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
                            ? 'text-[#FBF9F6] font-semibold'
                            : 'text-[#6A994E] dark:text-[#8FA86C] font-semibold'
                          : isSelected
                            ? 'text-[#F9DADA]'
                            : 'text-[#5E645C] dark:text-[#A3AD9E]'
                      }`}
                    >
                      {draftText && !isSelected && typingIds.length === 0 ? (
                        <span className="truncate">
                          <span className="text-[#D96868] dark:text-[#E58383] font-bold">
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
                            isSelected ? 'text-[#F9DADA]' : 'text-[#787F75]'
                          }`}
                        />
                      )}
                      {showUnread && (
                        <span
                          className={`p5-skew p5-reaction-pop min-w-[22px] h-5 px-1.5 text-[11px] font-mono font-bold tabular-nums flex items-center justify-center border border-[#E3E1DC] ${
                            isSelected
                              ? 'bg-[#FBF9F6] text-[#D96868]'
                              : chat.isMutedByUser
                                ? 'bg-[#E7E0D8] dark:bg-[#3A2F36] text-[#252A24] dark:text-[#F2F2F2]'
                                : 'bg-[#D96868] text-[#FBF9F6]'
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

      {/* Neo-Brutalist Floating Compose Button */}
      <button
        type="button"
        onClick={onOpenNewChat}
        aria-label={t(lang, 'newChat')}
        title={t(lang, 'newChat')}
        className="absolute bottom-5 right-5 h-12 w-12 rounded-xl bg-[#D96868] hover:bg-[#C45454] text-[#FBF9F6] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow brutal-press p5-slash-btn flex items-center justify-center z-20"
      >
        <Edit3 className="w-5 h-5" />
      </button>
    </aside>
  );
}
