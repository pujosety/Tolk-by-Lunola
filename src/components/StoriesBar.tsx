import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  AtSign,
  BellOff,
  Camera,
  ChevronUp,
  Edit3,
  Eye,
  Heart,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Play,
  Plus,
  Radio,
  Repeat2,
  SendHorizontal,
  Share2,
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
    mentionedUserIds?: string[];
    resharedFrom?: {
      storyId: string;
      userId: string;
      displayName: string;
      username: string;
    } | null;
  }) => Promise<void>;
  onUploadStoryMedia: (file: File, onProgress?: (pct: number) => void) => Promise<Attachment>;
  onViewStory: (storyId: string) => void;
  onDeleteStory: (storyId: string) => Promise<void>;
  onMuteStoryAuthor: (authorId: string) => Promise<void>;
  onReplyToStory: (story: StoryItem, text: string) => Promise<void>;
  onLikeStory: (storyId: string) => Promise<void>;
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
  onLikeStory,
}: UpdatesViewProps) {
  const [creating, setCreating] = useState(false);
  const [reshareSource, setReshareSource] = useState<StoryItem | null>(null);
  const [showMyStatusList, setShowMyStatusList] = useState(false);
  const [activeAuthorId, setActiveAuthorId] = useState<string | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [openViewersOnMount, setOpenViewersOnMount] = useState(false);

  // Group stories by author (chronological oldest -> newest for playback; latest is last item)
  const groupedByAuthor = useMemo(() => {
    const map = new Map<string, StoryItem[]>();
    for (const s of stories) {
      const list = map.get(s.userId) || [];
      list.push(s);
      map.set(s.userId, list);
    }
    const entries = Array.from(map.entries());
    for (const [, list] of entries) {
      list.sort((a, b) => a.createdAt - b.createdAt);
    }
    // Put current user first if they have stories
    entries.sort((a, b) => {
      if (a[0] === currentUser.id) return -1;
      if (b[0] === currentUser.id) return 1;
      const aLatest = a[1][a[1].length - 1]?.createdAt || 0;
      const bLatest = b[1][b[1].length - 1]?.createdAt || 0;
      return bLatest - aLatest;
    });
    return entries;
  }, [stories, currentUser.id]);

  const activeAuthorStories = useMemo(() => {
    if (!activeAuthorId) return [];
    return groupedByAuthor.find(([uid]) => uid === activeAuthorId)?.[1] || [];
  }, [activeAuthorId, groupedByAuthor]);

  const activeStory = activeAuthorStories[activeStoryIndex] || null;
  const createPresence = useAnimatedPresence(creating, 200);
  const myStatusPresence = useAnimatedPresence(showMyStatusList, 200);
  const viewerRetained = useRetainedValue(activeStory, 200);

  useEffect(() => {
    if (
      activeStory &&
      (!activeStory.viewerIds.includes(currentUser.id) || !activeStory.viewerTimes?.[currentUser.id])
    ) {
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

  const orderedPeerGroups = useMemo(
    () => [...unseenGroups, ...seenGroups],
    [unseenGroups, seenGroups]
  );

  const renderStoryCard = (uid: string, items: StoryItem[], isUnseen: boolean) => {
    const author = users[uid];
    if (!author) return null;
    const latest = items[items.length - 1];
    return (
      <button
        key={uid}
        type="button"
        onClick={() => {
          setOpenViewersOnMount(false);
          setActiveAuthorId(uid);
          setActiveStoryIndex(0);
        }}
        style={!latest.mediaUrl ? { backgroundColor: latest.bgColor } : undefined}
        className="relative w-[116px] h-[168px] shrink-0 snap-start rounded-2xl overflow-hidden bg-[#171E2C] text-left group brutal-press shadow-[0_4px_16px_rgba(15,20,30,0.10)]"
      >
        {/* Background Media / Text Preview */}
        {latest.mediaUrl && latest.kind === 'image' ? (
          <StoryImageWithLoader
            src={latest.mediaUrl}
            alt={author.displayName}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            spinnerSize="sm"
          />
        ) : latest.mediaUrl && latest.kind === 'video' ? (
          <>
            <video
              src={latest.mediaUrl}
              muted
              playsInline
              preload="metadata"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center z-10">
              <Play className="w-3 h-3 fill-white" />
            </span>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-2.5 text-center">
            <p className="text-[11px] font-display font-bold text-white/95 line-clamp-4 leading-snug">
              {latest.text}
            </p>
          </div>
        )}

        {/* Scrims */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/80 z-10" />

        {/* Top-Left Avatar with Status Ring */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5">
          <div
            className={`p-[2px] rounded-full ${
              isUnseen
                ? 'bg-gradient-to-tr from-[#8C0027] via-[#F59B00] to-[#BEDEFF]'
                : 'bg-white/45'
            }`}
          >
            <div className="p-[1.5px] rounded-full bg-[#171E2C]">
              <Avatar
                name={author.displayName}
                imageUrl={author.avatarUrl}
                color={author.avatarColor}
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* Multi-story count pill */}
        {items.length > 1 && latest.kind !== 'video' && (
          <span className="absolute top-2.5 right-2.5 z-20 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-mono font-bold text-white">
            {items.length}
          </span>
        )}

        {/* Bottom Author Name & Time */}
        <div className="absolute inset-x-2.5 bottom-2.5 z-20">
          <div className="text-xs font-bold text-white truncate drop-shadow-sm">
            {author.displayName}
          </div>
          <div className="text-[10px] text-white/75 font-mono truncate">
            {formatTimeShort(latest.createdAt)}
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

          {/* WA-style Horizontal Swipeable Status Cards */}
          <div
            data-no-tab-swipe="true"
            className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory thin-scrollbar pb-1"
          >
            {/* My Status Card */}
            {(() => {
              const latestOwn = myStories[myStories.length - 1];
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (myStories.length > 0) {
                      setShowMyStatusList(true);
                    } else {
                      setCreating(true);
                    }
                  }}
                  style={
                    latestOwn && !latestOwn.mediaUrl
                      ? { backgroundColor: latestOwn.bgColor }
                      : undefined
                  }
                  className="relative w-[116px] h-[168px] shrink-0 snap-start rounded-2xl overflow-hidden bg-[#F5F7FA] dark:bg-[#1E2738] text-left group brutal-press shadow-[0_4px_16px_rgba(15,20,30,0.08)]"
                >
                  {latestOwn ? (
                    <>
                      {latestOwn.mediaUrl && latestOwn.kind === 'image' ? (
                        <StoryImageWithLoader
                          src={latestOwn.mediaUrl}
                          alt="Status saya"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          spinnerSize="sm"
                        />
                      ) : latestOwn.mediaUrl && latestOwn.kind === 'video' ? (
                        <video
                          src={latestOwn.mediaUrl}
                          muted
                          playsInline
                          preload="metadata"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center px-2.5 text-center">
                          <p className="text-[11px] font-display font-bold text-white/95 line-clamp-4 leading-snug">
                            {latestOwn.text}
                          </p>
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/80 z-10" />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-b from-[#FFFFFF] to-[#EEF2F7] dark:from-[#1E2738] dark:to-[#151C28]" />
                  )}

                  {/* Top-Left Avatar */}
                  <div className="absolute top-2.5 left-2.5 z-20">
                    <div className="relative">
                      <div
                        className={`p-[2px] rounded-full ${
                          myStories.length > 0
                            ? 'bg-gradient-to-tr from-[#8C0027] via-[#F59B00] to-[#BEDEFF]'
                            : 'bg-transparent'
                        }`}
                      >
                        <div className="p-[1.5px] rounded-full bg-[#FFFFFF] dark:bg-[#1E2738]">
                          <Avatar
                            name={currentUser.displayName}
                            imageUrl={currentUser.avatarUrl}
                            color={currentUser.avatarColor}
                            size="sm"
                          />
                        </div>
                      </div>
                      {myStories.length === 0 && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#8C0027] text-white border-2 border-[#FFFFFF] dark:border-[#1E2738] flex items-center justify-center">
                          <Plus className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  {myStories.length > 1 && (
                    <span className="absolute top-2.5 right-2.5 z-20 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-mono font-bold text-white">
                      {myStories.length}
                    </span>
                  )}

                  <div className="absolute inset-x-2.5 bottom-2.5 z-20">
                    <div
                      className={`text-xs font-bold truncate ${
                        latestOwn ? 'text-white drop-shadow-sm' : 'text-[#161B26] dark:text-[#F1F5F9]'
                      }`}
                    >
                      Status saya
                    </div>
                    <div
                      className={`text-[10px] truncate ${
                        latestOwn ? 'text-white/80 font-mono' : 'text-[#5A6578] dark:text-[#94A3B8]'
                      }`}
                    >
                      {myStories.length > 0
                        ? `${myStories.length} aktif · Ketuk kelola`
                        : 'Tambah status'}
                    </div>
                  </div>
                </button>
              );
            })()}

            {/* Peer Status Cards (Unseen first, then Seen) */}
            {orderedPeerGroups.map(([uid, items]) => {
              const isUnseen = items.some((s) => !s.viewerIds.includes(currentUser.id));
              return renderStoryCard(uid, items, isUnseen);
            })}
          </div>

          {peerStoryGroups.length === 0 && (
            <p className="px-1 py-1 text-xs text-[#5A6578] dark:text-[#94A3B8]">
              Geser kartu status atau tambah pembaruan 24 jam.
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

      {/* Create Story Modal (portaled above all headers/navbars) */}
      {createPresence.mounted &&
        createPortal(
          <CreateStoryModal
            closing={createPresence.closing}
            users={Object.values(users).filter((u) => u.id !== currentUser.id)}
            initialReshare={reshareSource}
            initialAuthor={reshareSource ? users[reshareSource.userId] : undefined}
            onClose={() => {
              setCreating(false);
              setReshareSource(null);
            }}
            onUploadMedia={onUploadStoryMedia}
            onSubmit={async (payload) => {
              await onCreateStory(payload);
              setCreating(false);
              setReshareSource(null);
            }}
          />,
          document.body
        )}

      {/* My Status List Modal (WA-style list with stats & 3-dot delete/share) */}
      {myStatusPresence.mounted &&
        createPortal(
          <MyStatusModal
            closing={myStatusPresence.closing}
            stories={myStories}
            currentUserId={currentUser.id}
            onClose={() => setShowMyStatusList(false)}
            onAddNew={() => {
              setShowMyStatusList(false);
              setCreating(true);
            }}
            onOpenStory={(idx, openViewers = false) => {
              setShowMyStatusList(false);
              setOpenViewersOnMount(openViewers);
              setActiveAuthorId(currentUser.id);
              setActiveStoryIndex(idx);
            }}
            onShareStory={(s) => {
              setShowMyStatusList(false);
              setReshareSource(s);
              setCreating(true);
            }}
            onDeleteStory={onDeleteStory}
          />,
          document.body
        )}

      {/* Full-Screen Story Viewer (portaled above all headers/navbars) */}
      {viewerRetained.renderedValue &&
        createPortal(
          <StoryViewerModal
            closing={viewerRetained.closing}
            story={viewerRetained.renderedValue}
            nextStory={activeAuthorStories[activeStoryIndex + 1] || null}
            author={users[viewerRetained.renderedValue.userId]}
            users={users}
            currentUserId={currentUser.id}
            isOwn={viewerRetained.renderedValue.userId === currentUser.id}
            initialShowViewers={openViewersOnMount}
            index={activeStoryIndex}
            total={Math.max(1, activeAuthorStories.length)}
            onPrev={() => {
              setOpenViewersOnMount(false);
              setActiveStoryIndex((i) => Math.max(0, i - 1));
            }}
            onNext={() => {
              setOpenViewersOnMount(false);
              if (activeStoryIndex + 1 < activeAuthorStories.length) {
                setActiveStoryIndex((i) => i + 1);
              } else {
                setActiveAuthorId(null);
              }
            }}
            onClose={() => {
              setOpenViewersOnMount(false);
              setActiveAuthorId(null);
            }}
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
            onReshare={() => {
              const target = viewerRetained.renderedValue;
              if (!target) return;
              setActiveAuthorId(null);
              setReshareSource(target);
              setCreating(true);
            }}
            onReply={async (text) => {
              const target = viewerRetained.renderedValue;
              if (!target) return;
              await onReplyToStory(target, text);
              setActiveAuthorId(null);
            }}
            onLike={async () => {
              const target = viewerRetained.renderedValue;
              if (!target) return;
              await onLikeStory(target.id);
            }}
          />,
          document.body
        )}
    </>
  );
}

function CreateStoryModal({
  closing,
  users,
  initialReshare,
  initialAuthor,
  onClose,
  onUploadMedia,
  onSubmit,
}: {
  closing: boolean;
  users: UserProfile[];
  initialReshare?: StoryItem | null;
  initialAuthor?: UserProfile;
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
    mentionedUserIds?: string[];
    resharedFrom?: {
      storyId: string;
      userId: string;
      displayName: string;
      username: string;
    } | null;
  }) => Promise<void>;
}) {
  const [text, setText] = useState(initialReshare?.text || '');
  const [bgColor, setBgColor] = useState(initialReshare?.bgColor || STORY_BG_COLORS[0]);
  const [media, setMedia] = useState<Attachment | null>(
    initialReshare?.mediaUrl
      ? {
          id: `reshare_${initialReshare.id}`,
          url: initialReshare.mediaUrl,
          name: 'reshare-media',
          mimeType: initialReshare.kind === 'video' ? 'video/mp4' : 'image/jpeg',
          size: 0,
          kind: initialReshare.kind === 'video' ? 'video' : 'image',
        }
      : null
  );
  const [privacy, setPrivacy] = useState<'everyone' | 'selected' | 'except'>('everyone');
  const [pickedUserIds, setPickedUserIds] = useState<string[]>([]);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>(
    initialReshare ? [initialReshare.userId] : []
  );
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
      const inlineMatches = Array.from(text.matchAll(/@([a-zA-Z0-9_]{3,24})/g)).map((m) =>
        m[1].toLowerCase()
      );
      const autoMentionIds = users
        .filter((u) => inlineMatches.includes(u.username.toLowerCase()))
        .map((u) => u.id);
      const finalMentions = Array.from(new Set([...mentionedUserIds, ...autoMentionIds]));

      await onSubmit({
        kind,
        text: text.trim(),
        bgColor,
        mediaUrl: media?.url || null,
        privacy,
        allowedUserIds: privacy === 'selected' ? pickedUserIds : [],
        excludedUserIds: privacy === 'except' ? pickedUserIds : [],
        mentionedUserIds: finalMentions,
        resharedFrom: initialReshare
          ? {
              storyId: initialReshare.id,
              userId: initialReshare.userId,
              displayName: initialAuthor?.displayName || 'Pengguna',
              username: initialAuthor?.username || 'user',
            }
          : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menerbitkan status');
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        height: 'var(--app-height, 100dvh)',
        top: 'var(--vv-offset-top, 0px)',
      }}
      className={`fixed inset-x-0 z-[80] flex items-stretch md:items-center justify-center p-0 md:p-4 transition-[height,top] duration-240 ease-[cubic-bezier(0.22,1,0.36,1)] ${closing ? 'pointer-events-none' : ''}`}
    >
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
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => setMentionPickerOpen((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold brutal-press ${
                  mentionedUserIds.length > 0 || mentionPickerOpen
                    ? 'bg-[#FFF2A7] border-[#F59B00] text-[#161B26]'
                    : 'border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA]'
                }`}
              >
                <AtSign className="w-3.5 h-3.5" />
                <span>{mentionedUserIds.length > 0 ? `Mention (${mentionedUserIds.length})` : 'Mention'}</span>
              </button>
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
          {initialReshare && (
            <div className="px-3 py-2 rounded-xl bg-[#EAF4FF] dark:bg-[#1B2436] border border-[#BEDEFF] dark:border-[#324058] flex items-center gap-2 text-xs font-semibold text-[#161B26] dark:text-[#F1F5F9]">
              <Repeat2 className="w-4 h-4 text-[#8C0027] dark:text-[#F47296] shrink-0" />
              <span>
                Membagikan ulang status dari <strong>@{initialAuthor?.username || 'user'}</strong>
              </span>
            </div>
          )}
          {mentionPickerOpen && (
            <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] max-h-28 overflow-y-auto thin-scrollbar">
              {users.map((u) => {
                const tagged = mentionedUserIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() =>
                      setMentionedUserIds((prev) =>
                        prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                      )
                    }
                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                      tagged
                        ? 'bg-[#8C0027] text-white'
                        : 'bg-[#FFFFFF] dark:bg-[#232D40] text-[#161B26] dark:text-[#E2E8F0] border border-[#E6ECF2] dark:border-[#324058]'
                    }`}
                  >
                    @{u.username}
                  </button>
                );
              })}
            </div>
          )}
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

function renderStoryCaptionText(text: string): React.ReactNode {
  const parts = text.split(/(@[a-zA-Z0-9_]{3,24})/g);
  return parts.map((part, idx) =>
    /^@[a-zA-Z0-9_]{3,24}$/.test(part) ? (
      <span key={idx} className="text-[#FFF2A7] underline decoration-[#FFF2A7]/70">
        {part}
      </span>
    ) : (
      <span key={idx}>{part}</span>
    )
  );
}

const QUICK_STORY_EMOJIS = ['😂', '😮', '😢', '👏', '🔥'];

function StoryImageWithLoader({
  src,
  alt,
  className = '',
  spinnerSize = 'md',
}: {
  src: string;
  alt: string;
  className?: string;
  spinnerSize?: 'sm' | 'md';
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#171E2C]/70 backdrop-blur-xl z-10">
          <Loader2
            className={`${
              spinnerSize === 'sm' ? 'w-5 h-5' : 'w-7 h-7'
            } text-white/90 animate-spin`}
          />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`${className} transition-all duration-300 ${
          loaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-md scale-105'
        }`}
      />
    </>
  );
}

