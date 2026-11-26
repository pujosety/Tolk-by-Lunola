import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Ban,
  Bell,
  BellOff,
  Check,
  Copy,
  Edit3,
  FileText,
  Flag,
  LogOut,
  MailOpen,
  Mic,
  Pin,
  QrCode,
  Shield,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import type { ChatRoom, Message, UserProfile } from '../types/chat';
import { formatBytes, formatDuration, formatLastSeen } from '../lib/androidBridge';
import { useAnimatedPresence } from '../lib/useAnimatedPresence';
import { Avatar } from './Avatar';
import { QrCodeBox } from './QrCodeBox';

interface ChatInfoDrawerProps {
  open: boolean;
  chat: ChatRoom;
  currentUser: UserProfile;
  users: Record<string, UserProfile>;
  messages: Message[];
  onlineUserIds: Set<string>;
  onClose: () => void;
  onTogglePinChat: () => void;
  onSetMuteDuration: (mutedUntil: number | null) => void;
  onToggleArchiveChat: () => void;
  onToggleMarkUnread: () => void;
  onSetTimer: (seconds: number) => void;
  onStartDmWithUser: (userId: string) => void;
  onUpdateChatDetails: (payload: {
    title?: string;
    description?: string;
    adminOnlyPost?: boolean;
  }) => Promise<void>;
  onToggleModerator: (userId: string, makeMod: boolean) => Promise<void>;
  onLeaveChat: () => Promise<void>;
  onDeleteChat: () => Promise<void>;
  onToggleBlockUser: (userId: string, block: boolean) => Promise<void>;
  onReportTarget: (payload: {
    targetType: 'user' | 'group';
    targetId: string;
    targetLabel: string;
  }) => void;
}

const TIMER_OPTIONS = [
  { label: 'Mati', value: 0 },
  { label: '30 detik', value: 30 },
  { label: '5 menit', value: 300 },
  { label: '1 jam', value: 3600 },
  { label: '24 jam', value: 86400 },
];

