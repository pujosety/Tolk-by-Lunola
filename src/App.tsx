import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Megaphone, WifiOff, X } from 'lucide-react';
import type {
  Attachment,
  CallRecord,
  ChatAppearancePrefs,
  ChatRoom,
  ChatType,
  DeviceSession,
  FolderKey,
  FriendRequest,
  LanguageCode,
  Message,
  ModerationReport,
  NotificationTone,
  PlatformSettings,
  StoryItem,
  TextScale,
  UserPrivacySettings,
  UserProfile,
} from './types/chat';
import { api, LunolaTalkSocket, type ServerWsEvent } from './lib/api';
import {
  notifyAndroidToast,
  syncAndroidStatusBar,
  triggerAndroidHaptic,
} from './lib/androidBridge';
import { t } from './lib/i18n';
import {
  playNotificationSound,
  showBrowserNotification,
  useOnlineStatus,
} from './lib/pwa';
import { useAnimatedPresence, useRetainedValue } from './lib/useAnimatedPresence';
import { DEFAULT_CHAT_APPEARANCE } from './lib/appearance';
import { compressImageFile } from './lib/imageCompression';
import { Sidebar, type MainNavTab } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { ChatInfoDrawer } from './components/ChatInfoDrawer';
import { HeaderOverflowMenu } from './components/HeaderOverflowMenu';
import {
  AuthModal,
  CreateChatModal,
  ForwardModal,
  NotificationsModal,
  ProfileModal,
  ReportModal,
  SessionsModal,
  SettingsModal,
  StarredMessagesModal,
} from './components/Modals';
import {
  CallOverlay,
  type ActiveCallSession,
} from './components/CallOverlay';
import { AdminPanel } from './components/AdminPanel';
import { AuthScreen } from './components/AuthScreen';
import { CameraCaptureModal } from './components/CameraCaptureModal';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file dari perangkat.'));
    reader.readAsDataURL(file);
  });
}

function sortChats(list: ChatRoom[]): ChatRoom[] {
  return [...list].sort((a, b) => {
    const pinDiff = (b.isPinnedByUser ? 1 : 0) - (a.isPinnedByUser ? 1 : 0);
    if (pinDiff !== 0) return pinDiff;
    const aTime = a.lastMessage?.createdAt || a.createdAt;
    const bTime = b.lastMessage?.createdAt || b.createdAt;
    return bTime - aTime;
  });
}

const AUTH_TOKEN_KEY = 'tolk_auth_token';