function MyStatusModal({
  closing,
  stories,
  currentUserId,
  onClose,
  onAddNew,
  onOpenStory,
  onShareStory,
  onDeleteStory,
}: {
  closing: boolean;
  stories: StoryItem[];
  currentUserId: string;
  onClose: () => void;
  onAddNew: () => void;
  onOpenStory: (index: number, openViewers?: boolean) => void;
  onShareStory: (story: StoryItem) => void;
  onDeleteStory: (storyId: string) => Promise<void>;
}) {
  const [menuStoryId, setMenuStoryId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <div
      onClick={onClose}
      className={`${
        closing ? 'p5-backdrop-out pointer-events-none' : 'p5-backdrop-in'
      } fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${
          closing ? 'p5-modal-out' : 'p5-modal-impact'
        } w-full sm:max-w-md max-h-[88dvh] rounded-t-3xl sm:rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] shadow-[0_-8px_32px_rgba(15,20,30,0.2)] flex flex-col overflow-hidden`}
      >
        {/* Header */}
        <div className="pt-safe-2 md:pt-4 px-4 pb-3 flex items-center justify-between gap-2 bg-[#FFFFFF] dark:bg-[#171E2C] shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Kembali"
              className="h-9 w-9 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA]">
                Status saya
              </h3>
              <p className="text-[11px] text-[#5A6578] dark:text-[#94A3B8]">
                {stories.length} pembaruan aktif
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onAddNew}
            className="h-9 px-3.5 rounded-full bg-[#8C0027] hover:bg-[#6E001F] text-white text-xs font-bold flex items-center gap-1.5 brutal-press"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </div>

        {/* List View */}
        <div className="flex-1 overflow-y-auto thin-scrollbar px-3.5 pb-safe-3 space-y-2">
          {stories.map((s, idx) => {
            const viewCount = s.viewerIds.filter((id) => id !== currentUserId).length;
            const likeCount = (s.likedUserIds || []).filter((id) => id !== currentUserId).length;
            const isMenuOpen = menuStoryId === s.id;
            const isDeleting = deletingId === s.id;

            return (
              <div
                key={s.id}
                className={`relative flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1E2738] ${
                  isMenuOpen ? 'z-30' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpenStory(idx, false)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  {/* Thumbnail Preview */}
                  <div
                    style={!s.mediaUrl ? { backgroundColor: s.bgColor } : undefined}
                    className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#171E2C] flex items-center justify-center"
                  >
                    {s.mediaUrl && s.kind === 'image' ? (
                      <StoryImageWithLoader
                        src={s.mediaUrl}
                        alt="Preview status"
                        className="absolute inset-0 w-full h-full object-cover"
                        spinnerSize="sm"
                      />
                    ) : s.mediaUrl && s.kind === 'video' ? (
                      <>
                        <video
                          src={s.mediaUrl}
                          muted
                          playsInline
                          preload="metadata"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <Play className="w-4 h-4 text-white fill-white relative z-10 drop-shadow" />
                      </>
                    ) : (
                      <span className="text-[9px] font-bold text-white px-1 text-center line-clamp-2 leading-tight">
                        {s.text || 'Teks'}
                      </span>
                    )}
                  </div>

                  {/* Status Info */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-[#161B26] dark:text-[#F5F7FA] truncate">
                      {s.text || (s.kind === 'video' ? 'Video status' : 'Foto status')}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-[#5A6578] dark:text-[#94A3B8]">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#8C0027] dark:text-[#F47296]">
                        <Eye className="w-3.5 h-3.5" />
                        <span className="font-mono tabular-nums">{viewCount}</span>
                        <span>tayangan</span>
                      </span>
                      {likeCount > 0 && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-rose-500">
                            <Heart className="w-3 h-3 fill-rose-500" />
                            <span className="font-mono tabular-nums">{likeCount}</span>
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span className="font-mono text-[11px]">{formatTimeShort(s.createdAt)}</span>
                    </div>
                  </div>
                </button>

                {/* 3-Dot Action Trigger */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setMenuStoryId((prev) => (prev === s.id ? null : s.id))}
                    aria-label="Opsi status"
                    className="h-9 w-9 rounded-full hover:bg-[#E6ECF2] dark:hover:bg-[#2B364B] text-[#5A6578] dark:text-[#CBD5E1] flex items-center justify-center transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {isMenuOpen && (
                    <div
                      className={`absolute right-0 ${
                        idx >= stories.length - 1 && stories.length > 1 ? 'bottom-10' : 'top-10'
                      } w-44 rounded-2xl bg-[#FFFFFF] dark:bg-[#171E2C] shadow-[0_10px_28px_rgba(15,20,30,0.22)] border border-[#E6ECF2] dark:border-[#2A364B] p-1.5 z-40 space-y-0.5`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setMenuStoryId(null);
                          onOpenStory(idx, true);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#F5F7FA] dark:hover:bg-[#232D40] flex items-center gap-2"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#5A6578]" />
                        <span>Lihat penonton ({viewCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuStoryId(null);
                          onShareStory(s);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#F5F7FA] dark:hover:bg-[#232D40] flex items-center gap-2"
                      >
                        <Share2 className="w-3.5 h-3.5 text-[#F59B00]" />
                        <span>Bagikan ulang</span>
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={async () => {
                          setDeletingId(s.id);
                          setMenuStoryId(null);
                          try {
                            await onDeleteStory(s.id);
                          } finally {
                            setDeletingId(null);
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-[#8C0027] dark:text-[#F47296] hover:bg-[#FDF0F3] dark:hover:bg-[#2B1822] flex items-center gap-2 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus status</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StoryViewerModal({
  closing,
  story,
  nextStory,
  author,
  users,
  currentUserId,
  isOwn,
  initialShowViewers = false,
  index,
  total,
  onPrev,
  onNext,
  onClose,
  onDelete,
  onMuteAuthor,
  onReshare,
  onReply,
  onLike,
}: {
  closing: boolean;
  story: StoryItem;
  nextStory?: StoryItem | null;
  author?: UserProfile;
  users: Record<string, UserProfile>;
  currentUserId: string;
  isOwn: boolean;
  initialShowViewers?: boolean;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onMuteAuthor: () => Promise<void>;
  onReshare: () => void;
  onReply: (text: string) => Promise<void>;
  onLike: () => Promise<void>;
}) {
  const [replyText, setReplyText] = useState('');
  const [showViewers, setShowViewers] = useState(initialShowViewers);
  const [paused, setPaused] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number; ignore: boolean } | null>(null);
  const viewersPresence = useAnimatedPresence(showViewers, 175);

  useEffect(() => {
    setProgressPct(0);
    setShowViewers(initialShowViewers);
    setDragOffsetX(0);
  }, [story.id, initialShowViewers]);

  // Preload next story image for instant switching
  useEffect(() => {
    if (nextStory?.mediaUrl && nextStory.kind === 'image') {
      const preload = new Image();
      preload.src = nextStory.mediaUrl;
    }
  }, [nextStory]);

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
    .filter(Boolean)
    .sort((a, b) => (story.viewerTimes?.[b.id] || 0) - (story.viewerTimes?.[a.id] || 0));

  const mentionedUsers = (story.mentionedUserIds || [])
    .map((id) => users[id])
    .filter(Boolean);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement | null;
    const ignore = Boolean(target?.closest('input, textarea, form, [data-no-story-swipe="true"]'));
    swipeStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      ignore,
    };
    setPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    if (!start || start.ignore || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      setDragOffsetX(dx * 0.35);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    setPaused(false);
    setDragOffsetX(0);
    if (!start || start.ignore || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;

    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) onNext();
      else if (index > 0) onPrev();
      return;
    }

    if (Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      if (dy < 0 && isOwn && !showViewers) {
        setShowViewers(true);
      } else if (dy > 0) {
        if (showViewers) setShowViewers(false);
        else onClose();
      }
    }
  };

  return (
    <div
      style={{
        height: 'var(--app-height, 100dvh)',
        top: 'var(--vv-offset-top, 0px)',
      }}
      className={`${
        closing ? 'p5-backdrop-out pointer-events-none' : 'p5-backdrop-in'
      } fixed inset-x-0 z-[80] bg-black/95 flex items-center justify-center p-0 sm:p-4 transition-[height,top] duration-240 ease-[cubic-bezier(0.22,1,0.36,1)]`}
    >
      <div
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          swipeStartRef.current = null;
          setPaused(false);
          setDragOffsetX(0);
        }}
        className={`${
          closing ? 'p5-modal-out' : 'p5-modal-impact'
        } relative w-full h-full sm:h-[90dvh] sm:max-h-[820px] sm:aspect-[9/16] sm:w-auto sm:max-w-[440px] rounded-none sm:rounded-3xl overflow-hidden flex flex-col justify-between bg-black brutal-shadow-lg select-none`}
        style={{
          backgroundColor: story.mediaUrl ? '#000000' : story.bgColor,
          transform: dragOffsetX ? `translate3d(${dragOffsetX}px, 0, 0)` : undefined,
        }}
      >
        {/* Full-Bleed Edge-to-Edge Media (with blur + spinner while loading) */}
        {story.mediaUrl && story.kind === 'image' && (
          <StoryImageWithLoader
            src={story.mediaUrl}
            alt="Status media"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {story.mediaUrl && story.kind === 'video' && (
          <video
            src={story.mediaUrl}
            autoPlay
            playsInline
            loop
            onEnded={onNext}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Top & Bottom Scrims */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/75 via-black/35 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/85 via-black/40 to-transparent z-10" />

        {/* Invisible IG/WA Tap Zones (Left 30% = Prev, Right 70% = Next) */}
        <div className="absolute inset-0 z-10 flex">
          <button
            type="button"
            aria-label="Status sebelumnya"
            onClick={(e) => {
              e.stopPropagation();
              if (index > 0) onPrev();
            }}
            className="w-[30%] h-full bg-transparent focus:outline-none"
          />
          <button
            type="button"
            aria-label="Status berikutnya"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="w-[70%] h-full bg-transparent focus:outline-none"
          />
        </div>

        {/* Top Progress Bars & Author Info */}
        <div className="relative pt-safe-3 px-3.5 pb-2 z-20">
          <div className="flex gap-1 mb-3">
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
                <div key={idx} className="h-[3px] flex-1 rounded-full bg-white/30 overflow-hidden">
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
                <div className="text-sm font-bold truncate drop-shadow-sm">
                  {author?.displayName || 'Pengguna'}
                </div>
                <div className="text-[11px] text-white/80 font-mono">
                  {formatTimeShort(story.createdAt)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {isOwn ? (
                <button
                  type="button"
                  onClick={onDelete}
                  aria-label="Hapus status"
                  className="h-9 w-9 rounded-full bg-black/35 backdrop-blur-md text-white hover:bg-[#8C0027] flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onMuteAuthor}
                  aria-label="Bisukan status pengguna ini"
                  title="Bisukan status"
                  className="h-9 w-9 rounded-full bg-black/35 backdrop-blur-md text-white hover:bg-[#8C0027] flex items-center justify-center"
                >
                  <BellOff className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup status"
                className="h-9 w-9 rounded-full bg-black/35 backdrop-blur-md text-white hover:bg-[#8C0027] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {story.resharedFrom && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-white">
              <Repeat2 className="w-3.5 h-3.5 text-[#FFF2A7]" />
              <span>Dibagikan ulang dari @{story.resharedFrom.username}</span>
            </div>
          )}
        </div>

        {/* Center Text-Only Story OR Bottom Caption + Mention Pills */}
        {!story.mediaUrl ? (
          <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-6 text-center pointer-events-none gap-3">
            {story.text && (
              <p className="text-white font-display text-2xl sm:text-3xl font-extrabold leading-snug drop-shadow-md">
                {renderStoryCaptionText(story.text)}
              </p>
            )}
            {mentionedUsers.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {mentionedUsers.map((mu) => (
                  <span
                    key={mu.id}
                    className="px-2.5 py-1 rounded-full bg-black/35 backdrop-blur-md border border-white/20 text-xs font-bold text-[#FFF2A7]"
                  >
                    @{mu.username}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="relative z-20 mt-auto px-5 pb-2 text-center pointer-events-none space-y-2">
            {mentionedUsers.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {mentionedUsers.map((mu) => (
                  <span
                    key={mu.id}
                    className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-xs font-bold text-[#FFF2A7]"
                  >
                    @{mu.username}
                  </span>
                ))}
              </div>
            )}
            {story.text && (
              <p className="text-white text-sm sm:text-base font-semibold leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                {renderStoryCaptionText(story.text)}
              </p>
            )}
          </div>
        )}

        {/* Bottom Action Bar: Viewers + Reshare (own) OR Centered Emoji + Capsule Reply (others) */}
        <div data-no-story-swipe="true" className="relative z-20 px-4 pt-2 pb-safe-3">
          {isOwn ? (
            <div className="space-y-2 max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowViewers((p) => !p)}
                  className="flex-1 h-11 flex items-center justify-center gap-2 rounded-full bg-black/50 hover:bg-[#8C0027] border border-white/30 text-white text-xs font-bold backdrop-blur-md"
                >
                  <ChevronUp
                    className={`w-4 h-4 transition-transform ${showViewers ? 'rotate-180' : ''}`}
                  />
                  <Eye className="w-4 h-4" />
                  <span className="font-mono tabular-nums">{viewers.length}</span>
                  <span>Penonton</span>
                </button>
                <button
                  type="button"
                  onClick={onReshare}
                  aria-label="Bagikan ulang status"
                  title="Bagikan ulang"
                  className="h-11 px-4 rounded-full bg-black/50 hover:bg-[#8C0027] border border-white/30 text-white text-xs font-bold backdrop-blur-md flex items-center gap-1.5"
                >
                  <Repeat2 className="w-4 h-4" />
                  <span>Bagikan</span>
                </button>
              </div>
              {viewersPresence.mounted && (
                <div
                  className={`${
                    viewersPresence.closing ? 'p5-panel-out pointer-events-none' : 'p5-panel-reveal'
                  } p-3 rounded-2xl bg-[#171E2C]/95 backdrop-blur-md border border-white/15 text-white max-h-52 overflow-y-auto thin-scrollbar space-y-2 text-xs`}
                >
                  {viewers.length === 0 ? (
                    <div className="text-white/60 text-center py-1">Belum ada penonton lain.</div>
                  ) : (
                    viewers.map((v) => {
                      const viewedAt = story.viewerTimes?.[v.id];
                      const hasLiked = Boolean(story.likedUserIds?.includes(v.id));
                      return (
                        <div key={v.id} className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar
                              name={v.displayName}
                              imageUrl={v.avatarUrl}
                              color={v.avatarColor}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-white truncate leading-tight flex items-center gap-1.5">
                                <span className="truncate">{v.displayName}</span>
                                {hasLiked && (
                                  <Heart className="w-3 h-3 fill-rose-500 text-rose-500 shrink-0" />
                                )}
                              </div>
                              <div className="text-[10px] font-mono text-white/60 truncate">
                                @{v.username}
                              </div>
                            </div>
                          </div>
                          <span className="font-mono text-[11px] text-white/75 tabular-nums shrink-0">
                            {formatTimeShort(viewedAt || story.createdAt)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-md mx-auto space-y-2.5">
              {/* Quick Emoji Choices + Story Like Button (centered above reply form) */}
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void onLike()}
                  aria-label="Sukai status"
                  title="Sukai status"
                  className={`w-10 h-10 rounded-full border backdrop-blur-md flex items-center justify-center brutal-press transition-all active:scale-90 ${
                    story.likedUserIds?.includes(currentUserId)
                      ? 'bg-[#8C0027] border-[#F47296] text-white'
                      : 'bg-black/50 hover:bg-[#8C0027] border-white/25 text-white'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      story.likedUserIds?.includes(currentUserId)
                        ? 'fill-white text-white'
                        : 'text-[#F47296]'
                    }`}
                  />
                </button>
                {QUICK_STORY_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => void onReply(emoji)}
                    aria-label={`Balas dengan ${emoji}`}
                    className="w-10 h-10 rounded-full bg-black/50 hover:bg-[#8C0027] border border-white/25 backdrop-blur-md text-lg flex items-center justify-center brutal-press transition-transform active:scale-90"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Centered Text Reply Form */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!replyText.trim()) return;
                  await onReply(replyText.trim());
                  setReplyText('');
                }}
                className="flex items-center justify-center gap-2"
              >
                <input
                  type="text"
                  value={replyText}
                  onFocus={() => setPaused(true)}
                  onBlur={() => setPaused(false)}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Balas ${author?.displayName.split(' ')[0] || ''}...`}
                  className="flex-1 h-11 px-4 rounded-full bg-black/55 border border-white/35 backdrop-blur-md text-sm text-white placeholder:text-white/75 focus:outline-none focus:border-white"
                />
                <button
                  type="button"
                  onClick={onReshare}
                  aria-label="Bagikan ulang ke status saya"
                  title="Bagikan ulang ke Status"
                  className="w-11 h-11 rounded-full bg-black/50 hover:bg-[#8C0027] border border-white/35 backdrop-blur-md text-white flex items-center justify-center shrink-0 brutal-press"
                >
                  <Repeat2 className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  aria-label="Kirim balasan status"
                  className="w-11 h-11 rounded-full bg-[#8C0027] hover:bg-[#6E001F] border border-white/40 text-white flex items-center justify-center shrink-0 brutal-press"
                >
                  <SendHorizontal className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