export function ChatInfoDrawer({
  open,
  chat,
  currentUser,
  users,
  messages,
  onlineUserIds,
  onClose,
  onTogglePinChat,
  onSetMuteDuration,
  onToggleArchiveChat,
  onToggleMarkUnread,
  onSetTimer,
  onStartDmWithUser,
  onUpdateChatDetails,
  onToggleModerator,
  onLeaveChat,
  onDeleteChat,
  onToggleBlockUser,
  onReportTarget,
}: ChatInfoDrawerProps) {
  const [tab, setTab] = useState<'members' | 'media' | 'files' | 'voice'>(
    chat.type === 'dm' ? 'media' : 'members'
  );
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [showInviteQr, setShowInviteQr] = useState(false);
  const [editingGroup, setEditingGroup] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editTitle, setEditTitle] = useState(chat.title);
  const [editDesc, setEditDesc] = useState(chat.description);
  const [editAdminOnly, setEditAdminOnly] = useState(Boolean(chat.adminOnlyPost));
  const [savingGroup, setSavingGroup] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
    setEditingGroup(false);
    setShowInviteQr(false);
    setEditTitle(chat.title);
    setEditDesc(chat.description);
    setEditAdminOnly(Boolean(chat.adminOnlyPost));
    setTab(chat.type === 'dm' ? 'media' : 'members');
  }, [chat.id, chat.title, chat.description, chat.adminOnlyPost, chat.type, open]);

  const mediaMessages = useMemo(
    () =>
      messages.filter(
        (m) => m.attachment?.kind === 'image' || m.attachment?.kind === 'video'
      ),
    [messages]
  );

  const fileMessages = useMemo(
    () => messages.filter((m) => m.attachment?.kind === 'file'),
    [messages]
  );

  const voiceMessages = useMemo(
    () => messages.filter((m) => m.attachment?.kind === 'audio'),
    [messages]
  );

  const { mounted, closing } = useAnimatedPresence(open, 230);

  if (!mounted) return null;

  const isGroupAdmin = chat.adminIds.includes(currentUser.id);
  const isPeerOnline =
    chat.type === 'dm' && chat.peerUser ? onlineUserIds.has(chat.peerUser.id) : false;
  const isPeerBlocked =
    chat.type === 'dm' && chat.peerUser
      ? Boolean(currentUser.blockedUserIds?.includes(chat.peerUser.id))
      : false;

  const inviteUrl = chat.handle
    ? `${window.location.origin}/?join=${encodeURIComponent(chat.handle)}`
    : `${window.location.origin}/?chat=${encodeURIComponent(chat.id)}`;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedHandle(true);
      window.setTimeout(() => setCopiedHandle(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGroup(true);
    try {
      await onUpdateChatDetails({
        title: editTitle.trim(),
        description: editDesc.trim(),
        adminOnlyPost: editAdminOnly,
      });
      setEditingGroup(false);
    } finally {
      setSavingGroup(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        className={`lg:hidden fixed inset-0 z-30 bg-[#111111]/55 backdrop-blur-[1px] ${
          closing ? 'p5-backdrop-out pointer-events-none' : 'p5-backdrop-in'
        }`}
      />
      <aside
        className={`${
          closing ? 'p5-drawer-right-out pointer-events-none' : 'p5-drawer-right'
        } fixed inset-y-0 right-0 z-40 w-[336px] max-w-[90vw] lg:static lg:z-0 lg:w-[336px] shrink-0 bg-[#FFFDF9] dark:bg-[#161218] border-l-2 border-[#111111] dark:border-[#3D2933] flex flex-col brutal-shadow-lg lg:shadow-none`}
      >
      {/* Header */}
      <div className="pt-safe-2 pb-2 min-h-[62px] px-4 flex items-center justify-between border-b-2 border-[#111111] dark:border-[#3D2933] bg-[#F6F2EB] dark:bg-[#120E14] shrink-0">
        <span className="font-display font-extrabold text-lg tracking-wide text-[#111111] dark:text-[#F4EFE6]">
          {chat.type === 'group'
            ? 'Info Grup'
            : chat.type === 'channel'
              ? 'Info Channel'
              : 'Detail Kontak'}
        </span>
        <div className="flex items-center gap-1.5">
          {(chat.type === 'group' || chat.type === 'channel') && isGroupAdmin && (
            <button
              type="button"
              onClick={() => {
                setEditTitle(chat.title);
                setEditDesc(chat.description);
                setEditAdminOnly(Boolean(chat.adminOnlyPost));
                setEditingGroup((v) => !v);
              }}
              aria-label="Edit info grup"
              className="h-8 w-8 rounded-[4px] border-2 border-[#111111] dark:border-[#4A313C] bg-[#FFFDF9] dark:bg-[#221B24] text-[#111111] dark:text-[#F4EFE6] hover:bg-[#8B112B] hover:text-white brutal-press flex items-center justify-center"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel info"
            className="h-8 w-8 rounded-[4px] border-2 border-[#111111] dark:border-[#4A313C] bg-[#FFFDF9] dark:bg-[#221B24] text-[#111111] dark:text-[#F4EFE6] hover:bg-[#111111] hover:text-white brutal-press flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar">
        {/* Identity Summary */}
        <div className="p-5 flex flex-col items-center text-center border-b-2 border-[#111111]/15 dark:border-[#3D2933]">
          <Avatar
            name={chat.title}
            imageUrl={chat.avatarUrl}
            color={chat.avatarColor}
            chatType={chat.type}
            online={isPeerOnline}
            size="lg"
          />
          <h3 className="mt-3 font-display font-extrabold text-xl text-[#111111] dark:text-[#F4EFE6]">
            {chat.title}
          </h3>
          <p className="mt-0.5 text-xs text-[#6E6367] dark:text-[#B9A7AE]">
            {chat.type === 'dm' && chat.peerUser
              ? isPeerOnline
                ? 'Online'
                : formatLastSeen(chat.peerUser.lastSeen)
              : chat.type === 'group'
                ? `${chat.memberIds.length} anggota${chat.adminOnlyPost ? ' · Khusus admin' : ''}`
                : chat.type === 'channel'
                  ? `${chat.subscriberCount || chat.memberIds.length} pelanggan`
                  : 'Penyimpanan cloud pribadi'}
          </p>

          {chat.peerUser?.statusText && (
            <p className="mt-1 text-xs text-[#8B112B] dark:text-[#FF5C7A] font-semibold">
              {chat.peerUser.statusText}
            </p>
          )}

          {chat.description && (
            <p className="mt-2.5 text-xs text-[#52494D] dark:text-[#D5C3C9] leading-relaxed max-w-[260px]">
              {chat.description}
            </p>
          )}

          {(chat.handle || chat.peerUser?.username) && (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyInvite}
                className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#8B112B] dark:text-[#FF5C7A] hover:underline"
              >
                <span>@{chat.handle || chat.peerUser?.username}</span>
                {copiedHandle ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setShowInviteQr((v) => !v)}
                className="p-1.5 rounded-[4px] border-2 border-[#111111] dark:border-[#4A313C] text-[#111111] dark:text-[#F4EFE6] hover:bg-[#8B112B] hover:text-white"
                title="Tampilkan QR Undangan"
              >
                <QrCode className="w-4 h-4" />
              </button>
            </div>
          )}

          {showInviteQr && (
            <div className="mt-3">
              <QrCodeBox
                value={inviteUrl}
                label={`@${chat.handle || chat.peerUser?.username || chat.id}`}
                size={150}
              />
            </div>
          )}

          {/* Inline Group Edit Form */}
          {editingGroup && isGroupAdmin && (
            <form
              onSubmit={handleSaveGroup}
              className="mt-4 w-full text-left space-y-2.5 p-3 rounded-[4px] bg-[#F6F2EB] dark:bg-[#221B24] border-2 border-[#111111] dark:border-[#4A313C]"
            >
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
                placeholder="Nama grup / channel"
                className="w-full h-9 px-3 rounded-[4px] bg-[#FFFDF9] dark:bg-[#161218] border-2 border-[#111111] dark:border-[#4A313C] text-xs text-[#111111] dark:text-[#F4EFE6]"
              />
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                placeholder="Deskripsi"
                className="w-full p-2.5 rounded-[4px] bg-[#FFFDF9] dark:bg-[#161218] border-2 border-[#111111] dark:border-[#4A313C] text-xs text-[#111111] dark:text-[#F4EFE6] resize-none"
              />
              {chat.type === 'group' && (
                <label className="flex items-center gap-2 text-xs text-[#111111] dark:text-[#F4EFE6]">
                  <input
                    type="checkbox"
                    checked={editAdminOnly}
                    onChange={(e) => setEditAdminOnly(e.target.checked)}
                    className="accent-[#8B112B]"
                  />
                  <span>Hanya admin & moderator yang dapat mengirim pesan</span>
                </label>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingGroup(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#52494D] dark:text-[#B9A7AE]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingGroup}
                  className="px-3 py-1.5 rounded-[4px] bg-[#8B112B] text-[#FFFDF9] border-2 border-[#111111] text-xs font-bold brutal-shadow-sm brutal-press"
                >
                  {savingGroup ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Quick Actions */}
        <div className="p-3 space-y-1 border-b-2 border-[#111111]/15 dark:border-[#3D2933]">
          <button
            type="button"
            onClick={onTogglePinChat}
            className="w-full px-3 py-2 rounded-[4px] flex items-center justify-between text-xs font-medium text-[#111111] dark:text-[#F4EFE6] hover:bg-[#FDF2F4] dark:hover:bg-[#26161E]"
          >
            <span className="flex items-center gap-2.5">
              <Pin className="w-4 h-4 text-[#8B112B] dark:text-[#FF5C7A]" />
              <span>{chat.isPinnedByUser ? 'Lepas Sematan Chat' : 'Sematkan di Atas'}</span>
            </span>
            <span className="font-mono text-[11px] font-bold text-[#8B112B] dark:text-[#FF5C7A]">
              {chat.isPinnedByUser ? 'Aktif' : 'Mati'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleArchiveChat}
            className="w-full px-3 py-2 rounded-[4px] flex items-center justify-between text-xs font-medium text-[#111111] dark:text-[#F4EFE6] hover:bg-[#FDF2F4] dark:hover:bg-[#26161E]"
          >
            <span className="flex items-center gap-2.5">
              <Archive className="w-4 h-4 text-[#52494D] dark:text-[#B9A7AE]" />
              <span>{chat.isArchivedByUser ? 'Keluarkan dari Arsip' : 'Arsipkan Chat'}</span>
            </span>
            <span className="font-mono text-[11px] text-[#6E6367] dark:text-[#A9959C]">
              {chat.isArchivedByUser ? 'Diarsipkan' : 'Aktif'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleMarkUnread}
            className="w-full px-3 py-2 rounded-[4px] flex items-center justify-between text-xs font-medium text-[#111111] dark:text-[#F4EFE6] hover:bg-[#FDF2F4] dark:hover:bg-[#26161E]"
          >
            <span className="flex items-center gap-2.5">
              <MailOpen className="w-4 h-4 text-[#52494D] dark:text-[#B9A7AE]" />
              <span>Tandai Belum Dibaca</span>
            </span>
            <span className="font-mono text-[11px] font-bold text-[#8B112B] dark:text-[#FF5C7A]">
              {chat.markedUnreadByUser ? 'Ya' : 'Tidak'}
            </span>
          </button>

          {/* Timed Mute */}
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#111111] dark:text-[#F4EFE6] mb-2">
              {chat.isMutedByUser ? (
                <BellOff className="w-4 h-4 text-[#8B112B] dark:text-[#FF5C7A]" />
              ) : (
                <Bell className="w-4 h-4 text-[#52494D] dark:text-[#B9A7AE]" />
              )}
              <span>Notifikasi & Bisukan</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Aktif', value: null },
                { label: '1 jam', value: Date.now() + 3600_000 },
                { label: '8 jam', value: Date.now() + 8 * 3600_000 },
                { label: '24 jam', value: Date.now() + 24 * 3600_000 },
                { label: 'Selamanya', value: -1 },
              ].map((opt) => {
                const selected =
                  opt.value === null
                    ? !chat.isMutedByUser
                    : opt.value === -1
                      ? chat.mutedUntil === -1
                      : false;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => onSetMuteDuration(opt.value)}
                    className={`px-2.5 py-1 rounded-[4px] text-[11px] font-bold border-2 transition-colors ${
                      selected
                        ? 'bg-[#8B112B] text-[#FFFDF9] border-[#111111] dark:border-[#F4EFE6]'
                        : 'bg-[#F6F2EB] dark:bg-[#221B24] text-[#111111] dark:text-[#E7DDE0] border-[#111111]/25 dark:border-[#4A313C] hover:border-[#8B112B]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Self-Destruct Timer */}
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#111111] dark:text-[#F4EFE6] mb-2">
              <Timer className="w-4 h-4 text-amber-600" />
              <span>Hapus Pesan Otomatis</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TIMER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSetTimer(opt.value)}
                  className={`px-2.5 py-1 rounded-[4px] text-[11px] font-bold border-2 transition-colors ${
                    chat.selfDestructSec === opt.value
                      ? 'bg-[#8B112B] text-[#FFFDF9] border-[#111111] dark:border-[#F4EFE6]'
                      : 'bg-[#F6F2EB] dark:bg-[#221B24] text-[#111111] dark:text-[#E7DDE0] border-[#111111]/25 dark:border-[#4A313C] hover:border-[#8B112B]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b-2 border-[#111111] dark:border-[#3D2933] bg-[#F6F2EB] dark:bg-[#120E14] px-1">
          {chat.type === 'group' && (
            <button
              type="button"
              onClick={() => setTab('members')}
              className={`flex-1 py-2.5 text-xs font-display font-bold border-b-2 transition-colors ${
                tab === 'members'
                  ? 'border-[#8B112B] text-[#8B112B] dark:text-[#FF5C7A]'
                  : 'border-transparent text-[#52494D] dark:text-[#B9A7AE]'
              }`}
            >
              Anggota ({chat.memberIds.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab('media')}
            className={`flex-1 py-2.5 text-xs font-display font-bold border-b-2 transition-colors ${
              tab === 'media'
                ? 'border-[#8B112B] text-[#8B112B] dark:text-[#FF5C7A]'
                : 'border-transparent text-[#52494D] dark:text-[#B9A7AE]'
            }`}
          >
            Media ({mediaMessages.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('files')}
            className={`flex-1 py-2.5 text-xs font-display font-bold border-b-2 transition-colors ${
              tab === 'files'
                ? 'border-[#8B112B] text-[#8B112B] dark:text-[#FF5C7A]'
                : 'border-transparent text-[#52494D] dark:text-[#B9A7AE]'
            }`}
          >
            File ({fileMessages.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('voice')}
            className={`flex-1 py-2.5 text-xs font-display font-bold border-b-2 transition-colors ${
              tab === 'voice'
                ? 'border-[#8B112B] text-[#8B112B] dark:text-[#FF5C7A]'
                : 'border-transparent text-[#52494D] dark:text-[#B9A7AE]'
            }`}
          >
            Suara ({voiceMessages.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-3">
          {tab === 'members' && chat.type === 'group' && (
            <div className="space-y-1">
              {chat.memberIds.map((uid) => {
                const member = users[uid];
                if (!member) return null;
                const isAdmin = chat.adminIds.includes(uid);
                const isMod = chat.moderatorIds?.includes(uid);
                return (
                  <div
                    key={uid}
                    className="p-2 rounded-[4px] flex items-center gap-2.5 hover:bg-[#FDF2F4] dark:hover:bg-[#26161E]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (uid !== currentUser.id) onStartDmWithUser(uid);
                      }}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                    >
                      <Avatar
                        name={member.displayName}
                        imageUrl={member.avatarUrl}
                        color={member.avatarColor}
                        online={onlineUserIds.has(uid)}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[#111111] dark:text-[#F4EFE6] truncate">
                          {member.displayName}
                        </div>
                        <div className="text-[11px] text-[#6E6367] dark:text-[#A9959C] font-mono truncate">
                          @{member.username}
                        </div>
                      </div>
                    </button>
                    {isAdmin ? (
                      <span className="text-[10px] font-bold text-[#8B112B] dark:text-[#FF5C7A]">
                        Admin
                      </span>
                    ) : isMod ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                          Mod
                        </span>
                        {isGroupAdmin && (
                          <button
                            type="button"
                            onClick={() => void onToggleModerator(uid, false)}
                            title="Cabut Moderator"
                            className="p-1 text-[#6E6367] hover:text-[#8B112B]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      isGroupAdmin && (
                        <button
                          type="button"
                          onClick={() => void onToggleModerator(uid, true)}
                          title="Jadikan Moderator"
                          className="p-1 text-[#6E6367] hover:text-[#8B112B]"
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'media' && (
            <>
              {mediaMessages.length === 0 ? (
                <p className="text-xs text-[#6E6367] dark:text-[#A9959C] text-center py-8">
                  Belum ada foto atau video di percakapan ini.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {mediaMessages.map((m) => (
                    <a
                      key={m.id}
                      href={m.attachment?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-[4px] overflow-hidden border-2 border-[#111111] dark:border-[#4A313C] bg-[#F4EFE6] dark:bg-[#221B24] block"
                    >
                      {m.attachment?.kind === 'video' ? (
                        <video
                          src={m.attachment.url}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <img
                          src={m.attachment?.url}
                          alt={m.attachment?.name || 'Media'}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </a>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'files' && (
            <>
              {fileMessages.length === 0 ? (
                <p className="text-xs text-[#6E6367] dark:text-[#A9959C] text-center py-8">
                  Belum ada dokumen atau file di percakapan ini.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {fileMessages.map((m) => (
                    <a
                      key={m.id}
                      href={m.attachment?.url}
                      download={m.attachment?.name}
                      className="p-2.5 rounded-[4px] bg-[#F6F2EB] dark:bg-[#221B24] border-2 border-[#111111]/25 dark:border-[#4A313C] flex items-center gap-2.5 hover:border-[#8B112B]"
                    >
                      <FileText className="w-4 h-4 text-[#8B112B] dark:text-[#FF5C7A] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[#111111] dark:text-[#F4EFE6] truncate">
                          {m.attachment?.name}
                        </div>
                        <div className="font-mono text-[10px] text-[#6E6367] dark:text-[#A9959C]">
                          {formatBytes(m.attachment?.size || 0)}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'voice' && (
            <>
              {voiceMessages.length === 0 ? (
                <p className="text-xs text-[#6E6367] dark:text-[#A9959C] text-center py-8">
                  Belum ada pesan suara di percakapan ini.
                </p>
              ) : (
                <div className="space-y-2">
                  {voiceMessages.map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-[4px] bg-[#F6F2EB] dark:bg-[#221B24] border-2 border-[#111111]/25 dark:border-[#4A313C] flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Mic className="w-4 h-4 text-[#8B112B] dark:text-[#FF5C7A] shrink-0" />
                        <span className="text-xs font-medium text-[#111111] dark:text-[#F4EFE6] truncate">
                          {users[m.senderId]?.displayName || 'Pengguna'}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#6E6367] dark:text-[#A9959C] tabular-nums">
                        {formatDuration(m.attachment?.durationSec)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Safety Actions */}
        {chat.type !== 'saved' && (
          <div className="p-3 border-t-2 border-[#111111]/15 dark:border-[#3D2933] space-y-1">
            {chat.type === 'dm' && chat.peerUser && (
              <>
                <button
                  type="button"
                  onClick={() => void onToggleBlockUser(chat.peerUser!.id, !isPeerBlocked)}
                  className="w-full px-3 py-2 rounded-[4px] flex items-center gap-2.5 text-xs font-bold text-[#B91C1C] dark:text-[#FF6B81] hover:bg-[#FEF2F2] dark:hover:bg-[#2B1217]"
                >
                  <Ban className="w-4 h-4" />
                  <span>{isPeerBlocked ? 'Buka Blokir Pengguna' : 'Blokir Pengguna'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onReportTarget({
                      targetType: 'user',
                      targetId: chat.peerUser!.id,
                      targetLabel: `@${chat.peerUser!.username}`,
                    })
                  }
                  className="w-full px-3 py-2 rounded-[4px] flex items-center gap-2.5 text-xs font-bold text-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <Flag className="w-4 h-4" />
                  <span>Laporkan Pengguna</span>
                </button>
              </>
            )}

            {(chat.type === 'group' || chat.type === 'channel') && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onReportTarget({
                      targetType: 'group',
                      targetId: chat.id,
                      targetLabel: chat.title,
                    })
                  }
                  className="w-full px-3 py-2 rounded-[4px] flex items-center gap-2.5 text-xs font-bold text-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <Flag className="w-4 h-4" />
                  <span>Laporkan {chat.type === 'channel' ? 'Channel' : 'Grup'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void onLeaveChat()}
                  className="w-full px-3 py-2 rounded-[4px] flex items-center gap-2.5 text-xs font-bold text-[#B91C1C] dark:text-[#FF6B81] hover:bg-[#FEF2F2] dark:hover:bg-[#2B1217]"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar dari {chat.type === 'channel' ? 'Channel' : 'Grup'}</span>
                </button>
              </>
            )}
            {(chat.type === 'dm' ||
              isGroupAdmin ||
              currentUser.role === 'super_admin' ||
              currentUser.role === 'administrator') && (
              confirmDelete ? (
                <div className="p-2.5 rounded-[4px] border-2 border-[#B91C1C] bg-[#FEF2F2] dark:bg-[#2B1217] space-y-2">
                  <p className="text-[11px] font-bold text-[#B91C1C] dark:text-[#FF8DA6]">
                    Hapus permanen percakapan ini beserta semua pesannya?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDelete(false);
                        void onDeleteChat();
                      }}
                      className="flex-1 py-1.5 rounded-[4px] bg-[#B91C1C] text-white text-xs font-bold"
                    >
                      Ya, Hapus
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-1.5 rounded-[4px] border border-[#111111] dark:border-[#4A313C] text-xs font-bold"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full px-3 py-2 rounded-[4px] flex items-center gap-2.5 text-xs font-bold text-[#B91C1C] dark:text-[#FF6B81] hover:bg-[#FEF2F2] dark:hover:bg-[#2B1217]"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus Percakapan</span>
                </button>
              )
            )}
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
