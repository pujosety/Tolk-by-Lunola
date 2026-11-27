import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BarChart3,
  BellRing,
  CalendarClock,
  Camera,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Forward,
  Info,
  Languages,
  Lock,
  MapPin,
  MessageSquare,
  Mic,
  MoreVertical,
  Paperclip,
  Pause,
  Phone,
  Pin,
  Play,
  Plus,
  RefreshCw,
  Reply,
  Search,
  SendHorizontal,
  Smile,
  Sparkles,
  Square,
  Star,
  Timer,
  Trash2,
  UploadCloud,
  UserCheck,
  Video,
  Volume2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  Attachment,
  ChatAppearancePrefs,
  ChatRoom,
  LanguageCode,
  LinkPreview,
  Message,
  UserProfile,
} from '../types/chat';
import { getBubbleClasses, getCustomWallpaperLayers, getWallpaperStyle } from '../lib/appearance';
import {
  formatBytes,
  formatDateDivider,
  formatDuration,
  formatLastSeen,
  formatTimeShort,
  isSafeHttpUrl,
  saveMediaToGallery,
  triggerAndroidHaptic,
} from '../lib/androidBridge';
import { t } from '../lib/i18n';
import { useAnimatedPresence, useRetainedValue } from '../lib/useAnimatedPresence';
import { Avatar } from './Avatar';
import { CameraCaptureModal } from './CameraCaptureModal';

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂', '👏', '😮'];

interface ChatWindowProps {
  lang: LanguageCode;
  chat: ChatRoom;
  openSeq?: number;
  messages: Message[];
  scheduledMessages: Message[];
  loading: boolean;
  users: Record<string, UserProfile>;
  currentUser: UserProfile;
  onlineUserIds: Set<string>;
  typingUserIds: string[];
  draftText: string;
  maxUploadMb: number;
  appearance: ChatAppearancePrefs;
  darkMode: boolean;
  onDraftChange: (text: string) => void;
  onBackMobile: () => void;
  onOpenInfo: () => void;
  onStartCall: (peerId: string, kind: 'voice' | 'video') => void;
  onSendMessage: (payload: {
    text: string;
    replyToId?: string | null;
    attachment?: Attachment | null;
    poll?: {
      question: string;
      allowMultiple: boolean;
      options: Array<{ text: string }>;
    } | null;
    linkPreview?: LinkPreview | null;
    contactCard?: {
      userId: string;
      displayName: string;
      username: string;
      avatarUrl?: string | null;
      avatarColor?: string;
    } | null;
    location?: { lat: number; lng: number; label?: string } | null;
    sticker?: { id: string; label: string } | null;
    scheduledFor?: number | null;
  }) => Promise<void>;
  quickReplies?: Array<{ trigger: string; text: string }>;
  onFetchLinkPreview?: (url: string) => Promise<LinkPreview | null>;
  onCancelScheduled?: (messageId: string) => Promise<void>;
  onOpenDirectChat?: (userId: string) => void;
  onUploadFile: (
    file: File,
    onProgress?: (percent: number) => void,
    durationSec?: number
  ) => Promise<Attachment>;
  onEditMessage: (messageId: string, text: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onToggleReaction: (messageId: string, emoji: string) => Promise<void>;
  onVotePoll?: (messageId: string, optionId: string) => Promise<void>;
  onMarkViewOnceViewed?: (messageId: string) => Promise<void>;
  onPinMessage: (messageId: string | null) => Promise<void>;
  onToggleStarMessage: (messageId: string, starred?: boolean) => Promise<void>;
  onForwardMessage: (message: Message) => void;
  onTranslateMessage: (messageId: string, text: string) => Promise<string>;
  onSummarizeChat: () => Promise<string>;
  onReportMessage: (message: Message) => void;
  onRemindMessage?: (message: Message, delayMs: number) => void;
  onTyping: (isTyping: boolean) => void;
}

function VoiceNotePlayer({
  url,
  durationSec,
  isOwn,
  onPlayChange,
}: {
  url: string;
  durationSec?: number;
  isOwn: boolean;
  onPlayChange?: (playing: boolean) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      onPlayChange?.(false);
    } else {
      audio.playbackRate = speed;
      void audio.play().catch(() => {
        setPlaying(false);
        onPlayChange?.(false);
      });
      setPlaying(true);
      onPlayChange?.(true);
    }
  };

  const cycleSpeed = () => {
    const next: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const bars = [35, 65, 90, 50, 80, 100, 60, 40, 85, 70, 55, 95, 65, 45, 75, 50];

  return (
    <div className="flex items-center gap-2.5 min-w-[215px] py-1">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration && Number.isFinite(el.duration)) {
            setProgress(el.currentTime / el.duration);
          }
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
      />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? 'Jeda pesan suara' : 'Putar pesan suara'}
        className={`h-9 w-9 rounded-xl border border-[#E6ECF2] flex items-center justify-center shrink-0 transition-colors ${
          isOwn
            ? 'bg-[#FFFFFF] text-[#8C0027] hover:bg-[#161B26] hover:text-[#FFFFFF]'
            : 'bg-[#8C0027] text-[#FFFFFF] hover:bg-[#6E001F]'
        }`}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-end gap-[2px] h-5">
          {bars.map((height, idx) => {
            const active = idx / bars.length <= progress;
            return (
              <span
                key={idx}
                style={{ height: `${Math.max(25, height)}%` }}
                className={`w-[3px] transition-colors ${
                  isOwn
                    ? active
                      ? 'bg-[#FFFFFF]'
                      : 'bg-[#FFFFFF]/35'
                    : active
                      ? 'bg-[#8C0027] dark:bg-[#F47296]'
                      : 'bg-[#161B26]/25 dark:bg-[#F5F7FA]/30'
                }`}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <span
            className={`font-mono text-[10px] tabular-nums ${
              isOwn ? 'text-[#FFF2A7]' : 'text-[#5A6578] dark:text-[#94A3B8]'
            }`}
          >
            {formatDuration(durationSec)} · Pesan suara
          </span>
          <button
            type="button"
            onClick={cycleSpeed}
            className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
              isOwn
                ? 'border-[#FFFFFF]/50 bg-[#161B26]/30 text-[#FFFFFF]'
                : 'border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA]'
            }`}
          >
            {speed}x
          </button>
        </div>
      </div>
    </div>
  );
}

function SpoilerSpan({ text }: { text: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        setRevealed((v) => !v);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setRevealed((v) => !v);
        }
      }}
      title={revealed ? 'Sembunyikan spoiler' : 'Ketuk untuk lihat spoiler'}
      className={`px-1 rounded cursor-pointer transition-all ${
        revealed ? 'bg-black/10' : 'bg-[#161B26]/80 text-transparent select-none blur-[4px]'
      }`}
    >
      {text}
    </span>
  );
}

function renderFormattedSegment(seg: string, keyPrefix: string): React.ReactNode {
  const fmtRegex = /(\|\|[^|\n]+\|\||\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|~[^~\n]+~)/g;
  const parts = seg.split(fmtRegex);
  return parts.map((p, i) => {
    const k = `${keyPrefix}_${i}`;
    if (p.startsWith('||') && p.endsWith('||') && p.length > 4) {
      return <SpoilerSpan key={k} text={p.slice(2, -2)} />;
    }
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
      return <strong key={k} className="font-bold">{p.slice(1, -1)}</strong>;
    }
    if (p.startsWith('_') && p.endsWith('_') && p.length > 2) {
      return <em key={k} className="italic">{p.slice(1, -1)}</em>;
    }
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
      return (
        <code key={k} className="px-1 py-0.5 rounded bg-black/15 font-mono text-[12px]">
          {p.slice(1, -1)}
        </code>
      );
    }
    if (p.startsWith('~') && p.endsWith('~') && p.length > 2) {
      return <s key={k} className="line-through opacity-80">{p.slice(1, -1)}</s>;
    }
    return <span key={k}>{p}</span>;
  });
}

function renderSafeMessageText(text: string, isOwn: boolean): React.ReactNode {
  const tokenRegex = /(https?:\/\/[^\s]+|@[a-zA-Z0-9_]{3,24})/g;
  const parts = text.split(tokenRegex);
  return parts.map((part, idx) => {
    if (/^https?:\/\/[^\s]+$/i.test(part) && isSafeHttpUrl(part)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline font-medium break-all ${
            isOwn
              ? 'text-[#FDE68A] decoration-[#FDE68A]/70 hover:text-white'
              : 'text-[#8C0027] dark:text-[#F47296] decoration-[#8C0027]/60'
          }`}
        >
          {part}
        </a>
      );
    }
    if (/^@[a-zA-Z0-9_]{3,24}$/.test(part)) {
      return (
        <span
          key={idx}
          className={`font-mono font-semibold ${
            isOwn ? 'text-[#FDE68A]' : 'text-[#8C0027] dark:text-[#F47296]'
          }`}
        >
          {part}
        </span>
      );
    }
    return <span key={idx}>{renderFormattedSegment(part, `t_${idx}`)}</span>;
  });
}