export function App() {
  const isOnline = useOnlineStatus();

  const [token, setToken] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(() => {
    try {
      return Boolean(window.localStorage.getItem(AUTH_TOKEN_KEY));
    } catch {
      return false;
    }
  });
  const [bootError, setBootError] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<Record<string, UserProfile>>({});
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [adminAuthState, setAdminAuthState] = useState({
    hasClaimedAdmin: false,
    envPasscodeConfigured: false,
  });
  const [maxUploadMb, setMaxUploadMb] = useState(25);

  const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>({});
  const [scheduledByChat, setScheduledByChat] = useState<Record<string, Message[]>>({});
  const [draftsByChat, setDraftsByChat] = useState<Record<string, string>>({});
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const [activeFolder, setActiveFolder] = useState<FolderKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingByChat, setTypingByChat] = useState<Record<string, string[]>>({});
  const [wsConnected, setWsConnected] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState('');

  // UX & Accessibility preferences
  const [darkMode, setDarkMode] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [lang, setLang] = useState<LanguageCode>('id');
  const [textScale, setTextScale] = useState<TextScale>('md');
  const [highContrast, setHighContrast] = useState(false);
  const [notificationTone, setNotificationTone] = useState<NotificationTone>('lunola');
  const [vibrateEnabled, setVibrateEnabled] = useState(true);
  const [appearance, setAppearance] = useState<ChatAppearancePrefs>(() => {
    try {
      const raw = window.localStorage.getItem('tolk_chat_appearance');
      if (raw) return { ...DEFAULT_CHAT_APPEARANCE, ...(JSON.parse(raw) as Partial<ChatAppearancePrefs>) };
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_CHAT_APPEARANCE;
  });

  const handleChangeAppearance = useCallback((next: ChatAppearancePrefs) => {
    setAppearance(next);
    try {
      window.localStorage.setItem('tolk_chat_appearance', JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  }, []);

  // Panels & Modals
  const [activeMainTab, setActiveMainTab] = useState<MainNavTab>('chats');
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [sessionsModalOpen, setSessionsModalOpen] = useState(false);
  const [sessionsList, setSessionsList] = useState<DeviceSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [quickCameraOpen, setQuickCameraOpen] = useState(false);
  const [starredModalOpen, setStarredModalOpen] = useState(false);
  const [starredItems, setStarredItems] = useState<
    Array<{ message: Message; chatTitle: string; senderName: string }>
  >([]);
  const [starredLoading, setStarredLoading] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [createModalState, setCreateModalState] = useState<{
    open: boolean;
    mode: 'dm' | 'group' | 'channel';
  }>({ open: false, mode: 'dm' });
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    targetType: ModerationReport['targetType'];
    targetId: string;
    targetChatId?: string;
    targetLabel: string;
  } | null>(null);

  // WebRTC Call State
  const [callSession, setCallSession] = useState<ActiveCallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');

  const peerConnRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const callSessionRef = useRef<ActiveCallSession | null>(null);

  const socketRef = useRef<LunolaTalkSocket | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const activeChatIdRef = useRef<string | null>(null);
  const currentUserRef = useRef<UserProfile | null>(null);
  const chatsRef = useRef<ChatRoom[]>([]);
  const usersRef = useRef<Record<string, UserProfile>>({});
  const toneRef = useRef<NotificationTone>(notificationTone);
  const vibrateRef = useRef<boolean>(vibrateEnabled);

  activeChatIdRef.current = activeChatId;
  currentUserRef.current = currentUser;
  chatsRef.current = chats;
  usersRef.current = users;
  callSessionRef.current = callSession;
  toneRef.current = notificationTone;
  vibrateRef.current = vibrateEnabled;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    notifyAndroidToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Sync dark mode, text scale, and high contrast to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    syncAndroidStatusBar(darkMode);
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-text-scale', textScale);
  }, [textScale]);

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
  }, [highContrast]);

  // Global keyboard shortcuts: Ctrl+K focuses search, Ctrl+B toggles sidebar minimize
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMobileShowChat(false);
        setSidebarMinimized(false);
        window.setTimeout(() => searchInputRef.current?.focus(), 40);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarMinimized((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Register Android WebView back button handler
  const hasSubViewOpen =
    quickCameraOpen ||
    adminPanelOpen ||
    starredModalOpen ||
    notificationsOpen ||
    sessionsModalOpen ||
    settingsModalOpen ||
    profileModalOpen ||
    authModalOpen ||
    createModalState.open ||
    forwardMsg !== null ||
    reportTarget !== null ||
    infoOpen ||
    overflowMenuOpen ||
    mobileShowChat ||
    activeMainTab !== 'chats';

  const handleBackNavigation = useCallback((): boolean => {
    if (quickCameraOpen) {
      setQuickCameraOpen(false);
      return true;
    }
    if (adminPanelOpen) {
      setAdminPanelOpen(false);
      return true;
    }
    if (starredModalOpen) {
      setStarredModalOpen(false);
      return true;
    }
    if (notificationsOpen) {
      setNotificationsOpen(false);
      return true;
    }
    if (sessionsModalOpen) {
      setSessionsModalOpen(false);
      return true;
    }
    if (settingsModalOpen) {
      setSettingsModalOpen(false);
      return true;
    }
    if (profileModalOpen) {
      setProfileModalOpen(false);
      return true;
    }
    if (authModalOpen) {
      setAuthModalOpen(false);
      return true;
    }
    if (createModalState.open) {
      setCreateModalState((s) => ({ ...s, open: false }));
      return true;
    }
    if (forwardMsg !== null) {
      setForwardMsg(null);
      return true;
    }
    if (reportTarget !== null) {
      setReportTarget(null);
      return true;
    }
    if (infoOpen) {
      setInfoOpen(false);
      return true;
    }
    if (overflowMenuOpen) {
      setOverflowMenuOpen(false);
      return true;
    }
    if (mobileShowChat) {
      setMobileShowChat(false);
      return true;
    }
    if (activeMainTab !== 'chats') {
      setActiveMainTab('chats');
      return true;
    }
    return false;
  }, [
    quickCameraOpen,
    adminPanelOpen,
    starredModalOpen,
    notificationsOpen,
    sessionsModalOpen,
    settingsModalOpen,
    profileModalOpen,
    authModalOpen,
    createModalState.open,
    forwardMsg,
    reportTarget,
    infoOpen,
    overflowMenuOpen,
    mobileShowChat,
    activeMainTab,
  ]);

  const pushedHistoryGuardRef = useRef(false);
  const [popTick, setPopTick] = useState(0);

  useEffect(() => {
    window.__lunolaTalkHandleBack = handleBackNavigation;
    return () => {
      delete window.__lunolaTalkHandleBack;
    };
  }, [handleBackNavigation]);

  useEffect(() => {
    if (hasSubViewOpen && !pushedHistoryGuardRef.current) {
      window.history.pushState({ tolkNavGuard: true }, '');
      pushedHistoryGuardRef.current = true;
    } else if (!hasSubViewOpen) {
      pushedHistoryGuardRef.current = false;
    }
  }, [hasSubViewOpen, popTick]);

  useEffect(() => {
    const onPopState = () => {
      pushedHistoryGuardRef.current = false;
      const handled = handleBackNavigation();
      if (handled) {
        setPopTick((v) => v + 1);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [handleBackNavigation]);

  const loadMessagesForChat = useCallback(async (authToken: string, chatId: string) => {
    setLoadingChatId(chatId);
    try {
      const res = await api.getMessages(authToken, chatId);
      setMessagesByChat((prev) => ({ ...prev, [chatId]: res.messages }));
      setScheduledByChat((prev) => ({ ...prev, [chatId]: res.scheduledMessages }));
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId ? { ...c, unreadCount: 0, markedUnreadByUser: false } : c
        )
      );
    } catch {
      // Non-fatal
    } finally {
      setLoadingChatId((prev) => (prev === chatId ? null : prev));
    }
  }, []);

  const hydrateFromToken = useCallback(
    async (authToken: string) => {
      setBootstrapping(true);
      setBootError(null);
      try {
        const data = await api.bootstrap(authToken);
        try {
          window.localStorage.setItem(AUTH_TOKEN_KEY, authToken);
        } catch {
          // Ignore storage quota errors
        }
        setToken(authToken);
        setCurrentUser(data.user);
        setUsers(data.users);
        setChats(sortChats(data.chats));
        setStories(data.stories);
        setCalls(data.calls);
        setFriendRequests(data.friendRequests || []);
        setSettings(data.settings);
        setAdminAuthState(data.adminAuthState);
        setMaxUploadMb(data.serverInfo.maxUploadMb || 25);
        setOnlineUserIds(new Set(data.onlineUserIds));

        if (data.chats.length > 0) {
          const initialChat = data.chats[0];
          setActiveChatId(initialChat.id);
          await loadMessagesForChat(authToken, initialChat.id);
        } else {
          setActiveChatId(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal menyambung ke server Tolk by Lunola.';
        const isAuthFailure = /401|403|sesi|token|unauthorized|login/i.test(msg);
        if (isAuthFailure) {
          try {
            window.localStorage.removeItem(AUTH_TOKEN_KEY);
          } catch {
            // Ignore
          }
          setToken(null);
          setCurrentUser(null);
        } else {
          setBootError(msg);
        }
      } finally {
        setBootstrapping(false);
      }
    },
    [loadMessagesForChat]
  );

  // Restore saved session on mount / refresh
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      saved = null;
    }
    if (saved) {
      void hydrateFromToken(saved);
    } else {
      setBootstrapping(false);
    }
  }, [hydrateFromToken]);

  // WebRTC Cleanup Helper
  const cleanupWebRtc = useCallback(() => {
    if (peerConnRef.current) {
      peerConnRef.current.onicecandidate = null;
      peerConnRef.current.ontrack = null;
      peerConnRef.current.close();
      peerConnRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((tr) => tr.stop());
      localStreamRef.current = null;
    }
    pendingOfferRef.current = null;
    pendingIceRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setCallSession(null);
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string, callId: string) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnRef.current = pc;

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          socketRef.current?.sendCallSignal({
            type: 'call:ice',
            targetUserId: peerId,
            callId,
            candidate: ev.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (ev) => {
        const stream = ev.streams[0] || new MediaStream([ev.track]);
        setRemoteStream(stream);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallSession((prev) => (prev ? { ...prev, state: 'connected' } : prev));
        } else if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'disconnected'
        ) {
          cleanupWebRtc();
        }
      };

      return pc;
    },
    [cleanupWebRtc]
  );

  const handleStartCall = useCallback(
    async (peerId: string, kind: 'voice' | 'video') => {
      if (!token) return;
      try {
        const { call } = await api.createCall(token, peerId, kind);
        setCalls((prev) => [call, ...prev]);

        let stream: MediaStream | null = null;
        if (navigator.mediaDevices?.getUserMedia) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: kind === 'video' ? { facingMode: cameraFacing } : false,
            });
          } catch {
            showToast('Izin mikrofon/kamera tidak tersedia; panggilan berjalan tanpa media lokal.');
          }
        }
        localStreamRef.current = stream;
        setLocalStream(stream);

        setCallSession({
          callId: call.id,
          peerId,
          kind,
          direction: 'outgoing',
          state: 'ringing',
        });

        socketRef.current?.sendCallSignal({
          type: 'call:invite',
          targetUserId: peerId,
          callId: call.id,
          kind,
        });

        const pc = createPeerConnection(peerId, call.id);
        if (stream) {
          stream.getTracks().forEach((tr) => pc.addTrack(tr, stream!));
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.sendCallSignal({
          type: 'call:offer',
          targetUserId: peerId,
          callId: call.id,
          kind,
          sdp: offer,
        });
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Gagal memulai panggilan.');
        cleanupWebRtc();
      }
    },
    [token, cameraFacing, createPeerConnection, cleanupWebRtc, showToast]
  );

  const handleAcceptCall = useCallback(async () => {
    const active = callSessionRef.current;
    if (!active || !token) return;

    try {
      setCallSession({ ...active, state: 'connecting' });
      let stream: MediaStream | null = null;
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: active.kind === 'video' ? { facingMode: cameraFacing } : false,
          });
        } catch {
          showToast('Mikrofon/kamera tidak diizinkan; menerima panggilan hanya-dengar.');
        }
      }
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection(active.peerId, active.callId);
      if (stream) {
        stream.getTracks().forEach((tr) => pc.addTrack(tr, stream!));
      }

      if (pendingOfferRef.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.sendCallSignal({
          type: 'call:answer',
          targetUserId: active.peerId,
          callId: active.callId,
          sdp: answer,
        });
        for (const cand of pendingIceRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        pendingIceRef.current = [];
      }

      await api.updateCall(token, active.callId, { status: 'active' }).catch(() => {});
      setCallSession((prev) => (prev ? { ...prev, state: 'connected' } : prev));
    } catch {
      showToast('Gagal menyambungkan panggilan WebRTC.');
      cleanupWebRtc();
    }
  }, [token, cameraFacing, createPeerConnection, cleanupWebRtc, showToast]);

  const handleRejectCall = useCallback(() => {
    const active = callSessionRef.current;
    if (active) {
      socketRef.current?.sendCallSignal({
        type: 'call:reject',
        targetUserId: active.peerId,
        callId: active.callId,
      });
      if (token) {
        void api.updateCall(token, active.callId, { status: 'rejected' }).catch(() => {});
      }
    }
    cleanupWebRtc();
  }, [token, cleanupWebRtc]);

  const handleEndCall = useCallback(
    (durationSec: number) => {
      const active = callSessionRef.current;
      if (active) {
        socketRef.current?.sendCallSignal({
          type: 'call:end',
          targetUserId: active.peerId,
          callId: active.callId,
        });
        if (token) {
          void api
            .updateCall(token, active.callId, {
              status: durationSec > 0 ? 'completed' : 'missed',
              durationSec,
            })
            .then(({ call }) => {
              setCalls((prev) =>
                prev.map((c) => (c.id === call.id ? call : c))
              );
            })
            .catch(() => {});
        }
      }
      cleanupWebRtc();
    },
    [token, cleanupWebRtc]
  );

  const handleSwitchCamera = useCallback(async () => {
    const active = callSessionRef.current;
    if (!active || active.kind !== 'video' || !navigator.mediaDevices?.getUserMedia) return;
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    try {
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing },
      });
      const newTrack = newVideoStream.getVideoTracks()[0];
      const sender = peerConnRef.current
        ?.getSenders()
        .find((s) => s.track?.kind === 'video');
      if (sender && newTrack) {
        await sender.replaceTrack(newTrack);
      }
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((old) => {
          old.stop();
          localStreamRef.current?.removeTrack(old);
        });
        if (newTrack) localStreamRef.current.addTrack(newTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }
      setCameraFacing(nextFacing);
    } catch {
      showToast('Perangkat ini tidak memiliki kamera kedua.');
    }
  }, [cameraFacing, showToast]);

  // Real-time WebSocket Connection
  useEffect(() => {
    if (!token) return;

    const handleWsEvent = (evt: ServerWsEvent) => {
      switch (evt.type) {
        case 'auth:ok':
          setOnlineUserIds(new Set(evt.onlineUserIds));
          break;

        case 'session:revoked':
          try {
            window.localStorage.removeItem(AUTH_TOKEN_KEY);
          } catch {
            // Ignore
          }
          cleanupWebRtc();
          setToken(null);
          setCurrentUser(null);
          setChats([]);
          setMessagesByChat({});
          setActiveChatId(null);
          showToast('Sesi login Anda dicabut oleh perangkat lain atau admin.');
          break;

        case 'presence:update':
          setOnlineUserIds((prev) => {
            const next = new Set(prev);
            if (evt.online) next.add(evt.userId);
            else next.delete(evt.userId);
            return next;
          });
          setUsers((prev) =>
            prev[evt.userId]
              ? { ...prev, [evt.userId]: { ...prev[evt.userId], lastSeen: evt.lastSeen } }
              : prev
          );
          break;

        case 'typing:update':
          setTypingByChat((prev) => {
            const list = prev[evt.chatId] || [];
            const nextList = evt.isTyping
              ? Array.from(new Set([...list, evt.userId]))
              : list.filter((id) => id !== evt.userId);
            return { ...prev, [evt.chatId]: nextList };
          });
          break;

        case 'message:created': {
          const msg = evt.message;
          const isCurrentActive = activeChatIdRef.current === msg.chatId;
          const myId = currentUserRef.current?.id;
          const isFromOther = msg.senderId !== myId;

          setMessagesByChat((prev) => {
            const existing = prev[msg.chatId] || [];
            if (existing.some((m) => m.id === msg.id)) return prev;
            return { ...prev, [msg.chatId]: [...existing, msg] };
          });

          setScheduledByChat((prev) => {
            const sched = prev[msg.chatId];
            if (!sched) return prev;
            return { ...prev, [msg.chatId]: sched.filter((m) => m.id !== msg.id) };
          });

          setChats((prev) =>
            sortChats(
              prev.map((c) => {
                if (c.id !== msg.chatId) return c;
                return {
                  ...c,
                  lastMessage: msg,
                  unreadCount: isCurrentActive || !isFromOther ? 0 : c.unreadCount + 1,
                };
              })
            )
          );

          if (isFromOther) {
            const targetChat = chatsRef.current.find((c) => c.id === msg.chatId);
            const senderName = usersRef.current[msg.senderId]?.displayName || 'Tolk by Lunola';
            const mentionedMe =
              currentUserRef.current &&
              msg.mentions?.includes(currentUserRef.current.username.toLowerCase());
            if (!targetChat?.isMutedByUser || mentionedMe) {
              playNotificationSound(toneRef.current, vibrateRef.current);
              showBrowserNotification(
                targetChat?.type === 'group' ? `${senderName} · ${targetChat.title}` : senderName,
                msg.text || msg.attachment?.name || 'Mengirim lampiran media',
                msg.chatId
              );
            }
          }
          break;
        }

        case 'message:updated': {
          const msg = evt.message;
          setMessagesByChat((prev) => {
            const existing = prev[msg.chatId];
            if (!existing) return prev;
            return {
              ...prev,
              [msg.chatId]: existing.map((m) => (m.id === msg.id ? msg : m)),
            };
          });
          setChats((prev) =>
            prev.map((c) => (c.lastMessage?.id === msg.id ? { ...c, lastMessage: msg } : c))
          );
          break;
        }

        case 'message:deleted': {
          setMessagesByChat((prev) => {
            const existing = prev[evt.chatId];
            if (!existing) return prev;
            return {
              ...prev,
              [evt.chatId]: existing.filter((m) => m.id !== evt.messageId),
            };
          });
          break;
        }

        case 'chat:created':
          setChats((prev) => {
            if (prev.some((c) => c.id === evt.chat.id)) return prev;
            return sortChats([evt.chat, ...prev]);
          });
          break;

        case 'chat:updated':
          setChats((prev) =>
            sortChats(
              prev.map((c) => (c.id === evt.chatId ? { ...c, ...evt.patch } : c))
            )
          );
          break;

        case 'chat:deleted':
          setChats((prev) => prev.filter((c) => c.id !== evt.chatId));
          setMessagesByChat((prev) => {
            const next = { ...prev };
            delete next[evt.chatId];
            return next;
          });
          setActiveChatId((prev) => (prev === evt.chatId ? null : prev));
          break;

        case 'chat:read':
          setMessagesByChat((prev) => {
            const list = prev[evt.chatId];
            if (!list) return prev;
            return {
              ...prev,
              [evt.chatId]: list.map((m) =>
                m.readBy.includes(evt.userId) ? m : { ...m, readBy: [...m.readBy, evt.userId] }
              ),
            };
          });
          break;

        case 'user:updated':
          setUsers((prev) => ({ ...prev, [evt.user.id]: evt.user }));
          setCurrentUser((prev) => (prev && prev.id === evt.user.id ? evt.user : prev));
          break;

        case 'story:created':
          setStories((prev) => [evt.story, ...prev.filter((s) => s.id !== evt.story.id)]);
          break;

        case 'story:updated':
          setStories((prev) => prev.map((s) => (s.id === evt.story.id ? evt.story : s)));
          break;

        case 'story:deleted':
          setStories((prev) => prev.filter((s) => s.id !== evt.storyId));
          break;

        case 'settings:updated':
          setSettings(evt.settings);
          setMaxUploadMb(evt.settings.maxUploadMb || 25);
          break;

        case 'contact:request':
          setUsers((prev) => ({ ...prev, [evt.fromUser.id]: evt.fromUser }));
          setFriendRequests((prev) => [evt.request, ...prev.filter((r) => r.id !== evt.request.id)]);
          playNotificationSound(toneRef.current, vibrateRef.current);
          showBrowserNotification(
            'Permintaan Kontak Baru',
            `${evt.fromUser.displayName} (@${evt.fromUser.username}) ingin menambahkan Anda sebagai kontak.`,
            evt.request.id
          );
          showToast(`${evt.fromUser.displayName} mengirim permintaan kontak.`);
          break;

        case 'contact:accepted':
          setUsers((prev) => ({ ...prev, [evt.user.id]: evt.user }));
          setFriendRequests((prev) =>
            prev.map((r) => (r.id === evt.request.id ? { ...r, status: 'accepted' } : r))
          );
          setCurrentUser((prev) =>
            prev
              ? {
                  ...prev,
                  contactIds: Array.from(new Set([...(prev.contactIds || []), evt.user.id])),
                }
              : prev
          );
          showToast(`${evt.user.displayName} menerima permintaan kontak Anda.`);
          break;

        // WebRTC Call Signaling
        case 'call:invite': {
          if (callSessionRef.current) {
            socketRef.current?.sendCallSignal({
              type: 'call:reject',
              targetUserId: evt.fromUserId,
              callId: evt.callId,
            });
            break;
          }
          playNotificationSound(toneRef.current, vibrateRef.current);
          const callerName = usersRef.current[evt.fromUserId]?.displayName || 'Seseorang';
          showBrowserNotification(
            `Panggilan ${evt.kind === 'video' ? 'Video' : 'Suara'} Masuk`,
            `${callerName} memanggil Anda di Tolk by Lunola`,
            evt.callId
          );
          setCallSession({
            callId: evt.callId,
            peerId: evt.fromUserId,
            kind: evt.kind || 'voice',
            direction: 'incoming',
            state: 'ringing',
          });
          break;
        }

        case 'call:offer': {
          if (evt.sdp) {
            pendingOfferRef.current = evt.sdp;
          }
          break;
        }

        case 'call:answer': {
          if (evt.sdp && peerConnRef.current) {
            void peerConnRef.current
              .setRemoteDescription(new RTCSessionDescription(evt.sdp))
              .then(() => {
                setCallSession((prev) => (prev ? { ...prev, state: 'connected' } : prev));
              })
              .catch(() => {});
          }
          break;
        }

        case 'call:ice': {
          if (evt.candidate) {
            if (peerConnRef.current && peerConnRef.current.remoteDescription) {
              void peerConnRef.current
                .addIceCandidate(new RTCIceCandidate(evt.candidate))
                .catch(() => {});
            } else {
              pendingIceRef.current.push(evt.candidate);
            }
          }
          break;
        }

        case 'call:reject':
          showToast('Panggilan ditolak oleh penerima.');
          cleanupWebRtc();
          break;

        case 'call:end':
          showToast('Panggilan berakhir.');
          cleanupWebRtc();
          break;

        default:
          break;
      }
    };

    const socket = new LunolaTalkSocket(token, handleWsEvent, setWsConnected);
    socketRef.current = socket;
    socket.connect();

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, hydrateFromToken, cleanupWebRtc, showToast]);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || null,
    [chats, activeChatId]
  );

  const handleSelectChat = useCallback(
    (chatId: string) => {
      setActiveChatId(chatId);
      setMobileShowChat(true);
      triggerAndroidHaptic();
      if (token) {
        void loadMessagesForChat(token, chatId);
      }
    },
    [token, loadMessagesForChat]
  );

  const handleUploadFile = useCallback(
    async (file: File, onProgress?: (pct: number) => void, durationSec?: number): Promise<Attachment> => {
      if (!token) throw new Error('Sesi belum aktif.');
      onProgress?.(4);
      const processedFile = await compressImageFile(file);
      onProgress?.(12);
      const dataUrl = await fileToDataUrl(processedFile);
      const { attachment } = await api.uploadMediaWithProgress(
        token,
        { dataUrl, name: processedFile.name, durationSec },
        onProgress
      );
      return attachment;
    },
    [token]
  );

  const handleSendMessage = useCallback(
    async (payload: {
      text: string;
      replyToId?: string | null;
      attachment?: Attachment | null;
      scheduledFor?: number | null;
    }) => {
      if (!token || !activeChatId) return;
      const { message, scheduled } = await api.sendMessage(token, activeChatId, payload);
      if (scheduled) {
        setScheduledByChat((prev) => ({
          ...prev,
          [activeChatId]: [...(prev[activeChatId] || []), message],
        }));
        showToast('Pesan dijadwalkan untuk dikirim otomatis.');
      } else {
        setMessagesByChat((prev) => {
          const list = prev[activeChatId] || [];
          if (list.some((m) => m.id === message.id)) return prev;
          return { ...prev, [activeChatId]: [...list, message] };
        });
        setChats((prev) =>
          sortChats(
            prev.map((c) => (c.id === activeChatId ? { ...c, lastMessage: message } : c))
          )
        );
      }
    },
    [token, activeChatId, showToast]
  );

  const handleEditMessage = useCallback(
    async (messageId: string, text: string) => {
      if (!token || !activeChatId) return;
      const { message } = await api.editMessage(token, messageId, activeChatId, text);
      setMessagesByChat((prev) => ({
        ...prev,
        [activeChatId]: (prev[activeChatId] || []).map((m) => (m.id === message.id ? message : m)),
      }));
    },
    [token, activeChatId]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!token || !activeChatId) return;
      await api.deleteMessage(token, activeChatId, messageId);
      setMessagesByChat((prev) => ({
        ...prev,
        [activeChatId]: (prev[activeChatId] || []).filter((m) => m.id !== messageId),
      }));
    },
    [token, activeChatId]
  );

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!token || !activeChatId) return;
      const { message } = await api.toggleReaction(token, activeChatId, messageId, emoji);
      setMessagesByChat((prev) => ({
        ...prev,
        [activeChatId]: (prev[activeChatId] || []).map((m) => (m.id === message.id ? message : m)),
      }));
    },
    [token, activeChatId]
  );

  const handlePinMessage = useCallback(
    async (messageId: string | null) => {
      if (!token || !activeChatId) return;
      const { pinnedMessageId } = await api.pinMessage(token, activeChatId, messageId);
      setChats((prev) =>
        prev.map((c) => (c.id === activeChatId ? { ...c, pinnedMessageId } : c))
      );
      showToast(pinnedMessageId ? 'Pesan disematkan.' : 'Sematan dilepas.');
    },
    [token, activeChatId, showToast]
  );

  const handleForwardTarget = useCallback(
    async (targetChatId: string) => {
      if (!token || !forwardMsg) return;
      const origSender = users[forwardMsg.senderId]?.displayName || 'Pengguna';
      await api.sendMessage(token, targetChatId, {
        text: forwardMsg.text,
        attachment: forwardMsg.attachment || null,
        forwardedFrom: { senderName: origSender, chatTitle: activeChat?.title },
      });
      showToast('Pesan berhasil diteruskan.');
    },
    [token, forwardMsg, users, activeChat, showToast]
  );

  const handleUpdateChatPreferences = useCallback(
    async (patch: {
      pinned?: boolean;
      archived?: boolean;
      markedUnread?: boolean;
      mutedUntil?: number | null;
    }) => {
      if (!token || !activeChat) return;
      const res = await api.updateChatPreferences(token, activeChat.id, patch);
      setChats((prev) =>
        sortChats(
          prev.map((c) =>
            c.id === activeChat.id
              ? {
                  ...c,
                  isPinnedByUser: res.isPinnedByUser,
                  isArchivedByUser: res.isArchivedByUser,
                  markedUnreadByUser: res.markedUnreadByUser,
                  isMutedByUser: res.isMutedByUser,
                  mutedUntil: res.mutedUntil,
                }
              : c
          )
        )
      );
      showToast('Preferensi chat diperbarui.');
    },
    [token, activeChat, showToast]
  );

  const handleSetTimer = useCallback(
    async (seconds: number) => {
      if (!token || !activeChat) return;
      const { selfDestructSec } = await api.setTimer(token, activeChat.id, seconds);
      setChats((prev) =>
        prev.map((c) => (c.id === activeChat.id ? { ...c, selfDestructSec } : c))
      );
      showToast(selfDestructSec > 0 ? 'Timer hapus otomatis aktif.' : 'Timer dimatikan.');
    },
    [token, activeChat, showToast]
  );

  const handleCreateChat = useCallback(
    async (payload: {
      type: ChatType;
      targetUserId?: string;
      title?: string;
      description?: string;
      handle?: string;
      memberIds?: string[];
    }) => {
      if (!token) return;
      const { chat } = await api.createChat(token, payload);
      setChats((prev) => {
        const exists = prev.some((c) => c.id === chat.id);
        return sortChats(exists ? prev : [chat, ...prev]);
      });
      handleSelectChat(chat.id);
    },
    [token, handleSelectChat]
  );

  const handleTranslateMessage = useCallback(
    async (_messageId: string, text: string): Promise<string> => {
      if (!token) throw new Error('Belum login');
      try {
        const targetLang: 'id' | 'en' = lang === 'id' ? 'en' : 'id';
        const { translation } = await api.aiTranslate(token, text, targetLang);
        return translation;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal menerjemahkan pesan.';
        showToast(msg);
        throw err;
      }
    },
    [token, lang, showToast]
  );

  const handleSummarizeChat = useCallback(async (): Promise<string> => {
    if (!token || !activeChatId) throw new Error('Chat belum dipilih');
    try {
      const { summary } = await api.aiSummarize(token, activeChatId, lang);
      return summary;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal meringkas percakapan.';
      showToast(msg);
      throw err;
    }
  }, [token, activeChatId, lang, showToast]);

  // Stories callbacks
  const handleCreateStory = useCallback(
    async (payload: {
      kind: 'text' | 'image' | 'video';
      text: string;
      bgColor: string;
      mediaUrl?: string | null;
      privacy: 'everyone' | 'selected' | 'except';
      allowedUserIds?: string[];
      excludedUserIds?: string[];
    }) => {
      if (!token) return;
      const { story } = await api.createStory(token, payload);
      setStories((prev) => [story, ...prev.filter((s) => s.id !== story.id)]);
      showToast('Status 24 jam berhasil dipublikasikan.');
    },
    [token, showToast]
  );

  const handleReplyToStory = useCallback(
    async (story: StoryItem, text: string) => {
      if (!token) return;
      const { chat } = await api.createChat(token, { type: 'dm', targetUserId: story.userId });
      setChats((prev) => (prev.some((c) => c.id === chat.id) ? prev : sortChats([chat, ...prev])));
      const authorName = users[story.userId]?.displayName || 'Pengguna';
      await api.sendMessage(token, chat.id, {
        text,
        replyToStory: {
          storyId: story.id,
          authorName,
          snippet: story.text || (story.kind === 'video' ? 'Status video' : 'Status foto'),
        },
      });
      handleSelectChat(chat.id);
      showToast('Balasan status terkirim.');
    },
    [token, users, handleSelectChat, showToast]
  );

  const loadSessions = useCallback(async () => {
    if (!token) return;
    setSessionsLoading(true);
    try {
      const { sessions } = await api.getSessions(token);
      setSessionsList(sessions);
    } finally {
      setSessionsLoading(false);
    }
  }, [token]);

  const handleLogout = useCallback(async () => {
    if (token) {
      await api.logout(token).catch(() => {});
    }
    try {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // Ignore
    }
    cleanupWebRtc();
    setToken(null);
    setCurrentUser(null);
    setChats([]);
    setMessagesByChat({});
    setActiveChatId(null);
    setAuthModalOpen(false);
    showToast('Anda telah keluar. Silakan masuk kembali.');
  }, [token, cleanupWebRtc, showToast]);

  const loadStarredMessages = useCallback(async () => {
    if (!token) return;
    setStarredLoading(true);
    try {
      const { items } = await api.getStarredMessages(token);
      setStarredItems(items);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memuat pesan berbintang.');
    } finally {
      setStarredLoading(false);
    }
  }, [token, showToast]);

  const handleToggleStarMessage = useCallback(
    async (messageId: string, starred?: boolean) => {
      if (!token) return;
      try {
        const { starredMessageIds } = await api.toggleStarMessage(token, messageId, starred);
        setCurrentUser((prev) => (prev ? { ...prev, starredMessageIds } : prev));
        if (starredModalOpen) {
          setStarredItems((prev) => prev.filter((item) => starredMessageIds.includes(item.message.id)));
        }
        const isNowStarred = starredMessageIds.includes(messageId);
        showToast(isNowStarred ? 'Pesan dibintangi.' : 'Bintang pesan dihapus.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Gagal memperbarui bintang pesan.');
      }
    },
    [token, starredModalOpen, showToast]
  );

  const showGlobalBanner =
    Boolean(settings?.globalAnnouncement?.trim()) &&
    settings?.globalAnnouncement !== dismissedAnnouncement;
  const globalBannerPresence = useAnimatedPresence(showGlobalBanner, 175);
  const toastRetained = useRetainedValue(toast, 195);

  if (bootstrapping) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center chat-canvas-bg text-[#161B26] dark:text-[#F5F7FA] px-6">
        <div className="p5-impact-slam px-7 py-6 rounded-3xl bg-[#FFFFFF] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-lg flex flex-col items-center">
          <img
            src="/assets/aistudio/tolk-stacked_d5d93707.svg"
            alt="Tolk by Lunola"
            className="h-32 w-auto object-contain select-none"
          />
        </div>
        <p className="mt-4 text-xs font-mono font-bold tracking-wide text-[#5A6578] dark:text-[#CBD5E1] p5-panel-reveal">
          {t(lang, 'connecting')}
        </p>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#F5F7FA] dark:bg-[#0F141E] text-[#161B26] dark:text-[#F5F7FA] px-6 text-center">
        <div className="p-6 rounded-xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow max-w-sm">
          <p className="font-display font-extrabold text-xl">Gagal memuat Tolk by Lunola</p>
          <p className="mt-1 text-xs text-[#5A6578] dark:text-[#94A3B8]">
            {bootError}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] text-[#FFFFFF] border border-[#E6ECF2] brutal-shadow-sm brutal-press text-xs font-bold"
          >
            Muat Ulang
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser || !token) {
    return (
      <AuthScreen
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((v) => !v)}
        onRegister={async (payload) => {
          const { token: newToken } = await api.register(payload);
          await hydrateFromToken(newToken);
          showToast('Akun Tolk by Lunola berhasil dibuat.');
        }}
        onLogin={async (payload) => {
          const { token: newToken } = await api.login(payload);
          await hydrateFromToken(newToken);
          showToast('Berhasil masuk ke akun Anda.');
        }}
      />
    );
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-[#F5F7FA] dark:bg-[#0F141E]">
      {/* Offline Indicator (PWA) */}
      {!isOnline && (
        <div className="p5-panel-reveal px-4 py-1.5 bg-[#161B26] text-[#FFFFFF] border-b-2 border-[#8C0027] text-xs font-bold flex items-center justify-center gap-2 shrink-0 z-30">
          <WifiOff className="w-3.5 h-3.5 text-[#F47296]" />
          <span>{t(lang, 'offlineBanner')}</span>
        </div>
      )}

      {/* Maintenance Notice */}
      {settings?.maintenanceMode && (
        <div className="p5-panel-reveal px-4 py-1.5 bg-amber-500 text-[#161B26] border-b-2 border-[#E6ECF2] text-xs font-bold flex items-center justify-center gap-2 shrink-0 z-30">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Mode Maintenance sedang aktif — beberapa fungsi mungkin dibatasi sementara.</span>
        </div>
      )}

      {/* Global Platform Announcement */}
      {globalBannerPresence.mounted && settings && (
        <div
          className={`${
            globalBannerPresence.closing ? 'p5-panel-out pointer-events-none' : 'p5-panel-reveal'
          } px-4 py-1.5 bg-[#8C0027] text-[#FFFFFF] border-b-2 border-[#E6ECF2] text-xs font-medium flex items-center justify-between gap-3 shrink-0 z-30`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Megaphone className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{settings.globalAnnouncement}</span>
          </div>
          <button
            type="button"
            onClick={() => setDismissedAnnouncement(settings.globalAnnouncement)}
            aria-label="Tutup pengumuman"
            className="p-0.5 hover:bg-white/15 rounded-md brutal-press"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3-Pane Messaging Workspace */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Pane 1: Sidebar (smoothly minimizable on desktop) */}
        <div
          className={`${
            mobileShowChat ? 'hidden md:flex' : 'flex'
          } w-full ${
            sidebarMinimized ? 'md:w-[76px]' : 'md:w-[340px] lg:w-[375px]'
          } shrink-0 h-full transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`}
        >
          <Sidebar
            lang={lang}
            activeTab={activeMainTab}
            onSelectTab={setActiveMainTab}
            chats={chats}
            calls={calls}
            users={users}
            currentUser={currentUser}
            stories={stories}
            friendRequests={friendRequests}
            settings={settings}
            onlineUserIds={onlineUserIds}
            typingByChat={typingByChat}
            draftsByChat={draftsByChat}
            activeChatId={activeChatId}
            activeFolder={activeFolder}
            searchQuery={searchQuery}
            searchInputRef={searchInputRef}
            wsConnected={wsConnected}
            minimized={sidebarMinimized}
            darkMode={darkMode}
            notificationCount={
              friendRequests.filter(
                (r) => r.toUserId === currentUser.id && r.status === 'pending'
              ).length + (settings?.globalAnnouncement?.trim() ? 1 : 0)
            }
            onToggleMinimize={() => setSidebarMinimized((v) => !v)}
            onToggleDarkMode={() => setDarkMode((v) => !v)}
            onQuickSearch={() => {
              setSidebarMinimized(false);
              setActiveMainTab('chats');
              window.setTimeout(() => searchInputRef.current?.focus(), 60);
            }}
            onSelectFolder={setActiveFolder}
            onSearchChange={setSearchQuery}
            onSelectChat={handleSelectChat}
            onOpenOverflowMenu={() => setOverflowMenuOpen((v) => !v)}
            onOpenQuickCamera={() => setQuickCameraOpen(true)}
            onOpenNewChat={() => setCreateModalState({ open: true, mode: 'dm' })}
            onOpenNewChannel={() => setCreateModalState({ open: true, mode: 'channel' })}
            onRespondRequest={async (requestId, action) => {
              const res = await api.respondContactRequest(token, requestId, action);
              setFriendRequests((prev) => prev.map((r) => (r.id === requestId ? res.request : r)));
              setCurrentUser((prev) => (prev ? { ...prev, contactIds: res.contactIds } : prev));
              showToast(action === 'accept' ? 'Permintaan kontak diterima.' : 'Permintaan kontak ditolak.');
            }}
            onStartCall={(peerId, kind) => void handleStartCall(peerId, kind)}
            onOpenProfile={() => setProfileModalOpen(true)}
            onOpenQrCard={() => setCreateModalState({ open: true, mode: 'dm' })}
            onOpenStarred={() => {
              setStarredModalOpen(true);
              void loadStarredMessages();
            }}
            onOpenDevices={() => {
              setSessionsModalOpen(true);
              void loadSessions();
            }}
            onOpenSettings={() => setSettingsModalOpen(true)}
            onOpenAdminPanel={() => setAdminPanelOpen(true)}
            onOpenAuth={() => setAuthModalOpen(true)}
            onLogout={() => void handleLogout()}
            onDeleteChat={async (chatId) => {
              await api.deleteChat(token, chatId);
              setChats((prev) => prev.filter((c) => c.id !== chatId));
              setMessagesByChat((prev) => {
                const next = { ...prev };
                delete next[chatId];
                return next;
              });
              if (activeChatId === chatId) {
                setActiveChatId(null);
                setMobileShowChat(false);
              }
              showToast('Percakapan dihapus.');
            }}
            onTogglePinChat={async (chatId) => {
              const target = chats.find((c) => c.id === chatId);
              if (!target) return;
              const prefs = await api.updateChatPreferences(token, chatId, {
                pinned: !target.isPinnedByUser,
              });
              setChats((prev) =>
                sortChats(prev.map((c) => (c.id === chatId ? { ...c, ...prefs } : c)))
              );
              showToast(prefs.isPinnedByUser ? 'Chat disematkan.' : 'Semat dilepas.');
            }}
            onToggleArchiveChat={async (chatId) => {
              const target = chats.find((c) => c.id === chatId);
              if (!target) return;
              const prefs = await api.updateChatPreferences(token, chatId, {
                archived: !target.isArchivedByUser,
              });
              setChats((prev) =>
                sortChats(prev.map((c) => (c.id === chatId ? { ...c, ...prefs } : c)))
              );
              showToast(prefs.isArchivedByUser ? 'Chat diarsipkan.' : 'Dikeluarkan dari arsip.');
            }}
            onCreateStory={handleCreateStory}
            onUploadStoryMedia={(file, onProgress) => handleUploadFile(file, onProgress)}
            onViewStory={(storyId) => {
              void api.viewStory(token, storyId).catch(() => {});
            }}
            onDeleteStory={async (storyId) => {
              await api.deleteStory(token, storyId);
              setStories((prev) => prev.filter((s) => s.id !== storyId));
              showToast('Status dihapus.');
            }}
            onMuteStoryAuthor={async (authorId) => {
              const { mutedStoryUserIds } = await api.muteStoryAuthor(token, authorId, true);
              setCurrentUser((prev) => (prev ? { ...prev, mutedStoryUserIds } : prev));
              setStories((prev) => prev.filter((s) => s.userId !== authorId));
              showToast('Status pengguna ini dibisukan.');
            }}
            onReplyToStory={handleReplyToStory}
          />
        </div>

        {/* Pane 2: Active Chat Window */}
        <main
          className={`${
            mobileShowChat ? 'flex' : 'hidden md:flex'
          } flex-1 min-w-0 h-full`}
        >
          {activeChat ? (
            <ChatWindow
              lang={lang}
              chat={activeChat}
              messages={messagesByChat[activeChat.id] || []}
              scheduledMessages={scheduledByChat[activeChat.id] || []}
              loading={loadingChatId === activeChat.id && !messagesByChat[activeChat.id]}
              users={users}
              currentUser={currentUser}
              onlineUserIds={onlineUserIds}
              typingUserIds={typingByChat[activeChat.id] || []}
              draftText={draftsByChat[activeChat.id] || ''}
              maxUploadMb={maxUploadMb}
              appearance={appearance}
              darkMode={darkMode}
              onDraftChange={(text) =>
                setDraftsByChat((prev) => ({ ...prev, [activeChat.id]: text }))
              }
              onBackMobile={() => setMobileShowChat(false)}
              onOpenInfo={() => setInfoOpen((v) => !v)}
              onStartCall={(peerId, kind) => void handleStartCall(peerId, kind)}
              onSendMessage={handleSendMessage}
              onUploadFile={handleUploadFile}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onToggleReaction={handleToggleReaction}
              onPinMessage={handlePinMessage}
              onToggleStarMessage={handleToggleStarMessage}
              onForwardMessage={(msg) => setForwardMsg(msg)}
              onTranslateMessage={handleTranslateMessage}
              onSummarizeChat={handleSummarizeChat}
              onReportMessage={(msg) =>
                setReportTarget({
                  targetType: 'message',
                  targetId: msg.id,
                  targetChatId: activeChat.id,
                  targetLabel: msg.text.slice(0, 60) || msg.attachment?.name || 'Pesan',
                })
              }
              onTyping={(isTyping) => socketRef.current?.sendTyping(activeChat.id, isTyping)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center chat-canvas-bg p-6 text-center">
              <div className="p5-impact-slam px-6 py-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-lg max-w-sm flex flex-col items-center">
                <div className="mb-3 flex items-center justify-center">
                  <img
                    src="/assets/aistudio/tolk-stacked_d5d93707.svg"
                    alt="Tolk by Lunola"
                    className="tolk-logo-adaptive h-24 w-auto object-contain select-none"
                  />
                </div>
                <h2 className="font-display font-extrabold text-xl text-[#161B26] dark:text-[#F5F7FA]">
                  Pilih percakapan untuk mulai
                </h2>
                <p className="mt-1.5 text-xs text-[#5A6578] dark:text-[#94A3B8] leading-relaxed">
                  Gunakan <span className="font-mono font-bold text-[#8C0027] dark:text-[#F47296]">Ctrl + K</span> untuk mencari cepat, <span className="font-mono font-bold text-[#8C0027] dark:text-[#F47296]">Ctrl + B</span> untuk memperkecil sidebar, atau mulai panggilan WebRTC.
                </p>
              </div>
            </div>
          )}

          {/* Pane 3: Chat Info Drawer */}
          {activeChat && (
            <ChatInfoDrawer
              open={infoOpen}
              chat={activeChat}
              currentUser={currentUser}
              users={users}
              messages={messagesByChat[activeChat.id] || []}
              onlineUserIds={onlineUserIds}
              onClose={() => setInfoOpen(false)}
              onTogglePinChat={() =>
                void handleUpdateChatPreferences({ pinned: !activeChat.isPinnedByUser })
              }
              onSetMuteDuration={(mutedUntil) =>
                void handleUpdateChatPreferences({ mutedUntil })
              }
              onToggleArchiveChat={() =>
                void handleUpdateChatPreferences({ archived: !activeChat.isArchivedByUser })
              }
              onToggleMarkUnread={() =>
                void handleUpdateChatPreferences({
                  markedUnread: !activeChat.markedUnreadByUser,
                })
              }
              onSetTimer={handleSetTimer}
              onStartDmWithUser={(uid) => {
                setInfoOpen(false);
                void handleCreateChat({ type: 'dm', targetUserId: uid });
              }}
              onUpdateChatDetails={async (payload) => {
                const { chat } = await api.updateChat(token, activeChat.id, payload);
                setChats((prev) =>
                  prev.map((c) => (c.id === chat.id ? { ...c, ...chat } : c))
                );
                showToast('Info grup diperbarui.');
              }}
              onToggleModerator={async (uid, makeMod) => {
                const { moderatorIds } = await api.updateGroupRole(
                  token,
                  activeChat.id,
                  uid,
                  makeMod
                );
                setChats((prev) =>
                  prev.map((c) => (c.id === activeChat.id ? { ...c, moderatorIds } : c))
                );
                showToast(makeMod ? 'Anggota dijadikan moderator.' : 'Peran moderator dicabut.');
              }}
              onLeaveChat={async () => {
                await api.leaveChat(token, activeChat.id);
                setChats((prev) => prev.filter((c) => c.id !== activeChat.id));
                setActiveChatId(null);
                setInfoOpen(false);
                setMobileShowChat(false);
                showToast('Anda keluar dari ruang percakapan.');
              }}
              onDeleteChat={async () => {
                await api.deleteChat(token, activeChat.id);
                setChats((prev) => prev.filter((c) => c.id !== activeChat.id));
                setMessagesByChat((prev) => {
                  const next = { ...prev };
                  delete next[activeChat.id];
                  return next;
                });
                setActiveChatId(null);
                setInfoOpen(false);
                setMobileShowChat(false);
                showToast('Percakapan telah dihapus.');
              }}
              onToggleBlockUser={async (uid, block) => {
                const { blockedUserIds } = await api.toggleBlockUser(token, uid, block);
                setCurrentUser((prev) => (prev ? { ...prev, blockedUserIds } : prev));
                showToast(block ? 'Pengguna diblokir.' : 'Blokir pengguna dibuka.');
              }}
              onReportTarget={(target) => setReportTarget(target)}
            />
          )}
        </main>
      </div>

      {/* Top-Right Overflow Menu List (WhatsApp-style) */}
      <HeaderOverflowMenu
        open={overflowMenuOpen}
        lang={lang}
        user={currentUser}
        onClose={() => setOverflowMenuOpen(false)}
        onOpenNewGroup={() => setCreateModalState({ open: true, mode: 'group' })}
        onOpenNewChannel={() => setCreateModalState({ open: true, mode: 'channel' })}
        onOpenStarred={() => {
          setStarredModalOpen(true);
          void loadStarredMessages();
        }}
        onOpenDevices={() => {
          setSessionsModalOpen(true);
          void loadSessions();
        }}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onOpenAdminPanel={() => setAdminPanelOpen(true)}
      />

      {/* Modals & Overlays */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onRegister={async (payload) => {
          const { token: newToken } = await api.register(payload);
          await hydrateFromToken(newToken);
          showToast('Akun Tolk by Lunola berhasil dibuat.');
        }}
        onLogin={async (payload) => {
          const { token: newToken } = await api.login(payload);
          await hydrateFromToken(newToken);
          showToast('Berhasil masuk ke akun Anda.');
        }}
      />

      <ProfileModal
        open={profileModalOpen}
        user={currentUser}
        onClose={() => setProfileModalOpen(false)}
        onUploadAvatar={(file) => handleUploadFile(file)}
        onSave={async (payload) => {
          const { user: updated } = await api.updateProfile(token, payload);
          setCurrentUser(updated);
          setUsers((prev) => ({ ...prev, [updated.id]: updated }));
          showToast('Profil & foto diperbarui.');
        }}
      />

      <CreateChatModal
        open={createModalState.open}
        initialMode={createModalState.mode}
        users={users}
        currentUserId={currentUser.id}
        contactIds={currentUser.contactIds || []}
        friendRequests={friendRequests}
        onClose={() => setCreateModalState((s) => ({ ...s, open: false }))}
        onLookupUsers={async (q) => {
          const { users: matched } = await api.lookupUsers(token, q);
          return matched;
        }}
        onSendContactRequest={async (targetUserId) => {
          const res = await api.sendContactRequest(token, { targetUserId });
          setUsers((prev) => ({ ...prev, [res.targetUser.id]: res.targetUser }));
          setFriendRequests((prev) => [res.request, ...prev.filter((r) => r.id !== res.request.id)]);
          if (res.autoAccepted) {
            setCurrentUser((prev) =>
              prev
                ? {
                    ...prev,
                    contactIds: Array.from(new Set([...(prev.contactIds || []), res.targetUser.id])),
                  }
                : prev
            );
            showToast(`${res.targetUser.displayName} ditambahkan ke kontak.`);
          } else {
            showToast(`Permintaan kontak dikirim ke ${res.targetUser.displayName}.`);
          }
        }}
        onCreateChat={handleCreateChat}
      />

      <NotificationsModal
        open={notificationsOpen}
        currentUserId={currentUser.id}
        users={users}
        friendRequests={friendRequests}
        settings={settings}
        onClose={() => setNotificationsOpen(false)}
        onRespondRequest={async (requestId, action) => {
          const res = await api.respondContactRequest(token, requestId, action);
          setFriendRequests((prev) => prev.map((r) => (r.id === requestId ? res.request : r)));
          setCurrentUser((prev) => (prev ? { ...prev, contactIds: res.contactIds } : prev));
          showToast(action === 'accept' ? 'Permintaan kontak diterima.' : 'Permintaan kontak ditolak.');
        }}
      />

      <StarredMessagesModal
        open={starredModalOpen}
        items={starredItems}
        loading={starredLoading}
        onClose={() => setStarredModalOpen(false)}
        onOpenChat={(chatId) => handleSelectChat(chatId)}
        onUnstar={(messageId) => handleToggleStarMessage(messageId, false)}
      />

      <ForwardModal
        open={forwardMsg !== null}
        message={forwardMsg}
        chats={chats}
        onClose={() => setForwardMsg(null)}
        onSelectTarget={handleForwardTarget}
      />

      <SessionsModal
        open={sessionsModalOpen}
        sessions={sessionsList}
        loading={sessionsLoading}
        onClose={() => setSessionsModalOpen(false)}
        onRefresh={() => void loadSessions()}
        onRevokeSession={async (sid) => {
          await api.revokeSession(token, sid);
          setSessionsList((prev) => prev.filter((s) => s.id !== sid));
          showToast('Sesi perangkat dicabut.');
        }}
        onLogoutCurrent={() => void handleLogout()}
      />

      <SettingsModal
        open={settingsModalOpen}
        lang={lang}
        textScale={textScale}
        highContrast={highContrast}
        notificationTone={notificationTone}
        vibrateEnabled={vibrateEnabled}
        appearance={appearance}
        darkMode={darkMode}
        user={currentUser}
        users={users}
        onClose={() => setSettingsModalOpen(false)}
        onChangeLang={setLang}
        onChangeTextScale={setTextScale}
        onToggleHighContrast={() => setHighContrast((v) => !v)}
        onChangeTone={(tone) => {
          setNotificationTone(tone);
          playNotificationSound(tone, vibrateEnabled);
        }}
        onToggleVibrate={() => setVibrateEnabled((v) => !v)}
        onChangeAppearance={handleChangeAppearance}
        onUpdatePrivacy={async (patch: Partial<UserPrivacySettings>) => {
          const { user: updated } = await api.updatePrivacy(token, patch);
          setCurrentUser(updated);
          showToast('Pengaturan privasi disimpan.');
        }}
        onUnblockUser={async (targetId) => {
          const { blockedUserIds } = await api.toggleBlockUser(token, targetId, false);
          setCurrentUser((prev) => (prev ? { ...prev, blockedUserIds } : prev));
          showToast('Pengguna tidak lagi diblokir.');
        }}
      />

      <ReportModal
        open={reportTarget !== null}
        targetLabel={reportTarget?.targetLabel || ''}
        onClose={() => setReportTarget(null)}
        onSubmit={async (category, reason) => {
          if (!reportTarget) return;
          await api.submitReport(token, {
            ...reportTarget,
            category,
            reason,
          });
          showToast('Laporan telah dikirim ke antrean moderasi.');
        }}
      />

      <CallOverlay
        session={callSession}
        peerUser={callSession ? users[callSession.peerId] || null : null}
        localStream={localStream}
        remoteStream={remoteStream}
        onAccept={() => void handleAcceptCall()}
        onReject={handleRejectCall}
        onEnd={handleEndCall}
        onSwitchCamera={() => void handleSwitchCamera()}
      />

      <CameraCaptureModal
        open={quickCameraOpen}
        mode="photo"
        onClose={() => setQuickCameraOpen(false)}
        onCapturePhoto={async (file) => {
          setQuickCameraOpen(false);
          try {
            const att = await handleUploadFile(file);
            await handleCreateStory({
              kind: 'image',
              text: '',
              bgColor: '#8C0027',
              mediaUrl: att.url,
              privacy: 'everyone',
            });
            setActiveMainTab('status');
            showToast('Foto diterbitkan ke Status 24 jam.');
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Gagal mengunggah foto kamera.');
          }
        }}
      />

      <AdminPanel
        open={adminPanelOpen}
        token={token}
        currentUser={currentUser}
        adminAuthState={adminAuthState}
        onClose={() => setAdminPanelOpen(false)}
        onUserUpdated={(updated) => {
          setCurrentUser(updated);
          setUsers((prev) => ({ ...prev, [updated.id]: updated }));
          setAdminAuthState((prev) => ({ ...prev, hasClaimedAdmin: true }));
        }}
        onSettingsUpdated={(updated) => {
          setSettings(updated);
          setMaxUploadMb(updated.maxUploadMb || 25);
        }}
        onNotify={showToast}
      />

      {/* Toast Feedback (wrapper handles horizontal centering so animation transform never shifts it) */}
      {toastRetained.renderedValue && (
        <div className="fixed inset-x-0 top-3 pt-safe z-[70] flex justify-center px-4 pointer-events-none">
          <div
            key={toastRetained.renderedValue}
            className={`${
              toastRetained.closing ? 'p5-toast-out' : 'p5-toast-impact'
            } max-w-[90vw] text-center px-4 py-2.5 rounded-2xl bg-[#161B26] dark:bg-[#8C0027] border border-white/20 text-white text-xs font-bold brutal-shadow pointer-events-auto`}
          >
            {toastRetained.renderedValue}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
