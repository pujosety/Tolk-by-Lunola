import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BellOff,
  Camera,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Image as ImageIcon,
  Plus,
  Radio,
  SendHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import type { Attachment, ChatRoom, StoryItem, UserProfile } from '../types/chat';
import { formatTimeShort } from '../lib/androidBridge';
import { useAnimatedPresence, useRetainedValue } from '../lib/useAnimatedPresence';
import { Avatar } from './Avatar';
import { CameraCaptureModal } from './CameraCaptureModal';

const STORY_BG_COLORS = ['#8C0027', '#F59B00', '#0284C7', '#161B26', '#0F766E', '#6D28D9'];

interface UpdatesViewProps {
  stories: StoryItem[];
  channels: ChatRoom[];
  currentUser: UserProfile;
  users: Record<string, UserProfile>;
  onSelectChat: (chatId: string) => void;
  onOpenNewChannel: () => void;
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

export function UpdatesView({
  stories,
  channels,
  currentUser,
  users,
  onSelectChat,
  onOpenNewChannel,
  onCreateStory,
  onUploadStoryMedia,
  onViewStory,
  onDeleteStory,
  onMuteStoryAuthor,
  onReplyToStory,
}: UpdatesViewProps) {
  const [creating, setCreating] = useState(false);
  const [activeAuthorId, setActiveAuthorId] = useState<string | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  // Group stories by author
  const groupedByAuthor = useMemo(() => {
    const map = new Map<string, StoryItem[]>();
    for (const s of stories) {
      const list = map.get(s.userId) || [];
      list.push(s);
      map.set(s.userId, list);
    }
    const entries = Array.from(map.entries());
    // Put current user first if they have stories
    entries.sort((a, b) => {
      if (a[0] === currentUser.id) return -1;
      if (b[0] === currentUser.id) return 1;
      return b[1][0].createdAt - a[1][0].createdAt;
    });
    return entries;
  }, [stories, currentUser.id]);

  const activeAuthorStories = useMemo(() => {
    if (!activeAuthorId) return [];
    return groupedByAuthor.find(([uid]) => uid === activeAuthorId)?.[1] || [];
  }, [activeAuthorId, groupedByAuthor]);

  const activeStory = activeAuthorStories[activeStoryIndex] || null;
  const createPresence = useAnimatedPresence(creating, 200);
  const viewerRetained = useRetainedValue(activeStory, 200);

  useEffect(() => {
    if (activeStory && !activeStory.viewerIds.includes(currentUser.id)) {
      onViewStory(activeStory.id);
    }
  }, [activeStory, currentUser.id, onViewStory]);

  const myStories = useMemo(
    () => groupedByAuthor.find(([uid]) => uid === currentUser.id)?.[1] || [],
    [groupedByAuthor, currentUser.id]
  );
  const peerStoryGroups = useMemo(
    () => groupedByAuthor.filter(([uid]) => uid !== currentUser.id),
    [groupedByAuthor, currentUser.id]
  );
  const unseenGroups = useMemo(
    () =>
      peerStoryGroups.filter(([, items]) =>
        items.some((s) => !s.viewerIds.includes(currentUser.id))
      ),
    [peerStoryGroups, currentUser.id]
  );
  const seenGroups = useMemo(
    () =>
      peerStoryGroups.filter(([, items]) =>
        items.every((s) => s.viewerIds.includes(currentUser.id))
      ),
    [peerStoryGroups, currentUser.id]
  );

  const renderStoryRow = (uid: string, items: StoryItem[], isUnseen: boolean) => {
    const author = users[uid];
    if (!author) return null;
    const latest = items[items.length - 1];
    return (
      <button
        key={uid}
        type="button"
        onClick={() => {
          setActiveAuthorId(uid);
          setActiveStoryIndex(0);
        }}
        className="w-full px-3 py-2.5 rounded-2xl hover:bg-[#F5F7FA] dark:hover:bg-[#1E2738] flex items-center justify-between gap-3 text-left transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-[2.5px] rounded-2xl shrink-0 ${
              isUnseen
                ? 'bg-gradient-to-tr from-[#8C0027] via-[#F59B00] to-[#BEDEFF]'
                : 'bg-[#E6ECF2] dark:bg-[#324058]'
            }`}
          >
            <div className="p-[1.5px] rounded-[14px] bg-[#FFFFFF] dark:bg-[#171E2C]">
              <Avatar
                name={author.displayName}
                imageUrl={author.avatarUrl}
                color={author.avatarColor}
                size="sm"
              />
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#161B26] dark:text-[#F1F5F9] truncate">
              {author.displayName}
            </div>
            <div className="text-xs text-[#5A6578] dark:text-[#94A3B8]">
              {formatTimeShort(latest.createdAt)} · {items.length} pembaruan
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto thin-scrollbar p-3.5 pb-24 md:pb-4 space-y-5 bg-[#FFFFFF] dark:bg-[#171E2C]">
        {/* Status Section */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F1F5F9]">
              Status
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCreating(true)}
                aria-label="Buat status baru"
                className="px-3 py-1.5 rounded-xl bg-[#FFF2A7] dark:bg-[#2B2618] text-[#161B26] dark:text-[#FFF2A7] text-xs font-bold flex items-center gap-1.5 brutal-press"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Tambah Status</span>
              </button>
            </div>
          </div>

          {/* My Status Row */}
          <div className="p-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (myStories.length > 0) {
                  setActiveAuthorId(currentUser.id);
                  setActiveStoryIndex(0);
                } else {
                  setCreating(true);
                }
              }}
              className="flex items-center gap-3 min-w-0 flex-1 text-left"
            >
              <div className="relative shrink-0">
                <div
                  className={`p-[2.5px] rounded-2xl ${
                    myStories.length > 0
                      ? 'bg-gradient-to-tr from-[#8C0027] via-[#F59B00] to-[#BEDEFF]'
                      : 'bg-transparent'
                  }`}
                >
                  <div className="p-[1px] rounded-[14px] bg-[#F5F7FA] dark:bg-[#1E2738]">
                    <Avatar
                      name={currentUser.displayName}
                      imageUrl={currentUser.avatarUrl}
                      color={currentUser.avatarColor}
                      size="sm"
                    />
                  </div>
                </div>
                {myStories.length === 0 && (
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#8C0027] text-white border-2 border-[#F5F7FA] dark:border-[#1E2738] flex items-center justify-center">
                    <Plus className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#161B26] dark:text-[#F1F5F9]">
                  Status saya
                </div>
                <div className="text-xs text-[#5A6578] dark:text-[#94A3B8] truncate">
                  {myStories.length > 0
                    ? `${myStories.length} aktif · ${formatTimeShort(myStories[myStories.length - 1].createdAt)}`
                    : 'Ketuk untuk tambah pembaruan 24 jam'}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCreating(true)}
              aria-label="Tulis status baru"
              className="h-9 w-9 rounded-xl bg-[#FFFFFF] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-[#8C0027] dark:text-[#F47296] hover:bg-[#8C0027] hover:text-white flex items-center justify-center brutal-press shrink-0"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          {unseenGroups.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#5A6578] dark:text-[#94A3B8]">
                Pembaruan terbaru
              </div>
              {unseenGroups.map(([uid, items]) => renderStoryRow(uid, items, true))}
            </div>
          )}

          {seenGroups.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#5A6578] dark:text-[#94A3B8]">
                Telah dilihat
              </div>
              {seenGroups.map(([uid, items]) => renderStoryRow(uid, items, false))}
            </div>
          )}

          {peerStoryGroups.length === 0 && (
            <p className="px-1 py-2 text-xs text-[#5A6578] dark:text-[#94A3B8]">
              Belum ada pembaruan status dari kontakmu.
            </p>
          )}
        </section>

        {/* Channels Section */}
        <section className="space-y-2.5 pt-2 border-t border-[#E6ECF2] dark:border-[#2A364B]">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F1F5F9]">
              Saluran
            </h2>
            <button
              type="button"
              onClick={onOpenNewChannel}
              className="px-3 py-1.5 rounded-xl bg-[#EAF4FF] dark:bg-[#1B2436] text-[#8C0027] dark:text-[#BEDEFF] text-xs font-bold flex items-center gap-1.5 brutal-press"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Buat Saluran</span>
            </button>
          </div>

          {channels.length === 0 ? (
            <p className="px-1 py-2 text-xs text-[#5A6578] dark:text-[#94A3B8]">
              Belum ada saluran yang diikuti.
            </p>
          ) : (
            <div className="space-y-1">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onSelectChat(ch.id)}
                  className="w-full px-3 py-2.5 rounded-2xl hover:bg-[#F5F7FA] dark:hover:bg-[#1E2738] flex items-center justify-between gap-3 text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={ch.title}
                      imageUrl={ch.avatarUrl}
                      color={ch.avatarColor}
                      chatType="channel"
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#161B26] dark:text-[#F1F5F9] truncate">
                        {ch.title}
                      </div>
                      <div className="text-xs text-[#5A6578] dark:text-[#94A3B8] truncate">
                        {ch.lastMessage?.text || ch.description || `${ch.memberIds.length} pengikut`}
                      </div>
                    </div>
                  </div>
                  {ch.unreadCount > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#8C0027] text-white text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                      {ch.unreadCount > 99 ? '99+' : ch.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Create Story Modal */}
      {createPresence.mounted && (
        <CreateStoryModal
          closing={createPresence.closing}
          users={Object.values(users).filter((u) => u.id !== currentUser.id)}
          onClose={() => setCreating(false)}
          onUploadMedia={onUploadStoryMedia}
          onSubmit={async (payload) => {
            await onCreateStory(payload);
            setCreating(false);
          }}
        />
      )}

      {/* Full-Screen Story Viewer */}
      {viewerRetained.renderedValue && (
        <StoryViewerModal
          closing={viewerRetained.closing}
          story={viewerRetained.renderedValue}
          author={users[viewerRetained.renderedValue.userId]}
          users={users}
          isOwn={viewerRetained.renderedValue.userId === currentUser.id}
          index={activeStoryIndex}
          total={Math.max(1, activeAuthorStories.length)}
          onPrev={() => setActiveStoryIndex((i) => Math.max(0, i - 1))}
          onNext={() => {
            if (activeStoryIndex + 1 < activeAuthorStories.length) {
              setActiveStoryIndex((i) => i + 1);
            } else {
              setActiveAuthorId(null);
            }
          }}
          onClose={() => setActiveAuthorId(null)}
          onDelete={async () => {
            const target = viewerRetained.renderedValue;
            if (!target) return;
            await onDeleteStory(target.id);
            setActiveAuthorId(null);
          }}
          onMuteAuthor={async () => {
            const target = viewerRetained.renderedValue;
            if (!target) return;
            await onMuteStoryAuthor(target.userId);
            setActiveAuthorId(null);
          }}
          onReply={async (text) => {
            const target = viewerRetained.renderedValue;
            if (!target) return;
            await onReplyToStory(target, text);
            setActiveAuthorId(null);
          }}
        />
      )}
    </>
  );
}

function CreateStoryModal({
  closing,
  users,
  onClose,
  onUploadMedia,
  onSubmit,
}: {
  closing: boolean;
  users: UserProfile[];
  onClose: () => void;
  onUploadMedia: (file: File, onProgress?: (pct: number) => void) => Promise<Attachment>;
  onSubmit: (payload: {
    kind: 'text' | 'image' | 'video';
    text: string;
    bgColor: string;
    mediaUrl?: string | null;
    privacy: 'everyone' | 'selected' | 'except';
    allowedUserIds?: string[];
    excludedUserIds?: string[];
  }) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(STORY_BG_COLORS[0]);
  const [media, setMedia] = useState<Attachment | null>(null);
  const [privacy, setPrivacy] = useState<'everyone' | 'selected' | 'except'>('everyone');
  const [pickedUserIds, setPickedUserIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const uploadPickedFile = async (file: File) => {
    setUploading(true);
    setUploadPct(5);
    setError('');
    try {
      const att = await onUploadMedia(file, (pct) => setUploadPct(pct));
      setMedia(att);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah media status');
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await uploadPickedFile(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !media) {
      setError('Tulis teks status atau pilih foto/video.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const kind: 'text' | 'image' | 'video' =
        media?.kind === 'video' ? 'video' : media?.kind === 'image' ? 'image' : 'text';
      await onSubmit({
        kind,
        text: text.trim(),
        bgColor,
        mediaUrl: media?.url || null,
        privacy,
        allowedUserIds: privacy === 'selected' ? pickedUserIds : [],
        excludedUserIds: privacy === 'except' ? pickedUserIds : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menerbitkan status');
      setSaving(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-stretch md:items-center justify-center p-0 md:p-4 ${closing ? 'pointer-events-none' : ''}`}>
      <div
        className={`${closing ? 'p5-backdrop-out' : 'p5-backdrop-in'} hidden md:block fixed inset-0 bg-[#0F141E]/65 backdrop-blur-[2px]`}
        onClick={onClose}
      />
      <form
        onSubmit={handleSave}
        className={`${
          closing ? 'p5-modal-out' : 'p5-modal-impact'
        } relative z-10 w-full h-full md:h-auto md:max-w-md flex flex-col rounded-none md:rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] md:border md:border-[#E6ECF2] md:dark:border-[#2A364B] brutal-shadow-lg overflow-hidden`}
      >
        <div className="pt-safe-2 md:pt-3.5 pb-3 px-4 md:px-5 flex items-center justify-between border-b border-[#E6ECF2] dark:border-[#2A364B] bg-[#FFFFFF] dark:bg-[#171E2C] shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              aria-label="Kembali"
              className="md:hidden h-9 w-9 rounded-2xl border border-[#E6ECF2] dark:border-[#2A364B] bg-[#F5F7FA] dark:bg-[#232D40] flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="font-display font-extrabold text-lg md:text-xl text-[#161B26] dark:text-[#F5F7FA]">
              Bikin Story 24 Jam
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="hidden md:flex h-8 w-8 rounded-xl border border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 p-4 md:p-5 space-y-4 overflow-y-auto thin-scrollbar">
          {/* Preview Canvas */}
          <div
            className="relative rounded-xl min-h-[180px] p-5 flex flex-col items-center justify-center text-center overflow-hidden border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm"
            style={{ backgroundColor: bgColor }}
          >
            {media?.kind === 'image' && (
              <img
                src={media.url}
                alt="Preview status"
                className="max-h-56 rounded-xl border border-white/80 object-contain mb-2"
              />
            )}
            {media?.kind === 'video' && (
              <video
                src={media.url}
                controls
                className="max-h-56 rounded-xl border border-white/80 mb-2"
              />
            )}
            <textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Bagikan momen atau pembaruan (kedaluwarsa 24 jam)..."
              className="w-full bg-transparent text-white placeholder:text-white/75 text-center font-display text-lg font-bold resize-none focus:outline-none"
            />
          </div>

          {/* Background Color + Media Upload */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {STORY_BG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBgColor(c)}
                  aria-label={`Warna latar ${c}`}
                  className={`w-6 h-6 rounded-xl border border-[#E6ECF2] dark:border-[#F5F7FA] transition-transform ${
                    bgColor === c ? 'scale-115 ring-2 ring-[#8C0027] ring-offset-2 dark:ring-offset-[#171E2C]' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/mp4,video/webm"
              className="hidden"
              onChange={handleFile}
            />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={uploading}
                onClick={() => setCameraOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#BEDEFF] dark:border-[#324058] bg-[#EAF4FF] dark:bg-[#232D40] text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-press"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Kamera</span>
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-press"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>
                  {uploading ? `${uploadPct}%` : media ? 'Ganti' : 'Galeri'}
                </span>
              </button>
            </div>
          </div>
          {uploading && (
            <div className="h-2 w-full rounded-full bg-[#E6ECF2] dark:bg-[#2A364B] overflow-hidden">
              <div
                className="h-full bg-[#8C0027] transition-all duration-150"
                style={{ width: `${Math.max(8, uploadPct)}%` }}
              />
            </div>
          )}

          {/* Story Privacy Selector */}
          <div>
            <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1.5">
              Siapa yang dapat melihat status ini
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058]">
              {[
                { key: 'everyone' as const, label: 'Semua Kontak' },
                { key: 'selected' as const, label: 'Kontak Tertentu' },
                { key: 'except' as const, label: 'Kecualikan' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setPrivacy(opt.key);
                    setPickedUserIds([]);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors ${
                    privacy === opt.key
                      ? 'bg-[#8C0027] text-white'
                      : 'text-[#5A6578] dark:text-[#94A3B8] hover:text-[#161B26] dark:hover:text-[#F5F7FA]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {privacy !== 'everyone' && (
              <div className="mt-2 max-h-28 overflow-y-auto thin-scrollbar border border-[#E6ECF2] dark:border-[#324058] rounded-xl p-2 space-y-1 bg-[#FFFFFF] dark:bg-[#1E2738]">
                {users.map((u) => {
                  const active = pickedUserIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setPickedUserIds((prev) =>
                          prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                        )
                      }
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                        active
                          ? 'bg-[#EAF4FF] dark:bg-[#1B2436] text-[#8C0027] dark:text-[#F47296] font-bold'
                          : 'text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#F5F7FA] dark:hover:bg-[#232D40]'
                      }`}
                    >
                      <span>{u.displayName}</span>
                      <span className="font-mono opacity-75">@{u.username}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={saving || uploading}
            className="w-full h-11 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm brutal-press text-white text-sm font-bold transition-colors disabled:opacity-60"
          >
            {saving ? 'Menerbitkan...' : 'Terbitkan Status'}
          </button>
        </div>
      </form>

      <CameraCaptureModal
        open={cameraOpen}
        mode="photo"
        onClose={() => setCameraOpen(false)}
        onCapturePhoto={(file) => void uploadPickedFile(file)}
      />
    </div>
  );
}

function StoryViewerModal({
  closing,
  story,
  author,
  users,
  isOwn,
  index,
  total,
  onPrev,
  onNext,
  onClose,
  onDelete,
  onMuteAuthor,
  onReply,
}: {
  closing: boolean;
  story: StoryItem;
  author?: UserProfile;
  users: Record<string, UserProfile>;
  isOwn: boolean;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onMuteAuthor: () => Promise<void>;
  onReply: (text: string) => Promise<void>;
}) {
  const [replyText, setReplyText] = useState('');
  const [showViewers, setShowViewers] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const viewersPresence = useAnimatedPresence(showViewers, 175);

  useEffect(() => {
    setProgressPct(0);
    setShowViewers(false);
  }, [story.id]);

  useEffect(() => {
    if (story.kind === 'video' || paused || showViewers || replyText.trim().length > 0) return;
    const durationMs = 5500;
    const stepMs = 80;
    const timer = window.setInterval(() => {
      setProgressPct((prev) => {
        const next = prev + (stepMs / durationMs) * 100;
        if (next >= 100) {
          window.clearInterval(timer);
          onNext();
          return 100;
        }
        return next;
      });
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [story.id, story.kind, paused, showViewers, replyText, onNext]);

  const viewers = story.viewerIds
    .filter((id) => id !== story.userId)
    .map((id) => users[id])
    .filter(Boolean);

  return (
    <div
      className={`${
        closing ? 'p5-backdrop-out pointer-events-none' : 'p5-backdrop-in'
      } fixed inset-0 z-50 bg-[#0F141E]/95 flex items-center justify-center p-0 sm:p-3`}
    >
      <div
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
        className={`${
          closing ? 'p5-modal-out' : 'p5-modal-impact'
        } relative w-full h-full sm:max-w-md sm:h-[82dvh] sm:max-h-[720px] rounded-none sm:rounded-3xl border-0 sm:border sm:border-white/20 overflow-hidden flex flex-col justify-between brutal-shadow-lg`}
        style={{ backgroundColor: story.bgColor }}
      >
        {/* Top Progress Bars & Author Info */}
        <div className="pt-safe-3 px-4 pb-4 bg-gradient-to-b from-black/75 to-transparent z-10">
          <div className="flex gap-1.5 mb-3">
            {Array.from({ length: total }).map((_, idx) => {
              const width =
                idx < index
                  ? '100%'
                  : idx === index
                    ? story.kind === 'video'
                      ? '100%'
                      : `${progressPct}%`
                    : '0%';
              return (
                <div key={idx} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
                  <div
                    className="h-full bg-white transition-[width] duration-75 linear"
                    style={{ width }}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar
                name={author?.displayName || 'Pengguna'}
                imageUrl={author?.avatarUrl}
                color={author?.avatarColor}
                size="sm"
              />
              <div className="min-w-0 text-white">
                <div className="text-sm font-bold truncate">
                  {author?.displayName || 'Pengguna'}
                </div>
                <div className="text-[11px] text-white/80 font-mono">
                  {formatTimeShort(story.createdAt)} · Privasi:{' '}
                  {story.privacy === 'everyone'
                    ? 'Semua'
                    : story.privacy === 'selected'
                    ? 'Tertentu'
                    : 'Terkecuali'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {isOwn ? (
                <button
                  type="button"
                  onClick={onDelete}
                  aria-label="Hapus status"
                  className="h-8 w-8 rounded-xl bg-black/45 border border-white/50 text-white hover:bg-[#8C0027] flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onMuteAuthor}
                  aria-label="Bisukan status pengguna ini"
                  title="Bisukan status"
                  className="h-8 w-8 rounded-xl bg-black/45 border border-white/50 text-white hover:bg-[#8C0027] flex items-center justify-center"
                >
                  <BellOff className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup status"
                className="h-8 w-8 rounded-xl bg-black/45 border border-white/50 text-white hover:bg-[#8C0027] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Center Content + Navigation */}
        <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center">
          {index > 0 && (
            <button
              type="button"
              onClick={onPrev}
              aria-label="Status sebelumnya"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-black/50 hover:bg-[#8C0027] border border-white/60 text-white flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            aria-label="Status berikutnya"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-black/50 hover:bg-[#8C0027] border border-white/60 text-white flex items-center justify-center"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {story.mediaUrl && story.kind === 'image' && (
            <img
              src={story.mediaUrl}
              alt="Status media"
              className="max-h-[45vh] rounded-xl border border-white object-contain mb-4 brutal-shadow-sm"
            />
          )}
          {story.mediaUrl && story.kind === 'video' && (
            <video
              src={story.mediaUrl}
              controls
              autoPlay
              className="max-h-[45vh] rounded-xl border border-white mb-4 brutal-shadow-sm"
            />
          )}
          {story.text && (
            <p className="text-white font-display text-2xl font-bold leading-snug drop-shadow-sm">
              {story.text}
            </p>
          )}
        </div>

        {/* Bottom Action: Viewers (own) or Reply via Chat (others) */}
        <div className="p-4 bg-gradient-to-t from-black/80 to-transparent">
          {isOwn ? (
            <div>
              <button
                type="button"
                onClick={() => setShowViewers((p) => !p)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-black/55 hover:bg-[#8C0027] border border-white/70 text-white text-xs font-bold backdrop-blur-sm"
              >
                <Eye className="w-4 h-4" />
                <span className="font-mono tabular-nums">{viewers.length}</span>
                <span>Penonton</span>
              </button>
              {viewersPresence.mounted && (
                <div
                  className={`${
                    viewersPresence.closing ? 'p5-panel-out pointer-events-none' : 'p5-panel-reveal'
                  } mt-2 p-3 rounded-xl bg-[#171E2C] border border-[#F5F7FA] text-white max-h-32 overflow-y-auto space-y-1.5 text-xs`}
                >
                  {viewers.length === 0 ? (
                    <div className="text-white/60 text-center">Belum ada penonton lain.</div>
                  ) : (
                    viewers.map((v) => (
                      <div key={v.id} className="flex items-center justify-between">
                        <span>{v.displayName}</span>
                        <span className="font-mono text-[#F47296]">@{v.username}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!replyText.trim()) return;
                await onReply(replyText.trim());
                setReplyText('');
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Balas status ${author?.displayName.split(' ')[0] || ''}...`}
                className="flex-1 h-11 px-4 rounded-xl bg-black/55 border border-white/70 backdrop-blur-md text-sm text-white placeholder:text-white/70 focus:outline-none focus:border-white"
              />
              <button
                type="submit"
                aria-label="Kirim balasan status"
                className="w-11 h-11 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] border border-white text-white flex items-center justify-center shrink-0 brutal-press"
              >
                <SendHorizontal className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