export function ChatWindow({
  lang,
  chat,
  openSeq = 0,
  messages,
  scheduledMessages,
  loading,
  users,
  currentUser,
  onlineUserIds,
  typingUserIds,
  draftText,
  maxUploadMb,
  appearance,
  darkMode,
  onDraftChange,
  onBackMobile,
  onOpenInfo,
  onStartCall,
  onSendMessage,
  onUploadFile,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  onVotePoll,
  onMarkViewOnceViewed,
  quickReplies = [],
  onFetchLinkPreview,
  onCancelScheduled,
  onOpenDirectChat,
  onPinMessage,
  onToggleStarMessage,
  onForwardMessage,
  onTranslateMessage,
  onSummarizeChat,
  onReportMessage,
  onRemindMessage,
  onTyping,
}: ChatWindowProps) {
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number; upward: boolean; ownMsg: boolean } | null>(null);
  const msgLongPressRef = useRef<number | null>(null);

  const openMessageMenu = (msgId: string, anchorEl?: HTMLElement | null, ownMessage?: boolean) => {
    if (activeMenuMsgId === msgId) {
      setActiveMenuMsgId(null);
      setMenuPos(null);
      return;
    }
    if (anchorEl && typeof window !== 'undefined') {
      const rect = anchorEl.getBoundingClientRect();
      const vvHeight = window.visualViewport?.height || window.innerHeight;
      const upward = rect.bottom + 300 > vvHeight;
      const isOwnMsg = ownMessage ?? false;
      const menuWidth = 208; // 13rem
      const clampedX = Math.max(
        12,
        Math.min(isOwnMsg ? rect.right - menuWidth : rect.left, window.innerWidth - menuWidth - 12)
      );
      setMenuPos({
        x: clampedX,
        y: upward
          ? Math.max(68, Math.min(rect.top, vvHeight - 16))
          : Math.max(68, Math.min(rect.bottom + 4, vvHeight - 320)),
        upward,
        ownMsg: isOwnMsg,
      });
    } else {
      setMenuPos(null);
    }
    setActiveMenuMsgId(msgId);
  };
  const [searchOpen, setSearchOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTab, setEmojiTab] = useState<'emoji' | 'sticker'>('emoji');
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [scheduledDrawerOpen, setScheduledDrawerOpen] = useState(false);
  const [msgInfoTarget, setMsgInfoTarget] = useState<Message | null>(null);
  const [threadRootMsg, setThreadRootMsg] = useState<Message | null>(null);
  const [threadReplyText, setThreadReplyText] = useState('');
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(() => new Set());
  const [miniAudio, setMiniAudio] = useState<{ msgId: string; senderName: string; url: string } | null>(null);
  const [customStickers, setCustomStickers] = useState<Array<{ id: string; dataUrl: string; label: string }>>(() => {
    try {
      const raw = window.localStorage.getItem('tolk_custom_stickers');
      return raw ? (JSON.parse(raw) as Array<{ id: string; dataUrl: string; label: string }>) : [];
    } catch {
      return [];
    }
  });
  const customStickerInputRef = useRef<HTMLInputElement | null>(null);
  const [stickerCropSrc, setStickerCropSrc] = useState<string | null>(null);
  const [stickerCropLabel, setStickerCropLabel] = useState('');
  const [stickerZoom, setStickerZoom] = useState(1);
  const [stickerOffset, setStickerOffset] = useState({ x: 0, y: 0 });
  const [stickerNatural, setStickerNatural] = useState({ w: 1, h: 1 });
  const stickerDragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lightboxMsgId, setLightboxMsgId] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);
  const [viewOnceModalMsg, setViewOnceModalMsg] = useState<Message | null>(null);
  const [pendingViewOnce, setPendingViewOnce] = useState(false);
  const [pendingSpoiler, setPendingSpoiler] = useState(false);
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(() => new Set());
  const [recordLocked, setRecordLocked] = useState(false);
  const [recordSwipe, setRecordSwipe] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [recordLevels, setRecordLevels] = useState<number[]>([25, 45, 70, 50, 80, 40, 65, 35]);
  const recordTouchRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const analyserRafRef = useRef<number | null>(null);
  const [sending, setSending] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [sendKick, setSendKick] = useState(0);
  const [swipingMsgId, setSwipingMsgId] = useState<string | null>(null);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const swipeReplyRef = useRef<{
    msgId: string;
    x: number;
    y: number;
    locked: boolean;
    ignore: boolean;
    hapticFired: boolean;
  } | null>(null);
  const lastTapRef = useRef<{ msgId: string; time: number } | null>(null);
  const edgeSwipeRef = useRef<{ x: number; y: number } | null>(null);
  const lightboxTouchRef = useRef<{ x: number; y: number; pinchDist?: number } | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [unreadWhileScrolledUp, setUnreadWhileScrolledUp] = useState(0);
  const showScrollDownRef = useRef(false);
  const prevMsgLenRef = useRef(messages.length);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesInnerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottomNow = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const lightboxMediaList = useMemo(
    () =>
      messages.filter(
        (m) =>
          !m.attachment?.viewOnce &&
          (m.attachment?.kind === 'image' || m.attachment?.kind === 'video')
      ),
    [messages]
  );
  const lightboxIdx = useMemo(
    () => (lightboxMsgId ? lightboxMediaList.findIndex((m) => m.id === lightboxMsgId) : -1),
    [lightboxMsgId, lightboxMediaList]
  );
  const activeLightboxMsg = lightboxIdx >= 0 ? lightboxMediaList[lightboxIdx] : null;

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [optimisticUploads, setOptimisticUploads] = useState<
    Array<{
      tempId: string;
      localUrl: string;
      kind: 'image' | 'video' | 'file';
      name: string;
      size: number;
      text: string;
      progress: number;
      error?: string;
      file: File;
      replyToId?: string | null;
      viewOnce?: boolean;
      scheduledFor?: number | null;
    }>
  >([]);
  const [isDragging, setIsDragging] = useState(false);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<number | null>(null);
  const [customScheduleInput, setCustomScheduleInput] = useState('');

  const [mobileHeaderMenuOpen, setMobileHeaderMenuOpen] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartRef = useRef<number>(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const isGroupAdminOrMod =
    chat.adminIds.includes(currentUser.id) ||
    Boolean(chat.moderatorIds?.includes(currentUser.id));

  const canPost =
    chat.type === 'channel'
      ? chat.adminIds.includes(currentUser.id)
      : chat.type === 'group' && chat.adminOnlyPost
        ? isGroupAdminOrMod
        : !chat.suspended;

  // Animated presence hooks so every bar, option menu, and overlay animates cleanly on both open & close
  const dragPresence = useAnimatedPresence(isDragging && canPost, 180);
  const searchPresence = useAnimatedPresence(searchOpen, 175);
  const summaryRetained = useRetainedValue(summaryText, 175);
  const menuRetained = useRetainedValue(activeMenuMsgId, 155);
  const fileBarPresence = useAnimatedPresence(
    Boolean(pendingFile || uploadError || uploadProgress !== null),
    175
  );
  const replyBarPresence = useAnimatedPresence(
    Boolean(replyTo || editingMsg || scheduledFor),
    175
  );
  const schedulePresence = useAnimatedPresence(scheduleOpen && canPost, 175);
  const lightboxRetained = useRetainedValue(activeLightboxMsg, 200);

  const pinnedMessage = useMemo(
    () => messages.find((m) => m.id === chat.pinnedMessageId) || null,
    [messages, chat.pinnedMessageId]
  );

  const visibleMessages = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        m.text.toLowerCase().includes(q) ||
        (m.attachment?.name || '').toLowerCase().includes(q)
    );
  }, [messages, searchTerm]);

  const replyCountByMsgId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of messages) {
      if (m.replyToId) {
        map[m.replyToId] = (map[m.replyToId] || 0) + 1;
      }
    }
    return map;
  }, [messages]);

  const mentionCandidates = useMemo(() => {
    if (chat.type !== 'group') return [];
    const match = draftText.match(/@([a-zA-Z0-9_]*)$/);
    if (!match) return [];
    const query = match[1].toLowerCase();
    return chat.memberIds
      .map((id) => users[id])
      .filter((u): u is UserProfile => Boolean(u) && u.id !== currentUser.id)
      .filter(
        (u) =>
          u.username.toLowerCase().includes(query) ||
          u.displayName.toLowerCase().includes(query)
      )
      .slice(0, 5);
  }, [chat, draftText, users, currentUser.id]);

  useEffect(() => {
    setReplyTo(null);
    setEditingMsg(null);
    setActiveMenuMsgId(null);
    setSearchOpen(false);
    setSearchTerm('');
    setScheduleOpen(false);
    setScheduledFor(null);
    setSummaryText(null);
    setMobileHeaderMenuOpen(false);
    setShowScrollDown(false);
    showScrollDownRef.current = false;
    setUnreadWhileScrolledUp(0);
    prevMsgLenRef.current = messages.length;
    clearPendingFile();
    scrollToBottomNow();
    const tId = window.setTimeout(scrollToBottomNow, 60);
    return () => window.clearTimeout(tId);
  }, [chat.id]);

  useLayoutEffect(() => {
    showScrollDownRef.current = false;
    setShowScrollDown(false);
    setUnreadWhileScrolledUp(0);
    scrollToBottomNow();
    const t1 = window.setTimeout(scrollToBottomNow, 60);
    const t2 = window.setTimeout(scrollToBottomNow, 220);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [chat.id, openSeq]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    const inner = messagesInnerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (!showScrollDownRef.current && el.clientHeight > 0) {
        el.scrollTop = el.scrollHeight;
      }
    });
    ro.observe(el);
    if (inner) ro.observe(inner);
    return () => ro.disconnect();
  }, [chat.id]);

  useEffect(() => {
    const added = messages.length - prevMsgLenRef.current;
    prevMsgLenRef.current = messages.length;
    if (added > 0 && showScrollDownRef.current) {
      setUnreadWhileScrolledUp((c) => c + added);
      return;
    }
    scrollToBottomNow();
    const raf = window.requestAnimationFrame(() => {
      if (added > 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        scrollToBottomNow();
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [messages.length, chat.id, loading]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let prevH = vv.height;
    const onResize = () => {
      if (vv.height < prevH - 60) {
        window.setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 120);
      }
      prevH = vv.height;
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const clearPendingFile = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setUploadProgress(null);
    setUploadError(null);
  };

  const stageFileForPreview = (file: File) => {
    if (file.size > maxUploadMb * 1024 * 1024) {
      setUploadError(`Ukuran file melebihi batas server (${maxUploadMb} MB).`);
      return;
    }
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(file);
    setUploadError(null);
    setUploadProgress(null);
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setPendingPreviewUrl(URL.createObjectURL(file));
    } else {
      setPendingPreviewUrl(null);
    }
    setPendingViewOnce(false);
  };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [draftText]);

  const handleInputChange = (val: string) => {
    if (activeMenuMsgId) setActiveMenuMsgId(null);
    if (scheduleOpen) setScheduleOpen(false);
    onDraftChange(val);
    onTyping(val.trim().length > 0);
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      onTyping(false);
    }, 2400);
  };

  const compressImageIfNeeded = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size <= 1.5 * 1024 * 1024) {
      return file;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.84)
      );
      if (!blob || blob.size >= file.size) return file;
      const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
      return new File([blob], newName, { type: 'image/jpeg' });
    } catch {
      return file;
    }
  };

  const runOptimisticUpload = async (item: {
    tempId: string;
    localUrl: string;
    file: File;
    text: string;
    replyToId?: string | null;
    viewOnce?: boolean;
    scheduledFor?: number | null;
  }) => {
    try {
      const readyFile = await compressImageIfNeeded(item.file);
      let uploadedAttachment = await onUploadFile(readyFile, (pct) => {
        setOptimisticUploads((prev) =>
          prev.map((u) => (u.tempId === item.tempId ? { ...u, progress: pct, error: undefined } : u))
        );
      });
      if (
        item.viewOnce &&
        (uploadedAttachment.kind === 'image' || uploadedAttachment.kind === 'video')
      ) {
        uploadedAttachment = { ...uploadedAttachment, viewOnce: true, viewedBy: [] };
      }
      if (
        pendingSpoiler &&
        (uploadedAttachment.kind === 'image' || uploadedAttachment.kind === 'video')
      ) {
        uploadedAttachment = { ...uploadedAttachment, isSpoiler: true };
        setPendingSpoiler(false);
      }
      await onSendMessage({
        text: item.text,
        replyToId: item.replyToId || null,
        attachment: uploadedAttachment,
        scheduledFor: item.scheduledFor,
      });
      setOptimisticUploads((prev) => prev.filter((u) => u.tempId !== item.tempId));
      URL.revokeObjectURL(item.localUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunggah.';
      setOptimisticUploads((prev) =>
        prev.map((u) => (u.tempId === item.tempId ? { ...u, error: msg } : u))
      );
    }
  };

  const insertMention = (username: string) => {
    const replaced = draftText.replace(/@([a-zA-Z0-9_]*)$/, `@${username} `);
    onDraftChange(replaced);
    inputRef.current?.focus();
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = draftText.trim();
    if ((!trimmed && !pendingFile) || sending) return;

    setSendKick((k) => k + 1);
    setUploadError(null);
    triggerAndroidHaptic();

    if (editingMsg) {
      setSending(true);
      try {
        await onEditMessage(editingMsg.id, trimmed);
        setEditingMsg(null);
        onDraftChange('');
        onTyping(false);
      } finally {
        setSending(false);
      }
      return;
    }

    if (pendingFile) {
      const fileToUpload = pendingFile;
      const kind: 'image' | 'video' | 'file' = fileToUpload.type.startsWith('image/')
        ? 'image'
        : fileToUpload.type.startsWith('video/')
        ? 'video'
        : 'file';
      const localUrl = URL.createObjectURL(fileToUpload);
      const item = {
        tempId: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        localUrl,
        kind,
        name: fileToUpload.name,
        size: fileToUpload.size,
        text: trimmed,
        progress: 8,
        file: fileToUpload,
        replyToId: replyTo?.id || null,
        viewOnce: pendingViewOnce,
        scheduledFor,
      };
      setOptimisticUploads((prev) => [...prev, item]);
      setReplyTo(null);
      setScheduledFor(null);
      setScheduleOpen(false);
      onDraftChange('');
      clearPendingFile();
      onTyping(false);
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        inputRef.current?.blur();
        setComposerFocused(false);
      }
      window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 40);
      void runOptimisticUpload(item);
      return;
    }

    setSending(true);
    try {
      let linkPreview: LinkPreview | null = null;
      const urlMatch = trimmed.match(/https?:\/\/[^\s]+/i);
      if (urlMatch && onFetchLinkPreview) {
        try {
          linkPreview = await onFetchLinkPreview(urlMatch[0]);
        } catch {
          linkPreview = null;
        }
      }
      await onSendMessage({
        text: trimmed,
        replyToId: replyTo?.id || null,
        attachment: null,
        linkPreview,
        scheduledFor,
      });
      setReplyTo(null);
      setScheduledFor(null);
      setScheduleOpen(false);
      onDraftChange('');
      onTyping(false);
      window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 40);
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        inputRef.current?.blur();
        setComposerFocused(false);
      }
    } finally {
      setSending(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          stageFileForPreview(file);
          return;
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && canPost) stageFileForPreview(file);
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setUploadError('Browser atau perangkat ini tidak mendukung perekaman suara.');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setUploadError('Izin mikrofon ditolak oleh browser atau perangkat.');
      return;
    }

    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      let recorder: MediaRecorder;
      try {
        recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
      } catch {
        recorder = new MediaRecorder(stream);
      }

      recordChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((tTrack) => tTrack.stop());
        if (recordTimerRef.current !== null) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        const durationSec = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        const blob = new Blob(recordChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        setRecording(false);
        setRecordSec(0);
        if (blob.size < 200) return;

        setSending(true);
        setUploadProgress(15);
        try {
          const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
          const voiceFile = new File([blob], `voice-${Date.now()}.${ext}`, {
            type: blob.type || 'audio/webm',
          });
          const attachment = await onUploadFile(
            voiceFile,
            (pct) => setUploadProgress(pct),
            durationSec
          );
          await onSendMessage({
            text: '',
            replyToId: replyTo?.id || null,
            attachment,
          });
          setReplyTo(null);
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : 'Gagal mengirim pesan suara.');
        } finally {
          setUploadProgress(null);
          setSending(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recordStartRef.current = Date.now();
      recorder.start();
      setRecording(true);
      setRecordSec(0);
      triggerAndroidHaptic();
      recordTimerRef.current = window.setInterval(() => {
        setRecordSec(Math.round((Date.now() - recordStartRef.current) / 1000));
      }, 400);
    } catch (err) {
      stream.getTracks().forEach((tr) => tr.stop());
      setUploadError(err instanceof Error ? err.message : 'Gagal memulai perekaman suara.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelVoiceRecording = () => {
    recordChunksRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream.getTracks().forEach((tr) => tr.stop());
      };
      mediaRecorderRef.current.stop();
    }
    if (recordTimerRef.current !== null) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecording(false);
    setRecordSec(0);
  };

  const handleTriggerTranslate = async (msg: Message) => {
    setActiveMenuMsgId(null);
    if (!msg.text.trim()) return;
    setTranslatingId(msg.id);
    try {
      const translated = await onTranslateMessage(msg.id, msg.text);
      setTranslations((prev) => ({ ...prev, [msg.id]: translated }));
    } finally {
      setTranslatingId(null);
    }
  };

  const handleTriggerSummarize = async () => {
    setSummarizing(true);
    try {
      const result = await onSummarizeChat();
      setSummaryText(result);
    } finally {
      setSummarizing(false);
    }
  };

  const isPeerOnline =
    chat.type === 'dm' && chat.peerUser ? onlineUserIds.has(chat.peerUser.id) : false;

  const activeTypers = typingUserIds.filter((id) => id !== currentUser.id);

  let subtitleText = '';
  if (activeTypers.length > 0) {
    const names = activeTypers
      .map((id) => users[id]?.displayName?.split(' ')[0] || 'Seseorang')
      .join(', ');
    subtitleText = chat.type === 'dm' ? t(lang, 'typing') : `${names} ${t(lang, 'typing')}`;
  } else if (chat.type === 'dm' && chat.peerUser) {
    subtitleText = isPeerOnline ? t(lang, 'online') : formatLastSeen(chat.peerUser.lastSeen);
  } else if (chat.type === 'group') {
    const onlineMembers = chat.memberIds.filter((id) => onlineUserIds.has(id)).length;
    subtitleText = `${chat.memberIds.length} anggota · ${onlineMembers} online`;
  } else if (chat.type === 'channel') {
    subtitleText = `${chat.subscriberCount || chat.memberIds.length} pelanggan`;
  } else {
    subtitleText = 'Catatan & lampiran sinkron cloud';
  }

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        if (canPost) setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragging(false);
      }}
      onDrop={handleDrop}
      className="relative flex flex-col flex-1 h-full min-w-0 chat-canvas-bg"
    >
      {/* Drag-and-Drop Overlay */}
      {dragPresence.mounted && (
        <div
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`${
            dragPresence.closing ? 'p5-backdrop-out pointer-events-none' : 'p5-backdrop-in'
          } absolute inset-0 z-40 bg-[#8C0027]/20 backdrop-blur-[2px] border-4 border-dashed border-[#8C0027] flex items-center justify-center p-6`}
        >
          <div
            className={`${
              dragPresence.closing ? 'p5-modal-out' : 'p5-modal-impact'
            } px-6 py-5 rounded-xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-lg text-center`}
          >
            <UploadCloud className="w-9 h-9 text-[#8C0027] dark:text-[#F47296] mx-auto" />
            <p className="mt-2 font-display font-extrabold text-lg text-[#161B26] dark:text-[#F5F7FA]">
              Lepaskan file untuk pratinjau sebelum dikirim
            </p>
            <p className="mt-0.5 text-xs text-[#5A6578] dark:text-[#94A3B8]">
              Foto, video, dokumen PDF/Office, atau audio · maks {maxUploadMb} MB
            </p>
          </div>
        </div>
      )}

      {/* Chat Top Bar (Liquid Glass) */}
      <header className="pt-safe-2 pb-2 min-h-[62px] px-3 sm:px-4 liquid-glass !border-x-0 !border-t-0 flex items-center justify-between gap-2 shrink-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBackMobile}
            aria-label="Kembali ke daftar chat"
            className="md:hidden h-10 w-10 rounded-full border border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onOpenInfo}
            className="flex items-center gap-2.5 min-w-0 text-left group"
          >
            <Avatar
              name={chat.title}
              imageUrl={chat.avatarUrl}
              color={chat.avatarColor}
              chatType={chat.type}
              online={isPeerOnline}
              size="sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-display font-extrabold text-lg leading-tight text-[#161B26] dark:text-[#F5F7FA] truncate group-hover:text-[#8C0027] dark:group-hover:text-[#F47296] transition-colors">
                  {chat.title}
                </h2>
                {chat.selfDestructSec > 0 && (
                  <Timer className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                )}
              </div>
              <p
                className={`text-xs truncate ${
                  activeTypers.length > 0 || isPeerOnline
                    ? 'text-[#F59B00] dark:text-[#BEDEFF] font-semibold'
                    : 'text-[#6B768A] dark:text-[#94A3B8]'
                }`}
              >
                {subtitleText}
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {chat.type === 'dm' && chat.peerUser && (
            <>
              <button
                type="button"
                onClick={() => onStartCall(chat.peerUser!.id, 'voice')}
                aria-label="Panggilan suara"
                title="Panggilan Suara WebRTC"
                className="h-10 w-10 rounded-full border border-[#E6ECF2] dark:border-[#324058] bg-[#FFFFFF] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-shadow-sm brutal-press flex items-center justify-center"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onStartCall(chat.peerUser!.id, 'video')}
                aria-label="Panggilan video"
                title="Panggilan Video WebRTC"
                className="h-10 w-10 rounded-full border border-[#E6ECF2] dark:border-[#324058] bg-[#FFFFFF] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-shadow-sm brutal-press flex items-center justify-center"
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setSearchOpen((v) => !v);
              setSearchTerm('');
            }}
            aria-label="Cari di percakapan"
            className={`flex h-10 w-10 rounded-full border brutal-shadow-sm brutal-press items-center justify-center ${
              searchOpen
                ? 'bg-[#8C0027] text-[#FFFFFF] border-[#E6ECF2] dark:border-[#F5F7FA]'
                : 'border-[#E6ECF2] dark:border-[#324058] bg-[#FFFFFF] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenInfo}
            aria-label="Detail percakapan"
            className={`h-10 w-10 rounded-full border border-[#E6ECF2] dark:border-[#324058] bg-[#FFFFFF] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-shadow-sm brutal-press ${
              chat.type === 'dm' ? 'hidden md:flex' : 'flex'
            } items-center justify-center`}
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* In-Chat Search Strip */}
      {searchPresence.mounted && (
        <div
          className={`${
            searchPresence.closing ? 'p5-panel-out pointer-events-none' : 'p5-panel-reveal'
          } px-4 py-2 bg-[#F5F7FA] dark:bg-[#1E2738] border-b-2 border-[#E6ECF2] dark:border-[#2A364B] flex items-center gap-2 z-10`}
        >
          <Search className="w-4 h-4 text-[#8C0027] dark:text-[#F47296] shrink-0" />
          <input
            type="text"
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari teks atau nama file di percakapan ini..."
            className="flex-1 bg-transparent text-sm text-[#161B26] dark:text-[#F5F7FA] placeholder:text-[#6B768A] focus:outline-none"
          />
          <span className="font-mono text-xs font-bold text-[#8C0027] dark:text-[#F47296] tabular-nums">
            {visibleMessages.length} hasil
          </span>
          <button
            type="button"
            onClick={() => {
              setSearchOpen(false);
              setSearchTerm('');
            }}
            className="p-1 text-[#5A6578] hover:text-[#8C0027] brutal-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* AI Conversation Summary Banner */}
      {summaryRetained.renderedValue && (
        <div
          className={`${
            summaryRetained.closing ? 'p5-panel-out pointer-events-none' : 'p5-panel-reveal'
          } px-4 py-2.5 bg-[#EAF4FF] dark:bg-[#1B2436] border-b-2 border-[#E6ECF2] dark:border-[#8C0027] flex items-start gap-2.5 z-10`}
        >
          <Sparkles className="w-4 h-4 text-[#8C0027] dark:text-[#F47296] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-xs text-[#161B26] dark:text-[#F5F7FA] whitespace-pre-wrap leading-relaxed">
            <div className="font-display font-extrabold text-sm text-[#8C0027] dark:text-[#F47296] mb-0.5">
              Ringkasan Percakapan (AI)
            </div>
            {summaryRetained.renderedValue}
          </div>
          <button
            type="button"
            onClick={() => setSummaryText(null)}
            className="p-1 text-[#5A6578] hover:text-[#8C0027] brutal-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

        {/* Scheduled Messages Banner */}
        {scheduledMessages.length > 0 && (
          <button
            type="button"
            onClick={() => setScheduledDrawerOpen(true)}
            className="w-full px-4 py-1.5 bg-[#FFF9D6] dark:bg-[#232D40] border-b border-[#F59B00]/30 flex items-center justify-between text-xs font-semibold text-[#161B26] dark:text-[#FFF2A7] z-10"
          >
            <span className="flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-[#F59B00]" />
              <span>{scheduledMessages.length} pesan terjadwal menunggu dikirim</span>
            </span>
            <span className="text-[11px] underline">Kelola</span>
          </button>
        )}

      {/* Pinned Message Banner */}
      {pinnedMessage && (
        <div className="p5-panel-reveal px-4 py-2 bg-[#FFFFFF] dark:bg-[#1E2738] border-b-2 border-[#E6ECF2] dark:border-[#2A364B] flex items-center gap-3 z-10">
          <Pin className="w-3.5 h-3.5 text-[#8C0027] dark:text-[#F47296] shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-[#8C0027] dark:text-[#F47296]">
              Pesan Disematkan
            </div>
            <div className="text-xs text-[#5A6578] dark:text-[#CBD5E1] truncate">
              {pinnedMessage.text || pinnedMessage.attachment?.name || 'Lampiran media'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onPinMessage(null)}
            aria-label="Lepas sematan pesan"
            className="p-1 text-[#5A6578] hover:text-[#8C0027]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Scheduled Messages Strip */}
      {scheduledMessages.length > 0 && (
        <div className="px-4 py-1.5 bg-[#FEF3C7] dark:bg-[#3A1E08] border-b-2 border-[#E6ECF2] dark:border-amber-500 flex items-center justify-between gap-2 text-xs text-[#161B26] dark:text-amber-200 font-semibold z-10">
          <span className="flex items-center gap-1.5 truncate">
            <CalendarClock className="w-3.5 h-3.5 shrink-0" />
            <span>
              {scheduledMessages.length} pesan terjadwal · berikutnya pukul{' '}
              <span className="font-mono">
                {scheduledMessages[0].scheduledFor
                  ? formatTimeShort(scheduledMessages[0].scheduledFor)
                  : ''}
              </span>
            </span>
          </span>
        </div>
      )}

      {/* Messages Canvas */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        {miniAudio && (
          <div className="mx-3 mt-1.5 px-3 py-1.5 rounded-full liquid-glass flex items-center justify-between gap-2 z-20 p5-panel-reveal">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-6 w-6 rounded-full bg-[#8C0027] text-white flex items-center justify-center shrink-0">
                <Volume2 className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] truncate">
                Memutar suara · {miniAudio.senderName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMiniAudio(null)}
              aria-label="Tutup mini player"
              className="h-6 w-6 rounded-full flex items-center justify-center text-[#5A6578] hover:text-[#8C0027]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {(() => {
          const customLayers = getCustomWallpaperLayers(appearance, darkMode);
          if (!customLayers) return null;
          return (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden z-0">
              <div className="absolute inset-0" style={customLayers.imageStyle} />
              <div className="absolute inset-0" style={customLayers.overlayStyle} />
            </div>
          );
        })()}
      <div
        key={chat.id}
        ref={scrollContainerRef}
        style={getWallpaperStyle(appearance, darkMode)}
        className={`relative z-10 p5-chat-enter flex-1 overflow-y-auto thin-scrollbar px-3 sm:px-5 pt-4 pb-[88px] sm:pb-24 ${
          appearance.wallpaper === 'doodle-animated' ? 'doodle-wallpaper-bg' : ''
        } ${appearance.wallpaper === 'custom' && appearance.customWallpaperUrl ? '!bg-transparent' : ''}`}
        onLoadCapture={() => {
          if (!showScrollDownRef.current) {
            scrollToBottomNow();
          }
        }}
        onClick={() => {
          setActiveMenuMsgId(null);
          if (document.activeElement === inputRef.current) {
            inputRef.current?.blur();
          }
        }}
        onScroll={(e) => {
          if (activeMenuMsgId) setActiveMenuMsgId(null);
          const el = e.currentTarget;
          const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          const far = distFromBottom > 180;
          showScrollDownRef.current = far;
          setShowScrollDown(far);
          if (!far) setUnreadWhileScrolledUp(0);
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 1 && e.touches[0].clientX < 28) {
            edgeSwipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          } else {
            edgeSwipeRef.current = null;
          }
        }}
        onTouchEnd={(e) => {
          const edge = edgeSwipeRef.current;
          edgeSwipeRef.current = null;
          if (!edge || e.changedTouches.length !== 1) return;
          const dx = e.changedTouches[0].clientX - edge.x;
          const dy = Math.abs(e.changedTouches[0].clientY - edge.y);
          if (dx > 72 && dy < 48 && window.innerWidth < 768) {
            triggerAndroidHaptic();
            onBackMobile();
          }
        }}
      >
        <div ref={messagesInnerRef} className="space-y-2.5 min-h-full">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs font-semibold text-[#5A6578] dark:text-[#94A3B8]">
            Memuat riwayat pesan...
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="px-6 py-5 rounded-xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow text-center max-w-xs">
              <p className="font-display font-extrabold text-lg text-[#161B26] dark:text-[#F5F7FA]">
                Belum ada pesan di sini
              </p>
              <p className="mt-1 text-xs text-[#5A6578] dark:text-[#94A3B8]">
                Kirim teks, seret dokumen, tempel gambar (Ctrl+V), atau rekam pesan suara.
              </p>
            </div>
          </div>
        ) : (
          visibleMessages.map((msg, index) => {
            const prevMsg = index > 0 ? visibleMessages[index - 1] : null;
            const showDateDivider =
              !prevMsg ||
              formatDateDivider(prevMsg.createdAt) !== formatDateDivider(msg.createdAt);

            if (msg.systemEvent) {
              return (
                <div key={msg.id} className="my-2.5 flex justify-center">
                  <span className="px-3 py-1 rounded-lg bg-[#FFFFFF] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#324058] text-[11px] font-semibold text-[#161B26] dark:text-[#E2E8F0]">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const isOwn = msg.senderId === currentUser.id;
            const sender = users[msg.senderId];
            const repliedMsg = msg.replyToId
              ? messages.find((m) => m.id === msg.replyToId)
              : null;
            const isReadByOther =
              isOwn && msg.readBy.some((uid) => uid !== currentUser.id);
            const showSenderName =
              !isOwn &&
              chat.type === 'group' &&
              (!prevMsg || prevMsg.senderId !== msg.senderId || showDateDivider);

            return (
              <div key={msg.id}>
                {showDateDivider && (
                  <div className="my-3.5 flex justify-center">
                    <span className="p5-skew inline-block px-3.5 py-0.5 bg-[#161B26] text-[#FFFFFF] border border-[#8C0027] brutal-shadow-sm">
                      <span className="p5-unskew font-display font-bold text-xs tracking-wider">
                        {formatDateDivider(msg.createdAt)}
                      </span>
                    </span>
                  </div>
                )}

                <div
                  onTouchStart={(e) => {
                    if (e.touches.length !== 1) return;
                    const target = e.target as HTMLElement | null;
                    const ignoreLongPress = Boolean(target?.closest('button, a, input, textarea, audio, video'));
                    const ignoreSwipe = Boolean(target?.closest('input, textarea, audio, video')) || e.touches[0].clientX < 28;
                    const rowEl = e.currentTarget;
                    if (msgLongPressRef.current !== null) {
                      window.clearTimeout(msgLongPressRef.current);
                    }
                    if (!ignoreLongPress) {
                      msgLongPressRef.current = window.setTimeout(() => {
                        msgLongPressRef.current = null;
                        triggerAndroidHaptic();
                        openMessageMenu(msg.id, rowEl, isOwn);
                      }, 450);
                    }
                    swipeReplyRef.current = {
                      msgId: msg.id,
                      x: e.touches[0].clientX,
                      y: e.touches[0].clientY,
                      locked: false,
                      ignore: ignoreSwipe,
                      hapticFired: false,
                    };
                  }}
                  onTouchMove={(e) => {
                    const start = swipeReplyRef.current;
                    if (!start || start.ignore || start.msgId !== msg.id || e.touches.length !== 1) {
                      return;
                    }
                    const dx = e.touches[0].clientX - start.x;
                    const dy = e.touches[0].clientY - start.y;
                    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                      if (msgLongPressRef.current !== null) {
                        window.clearTimeout(msgLongPressRef.current);
                        msgLongPressRef.current = null;
                      }
                    }
                    if (!start.locked) {
                      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.1) {
                        start.locked = true;
                        setSwipingMsgId(msg.id);
                      } else if (Math.abs(dy) > 10) {
                        start.ignore = true;
                        return;
                      } else {
                        return;
                      }
                    }
                    const clamped = Math.max(-72, Math.min(72, dx));
                    if (!start.hapticFired && Math.abs(clamped) >= 44) {
                      start.hapticFired = true;
                      triggerAndroidHaptic();
                    }
                    setSwipeOffsetX(clamped);
                  }}
                  onTouchEnd={(e) => {
                    if (msgLongPressRef.current !== null) {
                      window.clearTimeout(msgLongPressRef.current);
                      msgLongPressRef.current = null;
                    }
                    const start = swipeReplyRef.current;
                    const pulledRight = swipeOffsetX >= 44 && start?.msgId === msg.id;
                    const pulledLeft = swipeOffsetX <= -44 && start?.msgId === msg.id;
                    const moved = start?.locked;
                    swipeReplyRef.current = null;
                    setSwipingMsgId(null);
                    setSwipeOffsetX(0);
                    if (pulledRight) {
                      setReplyTo(msg);
                      window.setTimeout(() => inputRef.current?.focus(), 60);
                    } else if (pulledLeft) {
                      onForwardMessage(msg);
                    } else if (!moved && !start?.ignore && e.changedTouches.length === 1) {
                      const now = Date.now();
                      if (
                        lastTapRef.current &&
                        lastTapRef.current.msgId === msg.id &&
                        now - lastTapRef.current.time < 280
                      ) {
                        lastTapRef.current = null;
                        triggerAndroidHaptic();
                        void onToggleReaction(msg.id, '❤️');
                      } else {
                        lastTapRef.current = { msgId: msg.id, time: now };
                      }
                    }
                  }}
                  onTouchCancel={() => {
                    if (msgLongPressRef.current !== null) {
                      window.clearTimeout(msgLongPressRef.current);
                      msgLongPressRef.current = null;
                    }
                    swipeReplyRef.current = null;
                    setSwipingMsgId(null);
                    setSwipeOffsetX(0);
                  }}
                  className={`relative touch-pan-y flex items-end gap-2 group ${
                    menuRetained.renderedValue === msg.id ? 'z-40' : ''
                  } ${isOwn ? 'justify-end p5-msg-own' : 'justify-start p5-msg-peer'}`}
                >
                  {swipingMsgId === msg.id && swipeOffsetX > 8 && (
                    <div
                      style={{
                        opacity: Math.min(1, swipeOffsetX / 44),
                        transform: `translateY(-50%) scale(${Math.min(1.1, 0.7 + (swipeOffsetX / 44) * 0.35).toFixed(2)})`,
                      }}
                      className="pointer-events-none absolute left-1 top-1/2 w-8 h-8 rounded-full bg-[#8C0027] text-white flex items-center justify-center shadow-md z-10"
                    >
                      <Reply className="w-4 h-4" />
                    </div>
                  )}
                  {swipingMsgId === msg.id && swipeOffsetX < -8 && (
                    <div
                      style={{
                        opacity: Math.min(1, Math.abs(swipeOffsetX) / 44),
                        transform: `translateY(-50%) scale(${Math.min(1.1, 0.7 + (Math.abs(swipeOffsetX) / 44) * 0.35).toFixed(2)})`,
                      }}
                      className="pointer-events-none absolute right-1 top-1/2 w-8 h-8 rounded-full bg-[#161B26] dark:bg-[#232D40] text-white flex items-center justify-center shadow-md z-10"
                    >
                      <Forward className="w-4 h-4" />
                    </div>
                  )}
                  {selectionMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMsgIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(msg.id)) next.delete(msg.id);
                          else next.add(msg.id);
                          return next;
                        });
                      }}
                      aria-label={`Pilih pesan ${msg.id}`}
                      className={`mr-1.5 self-center h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        selectedMsgIds.has(msg.id)
                          ? 'bg-[#8C0027] border-[#8C0027] text-white'
                          : 'border-[#94A3B8] bg-white/80 dark:bg-[#1E2738]'
                      }`}
                    >
                      {selectedMsgIds.has(msg.id) && <Check className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {!isOwn && chat.type === 'group' && (
                    <div className="w-8 shrink-0">
                      {showSenderName && (
                        <Avatar
                          name={sender?.displayName || 'Anggota'}
                          imageUrl={sender?.avatarUrl}
                          color={sender?.avatarColor}
                          size="xs"
                        />
                      )}
                    </div>
                  )}

                  <div
                    style={
                      swipingMsgId === msg.id && swipeOffsetX !== 0
                        ? { transform: `translate3d(${swipeOffsetX}px, 0, 0)` }
                        : undefined
                    }
                    className={`relative max-w-[84%] sm:max-w-[68%] ${
                      swipingMsgId === msg.id ? '' : 'transition-transform duration-200 ease-out'
                    }`}
                  >
                    <div
                      className={`px-3.5 py-2.5 ${getBubbleClasses(appearance, isOwn)}`}
                    >
                      {/* Group Sender Name */}
                      {showSenderName && (
                        <div className="text-xs font-display font-extrabold text-[#8C0027] dark:text-[#F47296] mb-0.5">
                          {sender?.displayName || 'Pengguna'}
                        </div>
                      )}

                      {/* Forwarded Attribution */}
                      {msg.forwardedFrom && (
                        <div
                          className={`text-[11px] mb-1 flex items-center gap-1 font-semibold ${
                            isOwn ? 'text-[#FDE68A]' : 'text-[#8C0027] dark:text-[#F47296]'
                          }`}
                        >
                          <Forward className="w-3 h-3" />
                          <span>Diteruskan dari {msg.forwardedFrom.senderName}</span>
                        </div>
                      )}

                      {/* Reply-to-Story Quote with Thumbnail */}
                      {msg.replyToStory && (
                        <div
                          className={`mb-1.5 p-2 rounded-xl border text-xs flex items-center gap-2.5 ${
                            isOwn
                              ? 'bg-[#161B26]/25 border-[#FFFFFF]/35 text-[#FFFFFF]'
                              : 'bg-[#F5F7FA] dark:bg-[#261D2A] border-[#161B26]/25 dark:border-[#324058]'
                          }`}
                        >
                          <div
                            style={
                              !msg.replyToStory.mediaUrl
                                ? { backgroundColor: msg.replyToStory.bgColor || '#8C0027' }
                                : undefined
                            }
                            className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#171E2C] flex items-center justify-center"
                          >
                            {msg.replyToStory.mediaUrl && msg.replyToStory.kind === 'image' ? (
                              <img
                                src={msg.replyToStory.mediaUrl}
                                alt="Status"
                                className="w-full h-full object-cover"
                              />
                            ) : msg.replyToStory.mediaUrl && msg.replyToStory.kind === 'video' ? (
                              <video
                                src={msg.replyToStory.mediaUrl}
                                muted
                                playsInline
                                preload="metadata"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[8px] font-bold text-white px-1 text-center line-clamp-2 leading-tight">
                                {msg.replyToStory.snippet}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-[11px] truncate">
                              Status · {msg.replyToStory.authorName}
                            </div>
                            <div className="opacity-85 truncate">{msg.replyToStory.snippet}</div>
                          </div>
                        </div>
                      )}

                      {/* Reply Quote */}
                      {repliedMsg && (
                        <div
                          className={`mb-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
                            isOwn
                              ? 'bg-[#161B26]/25 border-[#FFFFFF]/35 text-[#FFFFFF]'
                              : 'bg-[#F5F7FA] dark:bg-[#261D2A] border-[#161B26]/25 dark:border-[#324058]'
                          }`}
                        >
                          <div
                            className={`font-bold text-[11px] truncate ${
                              isOwn ? 'text-[#FDE68A]' : 'text-[#8C0027] dark:text-[#F47296]'
                            }`}
                          >
                            {users[repliedMsg.senderId]?.displayName || 'Pengguna'}
                          </div>
                          <div className="opacity-85 truncate">
                            {repliedMsg.text || repliedMsg.attachment?.name || 'Lampiran'}
                          </div>
                        </div>
                      )}

                      {/* View-Once Media Attachment */}
                      {msg.attachment?.viewOnce && (msg.attachment.kind === 'image' || msg.attachment.kind === 'video') ? (
                        (() => {
                          const alreadyViewed = !isOwn && msg.attachment!.viewedBy?.includes(currentUser.id);
                          return (
                            <button
                              type="button"
                              disabled={alreadyViewed}
                              onClick={() => {
                                if (alreadyViewed) return;
                                setViewOnceModalMsg(msg);
                                if (!isOwn) void onMarkViewOnceViewed?.(msg.id);
                              }}
                              className={`mb-1.5 px-3 py-2 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all ${
                                alreadyViewed
                                  ? 'opacity-60 cursor-default bg-black/10 border-current/20'
                                  : isOwn
                                  ? 'bg-white/15 border-white/30 text-white hover:bg-white/25'
                                  : 'bg-[#EAF4FF] dark:bg-[#1E2738] border-[#BEDEFF] dark:border-[#324058] text-[#8C0027] dark:text-[#F47296]'
                              }`}
                            >
                              <span className="h-5 w-5 rounded-full border border-current flex items-center justify-center text-[10px] font-mono">
                                1
                              </span>
                              <span>
                                {alreadyViewed
                                  ? 'Dibuka'
                                  : msg.attachment!.kind === 'video'
                                  ? 'Video Sekali Lihat'
                                  : 'Foto Sekali Lihat'}
                              </span>
                            </button>
                          );
                        })()
                      ) : (
                        <>
                          {/* Image Attachment */}
                          {msg.attachment?.kind === 'image' && (
                            <button
                              type="button"
                              onClick={() => {
                                setLightboxZoom(1);
                                setLightboxMsgId(msg.id);
                              }}
                              className="block w-full max-w-[300px] sm:max-w-[340px] mb-1.5 rounded-2xl overflow-hidden bg-black/5 dark:bg-black/25 focus:outline-none"
                            >
                              <img
                                src={msg.attachment.url}
                                alt={msg.attachment.name}
                                className={`block w-full max-h-80 object-contain rounded-2xl transition-all ${
                                  msg.attachment.isSpoiler && !revealedSpoilers.has(msg.id)
                                    ? 'blur-xl scale-105 brightness-75'
                                    : ''
                                }`}
                                loading="lazy"
                              />
                              {msg.attachment.isSpoiler && !revealedSpoilers.has(msg.id) && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRevealedSpoilers((prev) => new Set(prev).add(msg.id));
                                  }}
                                  className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xs font-bold gap-1.5"
                                >
                                  <EyeOff className="w-4 h-4" />
                                  <span>Spoiler · Ketuk</span>
                                </span>
                              )}
                            </button>
                          )}

                          {/* Video Attachment */}
                          {msg.attachment?.kind === 'video' && (
                            <div className="mb-1.5 rounded-lg overflow-hidden border border-[#E6ECF2] bg-black">
                              <video
                                src={msg.attachment.url}
                                controls
                                preload="metadata"
                                className="max-h-72 max-w-full"
                              />
                            </div>
                          )}
                        </>
                      )}

                      {/* Interactive Poll Card */}
                      {msg.poll && (
                        <div className="mb-1.5 min-w-[220px] max-w-[300px] space-y-2">
                          <div className="flex items-start gap-1.5">
                            <BarChart3 className="w-4 h-4 shrink-0 mt-0.5 opacity-85" />
                            <div>
                              <div className="text-[13px] font-bold leading-snug">{msg.poll.question}</div>
                              <div className="text-[10px] opacity-75">
                                {msg.poll.allowMultiple ? 'Pilih satu atau lebih' : 'Pilih satu'}
                              </div>
                            </div>
                          </div>
                          {(() => {
                            const totalVotes = msg.poll!.options.reduce(
                              (sum, o) => sum + o.voterIds.length,
                              0
                            );
                            return (
                              <div className="space-y-1.5">
                                {msg.poll!.options.map((opt) => {
                                  const voted = opt.voterIds.includes(currentUser.id);
                                  const pct =
                                    totalVotes > 0
                                      ? Math.round((opt.voterIds.length / totalVotes) * 100)
                                      : 0;
                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => void onVotePoll?.(msg.id, opt.id)}
                                      className={`relative w-full text-left px-2.5 py-2 rounded-xl border overflow-hidden transition-all ${
                                        voted
                                          ? isOwn
                                            ? 'border-white/60 bg-white/15'
                                            : 'border-[#8C0027] bg-[#8C0027]/10'
                                          : isOwn
                                          ? 'border-white/25 bg-black/15 hover:bg-black/25'
                                          : 'border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#1E2738]'
                                      }`}
                                    >
                                      <div
                                        style={{ width: `${pct}%` }}
                                        className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                                          isOwn ? 'bg-white/20' : 'bg-[#8C0027]/15 dark:bg-[#F47296]/20'
                                        }`}
                                      />
                                      <div className="relative flex items-center justify-between gap-2 text-xs">
                                        <span className="flex items-center gap-1.5 font-semibold truncate">
                                          {voted && <Check className="w-3.5 h-3.5 shrink-0" />}
                                          <span className="truncate">{opt.text}</span>
                                        </span>
                                        <span className="font-mono text-[10px] font-bold shrink-0 tabular-nums">
                                          {opt.voterIds.length} ({pct}%)
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
                                <div className="text-[10px] font-mono opacity-75 text-right">
                                  Total suara: {totalVotes}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Voice Note Attachment */}
                      {msg.attachment?.kind === 'audio' && (
                        <VoiceNotePlayer
                          url={msg.attachment.url}
                          durationSec={msg.attachment.durationSec}
                          isOwn={isOwn}
                          onPlayChange={(isPlaying) => {
                            if (isPlaying) {
                              setMiniAudio({
                                msgId: msg.id,
                                senderName: users[msg.senderId]?.displayName || 'Pengguna',
                                url: msg.attachment!.url,
                              });
                            } else if (miniAudio?.msgId === msg.id) {
                              setMiniAudio(null);
                            }
                          }}
                        />
                      )}

                      {/* Document Attachment */}
                      {msg.attachment?.kind === 'file' && (
                        <a
                          href={msg.attachment.url}
                          download={msg.attachment.name}
                          className={`mb-1.5 p-2.5 rounded-lg border flex items-center gap-3 transition-colors ${
                            isOwn
                              ? 'bg-[#161B26]/25 border-[#FFFFFF]/35 hover:bg-[#161B26]/40'
                              : 'bg-[#F5F7FA] dark:bg-[#232D40] border-[#161B26]/30 dark:border-[#324058] hover:border-[#8C0027]'
                          }`}
                        >
                          <div
                            className={`h-9 w-9 rounded-lg border border-[#E6ECF2] flex items-center justify-center shrink-0 ${
                              isOwn ? 'bg-[#FFFFFF] text-[#8C0027]' : 'bg-[#8C0027] text-[#FFFFFF]'
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold truncate">
                              {msg.attachment.name}
                            </div>
                            <div className="font-mono text-[10px] opacity-75">
                              {formatBytes(msg.attachment.size)}
                            </div>
                          </div>
                          <Download className="w-4 h-4 opacity-75 shrink-0" />
                        </a>
                      )}

                      {/* Sticker */}
                      {msg.sticker && (
                        <div className="mb-1 py-1 text-5xl leading-none select-none text-center flex justify-center">
                          {msg.sticker.id.startsWith('data:') ? (
                            <img
                              src={msg.sticker.id}
                              alt={msg.sticker.label}
                              className="w-24 h-24 rounded-2xl object-cover"
                            />
                          ) : (
                            msg.sticker.id
                          )}
                        </div>
                      )}

                      {/* Contact Card */}
                      {msg.contactCard && (
                        <div
                          className={`mb-1.5 p-2.5 rounded-xl border flex items-center justify-between gap-2.5 min-w-[210px] ${
                            isOwn
                              ? 'bg-black/20 border-white/25 text-white'
                              : 'bg-[#F5F7FA] dark:bg-[#1E2738] border-[#E6ECF2] dark:border-[#324058]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar
                              name={msg.contactCard.displayName}
                              imageUrl={msg.contactCard.avatarUrl || null}
                              color={msg.contactCard.avatarColor}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate">{msg.contactCard.displayName}</div>
                              <div className="text-[11px] font-mono opacity-80 truncate">
                                @{msg.contactCard.username}
                              </div>
                            </div>
                          </div>
                          {onOpenDirectChat && msg.contactCard.userId !== currentUser.id && (
                            <button
                              type="button"
                              onClick={() => onOpenDirectChat(msg.contactCard!.userId)}
                              className="px-2.5 py-1 rounded-full bg-[#8C0027] text-white text-[11px] font-bold shrink-0"
                            >
                              Chat
                            </button>
                          )}
                        </div>
                      )}

                      {/* Location Card */}
                      {msg.location && (
                        <a
                          href={`https://maps.google.com/?q=${msg.location.lat},${msg.location.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`mb-1.5 p-2.5 rounded-xl border flex items-center gap-2.5 min-w-[210px] ${
                            isOwn
                              ? 'bg-black/20 border-white/25 text-white hover:bg-black/30'
                              : 'bg-[#F5F7FA] dark:bg-[#1E2738] border-[#E6ECF2] dark:border-[#324058] hover:border-[#8C0027]'
                          }`}
                        >
                          <span className="h-9 w-9 rounded-full bg-[#8C0027] text-white flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">
                              {msg.location.label || 'Lokasi Terkini'}
                            </div>
                            <div className="text-[11px] font-mono opacity-80 truncate">
                              {msg.location.lat.toFixed(4)}, {msg.location.lng.toFixed(4)} · Buka Maps
                            </div>
                          </div>
                        </a>
                      )}

                      {/* Message Text */}
                      {msg.text && (
                        <p className="text-[14px] leading-[1.5] whitespace-pre-wrap break-words">
                          {renderSafeMessageText(msg.text, isOwn)}
                        </p>
                      )}

                      {/* Link Preview Card */}
                      {msg.linkPreview && isSafeHttpUrl(msg.linkPreview.url) && (
                        <a
                          href={msg.linkPreview.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`mt-1.5 block rounded-xl overflow-hidden border transition-colors ${
                            isOwn
                              ? 'bg-black/20 border-white/25 text-white'
                              : 'bg-[#F5F7FA] dark:bg-[#1E2738] border-[#E6ECF2] dark:border-[#324058]'
                          }`}
                        >
                          {msg.linkPreview.image && isSafeHttpUrl(msg.linkPreview.image) && (
                            <img
                              src={msg.linkPreview.image}
                              alt={msg.linkPreview.title}
                              className="w-full max-h-32 object-cover"
                              loading="lazy"
                            />
                          )}
                          <div className="p-2.5 space-y-0.5">
                            <div className="text-[10px] font-mono uppercase opacity-75 truncate">
                              {msg.linkPreview.domain || 'Tautan'}
                            </div>
                            <div className="text-xs font-bold leading-snug line-clamp-2">
                              {msg.linkPreview.title}
                            </div>
                            {msg.linkPreview.description && (
                              <div className="text-[11px] opacity-80 line-clamp-2">
                                {msg.linkPreview.description}
                              </div>
                            )}
                          </div>
                        </a>
                      )}

                      {/* AI Translation Block */}
                      {translatingId === msg.id && (
                        <div className="mt-1.5 pt-1.5 border-t border-current/20 text-[11px] opacity-85">
                          Menerjemahkan dengan AI...
                        </div>
                      )}
                      {translations[msg.id] && (
                        <div className="mt-1.5 pt-1.5 border-t border-current/20 text-xs">
                          <span className="font-bold text-[10px] block mb-0.5 opacity-80">
                            Terjemahan AI
                          </span>
                          {translations[msg.id]}
                        </div>
                      )}

                      {/* Footer Metadata */}
                      <div
                        className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] select-none ${
                          isOwn ? 'text-[#FFF2A7]/90' : 'text-[#6B768A] dark:text-[#7E8DA4]'
                        }`}
                      >
                        {msg.expiresAt && (
                          <span className="inline-flex items-center gap-0.5 text-[#FDE68A]">
                            <Timer className="w-2.5 h-2.5" />
                          </span>
                        )}
                        {chat.type === 'channel' && typeof msg.views === 'number' && (
                          <span className="inline-flex items-center gap-0.5 font-mono tabular-nums">
                            <Eye className="w-3 h-3" />
                            {msg.views}
                          </span>
                        )}
                        {msg.editedAt && <span className="italic">diedit</span>}
                        {currentUser.starredMessageIds?.includes(msg.id) && (
                          <Star className="w-3 h-3 fill-[#F59B00] text-[#F59B00]" />
                        )}
                        <span className="font-mono tabular-nums">
                          {formatTimeShort(msg.createdAt)}
                        </span>
                        {isOwn && (
                          isReadByOther ? (
                            <CheckCheck className="w-3.5 h-3.5 text-[#FDE68A]" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-[#FFF2A7]/75" />
                          )
                        )}
                      </div>
                    </div>

                    {/* Thread Reply Count Chip (#2) */}
                    {(replyCountByMsgId[msg.id] || 0) > 0 && (
                      <div className={`mt-1 flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <button
                          type="button"
                          onClick={() => setThreadRootMsg(msg)}
                          className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#324058] text-[11px] font-bold text-[#8C0027] dark:text-[#F47296] flex items-center gap-1 hover:border-[#8C0027]"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>{replyCountByMsgId[msg.id]} balasan</span>
                        </button>
                      </div>
                    )}

                    {/* Reactions Row */}
                    {msg.reactions.length > 0 && (
                      <div
                        className={`mt-1.5 flex flex-wrap gap-1 ${
                          isOwn ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.reactions.map((r) => {
                          const reactedByMe = r.userIds.includes(currentUser.id);
                          return (
                            <button
                              key={r.emoji}
                              type="button"
                              onClick={() => void onToggleReaction(msg.id, r.emoji)}
                              className={`px-2 py-0.5 rounded-lg text-xs flex items-center gap-1 border transition-colors ${
                                reactedByMe
                                  ? 'bg-[#8C0027] text-[#FFFFFF] border-[#E6ECF2] dark:border-[#F5F7FA]'
                                  : 'bg-[#FFFFFF] dark:bg-[#1E2738] text-[#161B26] dark:text-[#F5F7FA] border-[#E6ECF2] dark:border-[#324058] hover:border-[#8C0027]'
                              }`}
                            >
                              <span>{r.emoji}</span>
                              <span className="font-mono text-[10px] font-bold tabular-nums">
                                {r.userIds.length}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Floating Message Context Menu — rendered via React Portal to document.body (opened via long-press or right-click) */}
                    {menuRetained.renderedValue === msg.id && menuPos && typeof document !== 'undefined' && createPortal(
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'fixed',
                          zIndex: 9999,
                          width: '13rem',
                          ...(menuPos.upward
                            ? { bottom: `${Math.min(window.innerHeight - 340, Math.max(16, window.innerHeight - menuPos.y))}px` }
                            : { top: `${menuPos.y}px` }),
                          left: `${menuPos.x}px`,
                        }}
                        className={`${
                          menuRetained.closing ? 'p5-menu-out pointer-events-none' : 'p5-menu-in'
                        } rounded-xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow p-1.5`}
                      >
                        <div className="flex items-center justify-between px-1 py-1 border-b border-[#E6ECF2] dark:border-[#2A364B] mb-1">
                          {QUICK_REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                void onToggleReaction(msg.id, emoji);
                                setActiveMenuMsgId(null);
                              }}
                              className="h-7 w-7 rounded-lg hover:bg-[#EAF4FF] dark:hover:bg-[#1B2436] flex items-center justify-center text-sm"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(msg);
                            setEditingMsg(null);
                            setActiveMenuMsgId(null);
                            inputRef.current?.focus();
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#EAF4FF] dark:hover:bg-[#1B2436] flex items-center gap-2"
                        >
                          <Reply className="w-3.5 h-3.5" />
                          <span>Balas</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onForwardMessage(msg);
                            setActiveMenuMsgId(null);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#EAF4FF] dark:hover:bg-[#1B2436] flex items-center gap-2"
                        >
                          <Forward className="w-3.5 h-3.5" />
                          <span>Teruskan</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectionMode(true);
                            setSelectedMsgIds(new Set([msg.id]));
                            setActiveMenuMsgId(null);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#EAF4FF] dark:hover:bg-[#1B2436] flex items-center gap-2"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>Pilih Pesan</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setMsgInfoTarget(msg);
                            setActiveMenuMsgId(null);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#EAF4FF] dark:hover:bg-[#1B2436] flex items-center gap-2"
                        >
                          <Info className="w-3.5 h-3.5" />
                          <span>Info Pesan</span>
                        </button>

                        {onRemindMessage && (
                          <button
                            type="button"
                            onClick={() => {
                              onRemindMessage(msg, 3600_000);
                              setActiveMenuMsgId(null);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#EAF4FF] dark:hover:bg-[#1B2436] flex items-center gap-2"
                          >
                            <BellRing className="w-3.5 h-3.5" />
                            <span>Ingatkan 1 Jam</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            void onToggleStarMessage(msg.id);
                            setActiveMenuMsgId(null);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#EAF4FF] dark:hover:bg-[#1B2436] flex items-center gap-2"
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              currentUser.starredMessageIds?.includes(msg.id)
                                ? 'fill-[#F59B00] text-[#F59B00]'
                                : ''
                            }`}
                          />
                          <span>
                            {currentUser.starredMessageIds?.includes(msg.id)
                              ? 'Hapus Bintang'
                              : 'Bintangi Pesan'}
                          </span>
                        </button>

                        {(msg.attachment?.kind === 'image' || msg.attachment?.kind === 'video') && (
                          <button
                            type="button"
                            onClick={() => {
                              const att = msg.attachment!;
                              setActiveMenuMsgId(null);
                              triggerAndroidHaptic();
                              void saveMediaToGallery(att.url, att.name);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#EAF4FF] dark:hover:bg-[#1B2436] flex items-center gap-2"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Simpan ke Galeri</span>
                          </button>
                        )}

                        {msg.text.trim().length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard?.writeText(msg.text).catch(() => {});
                              triggerAndroidHaptic();
                              setActiveMenuMsgId(null);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#EAF4FF] dark:hover:bg-[#1B2436] flex items-center gap-2"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin Teks</span>
                          </button>
                        )}

                        {msg.text.trim().length > 0 && (
                          <button
                            type="button"
                            onClick={() => void handleTriggerTranslate(msg)}
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#8C0027] dark:text-[#F47296] hover:bg-[#EAF4FF] dark:hover:bg-[#1B2436] flex items-center gap-2"
                          >
                            <Languages className="w-3.5 h-3.5" />
                            <span>{t(lang, 'aiTranslate')}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            void onPinMessage(chat.pinnedMessageId === msg.id ? null : msg.id);
                            setActiveMenuMsgId(null);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#EAF4FF] dark:hover:bg-[#1B2436] flex items-center gap-2"
                        >
                          <Pin className="w-3.5 h-3.5" />
                          <span>
                            {chat.pinnedMessageId === msg.id ? 'Lepas Sematan' : 'Sematkan'}
                          </span>
                        </button>

                        {isOwn && msg.text && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMsg(msg);
                              setReplyTo(null);
                              onDraftChange(msg.text);
                              setActiveMenuMsgId(null);
                              inputRef.current?.focus();
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#EAF4FF] dark:hover:bg-[#1B2436] flex items-center gap-2"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit Pesan</span>
                          </button>
                        )}

                        {!isOwn && (
                          <button
                            type="button"
                            onClick={() => {
                              onReportMessage(msg);
                              setActiveMenuMsgId(null);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-2"
                          >
                            <Flag className="w-3.5 h-3.5" />
                            <span>Laporkan Pesan</span>
                          </button>
                        )}

                        {(isOwn || isGroupAdminOrMod) && (
                          <button
                            type="button"
                            onClick={() => {
                              void onDeleteMessage(msg.id);
                              setActiveMenuMsgId(null);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#B91C1C] dark:text-[#FF6B81] hover:bg-[#FEF2F2] dark:hover:bg-[#2B1217] flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {/* Optimistic Media Upload Bubbles (WhatsApp-style circular spinner on image) */}
        {optimisticUploads.map((item) => {
          const radius = 18;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference - (Math.min(100, Math.max(5, item.progress)) / 100) * circumference;
          return (
            <div key={item.tempId} className="flex justify-end p5-msg-own">
              <div className="max-w-[84%] sm:max-w-[68%]">
                <div className={`px-3.5 py-2.5 ${getBubbleClasses(appearance, true)}`}>
                  {item.kind === 'image' ? (
                    <div className="relative w-full max-w-[300px] sm:max-w-[340px] mb-1.5 rounded-2xl overflow-hidden bg-black/25">
                      <img
                        src={item.localUrl}
                        alt={item.name}
                        className="block w-full max-h-80 object-contain rounded-2xl brightness-75"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                        {item.error ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void runOptimisticUpload(item)}
                              aria-label="Coba unggah lagi"
                              className="h-11 px-3.5 rounded-full bg-[#8C0027] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
                            >
                              <RefreshCw className="w-4 h-4" />
                              <span>Coba Lagi</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOptimisticUploads((prev) => prev.filter((u) => u.tempId !== item.tempId));
                                URL.revokeObjectURL(item.localUrl);
                              }}
                              aria-label="Batalkan unggahan"
                              className="h-11 w-11 rounded-full bg-black/60 text-white flex items-center justify-center"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="relative h-12 w-12 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center">
                            <svg className="h-12 w-12 -rotate-90 animate-spin" viewBox="0 0 44 44">
                              <circle
                                cx="22"
                                cy="22"
                                r={radius}
                                fill="none"
                                stroke="rgba(255,255,255,0.22)"
                                strokeWidth="3"
                              />
                              <circle
                                cx="22"
                                cy="22"
                                r={radius}
                                fill="none"
                                stroke="#FFFFFF"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                              />
                            </svg>
                            <span className="absolute font-mono text-[10px] font-bold text-white tabular-nums">
                              {item.progress}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : item.kind === 'video' ? (
                    <div className="relative mb-1.5 rounded-lg overflow-hidden bg-black max-w-[300px]">
                      <video src={item.localUrl} muted className="max-h-64 max-w-full brightness-75" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                        <div className="h-11 w-11 rounded-full border-[3px] border-white/25 border-t-white animate-spin" />
                      </div>
                    </div>
                  ) : (
                    <div className="mb-1.5 p-2.5 rounded-lg border bg-[#161B26]/25 border-[#FFFFFF]/35 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
                      <div className="min-w-0 flex-1 text-xs truncate">{item.name}</div>
                    </div>
                  )}
                  {item.text && (
                    <p className="text-[14px] leading-[1.5] whitespace-pre-wrap break-words">
                      {item.text}
                    </p>
                  )}
                  <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#FFF2A7]/90">
                    <Clock className="w-3 h-3" />
                    <span>{item.error ? 'Gagal' : 'Mengirim...'}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
        </div>
      </div>
      </div>

      {/* WhatsApp-style Scroll-to-Bottom FAB with Unread Counter */}
      {showScrollDown && (
        <button
          type="button"
          onClick={() => {
            triggerAndroidHaptic();
            setUnreadWhileScrolledUp(0);
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          aria-label="Gulir ke pesan terbaru"
          className="p5-panel-reveal absolute bottom-28 right-4 z-20 h-11 w-11 rounded-full liquid-glass text-[#161B26] dark:text-[#F5F7FA] flex items-center justify-center brutal-press"
        >
          {unreadWhileScrolledUp > 0 && (
            <span className="absolute -top-2 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-[#8C0027] text-white text-[10px] font-mono font-bold flex items-center justify-center shadow-sm">
              {unreadWhileScrolledUp > 99 ? '99+' : unreadWhileScrolledUp}
            </span>
          )}
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* Floating Liquid-Glass Dock (Popovers + Composer Capsule) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col justify-end px-3 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] sm:pb-4">
        <div className="pointer-events-auto flex flex-col">
      {/* Mention Autocomplete Popover */}
      {mentionCandidates.length > 0 && (
        <div className="p5-panel-reveal mb-1.5 rounded-2xl liquid-glass overflow-hidden z-20">
          {mentionCandidates.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => insertMention(u.username)}
              className="p5-row-motion w-full px-3 py-2 flex items-center gap-2.5 hover:bg-[#EAF4FF] dark:hover:bg-[#1B2436] text-left"
            >
              <Avatar name={u.displayName} imageUrl={u.avatarUrl} color={u.avatarColor} size="xs" />
              <span className="text-xs font-semibold text-[#161B26] dark:text-[#F5F7FA]">
                {u.displayName}
              </span>
              <span className="font-mono text-[11px] text-[#8C0027] dark:text-[#F47296]">
                @{u.username}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Pre-Send File Preview & Upload Progress */}
      {fileBarPresence.mounted && (
        <div
          className={`${
            fileBarPresence.closing ? 'p5-panel-out pointer-events-none' : 'p5-panel-reveal'
          } mb-1.5 px-4 py-2.5 rounded-2xl liquid-glass space-y-1.5`}
        >
          {pendingFile && (
            <div className="flex items-center gap-3">
              {pendingPreviewUrl && pendingFile.type.startsWith('image/') ? (
                <img
                  src={pendingPreviewUrl}
                  alt={pendingFile.name}
                  className="h-12 w-12 rounded-xl object-cover border border-[#E6ECF2] shrink-0"
                />
              ) : pendingPreviewUrl && pendingFile.type.startsWith('video/') ? (
                <video
                  src={pendingPreviewUrl}
                  className="h-12 w-12 rounded-xl object-cover border border-[#E6ECF2] shrink-0"
                  muted
                />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-[#EAF4FF] dark:bg-[#1B2436] border border-[#E6ECF2] text-[#8C0027] flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[#161B26] dark:text-[#F5F7FA] truncate">
                  {pendingFile.name}
                </div>
                <div className="font-mono text-[11px] text-[#6B768A] dark:text-[#94A3B8]">
                  {formatBytes(pendingFile.size)} · Siap dikirim
                </div>
              </div>

              {(pendingFile.type.startsWith('image/') || pendingFile.type.startsWith('video/')) && (
                <>
                  <button
                    type="button"
                    onClick={() => setPendingViewOnce((v) => !v)}
                    aria-label="Aktifkan mode sekali lihat"
                    title="Sekali Lihat"
                    className={`h-8 px-2.5 rounded-full border text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors ${
                      pendingViewOnce
                        ? 'bg-[#8C0027] border-[#8C0027] text-white'
                        : 'bg-white dark:bg-[#171E2C] border-[#E6ECF2] dark:border-[#324058] text-[#5A6578] dark:text-[#CBD5E1]'
                    }`}
                  >
                    <span className="h-4 w-4 rounded-full border border-current flex items-center justify-center text-[9px] font-mono">
                      1
                    </span>
                    <span className="hidden sm:inline">Sekali Lihat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingSpoiler((v) => !v)}
                    aria-label="Aktifkan mode spoiler"
                    title="Spoiler (Blur)"
                    className={`h-8 px-2.5 rounded-full border text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors ${
                      pendingSpoiler
                        ? 'bg-[#8C0027] border-[#8C0027] text-white'
                        : 'bg-white dark:bg-[#171E2C] border-[#E6ECF2] dark:border-[#324058] text-[#5A6578] dark:text-[#CBD5E1]'
                    }`}
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Spoiler</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={clearPendingFile}
                aria-label="Hapus pratinjau file"
                className="h-9 w-9 rounded-full flex items-center justify-center text-[#5A6578] hover:text-[#8C0027] hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {uploadError && (
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#B91C1C] dark:text-[#FF6B81]">
              <span className="truncate">{uploadError}</span>
              {pendingFile && (
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  className="inline-flex items-center gap-1 font-bold text-[#8C0027] dark:text-[#F47296] hover:underline shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Coba Lagi</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reply / Edit / Schedule Banner */}
      {replyBarPresence.mounted && (
        <div
          className={`${
            replyBarPresence.closing ? 'p5-panel-out pointer-events-none' : 'p5-panel-reveal'
          } mb-1.5 px-4 py-2 rounded-2xl liquid-glass flex items-center gap-3`}
        >
          {editingMsg ? (
            <Edit2 className="w-4 h-4 text-[#8C0027] dark:text-[#F47296] shrink-0" />
          ) : scheduledFor ? (
            <CalendarClock className="w-4 h-4 text-amber-600 shrink-0" />
          ) : (
            <Reply className="w-4 h-4 text-[#8C0027] dark:text-[#F47296] shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-[#8C0027] dark:text-[#F47296]">
              {editingMsg
                ? 'Edit pesan'
                : scheduledFor
                  ? `Dijadwalkan untuk ${new Date(scheduledFor).toLocaleString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : replyTo
                    ? `Membalas ${users[replyTo.senderId]?.displayName || 'Pengguna'}`
                    : 'Balasan'}
            </div>
            <div className="text-xs text-[#5A6578] dark:text-[#CBD5E1] truncate">
              {editingMsg
                ? editingMsg.text
                : replyTo
                  ? replyTo.text || replyTo.attachment?.name || 'Lampiran'
                  : 'Pesan akan dikirim otomatis oleh server Tolk by Lunola'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setReplyTo(null);
              setEditingMsg(null);
              setScheduledFor(null);
            }}
            className="p-1 text-[#5A6578] hover:text-[#8C0027] brutal-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Schedule Picker Bar */}
      {schedulePresence.mounted && (
        <div
          className={`${
            schedulePresence.closing ? 'p5-panel-out pointer-events-none' : 'p5-panel-reveal'
          } px-4 py-2 bg-[#F5F7FA] dark:bg-[#1E2738] border-t-2 border-[#E6ECF2] dark:border-[#2A364B] flex flex-wrap items-center gap-2 text-xs`}
        >
          <Clock className="w-3.5 h-3.5 text-[#8C0027] dark:text-[#F47296]" />
          <span className="font-bold text-[#161B26] dark:text-[#F5F7FA]">Jadwalkan:</span>
          {[
            { label: '+1 mnt', ms: 60_000 },
            { label: '+5 mnt', ms: 5 * 60_000 },
            { label: '+1 jam', ms: 3600_000 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setScheduledFor(Date.now() + preset.ms);
                setScheduleOpen(false);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#FFFFFF] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] hover:bg-[#8C0027] hover:text-white font-semibold"
            >
              {preset.label}
            </button>
          ))}
          <input
            type="datetime-local"
            value={customScheduleInput}
            onChange={(e) => {
              setCustomScheduleInput(e.target.value);
              const ts = Date.parse(e.target.value);
              if (Number.isFinite(ts) && ts > Date.now() + 5000) {
                setScheduledFor(ts);
              }
            }}
            className="h-7 px-2 rounded-lg bg-[#FFFFFF] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-[#161B26] dark:text-[#F5F7FA]"
          />
          <button
            type="button"
            onClick={() => setScheduleOpen(false)}
            className="ml-auto text-[#5A6578] hover:text-[#8C0027]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* /slash Quick Reply Autocomplete */}
      {draftText.startsWith('/') && quickReplies.length > 0 && (
        (() => {
          const q = draftText.slice(1).toLowerCase();
          const matched = quickReplies.filter((r) =>
            r.trigger.toLowerCase().includes(q) || r.text.toLowerCase().includes(q)
          );
          if (matched.length === 0) return null;
          return (
            <div className="mx-3 mb-1.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#324058] shadow-lg overflow-hidden z-30">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5A6578] dark:text-[#94A3B8] border-b border-[#E6ECF2] dark:border-[#2A364B]">
                Template Balasan Cepat
              </div>
              <div className="max-h-40 overflow-y-auto thin-scrollbar divide-y divide-[#E6ECF2] dark:divide-[#2A364B]">
                {matched.map((item) => (
                  <button
                    key={item.trigger}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onDraftChange(item.text);
                      inputRef.current?.focus();
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#F5F7FA] dark:hover:bg-[#1E2738] flex items-center justify-between gap-2"
                  >
                    <span className="font-mono text-xs font-bold text-[#8C0027] dark:text-[#F47296]">
                      /{item.trigger}
                    </span>
                    <span className="text-xs text-[#161B26] dark:text-[#F5F7FA] truncate">
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()
      )}

      {/* Emoji & Sticker Popover */}
      {emojiOpen && (
        <div className="mb-2 p-3 rounded-3xl liquid-glass z-30 space-y-2.5 p5-panel-reveal">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-2 p-1 rounded-full liquid-glass">
              {(['emoji', 'sticker'] as const).map((tKey) => (
                <button
                  key={tKey}
                  type="button"
                  onClick={() => setEmojiTab(tKey)}
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    emojiTab === tKey ? 'bg-[#8C0027] text-white' : 'text-[#5A6578] dark:text-[#CBD5E1]'
                  }`}
                >
                  {tKey === 'emoji' ? 'Emoji' : 'Stiker'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setEmojiOpen(false)}
              className="h-7 w-7 rounded-full flex items-center justify-center text-[#5A6578]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {emojiTab === 'emoji' ? (
            <div className="grid grid-cols-8 gap-1">
              {['😀','😂','🥰','😎','🥳','😭','🙏','🔥','❤️','👍','👏','🎉','✨','💯','🤝','🫶','👀','🤔','😅','🚀','☕','🌙','🎵','📸'].map((em) => (
                <button
                  key={em}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onDraftChange(`${draftText}${em}`)}
                  className="h-9 rounded-lg hover:bg-[#F5F7FA] dark:hover:bg-[#232D40] text-lg flex items-center justify-center"
                >
                  {em}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: '👋', label: 'Halo!' },
                  { id: '🔥', label: 'Mantap' },
                  { id: '❤️', label: 'Sayang' },
                  { id: '😂', label: 'Ngakak' },
                  { id: '🥳', label: 'Gas!' },
                  { id: '🙏', label: 'Makasih' },
                  { id: '🫶', label: 'Oke Siap' },
                  { id: '☕', label: 'Ngopi Yuk' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={async () => {
                      setEmojiOpen(false);
                      await onSendMessage({ text: '', sticker: st });
                    }}
                    className="p-2 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] hover:bg-[#EAF4FF] dark:hover:bg-[#1B2436] flex flex-col items-center gap-1"
                  >
                    <span className="text-2xl leading-none">{st.id}</span>
                    <span className="text-[10px] font-bold text-[#5A6578] dark:text-[#CBD5E1]">{st.label}</span>
                  </button>
                ))}
                {customStickers.map((cs) => (
                  <div key={cs.id} className="relative group">
                    <button
                      type="button"
                      onClick={async () => {
                        setEmojiOpen(false);
                        await onSendMessage({ text: '', sticker: { id: cs.dataUrl, label: cs.label } });
                      }}
                      className="w-full p-1.5 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] hover:bg-[#EAF4FF] dark:hover:bg-[#1B2436] flex flex-col items-center gap-1"
                    >
                      <img src={cs.dataUrl} alt={cs.label} className="w-9 h-9 rounded-lg object-cover" />
                      <span className="text-[10px] font-bold text-[#5A6578] dark:text-[#CBD5E1] truncate w-full text-center">
                        {cs.label}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="Hapus stiker"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomStickers((prev) => {
                          const next = prev.filter((item) => item.id !== cs.id);
                          try {
                            window.localStorage.setItem('tolk_custom_stickers', JSON.stringify(next));
                          } catch {}
                          return next;
                        });
                      }}
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#161B26]/80 text-white text-[10px] flex items-center justify-center opacity-80 hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <input
                ref={customStickerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const src = String(reader.result || '');
                    const img = new Image();
                    img.onload = () => {
                      setStickerNatural({ w: img.width || 1, h: img.height || 1 });
                      setStickerZoom(1);
                      setStickerOffset({ x: 0, y: 0 });
                      setStickerCropLabel(f.name.replace(/\.[^.]+$/, '').slice(0, 14) || 'Stiker');
                      setStickerCropSrc(src);
                    };
                    img.src = src;
                  };
                  reader.readAsDataURL(f);
                }}
              />
              <button
                type="button"
                onClick={() => customStickerInputRef.current?.click()}
                className="w-full py-1.5 rounded-xl border border-dashed border-[#8C0027]/50 text-[#8C0027] dark:text-[#F47296] text-xs font-bold hover:bg-[#8C0027]/5"
              >
                + Tambah Stiker Kustom
              </button>
            </div>
          )}
        </div>
      )}

      {/* + Attachment Action Sheet */}
      {attachMenuOpen && (
        <div className="mb-1.5 p-3 rounded-3xl liquid-glass z-30 grid grid-cols-3 sm:grid-cols-6 gap-2 p5-panel-reveal">
          <button
            type="button"
            onClick={() => {
              setAttachMenuOpen(false);
              fileInputRef.current?.click();
            }}
            className="p-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] flex flex-col items-center gap-1 text-[11px] font-bold"
          >
            <Paperclip className="w-4 h-4 text-[#8C0027] dark:text-[#F47296]" />
            <span>File/Galeri</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAttachMenuOpen(false);
              setCameraOpen(true);
            }}
            className="p-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] flex flex-col items-center gap-1 text-[11px] font-bold"
          >
            <Camera className="w-4 h-4 text-[#0284C7]" />
            <span>Kamera</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAttachMenuOpen(false);
              setContactPickerOpen(true);
            }}
            className="p-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] flex flex-col items-center gap-1 text-[11px] font-bold"
          >
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Kontak</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAttachMenuOpen(false);
              if (!navigator.geolocation) return;
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  void onSendMessage({
                    text: '',
                    location: {
                      lat: pos.coords.latitude,
                      lng: pos.coords.longitude,
                      label: 'Lokasi Saat Ini',
                    },
                  });
                },
                () => setUploadError('Izin lokasi tidak tersedia.')
              );
            }}
            className="p-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] flex flex-col items-center gap-1 text-[11px] font-bold"
          >
            <MapPin className="w-4 h-4 text-rose-600" />
            <span>Lokasi</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAttachMenuOpen(false);
              setScheduleOpen((v) => !v);
            }}
            className="p-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] flex flex-col items-center gap-1 text-[11px] font-bold"
          >
            <CalendarClock className="w-4 h-4 text-amber-600" />
            <span>Jadwal</span>
          </button>
          {(chat.type === 'group' || chat.type === 'channel') && (
            <button
              type="button"
              onClick={() => {
                setAttachMenuOpen(false);
                setPollModalOpen(true);
              }}
              className="p-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] flex flex-col items-center gap-1 text-[11px] font-bold"
            >
              <BarChart3 className="w-4 h-4 text-violet-600" />
              <span>Polling</span>
            </button>
          )}
        </div>
      )}

      {/* Floating WhatsApp-Style Liquid-Glass Composer + Separate Mic/Send Button */}
      <footer className="shrink-0 transition-[margin-bottom] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]">
        {selectionMode ? (
          <div className="p5-panel-reveal flex items-center justify-between gap-2 h-11 px-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedMsgIds(new Set());
                }}
                className="h-9 px-3 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-xs font-bold text-[#161B26] dark:text-[#F5F7FA]"
              >
                Batal
              </button>
              <span className="text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] truncate">
                {selectedMsgIds.size} dipilih
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={selectedMsgIds.size === 0}
                onClick={() => {
                  const selected = messages.filter((m) => selectedMsgIds.has(m.id));
                  const joined = selected.map((m) => m.text).filter(Boolean).join('\n');
                  if (joined) void navigator.clipboard?.writeText(joined).catch(() => {});
                  setSelectionMode(false);
                  setSelectedMsgIds(new Set());
                }}
                aria-label="Salin pesan terpilih"
                className="h-9 w-9 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] flex items-center justify-center disabled:opacity-40"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={selectedMsgIds.size === 0}
                onClick={async () => {
                  for (const id of selectedMsgIds) {
                    await onToggleStarMessage(id);
                  }
                  setSelectionMode(false);
                  setSelectedMsgIds(new Set());
                }}
                aria-label="Bintangi pesan terpilih"
                className="h-9 w-9 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] flex items-center justify-center disabled:opacity-40"
              >
                <Star className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={selectedMsgIds.size === 0}
                onClick={() => {
                  const first = messages.find((m) => selectedMsgIds.has(m.id));
                  if (first) onForwardMessage(first);
                  setSelectionMode(false);
                  setSelectedMsgIds(new Set());
                }}
                aria-label="Teruskan pesan terpilih"
                className="h-9 w-9 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] flex items-center justify-center disabled:opacity-40"
              >
                <Forward className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={selectedMsgIds.size === 0}
                onClick={async () => {
                  for (const id of selectedMsgIds) {
                    const target = messages.find((m) => m.id === id);
                    if (target && (target.senderId === currentUser.id || isGroupAdminOrMod)) {
                      await onDeleteMessage(id);
                    }
                  }
                  setSelectionMode(false);
                  setSelectedMsgIds(new Set());
                }}
                aria-label="Hapus pesan terpilih"
                className="h-9 w-9 rounded-full bg-[#FEF2F2] dark:bg-[#2B1217] text-[#B91C1C] dark:text-[#FF6B81] border border-[#FECACA] dark:border-[#5C1D24] flex items-center justify-center disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : !canPost ? (
          <div className="py-2 text-center text-xs font-semibold text-[#5A6578] dark:text-[#94A3B8]">
            {chat.suspended
              ? 'Grup atau channel ini sedang ditangguhkan oleh administrator.'
              : chat.type === 'channel'
                ? 'Hanya admin channel yang dapat mempublikasikan siaran.'
                : 'Mode pengumuman aktif — hanya admin & moderator yang dapat mengirim pesan.'}
          </div>
        ) : recording ? (
          <div
            onTouchStart={(e) => {
              if (e.touches.length === 1) {
                recordTouchRef.current = {
                  x: e.touches[0].clientX,
                  y: e.touches[0].clientY,
                  active: true,
                };
              }
            }}
            onTouchMove={(e) => {
              const start = recordTouchRef.current;
              if (!start?.active || e.touches.length !== 1) return;
              const dx = e.touches[0].clientX - start.x;
              const dy = e.touches[0].clientY - start.y;
              setRecordSwipe({ dx, dy });
              if (dx < -80) {
                recordTouchRef.current = null;
                setRecordSwipe({ dx: 0, dy: 0 });
                setRecordLocked(false);
                triggerAndroidHaptic();
                cancelVoiceRecording();
              } else if (dy < -60 && !recordLocked) {
                setRecordLocked(true);
                setRecordSwipe({ dx: 0, dy: 0 });
                triggerAndroidHaptic();
              }
            }}
            onTouchEnd={() => {
              recordTouchRef.current = null;
              setRecordSwipe({ dx: 0, dy: 0 });
            }}
            style={{
              transform: recordSwipe.dx < 0 ? `translateX(${Math.max(-90, recordSwipe.dx)}px)` : undefined,
            }}
            className="p5-panel-reveal flex items-center justify-between gap-2 h-11 px-3 rounded-xl bg-[#EAF4FF] dark:bg-[#1B2436] border border-[#8C0027] brutal-shadow-sm transition-transform"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-3 w-3 rounded-full bg-[#8C0027] animate-pulse shrink-0" />
              <span className="font-mono text-xs font-bold text-[#8C0027] dark:text-[#F47296] tabular-nums shrink-0">
                {formatDuration(recordSec)}
              </span>
              <div className="hidden xs:flex items-center gap-0.5 h-5">
                {recordLevels.map((lvl, idx) => (
                  <span
                    key={idx}
                    style={{ height: `${Math.max(20, (lvl + ((recordSec * 17 + idx * 23) % 40)) % 100)}%` }}
                    className="w-1 rounded-full bg-[#8C0027]/75 dark:bg-[#F47296]/80 transition-all duration-150"
                  />
                ))}
              </div>
              {recordLocked ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8C0027] dark:text-[#F47296]">
                  <Lock className="w-3 h-3" />
                  <span>Terkunci</span>
                </span>
              ) : (
                <span className="text-[11px] text-[#5A6578] dark:text-[#94A3B8] truncate">
                  ← Geser batal · ↑ Kunci
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setRecordLocked(false);
                  cancelVoiceRecording();
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#5A6578] dark:text-[#CBD5E1] hover:bg-black/10"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecordLocked(false);
                  stopVoiceRecording();
                }}
                className="h-9 px-3 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] text-[#FFFFFF] border border-[#E6ECF2] brutal-shadow-sm brutal-press text-xs font-bold flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Kirim</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.txt,.csv,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) stageFileForPreview(file);
              }}
              className="hidden"
            />
            {/* Left Floating Liquid-Glass Input Capsule */}
            <div className="flex-1 min-w-0 flex items-end gap-0.5 px-1.5 py-1 rounded-full liquid-glass">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setEmojiOpen((v) => !v);
                  setAttachMenuOpen(false);
                }}
                disabled={sending}
                aria-label="Emoji dan Stiker"
                title="Emoji & Stiker"
                className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  emojiOpen
                    ? 'bg-[#8C0027] text-white'
                    : 'text-[#5A6578] dark:text-[#CBD5E1] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <Smile className="w-5 h-5" />
              </button>

              <textarea
                ref={inputRef}
                rows={1}
                value={draftText}
                onFocus={() => {
                  setComposerFocused(true);
                  window.setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }, 260);
                }}
                onBlur={() => setComposerFocused(false)}
                onChange={(e) => handleInputChange(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Ketik pesan"
                className="flex-1 min-w-0 h-10 max-h-32 min-h-[40px] py-[10px] px-1.5 bg-transparent border-0 text-sm leading-[20px] text-[#161B26] dark:text-[#F5F7FA] placeholder:text-[#6B768A] dark:placeholder:text-[#94A3B8] resize-none overflow-y-auto focus:outline-none"
              />

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setAttachMenuOpen((v) => !v);
                  setEmojiOpen(false);
                }}
                disabled={sending || Boolean(editingMsg)}
                aria-label="Menu lampiran dan fitur"
                title="Lampirkan & Fitur"
                className={`h-10 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  attachMenuOpen || scheduledFor
                    ? 'bg-[#8C0027] text-white'
                    : 'text-[#5A6578] dark:text-[#CBD5E1] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <Paperclip className="w-5 h-5 -rotate-45" />
              </button>

              {!composerFocused && !draftText.trim() && (
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  disabled={sending}
                  aria-label="Buka kamera"
                  title="Ambil foto dari kamera"
                  className="h-10 w-9 rounded-full text-[#5A6578] dark:text-[#CBD5E1] hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Right Separate Circular Mic / Send Button */}
            {draftText.trim() || pendingFile ? (
              <button
                key={`send-${sendKick}`}
                type="submit"
                onMouseDown={(e) => e.preventDefault()}
                disabled={sending}
                aria-label="Kirim pesan"
                className={`h-12 w-12 rounded-full bg-[#8C0027] hover:bg-[#6E001F] text-[#FFFFFF] border border-white/30 shadow-[0_8px_22px_rgba(140,0,39,0.38)] brutal-press flex items-center justify-center shrink-0 disabled:opacity-50 ${
                  sendKick > 0 ? 'p5-send-recoil p5-impact-ring' : ''
                }`}
              >
                <SendHorizontal className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startVoiceRecording()}
                disabled={sending}
                aria-label="Rekam pesan suara"
                title="Rekam pesan suara"
                className="h-12 w-12 rounded-full bg-[#8C0027] hover:bg-[#6E001F] text-[#FFFFFF] border border-white/30 shadow-[0_8px_22px_rgba(140,0,39,0.38)] brutal-press flex items-center justify-center shrink-0 disabled:opacity-50"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </form>
        )}
      </footer>
        </div>
      </div>

      {/* Full-Screen Media Lightbox (Carousel + Double-Tap/Pinch Zoom + Swipe-Down Dismiss) */}
      {lightboxRetained.renderedValue && lightboxRetained.renderedValue.attachment && (
        <div
          style={{
            height: 'var(--app-height, 100dvh)',
            top: 'var(--vv-offset-top, 0px)',
          }}
          className={`${
            lightboxRetained.closing ? 'p5-backdrop-out pointer-events-none' : 'p5-backdrop-in'
          } fixed inset-x-0 z-[85] bg-black flex flex-col`}
        >
          {/* Top Overlay Controls */}
          <div className="pt-safe-2 px-4 pb-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between gap-2 shrink-0 z-10">
            <button
              type="button"
              onClick={() => setLightboxMsgId(null)}
              aria-label="Tutup pratinjau media"
              className="h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white brutal-press flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-xs font-mono text-white/80">
              {lightboxMediaList.length > 1 && lightboxIdx >= 0
                ? `${lightboxIdx + 1} / ${lightboxMediaList.length}`
                : ''}
            </span>
            <div className="flex items-center gap-2">
              {lightboxRetained.renderedValue.attachment.kind === 'image' && (
                <button
                  type="button"
                  onClick={() => setLightboxZoom((z) => (z > 1 ? 1 : 2.2))}
                  aria-label="Zoom gambar"
                  className="h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
                >
                  {lightboxZoom > 1 ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  triggerAndroidHaptic();
                  void saveMediaToGallery(lightboxRetained.renderedValue!.attachment!.url);
                }}
                aria-label="Simpan media ke galeri"
                className="h-10 px-4 rounded-full bg-[#8C0027] hover:bg-[#6E001F] text-white text-xs font-bold brutal-press flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Simpan</span>
              </button>
            </div>
          </div>

          {/* Full-Bleed Media Container */}
          <div
            onClick={() => setLightboxMsgId(null)}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lightboxTouchRef.current = { x: 0, y: 0, pinchDist: Math.hypot(dx, dy) };
              } else if (e.touches.length === 1) {
                lightboxTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 2 && lightboxTouchRef.current?.pinchDist) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                const ratio = dist / lightboxTouchRef.current.pinchDist;
                setLightboxZoom(Math.max(1, Math.min(3, Number((ratio * 1.1).toFixed(2)))));
              }
            }}
            onTouchEnd={(e) => {
              const start = lightboxTouchRef.current;
              lightboxTouchRef.current = null;
              if (start && !start.pinchDist && e.changedTouches.length === 1) {
                const dx = e.changedTouches[0].clientX - start.x;
                const dy = e.changedTouches[0].clientY - start.y;
                if (Math.abs(dy) > 75 && Math.abs(dy) > Math.abs(dx) && lightboxZoom <= 1.05) {
                  setLightboxMsgId(null);
                } else if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) && lightboxZoom <= 1.05) {
                  if (dx < 0 && lightboxIdx >= 0 && lightboxIdx < lightboxMediaList.length - 1) {
                    setLightboxZoom(1);
                    setLightboxMsgId(lightboxMediaList[lightboxIdx + 1].id);
                  } else if (dx > 0 && lightboxIdx > 0) {
                    setLightboxZoom(1);
                    setLightboxMsgId(lightboxMediaList[lightboxIdx - 1].id);
                  }
                }
              }
            }}
            className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden"
          >
            {lightboxIdx > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxZoom(1);
                  setLightboxMsgId(lightboxMediaList[lightboxIdx - 1].id);
                }}
                aria-label="Media sebelumnya"
                className="hidden sm:flex absolute left-4 z-10 h-11 w-11 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {lightboxRetained.renderedValue.attachment.kind === 'video' ? (
              <video
                src={lightboxRetained.renderedValue.attachment.url}
                controls
                autoPlay
                onClick={(e) => e.stopPropagation()}
                className="max-w-full max-h-full"
              />
            ) : (
              <img
                src={lightboxRetained.renderedValue.attachment.url}
                alt="Pratinjau gambar"
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setLightboxZoom((z) => (z > 1 ? 1 : 2.2));
                }}
                style={{ transform: `scale(${lightboxZoom})` }}
                className={`${
                  lightboxRetained.closing ? 'p5-modal-out' : 'p5-modal-impact'
                } w-full h-full object-contain select-none transition-transform duration-200`}
              />
            )}
            {lightboxIdx >= 0 && lightboxIdx < lightboxMediaList.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxZoom(1);
                  setLightboxMsgId(lightboxMediaList[lightboxIdx + 1].id);
                }}
                aria-label="Media berikutnya"
                className="hidden sm:flex absolute right-4 z-10 h-11 w-11 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* View-Once Media Secure Overlay */}
      {viewOnceModalMsg?.attachment && (
        <div
          style={{ height: 'var(--app-height, 100dvh)', top: 'var(--vv-offset-top, 0px)' }}
          className="fixed inset-x-0 z-[90] bg-black text-white flex flex-col p5-backdrop-in"
        >
          <div className="pt-safe-2 px-4 pb-3 flex items-center justify-between bg-black/80">
            <span className="text-xs font-bold flex items-center gap-2">
              <span className="h-5 w-5 rounded-full border border-white flex items-center justify-center text-[10px] font-mono">
                1
              </span>
              <span>Media Sekali Lihat</span>
            </span>
            <button
              type="button"
              onClick={() => setViewOnceModalMsg(null)}
              className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div
            onClick={() => setViewOnceModalMsg(null)}
            className="flex-1 min-h-0 flex items-center justify-center p-4"
          >
            {viewOnceModalMsg.attachment.kind === 'video' ? (
              <video
                src={viewOnceModalMsg.attachment.url}
                controls
                autoPlay
                onClick={(e) => e.stopPropagation()}
                className="max-w-full max-h-full rounded-xl"
              />
            ) : (
              <img
                src={viewOnceModalMsg.attachment.url}
                alt="Media sekali lihat"
                className="max-w-full max-h-full object-contain select-none"
              />
            )}
          </div>
        </div>
      )}

      {/* Create Poll Modal */}
      {pollModalOpen && (
        <div
          onClick={() => setPollModalOpen(false)}
          className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 p5-backdrop-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#324058] p-5 pb-safe-3 space-y-3.5 brutal-shadow-lg p5-modal-impact"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#8C0027] dark:text-[#F47296]" />
                <span>Buat Polling</span>
              </h3>
              <button
                type="button"
                onClick={() => setPollModalOpen(false)}
                className="h-8 w-8 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Ajukan pertanyaan polling..."
              maxLength={200}
              className="w-full h-10 px-3.5 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-xs font-semibold text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
            />
            <div className="space-y-2 max-h-52 overflow-y-auto thin-scrollbar">
              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) =>
                      setPollOptions((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                    }
                    placeholder={`Pilihan ${idx + 1}`}
                    maxLength={100}
                    className="flex-1 h-9 px-3 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-xs text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions((prev) => prev.filter((_, i) => i !== idx))}
                      className="h-8 w-8 rounded-lg text-[#5A6578] hover:text-[#8C0027] flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {pollOptions.length < 6 && (
              <button
                type="button"
                onClick={() => setPollOptions((prev) => [...prev, ''])}
                className="text-xs font-bold text-[#8C0027] dark:text-[#F47296] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah pilihan</span>
              </button>
            )}
            <label className="flex items-center justify-between text-xs text-[#5A6578] dark:text-[#CBD5E1] cursor-pointer pt-1">
              <span>Izinkan beberapa jawaban</span>
              <input
                type="checkbox"
                checked={pollAllowMultiple}
                onChange={(e) => setPollAllowMultiple(e.target.checked)}
                className="h-4 w-4 accent-[#8C0027]"
              />
            </label>
            <button
              type="button"
              disabled={
                !pollQuestion.trim() ||
                pollOptions.filter((o) => o.trim()).length < 2 ||
                sending
              }
              onClick={async () => {
                const validOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
                if (!pollQuestion.trim() || validOpts.length < 2) return;
                setSending(true);
                try {
                  await onSendMessage({
                    text: '',
                    poll: {
                      question: pollQuestion.trim(),
                      allowMultiple: pollAllowMultiple,
                      options: validOpts.map((text) => ({ text })),
                    },
                  });
                  setPollModalOpen(false);
                  setPollQuestion('');
                  setPollOptions(['', '']);
                  setPollAllowMultiple(false);
                } finally {
                  setSending(false);
                }
              }}
              className="w-full h-11 rounded-2xl bg-[#8C0027] hover:bg-[#6E001F] text-white text-xs font-bold disabled:opacity-40 brutal-press"
            >
              Kirim Polling
            </button>
          </div>
        </div>
      )}

      {/* Contact Card Picker Modal */}
      {contactPickerOpen && (
        <div
          onClick={() => setContactPickerOpen(false)}
          className="fixed inset-0 z-[80] bg-black/55 flex items-end sm:items-center justify-center p-0 sm:p-4 p5-backdrop-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#324058] p-5 pb-safe-3 space-y-3 p5-modal-impact"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA]">
                Bagikan Kontak
              </h3>
              <button
                type="button"
                onClick={() => setContactPickerOpen(false)}
                className="h-8 w-8 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto thin-scrollbar space-y-1.5">
              {Object.values(users)
                .filter((u) => u.id !== currentUser.id && u.id !== 'usr_bot')
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={async () => {
                      setContactPickerOpen(false);
                      await onSendMessage({
                        text: '',
                        contactCard: {
                          userId: u.id,
                          displayName: u.displayName,
                          username: u.username,
                          avatarUrl: u.avatarUrl,
                          avatarColor: u.avatarColor,
                        },
                      });
                    }}
                    className="w-full p-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#1E2738] hover:bg-[#EAF4FF] dark:hover:bg-[#232D40] flex items-center gap-2.5 text-left"
                  >
                    <Avatar name={u.displayName} imageUrl={u.avatarUrl} color={u.avatarColor} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] truncate">
                        {u.displayName}
                      </div>
                      <div className="text-[11px] font-mono text-[#5A6578] dark:text-[#94A3B8]">
                        @{u.username}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Messages Drawer */}
      {scheduledDrawerOpen && (
        <div
          onClick={() => setScheduledDrawerOpen(false)}
          className="fixed inset-0 z-[80] bg-black/55 flex items-end sm:items-center justify-center p-0 sm:p-4 p5-backdrop-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#324058] p-5 pb-safe-3 space-y-3 p5-modal-impact"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA]">
                Pesan Terjadwal ({scheduledMessages.length})
              </h3>
              <button
                type="button"
                onClick={() => setScheduledDrawerOpen(false)}
                className="h-8 w-8 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto thin-scrollbar space-y-2">
              {scheduledMessages.map((sm) => (
                <div
                  key={sm.id}
                  className="p-3 rounded-xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#324058] flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono font-bold text-[#8C0027] dark:text-[#F47296]">
                      {formatTimeShort(sm.scheduledFor || sm.createdAt)}
                    </div>
                    <div className="text-xs text-[#161B26] dark:text-[#F5F7FA] mt-0.5 break-words">
                      {sm.text || sm.attachment?.name || 'Lampiran'}
                    </div>
                  </div>
                  {onCancelScheduled && (
                    <button
                      type="button"
                      onClick={() => void onCancelScheduled(sm.id)}
                      className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-[11px] font-bold shrink-0"
                    >
                      Batalkan
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Message Read-By Info Modal */}
      {msgInfoTarget && (
        <div
          onClick={() => setMsgInfoTarget(null)}
          className="fixed inset-0 z-[80] bg-black/55 flex items-end sm:items-center justify-center p-0 sm:p-4 p5-backdrop-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#324058] p-5 pb-safe-3 space-y-3 p5-modal-impact"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA]">
                Info Pesan
              </h3>
              <button
                type="button"
                onClick={() => setMsgInfoTarget(null)}
                className="h-8 w-8 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F7FA] dark:bg-[#1E2738] text-xs text-[#161B26] dark:text-[#F5F7FA]">
              {msgInfoTarget.text || msgInfoTarget.attachment?.name || 'Pesan media'}
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#5A6578] dark:text-[#94A3B8]">
              Dibaca oleh ({msgInfoTarget.readBy.filter((id) => id !== msgInfoTarget.senderId).length})
            </div>
            <div className="max-h-48 overflow-y-auto thin-scrollbar space-y-1.5">
              {msgInfoTarget.readBy
                .filter((id) => id !== msgInfoTarget.senderId)
                .map((uid) => {
                  const u = users[uid];
                  return (
                    <div key={uid} className="flex items-center gap-2.5 p-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1E2738]">
                      <Avatar name={u?.displayName || uid} imageUrl={u?.avatarUrl} color={u?.avatarColor} size="xs" />
                      <span className="text-xs font-semibold text-[#161B26] dark:text-[#F5F7FA]">
                        {u?.displayName || uid}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Reply Thread Drawer (#2) */}
      {threadRootMsg && (
        <div
          onClick={() => setThreadRootMsg(null)}
          className="fixed inset-0 z-[80] bg-black/55 flex items-end sm:items-center justify-center p-0 sm:p-4 p5-backdrop-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#324058] p-5 pb-safe-3 space-y-3 p5-modal-impact max-h-[82dvh] flex flex-col"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#8C0027] dark:text-[#F47296]" />
                <span>Thread Balasan</span>
              </h3>
              <button
                type="button"
                onClick={() => setThreadRootMsg(null)}
                className="h-8 w-8 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1E2738] border-l-4 border-[#8C0027] text-xs">
              <div className="font-bold text-[#8C0027] dark:text-[#F47296] mb-0.5">
                {users[threadRootMsg.senderId]?.displayName || 'Pengguna'}
              </div>
              <div className="text-[#161B26] dark:text-[#F5F7FA]">
                {threadRootMsg.text || threadRootMsg.attachment?.name || 'Pesan media'}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto thin-scrollbar space-y-2">
              {messages
                .filter((m) => m.replyToId === threadRootMsg.id)
                .map((rm) => (
                  <div key={rm.id} className="p-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] text-xs space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#161B26] dark:text-[#F5F7FA]">
                        {users[rm.senderId]?.displayName || 'Pengguna'}
                      </span>
                      <span className="font-mono text-[10px] text-[#6B768A]">{formatTimeShort(rm.createdAt)}</span>
                    </div>
                    <div className="text-[#161B26] dark:text-[#E2E8F0]">{rm.text}</div>
                  </div>
                ))}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const txt = threadReplyText.trim();
                if (!txt) return;
                setThreadReplyText('');
                await onSendMessage({ text: txt, replyToId: threadRootMsg.id });
              }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                type="text"
                value={threadReplyText}
                onChange={(e) => setThreadReplyText(e.target.value)}
                placeholder="Balas di thread ini..."
                className="flex-1 h-9 px-3 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-xs text-[#161B26] dark:text-[#F5F7FA]"
              />
              <button
                type="submit"
                className="h-9 px-4 rounded-full bg-[#8C0027] text-white text-xs font-bold"
              >
                Kirim
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Interactive 1:1 Square Sticker Cropper & Compressor Modal */}
      {stickerCropSrc && (
        <div
          onClick={() => setStickerCropSrc(null)}
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 p5-backdrop-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#324058] p-5 space-y-4 p5-modal-impact"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA]">
                  Potong Stiker (1:1)
                </h3>
                <p className="text-[11px] text-[#5A6578] dark:text-[#94A3B8]">
                  Geser & zoom untuk mengepaskan kotak stiker
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStickerCropSrc(null)}
                className="h-8 w-8 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 240x240 Square Crop Viewport */}
            <div
              onPointerDown={(e) => {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                stickerDragRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  ox: stickerOffset.x,
                  oy: stickerOffset.y,
                };
              }}
              onPointerMove={(e) => {
                const drag = stickerDragRef.current;
                if (!drag) return;
                setStickerOffset({
                  x: drag.ox + (e.clientX - drag.x),
                  y: drag.oy + (e.clientY - drag.y),
                });
              }}
              onPointerUp={() => {
                stickerDragRef.current = null;
              }}
              onPointerCancel={() => {
                stickerDragRef.current = null;
              }}
              className="relative mx-auto w-[240px] h-[240px] rounded-3xl overflow-hidden border-2 border-[#8C0027] bg-[#F5F7FA] dark:bg-[#0F141E] touch-none cursor-grab active:cursor-grabbing select-none"
            >
              {(() => {
                const box = 240;
                const coverScale = Math.max(box / stickerNatural.w, box / stickerNatural.h) * stickerZoom;
                const drawW = stickerNatural.w * coverScale;
                const drawH = stickerNatural.h * coverScale;
                return (
                  <img
                    src={stickerCropSrc}
                    alt="Crop preview"
                    draggable={false}
                    style={{
                      width: `${drawW}px`,
                      height: `${drawH}px`,
                      left: `${(box - drawW) / 2 + stickerOffset.x}px`,
                      top: `${(box - drawH) / 2 + stickerOffset.y}px`,
                    }}
                    className="absolute max-w-none pointer-events-none"
                  />
                );
              })()}
              <div className="pointer-events-none absolute inset-0 border border-white/40 rounded-3xl" />
            </div>

            <div className="space-y-2">
              <label className="block space-y-1">
                <div className="flex justify-between text-[11px] font-semibold text-[#5A6578] dark:text-[#CBD5E1]">
                  <span>Perbesar (Zoom)</span>
                  <span className="font-mono font-bold">{stickerZoom.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={stickerZoom}
                  onChange={(e) => setStickerZoom(Number(e.target.value))}
                  className="w-full accent-[#8C0027]"
                />
              </label>

              <input
                type="text"
                maxLength={14}
                value={stickerCropLabel}
                onChange={(e) => setStickerCropLabel(e.target.value)}
                placeholder="Nama stiker..."
                className="w-full h-9 px-3 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-xs text-[#161B26] dark:text-[#F5F7FA]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStickerCropSrc(null)}
                className="flex-1 h-10 rounded-full border border-[#E6ECF2] dark:border-[#324058] text-xs font-bold text-[#5A6578] dark:text-[#CBD5E1]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const img = new Image();
                  img.onload = () => {
                    const outSize = 160;
                    const previewBox = 240;
                    const ratio = outSize / previewBox;
                    const canvas = document.createElement('canvas');
                    canvas.width = outSize;
                    canvas.height = outSize;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    const coverScale = Math.max(previewBox / img.width, previewBox / img.height) * stickerZoom;
                    const drawW = img.width * coverScale * ratio;
                    const drawH = img.height * coverScale * ratio;
                    const drawX = ((previewBox - img.width * coverScale) / 2 + stickerOffset.x) * ratio;
                    const drawY = ((previewBox - img.height * coverScale) / 2 + stickerOffset.y) * ratio;
                    ctx.drawImage(img, drawX, drawY, drawW, drawH);

                    // Adaptive compression: try WebP qualities first, fallback to JPEG if needed
                    let compressed = canvas.toDataURL('image/webp', 0.78);
                    if (!compressed.startsWith('data:image/webp')) {
                      compressed = canvas.toDataURL('image/jpeg', 0.78);
                    }
                    if (compressed.length > 36_000) {
                      compressed = compressed.startsWith('data:image/webp')
                        ? canvas.toDataURL('image/webp', 0.55)
                        : canvas.toDataURL('image/jpeg', 0.55);
                    }
                    if (compressed.length > 48_000) {
                      compressed = canvas.toDataURL('image/jpeg', 0.45);
                    }

                    const label = stickerCropLabel.trim() || 'Stiker';
                    setCustomStickers((prev) => {
                      const next = [
                        ...prev.slice(-11),
                        { id: `cs_${Date.now()}`, dataUrl: compressed, label },
                      ];
                      try {
                        window.localStorage.setItem('tolk_custom_stickers', JSON.stringify(next));
                      } catch {}
                      return next;
                    });
                    setStickerCropSrc(null);
                  };
                  img.src = stickerCropSrc;
                }}
                className="flex-1 h-10 rounded-full bg-[#8C0027] text-white text-xs font-bold"
              >
                Simpan Stiker
              </button>
            </div>
          </div>
        </div>
      )}

      <CameraCaptureModal
        open={cameraOpen}
        mode="photo"
        onClose={() => setCameraOpen(false)}
        onCapturePhoto={(file) => stageFileForPreview(file)}
      />
    </section>
  );
}
