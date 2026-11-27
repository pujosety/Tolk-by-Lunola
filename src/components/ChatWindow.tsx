import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BarChart3,
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
  FileText,
  Flag,
  Forward,
  Info,
  Languages,
  Lock,
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
  Sparkles,
  Square,
  Star,
  Timer,
  Trash2,
  UploadCloud,
  Video,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  Attachment,
  ChatAppearancePrefs,
  ChatRoom,
  LanguageCode,
  Message,
  UserProfile,
} from '../types/chat';
import { getBubbleClasses, getWallpaperStyle } from '../lib/appearance';
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
    scheduledFor?: number | null;
  }) => Promise<void>;
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
  onTyping: (isTyping: boolean) => void;
}

function VoiceNotePlayer({
  url,
  durationSec,
  isOwn,
}: {
  url: string;
  durationSec?: number;
  isOwn: boolean;
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
    } else {
      audio.playbackRate = speed;
      void audio.play().catch(() => setPlaying(false));
      setPlaying(true);
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
    return <span key={idx}>{part}</span>;
  });
}

export function ChatWindow({
  lang,
  chat,
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
  onPinMessage,
  onToggleStarMessage,
  onForwardMessage,
  onTranslateMessage,
  onSummarizeChat,
  onReportMessage,
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
  const [searchTerm, setSearchTerm] = useState('');
  const [lightboxMsgId, setLightboxMsgId] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);
  const [viewOnceModalMsg, setViewOnceModalMsg] = useState<Message | null>(null);
  const [pendingViewOnce, setPendingViewOnce] = useState(false);
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
  }, [chat.id]);

  useEffect(() => {
    const added = messages.length - prevMsgLenRef.current;
    prevMsgLenRef.current = messages.length;
    if (added > 0 && showScrollDownRef.current) {
      setUnreadWhileScrolledUp((c) => c + added);
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, chat.id]);

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
      await onSendMessage({
        text: trimmed,
        replyToId: replyTo?.id || null,
        attachment: null,
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

      {/* Chat Top Bar (Seamless Futuristic) */}
      <header className="pt-safe-2 pb-2 min-h-[62px] px-3 sm:px-4 bg-[#FFFFFF]/95 dark:bg-[#171E2C]/95 backdrop-blur-md shadow-[0_2px_14px_rgba(15,20,30,0.05)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.28)] flex items-center justify-between gap-2 shrink-0 z-10">
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
      <div
        key={chat.id}
        style={getWallpaperStyle(appearance, darkMode)}
        className={`p5-chat-enter flex-1 overflow-y-auto thin-scrollbar px-3 sm:px-5 py-4 space-y-2.5 ${
          appearance.wallpaper === 'doodle-animated' ? 'doodle-wallpaper-bg' : ''
        }`}
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
                                className="block w-full max-h-80 object-contain rounded-2xl"
                                loading="lazy"
                              />
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

                      {/* Message Text */}
                      {msg.text && (
                        <p className="text-[14px] leading-[1.5] whitespace-pre-wrap break-words">
                          {renderSafeMessageText(msg.text, isOwn)}
                        </p>
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

                    {/* Action Menu Trigger */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openMessageMenu(msg.id, e.currentTarget, isOwn);
                      }}
                      aria-label="Opsi pesan"
                      className={`absolute top-1 ${
                        isOwn ? '-left-10' : '-right-10'
                      } h-9 w-9 rounded-full border border-[#E6ECF2] dark:border-[#324058] bg-[#FFFFFF] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] flex items-center justify-center opacity-50 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity`}
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {/* Floating Message Context Menu — rendered via React Portal to document.body so transformed ancestors never trap position:fixed */}
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
          className="p5-panel-reveal absolute bottom-20 right-4 z-20 h-11 w-11 rounded-full bg-[#FFFFFF] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#324058] text-[#161B26] dark:text-[#F5F7FA] brutal-shadow flex items-center justify-center brutal-press"
        >
          {unreadWhileScrolledUp > 0 && (
            <span className="absolute -top-2 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-[#8C0027] text-white text-[10px] font-mono font-bold flex items-center justify-center shadow-sm">
              {unreadWhileScrolledUp > 99 ? '99+' : unreadWhileScrolledUp}
            </span>
          )}
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* Mention Autocomplete Popover */}
      {mentionCandidates.length > 0 && (
        <div className="p5-panel-reveal mx-3 mb-1 rounded-xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow overflow-hidden z-20">
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
          } px-4 py-2.5 bg-[#FFFFFF] dark:bg-[#171E2C] border-t-2 border-[#E6ECF2] dark:border-[#2A364B] space-y-1.5`}
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
          } px-4 py-2 bg-[#EAF4FF] dark:bg-[#1E2738] border-t-2 border-[#E6ECF2] dark:border-[#2A364B] flex items-center gap-3`}
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

      {/* Composer */}
      <footer className="pt-2.5 pb-safe-3 px-3 bg-[#FFFFFF] dark:bg-[#171E2C] border-t border-[#E6ECF2] dark:border-[#2A364B] shrink-0 transition-[padding-bottom] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]">
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
            {!composerFocused ? (
              <>
                <button
                  type="button"
                  onClick={() => setScheduleOpen((v) => !v)}
                  disabled={sending || Boolean(editingMsg)}
                  aria-label={t(lang, 'scheduleMessage')}
                  title={t(lang, 'scheduleMessage')}
                  className={`h-11 w-10 rounded-full border brutal-press flex items-center justify-center shrink-0 transition-all ${
                    scheduledFor
                      ? 'bg-[#8C0027] text-[#FFFFFF] border-[#E6ECF2]'
                      : 'border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white'
                  }`}
                >
                  <CalendarClock className="w-4 h-4" />
                </button>
                {(chat.type === 'group' || chat.type === 'channel') && (
                  <button
                    type="button"
                    onClick={() => setPollModalOpen(true)}
                    disabled={sending || Boolean(editingMsg)}
                    aria-label="Buat polling"
                    title="Buat polling"
                    className="h-11 w-10 rounded-full border border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-press flex items-center justify-center shrink-0"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                aria-label="Lampirkan file atau media"
                title="Lampirkan foto, video, atau dokumen"
                className="h-11 w-10 rounded-full border border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-press flex items-center justify-center shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}

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
              className="flex-1 h-11 max-h-32 min-h-[44px] py-[11px] px-4 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm leading-[20px] text-[#161B26] dark:text-[#F5F7FA] placeholder:text-[#6B768A] dark:placeholder:text-[#7E8DA4] resize-none overflow-y-auto focus:outline-none focus:border-[#8C0027] dark:focus:border-[#8C0027] transition-all"
            />

            {!composerFocused && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  aria-label="Lampirkan file atau media"
                  title="Lampirkan foto, video, atau dokumen"
                  className="h-11 w-10 rounded-full border border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-press flex items-center justify-center shrink-0"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  disabled={sending}
                  aria-label="Buka kamera"
                  title="Ambil foto dari kamera"
                  className="h-11 w-10 rounded-full border border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-press flex items-center justify-center shrink-0"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </>
            )}

            {composerFocused || draftText.trim() || pendingFile ? (
              <button
                key={`send-${sendKick}`}
                type="submit"
                onMouseDown={(e) => e.preventDefault()}
                disabled={sending}
                aria-label="Kirim pesan"
                className={`h-11 px-4 rounded-full bg-[#8C0027] hover:bg-[#6E001F] text-[#FFFFFF] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm brutal-press p5-slash-btn flex items-center justify-center gap-1.5 font-display font-bold tracking-wide shrink-0 disabled:opacity-50 ${
                  sendKick > 0 ? 'p5-send-recoil p5-impact-ring' : ''
                }`}
              >
                <SendHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Kirim</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startVoiceRecording()}
                disabled={sending}
                aria-label="Rekam pesan suara"
                title="Rekam pesan suara"
                className="h-11 w-11 rounded-full bg-[#8C0027] hover:bg-[#6E001F] text-[#FFFFFF] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm brutal-press p5-slash-btn flex items-center justify-center shrink-0 disabled:opacity-50"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </form>
        )}
      </footer>

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

      <CameraCaptureModal
        open={cameraOpen}
        mode="photo"
        onClose={() => setCameraOpen(false)}
        onCapturePhoto={(file) => stageFileForPreview(file)}
      />
    </section>
  );
}
