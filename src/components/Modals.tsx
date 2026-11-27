import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Ban,
  Bell,
  Camera,
  Check,
  Copy,
  Eye,
  EyeOff,
  Flag,
  Globe,
  LogOut,
  Megaphone,
  MonitorSmartphone,
  Palette,
  QrCode,
  Radio,
  RotateCcw,
  ScanLine,
  Search,
  Server,
  Shield,
  Smartphone,
  Star,
  Terminal,
  Trash2,
  UserPlus,
  Users,
  X,
  ZoomIn,
} from 'lucide-react';
import type {
  Attachment,
  BubbleAccentId,
  BubbleStyleId,
  ChatAppearancePrefs,
  ChatRoom,
  ChatType,
  ChatWallpaperId,
  DeviceSession,
  FriendRequest,
  LanguageCode,
  Message,
  ModerationReport,
  NotificationTone,
  PlatformSettings,
  PrivacyScope,
  TextScale,
  UserPrivacySettings,
  UserProfile,
} from '../types/chat';
import { formatTimeShort, isRunningInAndroidWebView, openAndroidNotificationSettings } from '../lib/androidBridge';
import { requestBrowserNotificationPermission, showBrowserNotification } from '../lib/pwa';
import { Avatar } from './Avatar';
import { useAnimatedPresence } from '../lib/useAnimatedPresence';
import { useCapsuleSwipe, useSwipeGesture } from '../lib/useSwipeGesture';
import {
  BUBBLE_ACCENT_OPTIONS,
  BUBBLE_STYLE_OPTIONS,
  DEFAULT_CHAT_APPEARANCE,
  WALLPAPER_OPTIONS,
  getBubbleClasses,
  getCustomWallpaperLayers,
  getWallpaperStyle,
} from '../lib/appearance';
import { DigitalProfileQrCard, QrCodeBox } from './QrCodeBox';
import { CameraCaptureModal } from './CameraCaptureModal';

function ModalShell({
  open,
  title,
  subtitle,
  maxWidth = 'max-w-md',
  closable = true,
  mobileBottomBar,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  closable?: boolean;
  mobileBottomBar?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { mounted, closing } = useAnimatedPresence(open, 200);
  const edgeSwipe = useSwipeGesture({
    direction: 'right',
    edgeOnlyPx: 28,
    threshold: 75,
    enabled: closable && (typeof window === 'undefined' || window.innerWidth < 768),
    onTrigger: onClose,
  });
  if (!mounted) return null;
  return (
    <div
      style={{
        height: 'var(--app-height, 100dvh)',
        top: 'var(--vv-offset-top, 0px)',
      }}
      className={`fixed inset-x-0 z-50 flex items-stretch md:items-center justify-center p-0 md:p-4 transition-[height,top] duration-240 ease-[cubic-bezier(0.22,1,0.36,1)] ${closing ? 'pointer-events-none' : ''}`}
    >
      <div
        className={`${closing ? 'p5-backdrop-out' : 'p5-backdrop-in'} hidden md:block fixed inset-0 bg-[#0F141E]/55 backdrop-blur-[2px]`}
        onClick={closable ? onClose : undefined}
      />
      <div
        className={`${
          closing ? 'p5-modal-out' : 'p5-modal-impact'
        } relative z-10 w-full h-full md:h-auto ${maxWidth} md:max-h-[88dvh]`}
      >
        <div
          {...edgeSwipe.handlers}
          style={
            edgeSwipe.offsetX > 0
              ? { transform: `translate3d(${edgeSwipe.offsetX}px, 0, 0)` }
              : undefined
          }
          className={`${
            edgeSwipe.isDragging ? '' : 'transition-transform duration-200 ease-out'
          } touch-pan-y w-full h-full flex flex-col rounded-none md:rounded-3xl bg-[#F5F7FA] md:bg-[#FFFFFF] dark:bg-[#0F141E] md:dark:bg-[#171E2C] md:border md:border-[#E6ECF2] md:dark:border-[#2A364B] brutal-shadow-lg overflow-hidden`}
        >
        <div className="pt-safe-2 md:pt-4 pb-3 px-4 md:px-5 flex items-center justify-between gap-3 bg-[#FFFFFF]/95 dark:bg-[#171E2C]/95 backdrop-blur-md shadow-[0_2px_12px_rgba(15,20,30,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.25)] shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            {closable && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Kembali"
                className="md:hidden h-10 w-10 rounded-full border border-[#E6ECF2] dark:border-[#2A364B] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F1F5F9] hover:bg-[#8C0027] hover:text-white brutal-press flex items-center justify-center shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="font-display font-extrabold text-lg md:text-xl leading-tight text-[#161B26] dark:text-[#F1F5F9] truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-0.5 text-xs text-[#5A6578] dark:text-[#94A3B8] truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {closable && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog"
              className="hidden md:flex h-9 w-9 rounded-full border border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F1F5F9] hover:bg-[#8C0027] hover:text-white brutal-press items-center justify-center shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex-1 p-4 md:p-5 pb-safe-3 overflow-y-auto thin-scrollbar">{children}</div>
        {mobileBottomBar && (
          <div className="md:hidden shrink-0 px-3 pt-2 pb-safe-2 bg-[#FFFFFF]/85 dark:bg-[#171E2C]/85 backdrop-blur-xl border-t border-[#E6ECF2] dark:border-[#2A364B]">
            {mobileBottomBar}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export function AuthModal({
  open,
  closable = true,
  defaultMode = 'register',
  onClose,
  onRegister,
  onLogin,
}: {
  open: boolean;
  closable?: boolean;
  defaultMode?: 'login' | 'register';
  onClose: () => void;
  onRegister: (payload: {
    username: string;
    displayName: string;
    email?: string;
    password: string;
    bio?: string;
  }) => Promise<void>;
  onLogin: (payload: { username: string; password: string }) => Promise<void>;
}) {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setError('');
    }
  }, [open, defaultMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') {
        await onRegister({ username, displayName, email, password, bio });
      } else {
        await onLogin({ username, password });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autentikasi gagal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      open={open}
      closable={closable}
      title={mode === 'register' ? 'Daftar Akun Tolk by Lunola' : 'Masuk ke Tolk by Lunola'}
      subtitle="Satu akun untuk semua perangkat Anda."
      onClose={onClose}
    >
      <div className="flex items-center justify-center mb-4">
        <div className="px-2 py-1 flex items-center gap-2.5">
          <img
            src="/assets/aistudio/tolk-symbol_95df402c.svg"
            alt="Tolk symbol"
            className="tolk-logo-adaptive h-8 w-8 object-contain select-none"
          />
          <img
            src="/assets/aistudio/tolk-wordmark_36d1b947.svg"
            alt="Tolk by Lunola"
            className="tolk-logo-adaptive h-7 w-auto object-contain select-none"
          />
        </div>
      </div>

      <div className="flex rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] p-1 mb-4 gap-1">
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setError('');
          }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            mode === 'register'
              ? 'bg-[#8C0027] text-white'
              : 'text-[#5A6578] dark:text-[#94A3B8] hover:text-[#161B26] dark:hover:text-[#F5F7FA]'
          }`}
        >
          Daftar Baru
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError('');
          }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            mode === 'login'
              ? 'bg-[#8C0027] text-white'
              : 'text-[#5A6578] dark:text-[#94A3B8] hover:text-[#161B26] dark:hover:text-[#F5F7FA]'
          }`}
        >
          Masuk Akun
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'register' && (
          <>
            <div>
              <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
                Nama Tampilan
              </label>
              <input
                type="text"
                required
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Masukkan nama tampilan"
                className="w-full h-10 px-4 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
                Email (opsional)
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Masukkan alamat email"
                className="w-full h-10 px-4 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
            {mode === 'login' ? 'Username atau Email' : 'Username'}
          </label>
          <input
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={mode === 'login' ? 'Masukkan username atau email' : 'Masukkan username'}
            className="w-full h-10 px-4 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm font-mono text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
            Kata Sandi
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full h-10 pl-4 pr-10 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#5A6578] dark:text-[#94A3B8] hover:text-[#8C0027] dark:hover:text-[#F47296]"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mode === 'register' && (
          <div>
            <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
              Bio Singkat (opsional)
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tulis bio singkat"
              className="w-full h-10 px-4 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
            />
          </div>
        )}

        {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full h-10 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm brutal-press text-white text-sm font-bold transition-colors disabled:opacity-50"
        >
          {busy ? 'Memproses...' : mode === 'register' ? 'Buat Akun' : 'Masuk'}
        </button>
      </form>
    </ModalShell>
  );
}

const AVATAR_COLOR_SWATCHES = [
  '#8C0027',
  '#B54B4B',
  '#111111',
  '#9A3412',
  '#0F766E',
  '#3730A3',
  '#6B21A8',
  '#334155',
];

async function renderCroppedAvatarFile(
  imageSrc: string,
  zoom: number,
  offsetX: number,
  offsetY: number
): Promise<File> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Gagal memproses gambar.'));
    el.src = imageSrc;
  });

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia di browser.');

  const baseScale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
  const scale = baseScale * zoom;
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  // offsetX/offsetY are in preview coordinates (-100..100), map proportionally
  const dx = (size - drawW) / 2 + (offsetX / 100) * (size * 0.45);
  const dy = (size - drawH) / 2 + (offsetY / 100) * (size * 0.45);

  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, dx, dy, drawW, drawH);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Gagal menghasilkan gambar avatar.'))),
      'image/jpeg',
      0.9
    );
  });

  return new File([blob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

export function ProfileModal({
  open,
  user,
  onClose,
  onUploadAvatar,
  onSave,
}: {
  open: boolean;
  user: UserProfile;
  onClose: () => void;
  onUploadAvatar: (file: File) => Promise<Attachment>;
  onSave: (payload: {
    displayName: string;
    username: string;
    bio: string;
    statusText?: string;
    email?: string;
    avatarUrl?: string | null;
    avatarColor?: string;
  }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [statusText, setStatusText] = useState(user.statusText || '');
  const [email, setEmail] = useState(user.email || '');
  const [bio, setBio] = useState(user.bio);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
  const [avatarColor, setAvatarColor] = useState<string>(user.avatarColor || '#8C0027');
  const [showQr, setShowQr] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Interactive cropper state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1.1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDisplayName(user.displayName);
    setUsername(user.username);
    setStatusText(user.statusText || '');
    setEmail(user.email || '');
    setBio(user.bio);
    setAvatarUrl(user.avatarUrl);
    setAvatarColor(user.avatarColor || '#8C0027');
    setError('');
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [user, open]);

  const profileShareUrl = `${window.location.origin}/?u=${encodeURIComponent(user.username)}`;

  const handleSelectPhoto = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Pilih file gambar (JPG, PNG, WebP, atau GIF).');
      return;
    }
    setError('');
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
    setCropZoom(1.1);
    setCropOffsetX(0);
    setCropOffsetY(0);
  };

  const handleApplyCrop = async () => {
    if (!cropSrc) return;
    setUploadingPhoto(true);
    setError('');
    try {
      const croppedFile = await renderCroppedAvatarFile(
        cropSrc,
        cropZoom,
        cropOffsetX,
        cropOffsetY
      );
      const uploaded = await onUploadAvatar(croppedFile);
      setAvatarUrl(uploaded.url);
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah foto profil.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSave({
        displayName,
        username,
        bio,
        statusText,
        email,
        avatarUrl,
        avatarColor,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan profil.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      open={open}
      title="Profil & Kustomisasi Foto"
      subtitle="Unggah & potong foto profil, pilih warna avatar, atau bagikan QR Code profil Anda."
      onClose={onClose}
    >
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) handleSelectPhoto(f);
        }}
        className="hidden"
      />

      {/* Interactive Circular Photo Cropper */}
      {cropSrc ? (
        <div className="mb-4 p-4 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-display font-extrabold text-[#161B26] dark:text-[#F5F7FA]">
              Sesuaikan Posisi & Zoom Foto
            </span>
            <button
              type="button"
              onClick={() => {
                setCropZoom(1.1);
                setCropOffsetX(0);
                setCropOffsetY(0);
              }}
              className="text-[11px] font-bold text-[#8C0027] dark:text-[#F47296] hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <div className="flex justify-center">
            <div
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                dragStartRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  ox: cropOffsetX,
                  oy: cropOffsetY,
                };
              }}
              onPointerMove={(e) => {
                if (!dragStartRef.current) return;
                const dx = e.clientX - dragStartRef.current.x;
                const dy = e.clientY - dragStartRef.current.y;
                setCropOffsetX(Math.max(-100, Math.min(100, dragStartRef.current.ox + dx * 0.9)));
                setCropOffsetY(Math.max(-100, Math.min(100, dragStartRef.current.oy + dy * 0.9)));
              }}
              onPointerUp={() => {
                dragStartRef.current = null;
              }}
              className="relative w-44 h-44 rounded-3xl overflow-hidden bg-[#161B26] border border-[#8C0027] brutal-shadow-sm cursor-grab active:cursor-grabbing touch-none select-none"
            >
              <img
                src={cropSrc}
                alt="Pratinjau foto profil"
                draggable={false}
                style={{
                  transform: `translate(${cropOffsetX * 0.75}px, ${cropOffsetY * 0.75}px) scale(${cropZoom})`,
                }}
                className="w-full h-full object-cover pointer-events-none select-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <ZoomIn className="w-4 h-4 text-[#5A6578] dark:text-[#94A3B8] shrink-0" />
            <input
              type="range"
              min={1}
              max={2.5}
              step={0.05}
              value={cropZoom}
              onChange={(e) => setCropZoom(Number(e.target.value))}
              className="flex-1 accent-[#8C0027]"
            />
            <span className="font-mono text-[11px] font-bold text-[#5A6578] dark:text-[#94A3B8] tabular-nums w-9 text-right">
              {cropZoom.toFixed(1)}x
            </span>
          </div>

          <p className="text-[11px] text-[#5A6578] dark:text-[#94A3B8] text-center">
            Geser gambar di dalam bingkai untuk mengatur posisi wajah.
          </p>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={uploadingPhoto}
              onClick={() => {
                URL.revokeObjectURL(cropSrc);
                setCropSrc(null);
              }}
              className="px-3 py-1.5 rounded-xl border border-[#E6ECF2] dark:border-[#324058] text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#FFFFFF] dark:hover:bg-[#171E2C]"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={uploadingPhoto}
              onClick={() => void handleApplyCrop()}
              className="px-3.5 py-1.5 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm brutal-press text-white text-xs font-bold disabled:opacity-50"
            >
              {uploadingPhoto ? 'Mengunggah...' : 'Terapkan Foto'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-5 rounded-3xl bg-[#FFFFFF] dark:bg-[#1E2738] shadow-[0_4px_20px_rgba(15,20,30,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.28)] overflow-hidden">
          <div className="p-5 p5-maroon-banner text-white flex flex-col items-center text-center">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="relative group rounded-3xl focus:outline-none focus:ring-2 focus:ring-white/80"
              title="Ganti foto profil"
            >
              <Avatar
                name={displayName || user.displayName}
                imageUrl={avatarUrl}
                color={avatarColor}
                size="lg"
              />
              <span className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-[#FFFFFF] text-[#8C0027] shadow-md flex items-center justify-center group-hover:scale-105 transition-transform">
                <Camera className="w-4 h-4" />
              </span>
            </button>
            <div className="mt-3 font-display font-extrabold text-lg leading-tight truncate max-w-full">
              {displayName || user.displayName}
            </div>
            <div className="text-xs font-mono text-[#FFF2A7]">
              @{username || user.username}
            </div>

            <div className="mt-3.5 flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{avatarUrl ? 'Ganti Foto' : 'Unggah Foto'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQr((v) => !v)}
                className="px-3.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{showQr ? 'Tutup QR' : 'Kartu QR'}</span>
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="px-3 py-1.5 rounded-full bg-rose-500/30 hover:bg-rose-500/50 text-white text-xs font-bold transition-colors"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>

          {/* Avatar Color Swatches */}
          <div className="px-4 py-3 flex items-center justify-between gap-2 bg-[#F5F7FA] dark:bg-[#171E2C]">
            <span className="text-[11px] font-semibold text-[#5A6578] dark:text-[#94A3B8]">
              Warna inisial
            </span>
            <div className="flex items-center gap-2">
              {AVATAR_COLOR_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => {
                    setAvatarColor(hex);
                    if (avatarUrl) setAvatarUrl(null);
                  }}
                  aria-label={`Pilih warna ${hex}`}
                  style={{ backgroundColor: hex }}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    avatarColor === hex && !avatarUrl
                      ? 'ring-2 ring-offset-2 ring-[#8C0027] dark:ring-offset-[#171E2C] scale-110'
                      : 'hover:scale-110'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {showQr && (
        <div className="mb-4 flex justify-center">
          <QrCodeBox value={profileShareUrl} label={`@${user.username}`} size={168} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
            Nama Tampilan
          </label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full h-10 px-4 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
            Username Unik
          </label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full h-10 px-4 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm font-mono text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
            Status Singkat
          </label>
          <input
            type="text"
            value={statusText}
            onChange={(e) => setStatusText(e.target.value)}
            placeholder="Masukkan status singkat"
            className="w-full h-10 px-4 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Masukkan alamat email (opsional)"
            className="w-full h-10 px-4 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
            Bio
          </label>
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full p-3 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] resize-none focus:outline-none focus:border-[#8C0027]"
          />
        </div>
        {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full h-10 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm brutal-press text-white text-sm font-bold transition-colors disabled:opacity-50"
        >
          {busy ? 'Menyimpan...' : 'Simpan Profil'}
        </button>
      </form>
    </ModalShell>
  );
}

export function CreateChatModal({
  open,
  initialMode,
  users,
  currentUserId,
  contactIds,
  friendRequests,
  onClose,
  onLookupUsers,
  onSendContactRequest,
  onCreateChat,
}: {
  open: boolean;
  initialMode: 'dm' | 'group' | 'channel' | 'qr';
  users: Record<string, UserProfile>;
  currentUserId: string;
  contactIds: string[];
  friendRequests: FriendRequest[];
  onClose: () => void;
  onLookupUsers: (query: string) => Promise<UserProfile[]>;
  onSendContactRequest: (targetUserId: string) => Promise<void>;
  onCreateChat: (payload: {
    type: ChatType;
    targetUserId?: string;
    title?: string;
    description?: string;
    handle?: string;
    memberIds?: string[];
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<'dm' | 'group' | 'channel'>(
    initialMode === 'qr' ? 'dm' : initialMode
  );
  const [showMyQr, setShowMyQr] = useState(initialMode === 'qr');
  const [scanQrOpen, setScanQrOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [lookupResults, setLookupResults] = useState<UserProfile[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [title, setTitle] = useState('');
  const [handle, setHandle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(initialMode === 'qr' ? 'dm' : initialMode);
    if (open) {
      setShowMyQr(initialMode === 'qr');
      setQuery('');
      setLookupResults([]);
      setError('');
    }
  }, [initialMode, open]);

  useEffect(() => {
    const q = query.trim();
    if (!open || mode !== 'dm' || q.length < 2) {
      setLookupResults([]);
      return;
    }
    let cancelled = false;
    setLookingUp(true);
    const timer = window.setTimeout(() => {
      void onLookupUsers(q)
        .then((res) => {
          if (!cancelled) setLookupResults(res);
        })
        .catch(() => {
          if (!cancelled) setLookupResults([]);
        })
        .finally(() => {
          if (!cancelled) setLookingUp(false);
        });
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open, mode, onLookupUsers]);

  const contactSet = new Set(contactIds);
  const otherUsers = Object.values(users).filter(
    (u) => u.id !== currentUserId && contactSet.has(u.id)
  );
  const filteredUsers = otherUsers.filter(
    (u) =>
      u.displayName.toLowerCase().includes(query.toLowerCase()) ||
      u.username.toLowerCase().includes(query.toLowerCase())
  );
  const nonContactMatches = lookupResults.filter(
    (u) => u.id !== currentUserId && !contactSet.has(u.id)
  );

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmitGroupOrChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onCreateChat({
        type: mode,
        title,
        description,
        handle,
        memberIds: selectedMembers,
      });
      setTitle('');
      setHandle('');
      setDescription('');
      setSelectedMembers([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat ruang chat.');
    } finally {
      setBusy(false);
    }
  };

  const modeIndex = mode === 'dm' ? 0 : mode === 'group' ? 1 : 2;
  const modeOrder = ['dm', 'group', 'channel'] as const;
  const createSwipe = useCapsuleSwipe(3, modeIndex, (idx) => setMode(modeOrder[idx]));

  const renderModeSwitcher = () => (
    <div className="relative grid grid-cols-3 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] p-1">
      <span
        aria-hidden="true"
        style={{
          width: 'calc((100% - 8px) / 3)',
          transform: `translate3d(${createSwipe.visualIndex * 100}%, 0, 0)`,
        }}
        className={`pointer-events-none absolute top-1 bottom-1 left-1 rounded-full bg-[#8C0027] will-change-transform ${
          createSwipe.isDragging ? '' : 'transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]'
        }`}
      />
      {(
        [
          { key: 'dm', label: 'Pribadi', icon: <UserPlus className="w-3.5 h-3.5" /> },
          { key: 'group', label: 'Grup', icon: <Users className="w-3.5 h-3.5" /> },
          { key: 'channel', label: 'Channel', icon: <Radio className="w-3.5 h-3.5" /> },
        ] as const
      ).map((tab) => {
        const active = mode === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => setMode(tab.key)}
            className={`relative min-h-[40px] py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-colors duration-200 z-10 touch-manipulation ${
              active
                ? 'text-white'
                : 'text-[#5A6578] dark:text-[#94A3B8] hover:text-[#161B26] dark:hover:text-[#F5F7FA]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <ModalShell
      open={open}
      title="Mulai Percakapan"
      subtitle="Chat pribadi via @username, buat grup komunitas, atau buka channel publik."
      mobileBottomBar={renderModeSwitcher()}
      onClose={onClose}
    >
      <div className="hidden md:block mb-4">{renderModeSwitcher()}</div>

      <div
        {...createSwipe.handlers}
        style={
          createSwipe.dragOffsetPx !== 0
            ? { transform: `translate3d(${createSwipe.dragOffsetPx}px, 0, 0)` }
            : undefined
        }
        className={`min-h-[60dvh] ${createSwipe.isDragging ? 'touch-pan-y' : 'touch-pan-y transition-transform duration-200 ease-out'}`}
      >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          initial={{ opacity: 0, x: 36 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -36 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
      {mode === 'dm' ? (
        <div className="space-y-3.5">
          {/* 2 Bento Action Boxes: Kartu QR Saya & Scan QR */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setShowMyQr((v) => !v)}
              className={`p-3 rounded-2xl border text-left transition-all brutal-press flex items-center gap-2.5 ${
                showMyQr
                  ? 'bg-[#8C0027] border-[#8C0027] text-white brutal-shadow-sm'
                  : 'bg-[#EAF4FF] dark:bg-[#1E2738] border-[#BEDEFF] dark:border-[#324058] text-[#161B26] dark:text-[#F5F7FA]'
              }`}
            >
              <span
                className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                  showMyQr ? 'bg-white/20 text-white' : 'bg-[#BEDEFF] text-[#161B26]'
                }`}
              >
                <QrCode className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-extrabold leading-tight truncate">Kartu QR Saya</div>
                <div className={`text-[10px] truncate ${showMyQr ? 'text-white/80' : 'text-[#5A6578] dark:text-[#94A3B8]'}`}>
                  Bagikan ID profil
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setScanQrOpen(true)}
              className="p-3 rounded-2xl border border-[#FFF2A7] dark:border-[#324058] bg-[#FFF9D6] dark:bg-[#1E2738] text-[#161B26] dark:text-[#F5F7FA] text-left brutal-press flex items-center gap-2.5"
            >
              <span className="h-9 w-9 rounded-xl bg-[#F59B00] text-white flex items-center justify-center shrink-0">
                <ScanLine className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-extrabold leading-tight truncate">Scan QR</div>
                <div className="text-[10px] text-[#5A6578] dark:text-[#94A3B8] truncate">
                  Tambah teman cepat
                </div>
              </div>
            </button>
          </div>

          {showMyQr && users[currentUserId] && (
            <div className="p5-panel-reveal py-1">
              <DigitalProfileQrCard user={users[currentUserId]} />
            </div>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-[#5A6578] dark:text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus={!showMyQr}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau @username..."
              className="w-full h-10 pl-9 pr-4 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
            />
          </div>
          <div className="max-h-64 overflow-y-auto thin-scrollbar space-y-2">
            {filteredUsers.length > 0 && (
              <div className="space-y-1">
                <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#5A6578] dark:text-[#94A3B8]">
                  Kontak Anda ({filteredUsers.length})
                </div>
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await onCreateChat({ type: 'dm', targetUserId: u.id });
                        onClose();
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="w-full p-2.5 rounded-xl border border-transparent hover:border-[#E6ECF2] dark:hover:border-[#324058] flex items-center gap-3 hover:bg-[#F5F7FA] dark:hover:bg-[#232D40] text-left"
                  >
                    <Avatar name={u.displayName} imageUrl={u.avatarUrl} color={u.avatarColor} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[#161B26] dark:text-[#F5F7FA] truncate">
                        {u.displayName}
                      </div>
                      <div className="text-xs font-mono text-[#8C0027] dark:text-[#F47296] truncate">
                        @{u.username}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {query.trim().length >= 2 && (
              <div className="space-y-1 pt-1">
                <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#5A6578] dark:text-[#94A3B8]">
                  {lookingUp ? 'Mencari pengguna...' : 'Tambah Kontak Baru'}
                </div>
                {!lookingUp && nonContactMatches.length === 0 && filteredUsers.length === 0 && (
                  <p className="px-2 py-2 text-xs text-[#6B768A] dark:text-[#94A3B8]">
                    Pengguna tidak ditemukan.
                  </p>
                )}
                {nonContactMatches.map((u) => {
                  const outgoingPending = friendRequests.some(
                    (r) => r.fromUserId === currentUserId && r.toUserId === u.id && r.status === 'pending'
                  );
                  const incomingPending = friendRequests.some(
                    (r) => r.fromUserId === u.id && r.toUserId === currentUserId && r.status === 'pending'
                  );
                  return (
                    <div
                      key={u.id}
                      className="w-full p-2.5 rounded-xl border border-[#E6ECF2] dark:border-[#2A364B] bg-[#F5F7FA]/70 dark:bg-[#1E2738] flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={u.displayName} imageUrl={u.avatarUrl} color={u.avatarColor} size="sm" />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[#161B26] dark:text-[#F5F7FA] truncate">
                            {u.displayName}
                          </div>
                          <div className="text-xs font-mono text-[#8C0027] dark:text-[#F47296] truncate">
                            @{u.username}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busy || outgoingPending}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await onSendContactRequest(u.id);
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 brutal-press ${
                          outgoingPending
                            ? 'bg-[#E6ECF2] dark:bg-[#2A364B] text-[#5A6578] dark:text-[#94A3B8] cursor-default'
                            : 'bg-[#F59B00] hover:bg-[#D98800] text-white brutal-shadow-sm'
                        }`}
                      >
                        {outgoingPending ? 'Menunggu' : incomingPending ? 'Terima' : '+ Tambah'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredUsers.length === 0 && query.trim().length < 2 && (
              <div className="px-3 py-6 text-center rounded-2xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B]">
                <p className="text-xs font-bold text-[#161B26] dark:text-[#F5F7FA]">
                  Belum ada kontak
                </p>
                <p className="mt-1 text-[11px] text-[#5A6578] dark:text-[#94A3B8]">
                  Ketik minimal 2 huruf @username atau nama di atas untuk mencari dan menambahkan kontak.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmitGroupOrChannel} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
              {mode === 'group' ? 'Nama Grup' : 'Nama Channel Publik'}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === 'group' ? 'Masukkan nama grup' : 'Masukkan nama channel'}
              className="w-full h-10 px-4 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
              Tautan Undangan (@handle)
            </label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="Masukkan username handle"
              className="w-full h-10 px-4 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm font-mono text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
              Deskripsi
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tujuan grup atau channel ini..."
              className="w-full p-3 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] resize-none focus:outline-none focus:border-[#8C0027]"
            />
          </div>

          {mode === 'group' && (
            <div>
              <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1.5">
                Pilih Anggota ({selectedMembers.length})
              </label>
              <div className="max-h-36 overflow-y-auto thin-scrollbar space-y-1">
                {otherUsers.map((u) => {
                  const checked = selectedMembers.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleMember(u.id)}
                      className={`w-full p-2 rounded-xl border flex items-center justify-between text-left ${
                        checked
                          ? 'bg-[#EAF4FF] dark:bg-[#1B2436] border-[#8C0027] text-[#8C0027] dark:text-[#F47296]'
                          : 'border-transparent hover:bg-[#F5F7FA] dark:hover:bg-[#232D40]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          name={u.displayName}
                          imageUrl={u.avatarUrl}
                          color={u.avatarColor}
                          size="xs"
                        />
                        <span className="text-xs font-bold truncate">{u.displayName}</span>
                      </div>
                      <span
                        className={`h-4 w-4 rounded-lg border flex items-center justify-center ${
                          checked
                            ? 'bg-[#8C0027] border-[#E6ECF2] dark:border-[#F5F7FA] text-white'
                            : 'border-[#161B26]/40 dark:border-[#324058]'
                        }`}
                      >
                        {checked && <Check className="w-3 h-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full h-10 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm brutal-press text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {busy ? 'Membuat...' : mode === 'group' ? 'Buat Grup' : 'Buat Channel'}
          </button>
        </form>
      )}
        </motion.div>
      </AnimatePresence>
      </div>

      <CameraCaptureModal
        open={scanQrOpen}
        mode="qr"
        onClose={() => setScanQrOpen(false)}
        onScanQr={(raw) => {
          let extracted = raw.trim();
          try {
            const url = new URL(extracted);
            const addParam = url.searchParams.get('add');
            if (addParam) extracted = addParam;
          } catch {
            // Raw username / text
          }
          setMode('dm');
          setShowMyQr(false);
          setQuery(extracted.replace(/^@/, ''));
        }}
      />
    </ModalShell>
  );
}

export function ForwardModal({
  open,
  message,
  chats,
  onClose,
  onSelectTarget,
}: {
  open: boolean;
  message: Message | null;
  chats: ChatRoom[];
  onClose: () => void;
  onSelectTarget: (targetChatId: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  if (!message) return null;

  return (
    <ModalShell
      open={open}
      title="Teruskan Pesan"
      subtitle="Pilih percakapan tujuan untuk meneruskan pesan ini."
      onClose={onClose}
    >
      <div className="mb-3 p-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-xs text-[#161B26] dark:text-[#F5F7FA] line-clamp-2">
        {message.text || message.attachment?.name || 'Lampiran media'}
      </div>
      <div className="max-h-72 overflow-y-auto thin-scrollbar space-y-1">
        {chats.map((chat) => (
          <button
            key={chat.id}
            type="button"
            disabled={busyId !== null}
            onClick={async () => {
              setBusyId(chat.id);
              try {
                await onSelectTarget(chat.id);
                onClose();
              } finally {
                setBusyId(null);
              }
            }}
            className="w-full p-2.5 rounded-xl border border-transparent hover:border-[#E6ECF2] dark:hover:border-[#324058] flex items-center gap-3 hover:bg-[#F5F7FA] dark:hover:bg-[#232D40] text-left"
          >
            <Avatar
              name={chat.title}
              imageUrl={chat.avatarUrl}
              color={chat.avatarColor}
              chatType={chat.type}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-[#161B26] dark:text-[#F5F7FA] truncate">
                {chat.title}
              </div>
              <div className="text-[11px] text-[#5A6578] dark:text-[#94A3B8] capitalize">
                {chat.type}
              </div>
            </div>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

export function SessionsModal({
  open,
  sessions,
  loading,
  onClose,
  onRefresh,
  onRevokeSession,
  onApproveQrLogin,
  onLogoutCurrent,
}: {
  open: boolean;
  sessions: DeviceSession[];
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onRevokeSession: (sid: string) => Promise<void>;
  onApproveQrLogin?: (challengeId: string, secret: string) => Promise<void>;
  onLogoutCurrent: () => void;
}) {
  const [qrScanOpen, setQrScanOpen] = useState(false);
  const [qrScanError, setQrScanError] = useState('');

  return (
    <ModalShell
      open={open}
      title="Perangkat Aktif & Sesi Login"
      subtitle="Kelola perangkat web, PWA, atau Android WebView yang tersambung ke akun Anda."
      onClose={onClose}
    >
      <div className="space-y-3">
        {onApproveQrLogin && (
          <div className="p-3 rounded-2xl bg-[#FFF9D6] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] space-y-2">
            <button
              type="button"
              onClick={() => {
                setQrScanError('');
                setQrScanOpen(true);
              }}
              className="w-full h-10 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] text-white text-xs font-bold flex items-center justify-center gap-2 brutal-shadow-sm brutal-press"
            >
              <ScanLine className="w-4 h-4" />
              <span>Tautkan Perangkat (Scan QR Desktop)</span>
            </button>
            {qrScanError && (
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 text-center">
                {qrScanError}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#5A6578] dark:text-[#94A3B8]">
            Total sesi aktif: <strong className="font-mono text-[#161B26] dark:text-[#F5F7FA]">{sessions.length}</strong>
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs font-bold text-[#8C0027] dark:text-[#F47296] hover:underline"
          >
            Muat ulang
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-[#5A6578] dark:text-[#94A3B8] text-center py-6">Memuat daftar perangkat...</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto thin-scrollbar">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MonitorSmartphone className="w-5 h-5 text-[#8C0027] dark:text-[#F47296] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] truncate">
                      {s.deviceName} {s.current ? '(Perangkat ini)' : ''}
                    </div>
                    <div className="font-mono text-[10px] text-[#5A6578] dark:text-[#94A3B8] truncate">
                      {s.platform} · IP {s.ip} · Aktif {formatTimeShort(s.lastActiveAt)}
                    </div>
                  </div>
                </div>
                {!s.current && (
                  <button
                    type="button"
                    onClick={() => void onRevokeSession(s.id)}
                    className="p-1.5 rounded-xl border border-rose-600/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white"
                    title="Cabut sesi ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            onClose();
            onLogoutCurrent();
          }}
          className="w-full h-10 rounded-xl border border-[#8C0027] text-[#8C0027] dark:text-[#F47296] hover:bg-[#8C0027] hover:text-white text-xs font-bold flex items-center justify-center gap-2 brutal-press transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar dari Perangkat Ini</span>
        </button>
      </div>

      {onApproveQrLogin && (
        <CameraCaptureModal
          open={qrScanOpen}
          mode="qr"
          onClose={() => setQrScanOpen(false)}
          onScanQr={async (rawValue) => {
            setQrScanOpen(false);
            const match = rawValue.trim().match(/^tolk-qr-login:([^:]+):([^:\s]+)$/);
            if (!match) {
              setQrScanError('Kode QR bukan QR login desktop Tolk by Lunola.');
              return;
            }
            try {
              await onApproveQrLogin(match[1], match[2]);
              onRefresh();
            } catch (err) {
              setQrScanError(err instanceof Error ? err.message : 'Gagal menautkan perangkat.');
            }
          }}
        />
      )}
    </ModalShell>
  );
}

export function SettingsModal({
  open,
  initialTab = 'appearance',
  lang,
  textScale,
  highContrast,
  notificationTone,
  vibrateEnabled,
  dndEnabled,
  notifPreview,
  notifGroups,
  readReceiptsEnabled,
  typingIndicatorEnabled,
  appearance,
  darkMode,
  user,
  users,
  onClose,
  onChangeLang,
  onChangeTextScale,
  onToggleHighContrast,
  onChangeTone,
  onToggleVibrate,
  onToggleDnd,
  onToggleNotifPreview,
  onToggleNotifGroups,
  onToggleReadReceipts,
  onToggleTypingIndicator,
  onChangeAppearance,
  onUpdatePrivacy,
  onUnblockUser,
}: {
  open: boolean;
  initialTab?: 'appearance' | 'notifications' | 'privacy';
  lang: LanguageCode;
  textScale: TextScale;
  highContrast: boolean;
  notificationTone: NotificationTone;
  vibrateEnabled: boolean;
  dndEnabled: boolean;
  notifPreview: boolean;
  notifGroups: boolean;
  readReceiptsEnabled: boolean;
  typingIndicatorEnabled: boolean;
  appearance: ChatAppearancePrefs;
  darkMode: boolean;
  user: UserProfile;
  users: Record<string, UserProfile>;
  onClose: () => void;
  onChangeLang: (lang: LanguageCode) => void;
  onChangeTextScale: (scale: TextScale) => void;
  onToggleHighContrast: () => void;
  onChangeTone: (tone: NotificationTone) => void;
  onToggleVibrate: () => void;
  onToggleDnd: () => void;
  onToggleNotifPreview: () => void;
  onToggleNotifGroups: () => void;
  onToggleReadReceipts: () => void;
  onToggleTypingIndicator: () => void;
  onChangeAppearance: (next: ChatAppearancePrefs) => void;
  onUpdatePrivacy: (patch: Partial<UserPrivacySettings>) => Promise<void>;
  onUnblockUser: (targetId: string) => Promise<void>;
}) {
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<'appearance' | 'notifications' | 'privacy'>(initialTab);
  useEffect(() => {
    if (open) setActiveTab(initialTab);
  }, [open, initialTab]);

  const [notifPermission, setNotifPermission] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  const privacy: UserPrivacySettings = user.privacy || {
    lastSeenVisibility: 'everyone',
    whoCanMessage: 'everyone',
    storyVisibility: 'everyone',
  };

  const blockedIds = user.blockedUserIds || [];

  const handleEnableBrowserNotif = async () => {
    const result = await requestBrowserNotificationPermission();
    setNotifPermission(result);
  };

  const tabMeta = {
    appearance: {
      title: 'Tampilan & Wallpaper',
      subtitle: 'Tema, wallpaper foto kustom, gaya bubble, dan aksesibilitas.',
    },
    notifications: {
      title: 'Notifikasi & Nada',
      subtitle: 'Izin HP, mode jangan ganggu, pratinjau pesan, dan nada dering.',
    },
    privacy: {
      title: 'Privasi & Keamanan',
      subtitle: 'Kontrol visibilitas profil, tanda baca, dan daftar blokir.',
    },
  }[activeTab];

  const settingsTabOrder = ['appearance', 'notifications', 'privacy'] as const;
  const settingsTabIndex = settingsTabOrder.indexOf(activeTab);
  const settingsSwipe = useCapsuleSwipe(3, settingsTabIndex, (idx) =>
    setActiveTab(settingsTabOrder[idx])
  );

  return (
    <ModalShell
      open={open}
      title={tabMeta.title}
      subtitle={tabMeta.subtitle}
      maxWidth="max-w-lg"
      onClose={onClose}
    >
      <div className="space-y-5 text-xs">
        {/* 3-Capsule Segmented Switcher with Sliding Pill */}
        <div className="relative grid grid-cols-3 p-1 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058]">
          <span
            aria-hidden="true"
            style={{
              width: 'calc((100% - 8px) / 3)',
              transform: `translate3d(${settingsSwipe.visualIndex * 100}%, 0, 0)`,
            }}
            className={`pointer-events-none absolute top-1 bottom-1 left-1 rounded-full bg-[#8C0027] will-change-transform ${
              settingsSwipe.isDragging
                ? ''
                : 'transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]'
            }`}
          />
          {(
            [
              { key: 'appearance', label: 'Tampilan' },
              { key: 'notifications', label: 'Notifikasi' },
              { key: 'privacy', label: 'Privasi' },
            ] as const
          ).map((tItem) => (
            <button
              key={tItem.key}
              type="button"
              onClick={() => setActiveTab(tItem.key)}
              className={`relative z-10 h-9 rounded-full text-xs font-bold transition-colors ${
                activeTab === tItem.key
                  ? 'text-white'
                  : 'text-[#5A6578] dark:text-[#CBD5E1] hover:text-[#161B26] dark:hover:text-white'
              }`}
            >
              {tItem.label}
            </button>
          ))}
        </div>

        <div
          {...settingsSwipe.handlers}
          style={
            settingsSwipe.dragOffsetPx !== 0
              ? { transform: `translate3d(${settingsSwipe.dragOffsetPx}px, 0, 0)` }
              : undefined
          }
          className={`min-h-[60dvh] ${
            settingsSwipe.isDragging
              ? 'touch-pan-y space-y-5'
              : 'touch-pan-y space-y-5 transition-transform duration-200 ease-out'
          }`}
        >
        <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 36 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -36 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >

        {activeTab === 'appearance' && (
          <>
        {/* Chat Personalization (Wallpaper & Bubble Style) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA] flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-[#8C0027] dark:text-[#F47296]" />
              <span>Personalisasi Chat</span>
            </h3>
            <button
              type="button"
              onClick={() => onChangeAppearance(DEFAULT_CHAT_APPEARANCE)}
              className="text-[11px] font-bold text-[#5A6578] dark:text-[#94A3B8] hover:text-[#8C0027]"
            >
              Reset Default
            </button>
          </div>

          {/* Live Mini Chat Preview */}
          <div
            style={getWallpaperStyle(appearance, darkMode)}
            className={`relative p-3.5 rounded-2xl border border-[#E6ECF2] dark:border-[#2A364B] bg-[#F5F7FA] dark:bg-[#0F141E] overflow-hidden flex flex-col gap-2 ${
              appearance.wallpaper === 'doodle-animated' ? 'doodle-wallpaper-bg' : ''
            }`}
          >
            {(() => {
              const customLayers = getCustomWallpaperLayers(appearance, darkMode);
              if (!customLayers) return null;
              return (
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="absolute inset-0" style={customLayers.imageStyle} />
                  <div className="absolute inset-0" style={customLayers.overlayStyle} />
                </div>
              );
            })()}
            <div className={`relative z-10 self-start max-w-[78%] px-3 py-2 text-xs ${getBubbleClasses(appearance, false)}`}>
              Wih, tampilan chatnya kece banget!
            </div>
            <div className={`relative z-10 self-end max-w-[78%] px-3 py-2 text-xs ${getBubbleClasses(appearance, true)}`}>
              Bisa ganti wallpaper &amp; style bubble sesuka hati.
            </div>
          </div>

          {/* Bubble Style */}
          <div>
            <div className="text-[#5A6578] dark:text-[#CBD5E1] font-semibold mb-1.5">Gaya Bubble</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {BUBBLE_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    onChangeAppearance({ ...appearance, bubbleStyle: opt.id as BubbleStyleId })
                  }
                  className={`py-2 px-2.5 rounded-xl border font-bold text-center transition-colors ${
                    appearance.bubbleStyle === opt.id
                      ? 'bg-[#8C0027] border-[#8C0027] text-white brutal-shadow-sm'
                      : 'bg-[#F5F7FA] dark:bg-[#232D40] border-[#E6ECF2] dark:border-[#324058] text-[#161B26] dark:text-[#F5F7FA]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bubble Color */}
          <div>
            <div className="text-[#5A6578] dark:text-[#CBD5E1] font-semibold mb-1.5">Warna Bubble Kamu</div>
            <div className="flex flex-wrap gap-2">
              {BUBBLE_ACCENT_OPTIONS.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() =>
                    onChangeAppearance({ ...appearance, bubbleAccent: acc.id as BubbleAccentId })
                  }
                  aria-label={acc.label}
                  title={acc.label}
                  className={`h-8 px-2.5 rounded-full border flex items-center gap-1.5 font-bold ${
                    appearance.bubbleAccent === acc.id
                      ? 'border-[#161B26] dark:border-white bg-[#FFFFFF] dark:bg-[#232D40] brutal-shadow-sm'
                      : 'border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#1E2738]'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: acc.hex }}
                  />
                  <span className="text-[11px]">{acc.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Wallpaper Presets + Custom Upload */}
          <div>
            <div className="text-[#5A6578] dark:text-[#CBD5E1] font-semibold mb-1.5">Wallpaper Chat</div>
            <div className="grid grid-cols-3 gap-2">
              {WALLPAPER_OPTIONS.map((wp) => (
                <button
                  key={wp.id}
                  type="button"
                  onClick={() =>
                    onChangeAppearance({ ...appearance, wallpaper: wp.id as ChatWallpaperId })
                  }
                  className={`p-2 rounded-xl border text-left transition-all ${
                    appearance.wallpaper === wp.id
                      ? 'border-[#8C0027] ring-2 ring-[#8C0027]/25 bg-[#FFFFFF] dark:bg-[#232D40]'
                      : 'border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#1E2738]'
                  }`}
                >
                  <div
                    className="h-7 w-full rounded-lg border border-black/10 mb-1"
                    style={{ background: wp.swatch }}
                  />
                  <div className="text-[11px] font-bold truncate">{wp.label}</div>
                </button>
              ))}

              <input
                ref={wallpaperInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === 'string') {
                      onChangeAppearance({
                        ...appearance,
                        wallpaper: 'custom',
                        customWallpaperUrl: reader.result,
                      });
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <button
                type="button"
                onClick={() => wallpaperInputRef.current?.click()}
                className={`p-2 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  appearance.wallpaper === 'custom'
                    ? 'border-[#8C0027] ring-2 ring-[#8C0027]/25 bg-[#FFFFFF] dark:bg-[#232D40]'
                    : 'border-dashed border-[#8C0027]/50 bg-[#EAF4FF]/60 dark:bg-[#1E2738]'
                }`}
              >
                <div className="h-7 w-full rounded-lg bg-[#BEDEFF]/60 dark:bg-[#2B364B] flex items-center justify-center mb-1">
                  <Camera className="w-4 h-4 text-[#161B26] dark:text-[#F1F5F9]" />
                </div>
                <div className="text-[11px] font-bold truncate">Foto Sendiri</div>
              </button>
            </div>

            {/* Custom Photo Wallpaper Customization */}
            {appearance.wallpaper === 'custom' && appearance.customWallpaperUrl && (
              <div className="mt-3 p-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#324058] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#161B26] dark:text-[#F5F7FA]">
                    Kustomisasi Foto Wallpaper
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => wallpaperInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-full bg-white dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-[11px] font-bold"
                    >
                      Ganti
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeAppearance({
                          ...appearance,
                          wallpaper: 'doodle-animated',
                          customWallpaperUrl: null,
                        })
                      }
                      className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-[11px] font-bold"
                    >
                      Hapus
                    </button>
                  </div>
                </div>

                <label className="block space-y-1">
                  <div className="flex justify-between text-[11px] text-[#5A6578] dark:text-[#CBD5E1]">
                    <span>Kegelapan Latar</span>
                    <span className="font-mono font-bold">{appearance.customDim ?? 35}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    value={appearance.customDim ?? 35}
                    onChange={(e) =>
                      onChangeAppearance({ ...appearance, customDim: Number(e.target.value) })
                    }
                    className="w-full accent-[#8C0027]"
                  />
                </label>

                <label className="block space-y-1">
                  <div className="flex justify-between text-[11px] text-[#5A6578] dark:text-[#CBD5E1]">
                    <span>Blur Foto</span>
                    <span className="font-mono font-bold">{appearance.customBlur ?? 0}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={16}
                    value={appearance.customBlur ?? 0}
                    onChange={(e) =>
                      onChangeAppearance({ ...appearance, customBlur: Number(e.target.value) })
                    }
                    className="w-full accent-[#8C0027]"
                  />
                </label>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#5A6578] dark:text-[#CBD5E1]">Ukuran Foto</span>
                  <div className="grid grid-cols-2 p-0.5 rounded-full bg-white dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058]">
                    {(
                      [
                        { key: 'cover', label: 'Isi Penuh' },
                        { key: 'contain', label: 'Muat Utuh' },
                      ] as const
                    ).map((fitOpt) => (
                      <button
                        key={fitOpt.key}
                        type="button"
                        onClick={() => onChangeAppearance({ ...appearance, customFit: fitOpt.key })}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                          (appearance.customFit ?? 'cover') === fitOpt.key
                            ? 'bg-[#8C0027] text-white'
                            : 'text-[#5A6578] dark:text-[#CBD5E1]'
                        }`}
                      >
                        {fitOpt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Language & Accessibility */}
        <section className="pt-4 border-t border-[#E6ECF2] dark:border-[#2A364B] space-y-3">
          <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA] flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-[#8C0027] dark:text-[#F47296]" />
            <span>Bahasa & Aksesibilitas</span>
          </h3>

          <div className="flex items-center justify-between">
            <span className="text-[#5A6578] dark:text-[#CBBBC2] font-medium">Bahasa Antarmuka</span>
            <div className="flex gap-1">
              {(['id', 'en'] as LanguageCode[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onChangeLang(code)}
                  className={`px-3 py-1 rounded-xl border font-bold ${
                    lang === code
                      ? 'bg-[#8C0027] border-[#E6ECF2] dark:border-[#F5F7FA] text-white'
                      : 'bg-[#F5F7FA] dark:bg-[#232D40] border-[#161B26]/30 dark:border-[#324058] text-[#161B26] dark:text-[#F5F7FA]'
                  }`}
                >
                  {code === 'id' ? 'Indonesia' : 'English'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#5A6578] dark:text-[#CBBBC2] font-medium">Ukuran Teks</span>
            <div className="flex gap-1">
              {([
                { k: 'sm', label: 'Kecil' },
                { k: 'md', label: 'Normal' },
                { k: 'lg', label: 'Besar' },
              ] as const).map((item) => (
                <button
                  key={item.k}
                  type="button"
                  onClick={() => onChangeTextScale(item.k)}
                  className={`px-3 py-1 rounded-xl border font-bold ${
                    textScale === item.k
                      ? 'bg-[#8C0027] border-[#E6ECF2] dark:border-[#F5F7FA] text-white'
                      : 'bg-[#F5F7FA] dark:bg-[#232D40] border-[#161B26]/30 dark:border-[#324058] text-[#161B26] dark:text-[#F5F7FA]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-[#5A6578] dark:text-[#CBBBC2] font-medium">Mode Kontras Tinggi</span>
            <input
              type="checkbox"
              checked={highContrast}
              onChange={onToggleHighContrast}
              className="h-4 w-4 accent-[#8C0027]"
            />
          </label>
        </section>
          </>
        )}

        {/* Notifications */}
        {activeTab === 'notifications' && (
        <section className="space-y-3">
          <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA] flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-[#8C0027] dark:text-[#F47296]" />
            <span>Notifikasi & Nada</span>
          </h3>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[#5A6578] dark:text-[#CBBBC2] font-medium">Notifikasi Browser</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  showBrowserNotification(
                    'Tes Notifikasi Tolk',
                    'Notifikasi Android & browser sudah aktif!',
                    undefined,
                    { forceInForeground: true }
                  )
                }
                className="px-2.5 py-1 rounded-xl bg-[#EAF4FF] dark:bg-[#1E2738] border border-[#BEDEFF] dark:border-[#324058] text-[#161B26] dark:text-[#F5F7FA] font-bold brutal-press"
              >
                Tes Notif
              </button>
              {isRunningInAndroidWebView() && (
                <button
                  type="button"
                  onClick={() => openAndroidNotificationSettings()}
                  className="px-2.5 py-1 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-[#161B26] dark:text-[#F5F7FA] font-bold brutal-press"
                >
                  Izin HP
                </button>
              )}
              {notifPermission === 'granted' ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">Aktif</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleEnableBrowserNotif()}
                  className="px-3 py-1 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] border border-[#E6ECF2] dark:border-[#F5F7FA] text-white font-bold brutal-press"
                >
                  Izinkan Notifikasi
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#5A6578] dark:text-[#CBBBC2] font-medium">Nada Dering Pesan</span>
            <select
              value={notificationTone}
              onChange={(e) => onChangeTone(e.target.value as NotificationTone)}
              className="h-8 px-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-[#161B26] dark:text-[#F5F7FA] font-semibold"
            >
              <option value="lunola">Lunola Chime</option>
              <option value="crystal">Crystal Bell</option>
              <option value="soft">Soft Tone</option>
              <option value="mute">Senyap</option>
            </select>
          </div>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-[#5A6578] dark:text-[#CBBBC2] font-medium">Getaran Pesan Masuk</span>
            <input
              type="checkbox"
              checked={vibrateEnabled}
              onChange={onToggleVibrate}
              className="h-4 w-4 accent-[#8C0027]"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-[#161B26] dark:text-[#F5F7FA] font-semibold">Mode Jangan Ganggu (DND)</div>
              <div className="text-[11px] text-[#5A6578] dark:text-[#94A3B8]">Senyapkan semua banner & bunyi sementara</div>
            </div>
            <input
              type="checkbox"
              checked={dndEnabled}
              onChange={onToggleDnd}
              className="h-4 w-4 accent-[#8C0027]"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-[#161B26] dark:text-[#F5F7FA] font-semibold">Tampilkan Pratinjau Pesan</div>
              <div className="text-[11px] text-[#5A6578] dark:text-[#94A3B8]">Tampilkan isi teks di banner notifikasi</div>
            </div>
            <input
              type="checkbox"
              checked={notifPreview}
              onChange={onToggleNotifPreview}
              className="h-4 w-4 accent-[#8C0027]"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-[#161B26] dark:text-[#F5F7FA] font-semibold">Notifikasi Grup & Channel</div>
              <div className="text-[11px] text-[#5A6578] dark:text-[#94A3B8]">Matikan untuk hanya terima notif DM & mention</div>
            </div>
            <input
              type="checkbox"
              checked={notifGroups}
              onChange={onToggleNotifGroups}
              className="h-4 w-4 accent-[#8C0027]"
            />
          </label>
        </section>
        )}

        {/* Privacy */}
        {activeTab === 'privacy' && (
        <section className="space-y-3">
          <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA] flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#8C0027] dark:text-[#F47296]" />
            <span>Privasi & Kontrol Kontak</span>
          </h3>

          {(
            [
              { key: 'lastSeenVisibility', label: 'Siapa yang melihat Terakhir Dilihat' },
              { key: 'whoCanMessage', label: 'Siapa yang dapat menghubungi saya' },
              { key: 'storyVisibility', label: 'Privasi default Status 24 jam' },
            ] as const
          ).map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-3">
              <span className="text-[#5A6578] dark:text-[#CBBBC2] font-medium">{item.label}</span>
              <select
                value={privacy[item.key]}
                onChange={(e) =>
                  void onUpdatePrivacy({ [item.key]: e.target.value as PrivacyScope })
                }
                className="h-8 px-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-[#161B26] dark:text-[#F5F7FA] font-semibold"
              >
                <option value="everyone">Semua Orang</option>
                <option value="contacts">Kontak Saya</option>
                <option value="nobody">Tidak Seorang Pun</option>
              </select>
            </div>
          ))}

          <label className="flex items-center justify-between cursor-pointer pt-1">
            <div>
              <div className="text-[#161B26] dark:text-[#F5F7FA] font-semibold">Tanda Baca Dibaca</div>
              <div className="text-[11px] text-[#5A6578] dark:text-[#94A3B8]">Tampilkan centang biru saat pesan dibaca</div>
            </div>
            <input
              type="checkbox"
              checked={readReceiptsEnabled}
              onChange={onToggleReadReceipts}
              className="h-4 w-4 accent-[#8C0027]"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-[#161B26] dark:text-[#F5F7FA] font-semibold">Indikator Sedang Mengetik</div>
              <div className="text-[11px] text-[#5A6578] dark:text-[#94A3B8]">Perlihatkan saat Anda sedang mengetik pesan</div>
            </div>
            <input
              type="checkbox"
              checked={typingIndicatorEnabled}
              onChange={onToggleTypingIndicator}
              className="h-4 w-4 accent-[#8C0027]"
            />
          </label>

          {/* Blocked Users */}
          <div className="pt-2">
            <div className="text-[#161B26] dark:text-[#F5F7FA] font-bold mb-1.5 flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Pengguna Diblokir ({blockedIds.length})</span>
            </div>
            {blockedIds.length === 0 ? (
              <p className="text-[#5A6578] dark:text-[#94A3B8]">Tidak ada pengguna yang diblokir.</p>
            ) : (
              <div className="space-y-1.5">
                {blockedIds.map((uid) => (
                  <div
                    key={uid}
                    className="flex items-center justify-between p-2 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#161B26]/20 dark:border-[#324058]"
                  >
                    <span className="text-[#161B26] dark:text-[#F5F7FA] font-semibold">
                      {users[uid]?.displayName || uid}
                    </span>
                    <button
                      type="button"
                      onClick={() => void onUnblockUser(uid)}
                      className="text-[#8C0027] dark:text-[#F47296] hover:underline font-bold"
                    >
                      Buka Blokir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        )}
        </motion.div>
        </AnimatePresence>
        </div>
      </div>
    </ModalShell>
  );
}

export function ReportModal({
  open,
  targetLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  targetLabel: string;
  onClose: () => void;
  onSubmit: (category: ModerationReport['category'], reason: string) => Promise<void>;
}) {
  const [category, setCategory] = useState<ModerationReport['category']>('spam');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await onSubmit(category, reason.trim());
      setReason('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      open={open}
      title="Laporkan Konten / Pengguna"
      subtitle={`Target laporan: ${targetLabel}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
            Kategori Pelanggaran
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ModerationReport['category'])}
            className="w-full h-10 px-4 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA]"
          >
            <option value="spam">Spam atau Promosi Berlebihan</option>
            <option value="scam">Penipuan / Phishing</option>
            <option value="harassment">Pelecehan / Ujaran Kebencian</option>
            <option value="illegal">Konten Ilegal</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
            Penjelasan Singkat
          </label>
          <textarea
            rows={3}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Jelaskan pelanggaran yang Anda temukan untuk ditinjau moderator..."
            className="w-full p-3 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] resize-none focus:outline-none focus:border-[#8C0027]"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full h-10 rounded-xl bg-amber-600 hover:bg-amber-700 border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm brutal-press text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Flag className="w-4 h-4" />
          <span>{busy ? 'Mengirim...' : 'Kirim Laporan ke Moderator'}</span>
        </button>
      </form>
    </ModalShell>
  );
}

export function SelfHostModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'docker' | 'wasmer' | 'android'>('docker');
  const [copied, setCopied] = useState(false);
  const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'https://lunola.example.com';
  const inAndroid = isRunningInAndroidWebView();

  const snippets: Record<'docker' | 'wasmer' | 'android', string> = {
    docker: `# 1. Salin .env.example menjadi .env lalu isi ADMIN_PASSCODE
cp .env.example .env

# 2. Jalankan stack Self-Host (Tolk by Lunola + Tinode + PostgreSQL + Caddy HTTPS)
docker compose up -d

# 3. Verifikasi kesehatan layanan
curl http://localhost:3000/api/health`,
    wasmer: `# Deploy langsung ke Wasmer Edge menggunakan wasmer.toml
npm run build
wasmer deploy --manifest wasmer.toml

# Atau jalankan lokal via Wasmer runtime
wasmer run .`,
    android: `// Buka /android-webview di Android Studio
// Set APP_URL di MainActivity.kt ke domain server Anda:
private val lunolaUrl = "${currentUrl}"

// Fitur native yang sudah terhubung:
// - LunolaTalkAndroid JS Bridge (Haptic, Toast, StatusBar)
// - Back-button handler (__lunolaTalkHandleBack)
// - Upload media & izin mikrofon/kamera WebRTC`,
  };

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippets[tab]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore
    }
  };

  return (
    <ModalShell
      open={open}
      title="Self-Hosting, Wasmer & Android WebView"
      subtitle="Semua file konfigurasi (docker-compose.yml, wasmer.toml, .env.example, Android Kotlin) sudah tersedia di repositori."
      maxWidth="max-w-xl"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] p-1">
          <button
            type="button"
            onClick={() => setTab('docker')}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${
              tab === 'docker'
                ? 'bg-[#8C0027] text-white'
                : 'text-[#5A6578] dark:text-[#94A3B8] hover:text-[#161B26] dark:hover:text-[#F5F7FA]'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Docker + Tinode</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('wasmer')}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${
              tab === 'wasmer'
                ? 'bg-[#8C0027] text-white'
                : 'text-[#5A6578] dark:text-[#94A3B8] hover:text-[#161B26] dark:hover:text-[#F5F7FA]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Wasmer Edge</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('android')}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${
              tab === 'android'
                ? 'bg-[#8C0027] text-white'
                : 'text-[#5A6578] dark:text-[#94A3B8] hover:text-[#161B26] dark:hover:text-[#F5F7FA]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android WebView</span>
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-[#161B26] border border-[#E6ECF2] dark:border-[#324058] text-[#F5F7FA] font-mono text-xs overflow-x-auto relative brutal-shadow-sm">
          <button
            type="button"
            onClick={copySnippet}
            className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-[#8C0027] hover:bg-[#6E001F] border border-[#F5F7FA]/60 text-white text-[11px] font-bold flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Disalin' : 'Salin'}</span>
          </button>
          <pre className="whitespace-pre-wrap leading-relaxed pr-16">{snippets[tab]}</pre>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5A6578] dark:text-[#94A3B8]">
          <span>
            Endpoint aktif: <code className="font-mono font-bold text-[#8C0027] dark:text-[#F47296]">{currentUrl}</code>
          </span>
          <span>
            Mode klien: <strong className="text-[#161B26] dark:text-[#F5F7FA]">{inAndroid ? 'Android WebView' : 'Web / PWA'}</strong>
          </span>
        </div>
      </div>
    </ModalShell>
  );
}

export function NotificationsModal({
  open,
  currentUserId,
  users,
  friendRequests,
  settings,
  onClose,
  onRespondRequest,
}: {
  open: boolean;
  currentUserId: string;
  users: Record<string, UserProfile>;
  friendRequests: FriendRequest[];
  settings: PlatformSettings | null;
  onClose: () => void;
  onRespondRequest: (requestId: string, action: 'accept' | 'reject') => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const incomingPending = friendRequests.filter(
    (r) => r.toUserId === currentUserId && r.status === 'pending'
  );
  const outgoingPending = friendRequests.filter(
    (r) => r.fromUserId === currentUserId && r.status === 'pending'
  );
  const announcement = settings?.globalAnnouncement?.trim() || '';

  return (
    <ModalShell
      open={open}
      title="Notifikasi"
      subtitle="Pengumuman platform & permintaan kontak masuk."
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Platform Announcement */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5A6578] dark:text-[#94A3B8] mb-2">
            <Megaphone className="w-3.5 h-3.5 text-[#8C0027]" />
            <span>Pengumuman</span>
          </div>
          {announcement ? (
            <div className="p-3.5 rounded-2xl bg-[#EAF4FF] dark:bg-[#1B2436] border border-[#8C0027]/30 text-xs text-[#161B26] dark:text-[#F5F7FA] leading-relaxed brutal-shadow-sm">
              {announcement}
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1E2738] text-xs text-[#6B768A] dark:text-[#94A3B8]">
              Tidak ada pengumuman terbaru.
            </div>
          )}
        </div>

        {/* Incoming Friend Requests */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5A6578] dark:text-[#94A3B8] mb-2">
            <UserPlus className="w-3.5 h-3.5 text-[#F59B00]" />
            <span>Permintaan Kontak ({incomingPending.length})</span>
          </div>
          {incomingPending.length === 0 ? (
            <div className="p-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1E2738] text-xs text-[#6B768A] dark:text-[#94A3B8]">
              Belum ada permintaan kontak masuk.
            </div>
          ) : (
            <div className="space-y-2">
              {incomingPending.map((req) => {
                const sender = users[req.fromUserId];
                if (!sender) return null;
                return (
                  <div
                    key={req.id}
                    className="p-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] flex items-center justify-between gap-2 brutal-shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        name={sender.displayName}
                        imageUrl={sender.avatarUrl}
                        color={sender.avatarColor}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#161B26] dark:text-[#F5F7FA] truncate">
                          {sender.displayName}
                        </div>
                        <div className="text-xs font-mono text-[#8C0027] dark:text-[#F47296] truncate">
                          @{sender.username} · {formatTimeShort(req.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={async () => {
                          setBusyId(req.id);
                          try {
                            await onRespondRequest(req.id, 'reject');
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-xl border border-[#E6ECF2] dark:border-[#2A364B] bg-[#FFFFFF] dark:bg-[#171E2C] text-xs font-bold text-[#5A6578] dark:text-[#94A3B8] hover:text-[#8C0027]"
                      >
                        Tolak
                      </button>
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={async () => {
                          setBusyId(req.id);
                          try {
                            await onRespondRequest(req.id, 'accept');
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#F59B00] hover:bg-[#D98800] text-white text-xs font-bold brutal-shadow-sm brutal-press"
                      >
                        Terima
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Outgoing Pending */}
        {outgoingPending.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#5A6578] dark:text-[#94A3B8] mb-2">
              Menunggu Persetujuan ({outgoingPending.length})
            </div>
            <div className="space-y-1.5">
              {outgoingPending.map((req) => {
                const target = users[req.toUserId];
                if (!target) return null;
                return (
                  <div
                    key={req.id}
                    className="p-2.5 rounded-xl bg-[#F5F7FA]/70 dark:bg-[#1E2738]/70 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-semibold truncate">
                      {target.displayName} (@{target.username})
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#E6ECF2] dark:bg-[#2A364B] text-[11px] font-bold text-[#5A6578] dark:text-[#94A3B8]">
                      Menunggu
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

export function StarredMessagesModal({
  open,
  items,
  loading,
  onClose,
  onOpenChat,
  onUnstar,
}: {
  open: boolean;
  items: Array<{ message: Message; chatTitle: string; senderName: string }>;
  loading: boolean;
  onClose: () => void;
  onOpenChat: (chatId: string) => void;
  onUnstar: (messageId: string) => Promise<void>;
}) {
  return (
    <ModalShell
      open={open}
      title="Pesan Berbintang"
      subtitle={`${items.length} pesan ditandai penting`}
      maxWidth="max-w-lg"
      onClose={onClose}
    >
      <div className="space-y-2.5 max-h-[65dvh] overflow-y-auto pr-1">
        {loading ? (
          <div className="py-10 text-center text-sm text-[#5A6578] dark:text-[#94A3B8]">
            Memuat pesan berbintang...
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF2A7] text-[#161B26] mx-auto flex items-center justify-center">
              <Star className="w-6 h-6 fill-[#F59B00] text-[#F59B00]" />
            </div>
            <div className="text-sm font-bold text-[#161B26] dark:text-[#F1F5F9]">
              Belum ada pesan berbintang
            </div>
            <p className="text-xs text-[#5A6578] dark:text-[#94A3B8] max-w-xs mx-auto">
              Tekan menu titik tiga di bubble pesan mana saja lalu pilih Bintangi Pesan untuk menyimpannya di sini.
            </p>
          </div>
        ) : (
          items.map(({ message, chatTitle, senderName }) => (
            <div
              key={message.id}
              className="p-3.5 rounded-2xl border border-[#E6ECF2] dark:border-[#2A364B] bg-[#FFFFFF] dark:bg-[#1E2738] space-y-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 truncate">
                  <span className="font-bold text-[#161B26] dark:text-[#F1F5F9]">{senderName}</span>
                  <span className="text-[#5A6578] dark:text-[#94A3B8]"> · {chatTitle}</span>
                </div>
                <span className="font-mono text-[11px] text-[#5A6578] dark:text-[#94A3B8] shrink-0">
                  {new Date(message.createdAt).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                  })}{' '}
                  {new Date(message.createdAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {message.text && (
                <p className="text-sm text-[#161B26] dark:text-[#F1F5F9] whitespace-pre-wrap break-words">
                  {message.text}
                </p>
              )}

              {message.attachment && (
                <div className="text-xs px-2.5 py-1.5 rounded-xl bg-[#F5F7FA] dark:bg-[#151C28] text-[#5A6578] dark:text-[#CBD5E1] truncate">
                  Lampiran: {message.attachment.name}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void onUnstar(message.id)}
                  className="px-3 py-1.5 rounded-xl border border-[#E6ECF2] dark:border-[#2A364B] text-xs font-semibold text-[#5A6578] dark:text-[#CBD5E1] hover:bg-[#FEE2E2] hover:text-[#991B1B] dark:hover:bg-[#3B1822] dark:hover:text-[#FCA5A5] transition-colors"
                >
                  Hapus Bintang
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenChat(message.chatId);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#8C0027] text-white text-xs font-bold hover:bg-[#730020] transition-colors"
                >
                  Buka Chat
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </ModalShell>
  );
}
