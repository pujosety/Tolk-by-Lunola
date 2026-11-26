import { useEffect, useRef, useState } from 'react';
import {
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
  MonitorSmartphone,
  QrCode,
  Radio,
  RotateCcw,
  Search,
  Server,
  Shield,
  Smartphone,
  Terminal,
  Trash2,
  UserPlus,
  Users,
  X,
  ZoomIn,
} from 'lucide-react';
import type {
  Attachment,
  ChatRoom,
  ChatType,
  DeviceSession,
  LanguageCode,
  Message,
  ModerationReport,
  NotificationTone,
  PrivacyScope,
  TextScale,
  UserPrivacySettings,
  UserProfile,
} from '../types/chat';
import { formatTimeShort, isRunningInAndroidWebView } from '../lib/androidBridge';
import { requestBrowserNotificationPermission } from '../lib/pwa';
import { Avatar } from './Avatar';
import { useAnimatedPresence } from '../lib/useAnimatedPresence';
import { QrCodeBox } from './QrCodeBox';

function ModalShell({
  open,
  title,
  subtitle,
  maxWidth = 'max-w-md',
  closable = true,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  closable?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { mounted, closing } = useAnimatedPresence(open, 200);
  if (!mounted) return null;
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${closing ? 'pointer-events-none' : ''}`}>
      <div
        className={`${closing ? 'p5-backdrop-out' : 'p5-backdrop-in'} fixed inset-0 bg-[#252A24]/65 backdrop-blur-[2px]`}
        onClick={closable ? onClose : undefined}
      />
      <div
        className={`${
          closing ? 'p5-modal-out' : 'p5-modal-impact'
        } relative z-10 w-full ${maxWidth} max-h-[88dvh] flex flex-col rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-lg overflow-hidden`}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b-2 border-[#E3E1DC] dark:border-[#364032] bg-[#F2F2F2] dark:bg-[#191E17] shrink-0">
          <div>
            <h2 className="font-display font-extrabold text-xl leading-tight text-[#252A24] dark:text-[#F2F2F2]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[#5E645C] dark:text-[#A3AD9E]">
                {subtitle}
              </p>
            )}
          </div>
          {closable && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog"
              className="h-8 w-8 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] bg-[#FBF9F6] dark:bg-[#2B3328] text-[#252A24] dark:text-[#F2F2F2] hover:bg-[#D96868] hover:text-white brutal-press flex items-center justify-center shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="p-5 overflow-y-auto thin-scrollbar">{children}</div>
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
        <div className="px-3.5 py-2 rounded-xl bg-[#FBF9F6] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm flex items-center gap-2.5">
          <img
            src="/assets/aistudio/tolk-symbol_95df402c.svg"
            alt="Tolk symbol"
            className="h-8 w-8 object-contain select-none"
          />
          <img
            src="/assets/aistudio/tolk-wordmark_36d1b947.svg"
            alt="Tolk by Lunola"
            className="h-7 w-auto object-contain select-none"
          />
        </div>
      </div>

      <div className="flex rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] p-1 mb-4 gap-1">
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setError('');
          }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            mode === 'register'
              ? 'bg-[#D96868] text-white'
              : 'text-[#5E645C] dark:text-[#A3AD9E] hover:text-[#252A24] dark:hover:text-[#F2F2F2]'
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
              ? 'bg-[#D96868] text-white'
              : 'text-[#5E645C] dark:text-[#A3AD9E] hover:text-[#252A24] dark:hover:text-[#F2F2F2]'
          }`}
        >
          Masuk Akun
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'register' && (
          <>
            <div>
              <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
                Nama Tampilan
              </label>
              <input
                type="text"
                required
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Masukkan nama tampilan"
                className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
                Email (opsional)
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Masukkan alamat email"
                className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
            {mode === 'login' ? 'Username atau Email' : 'Username'}
          </label>
          <input
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={mode === 'login' ? 'Masukkan username atau email' : 'Masukkan username'}
            className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm font-mono text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
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
              className="w-full h-10 pl-3 pr-10 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#5E645C] dark:text-[#A3AD9E] hover:text-[#D96868] dark:hover:text-[#E58383]"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mode === 'register' && (
          <div>
            <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
              Bio Singkat (opsional)
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tulis bio singkat"
              className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
            />
          </div>
        )}

        {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full h-10 rounded-xl bg-[#D96868] hover:bg-[#C45454] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm brutal-press text-white text-sm font-bold transition-colors disabled:opacity-50"
        >
          {busy ? 'Memproses...' : mode === 'register' ? 'Buat Akun' : 'Masuk'}
        </button>
      </form>
    </ModalShell>
  );
}

const AVATAR_COLOR_SWATCHES = [
  '#D96868',
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
  const [avatarColor, setAvatarColor] = useState<string>(user.avatarColor || '#D96868');
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
    setAvatarColor(user.avatarColor || '#D96868');
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
        <div className="mb-4 p-4 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-display font-extrabold text-[#252A24] dark:text-[#F2F2F2]">
              Sesuaikan Posisi & Zoom Foto
            </span>
            <button
              type="button"
              onClick={() => {
                setCropZoom(1.1);
                setCropOffsetX(0);
                setCropOffsetY(0);
              }}
              className="text-[11px] font-bold text-[#D96868] dark:text-[#E58383] hover:underline flex items-center gap-1"
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
              className="relative w-44 h-44 rounded-3xl overflow-hidden bg-[#252A24] border border-[#D96868] brutal-shadow-sm cursor-grab active:cursor-grabbing touch-none select-none"
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
            <ZoomIn className="w-4 h-4 text-[#5E645C] dark:text-[#A3AD9E] shrink-0" />
            <input
              type="range"
              min={1}
              max={2.5}
              step={0.05}
              value={cropZoom}
              onChange={(e) => setCropZoom(Number(e.target.value))}
              className="flex-1 accent-[#D96868]"
            />
            <span className="font-mono text-[11px] font-bold text-[#5E645C] dark:text-[#A3AD9E] tabular-nums w-9 text-right">
              {cropZoom.toFixed(1)}x
            </span>
          </div>

          <p className="text-[11px] text-[#5E645C] dark:text-[#A3AD9E] text-center">
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
              className="px-3 py-1.5 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] hover:bg-[#FBF9F6] dark:hover:bg-[#1E241C]"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={uploadingPhoto}
              onClick={() => void handleApplyCrop()}
              className="px-3.5 py-1.5 rounded-xl bg-[#D96868] hover:bg-[#C45454] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm brutal-press text-white text-xs font-bold disabled:opacity-50"
            >
              {uploadingPhoto ? 'Mengunggah...' : 'Terapkan Foto'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4 p-3.5 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="relative group rounded-xl shrink-0 focus:outline-none focus:ring-2 focus:ring-[#D96868]"
                title="Ganti foto profil"
              >
                <Avatar
                  name={displayName || user.displayName}
                  imageUrl={avatarUrl}
                  color={avatarColor}
                  size="lg"
                />
                <span className="absolute inset-0 rounded-xl bg-[#252A24]/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Camera className="w-5 h-5" />
                </span>
              </button>
              <div className="min-w-0">
                <div className="font-display font-extrabold text-base text-[#252A24] dark:text-[#F2F2F2] truncate">
                  {displayName || user.displayName}
                </div>
                <div className="font-mono text-xs font-bold text-[#D96868] dark:text-[#E58383]">
                  @{username || user.username}
                </div>
                <div className="mt-1.5 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="text-[11px] font-bold text-[#D96868] dark:text-[#E58383] hover:underline flex items-center gap-1"
                  >
                    <Camera className="w-3 h-3" />
                    <span>{avatarUrl ? 'Ganti Foto' : 'Unggah Foto'}</span>
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(null)}
                      className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      Hapus Foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              className="px-2.5 py-1.5 rounded-xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#3C4738] text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] hover:bg-[#D96868] hover:text-white flex items-center gap-1.5 shrink-0 brutal-press"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{showQr ? 'Tutup' : 'QR'}</span>
            </button>
          </div>

          {/* Avatar Color Swatches */}
          <div className="flex items-center justify-between gap-2 pt-2.5 border-t-2 border-[#252A24]/15 dark:border-[#364032]">
            <span className="text-[11px] font-semibold text-[#5E645C] dark:text-[#A3AD9E]">
              Warna latar inisial:
            </span>
            <div className="flex items-center gap-1.5">
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
                  className={`w-5 h-5 rounded-lg border border-[#E3E1DC] dark:border-[#F2F2F2] transition-transform ${
                    avatarColor === hex && !avatarUrl
                      ? 'ring-2 ring-offset-2 ring-[#D96868] dark:ring-offset-[#2B3328] scale-115'
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
          <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
            Nama Tampilan
          </label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
            Username Unik
          </label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm font-mono text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
            Status Singkat
          </label>
          <input
            type="text"
            value={statusText}
            onChange={(e) => setStatusText(e.target.value)}
            placeholder="Masukkan status singkat"
            className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Masukkan alamat email (opsional)"
            className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
            Bio
          </label>
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full p-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] resize-none focus:outline-none focus:border-[#D96868]"
          />
        </div>
        {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full h-10 rounded-xl bg-[#D96868] hover:bg-[#C45454] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm brutal-press text-white text-sm font-bold transition-colors disabled:opacity-50"
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
  onClose,
  onCreateChat,
}: {
  open: boolean;
  initialMode: 'dm' | 'group' | 'channel';
  users: Record<string, UserProfile>;
  currentUserId: string;
  onClose: () => void;
  onCreateChat: (payload: {
    type: ChatType;
    targetUserId?: string;
    title?: string;
    description?: string;
    handle?: string;
    memberIds?: string[];
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<'dm' | 'group' | 'channel'>(initialMode);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [handle, setHandle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, open]);

  const otherUsers = Object.values(users).filter((u) => u.id !== currentUserId);
  const filteredUsers = otherUsers.filter(
    (u) =>
      u.displayName.toLowerCase().includes(query.toLowerCase()) ||
      u.username.toLowerCase().includes(query.toLowerCase())
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

  return (
    <ModalShell
      open={open}
      title="Mulai Percakapan"
      subtitle="Chat pribadi via @username, buat grup komunitas, atau buka channel publik."
      onClose={onClose}
    >
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] p-1 mb-4">
        <button
          type="button"
          onClick={() => setMode('dm')}
          className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${
            mode === 'dm'
              ? 'bg-[#D96868] text-white'
              : 'text-[#5E645C] dark:text-[#A3AD9E] hover:text-[#252A24] dark:hover:text-[#F2F2F2]'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Pribadi</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('group')}
          className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${
            mode === 'group'
              ? 'bg-[#D96868] text-white'
              : 'text-[#5E645C] dark:text-[#A3AD9E] hover:text-[#252A24] dark:hover:text-[#F2F2F2]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Grup</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('channel')}
          className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${
            mode === 'channel'
              ? 'bg-[#D96868] text-white'
              : 'text-[#5E645C] dark:text-[#A3AD9E] hover:text-[#252A24] dark:hover:text-[#F2F2F2]'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Channel</span>
        </button>
      </div>

      {mode === 'dm' ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#5E645C] dark:text-[#A3AD9E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau @username..."
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
            />
          </div>
          <div className="max-h-64 overflow-y-auto thin-scrollbar space-y-1">
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
                className="w-full p-2.5 rounded-xl border border-transparent hover:border-[#E3E1DC] dark:hover:border-[#3C4738] flex items-center gap-3 hover:bg-[#F2F2F2] dark:hover:bg-[#2B3328] text-left"
              >
                <Avatar name={u.displayName} imageUrl={u.avatarUrl} color={u.avatarColor} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[#252A24] dark:text-[#F2F2F2] truncate">
                    {u.displayName}
                  </div>
                  <div className="text-xs font-mono text-[#D96868] dark:text-[#E58383] truncate">
                    @{u.username}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmitGroupOrChannel} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
              {mode === 'group' ? 'Nama Grup' : 'Nama Channel Publik'}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === 'group' ? 'Masukkan nama grup' : 'Masukkan nama channel'}
              className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
              Tautan Undangan (@handle)
            </label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="Masukkan username handle"
              className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm font-mono text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
              Deskripsi
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tujuan grup atau channel ini..."
              className="w-full p-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] resize-none focus:outline-none focus:border-[#D96868]"
            />
          </div>

          {mode === 'group' && (
            <div>
              <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1.5">
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
                          ? 'bg-[#FCEAEA] dark:bg-[#2E2223] border-[#D96868] text-[#D96868] dark:text-[#E58383]'
                          : 'border-transparent hover:bg-[#F2F2F2] dark:hover:bg-[#2B3328]'
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
                            ? 'bg-[#D96868] border-[#E3E1DC] dark:border-[#F2F2F2] text-white'
                            : 'border-[#252A24]/40 dark:border-[#3C4738]'
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
            className="w-full h-10 rounded-xl bg-[#D96868] hover:bg-[#C45454] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm brutal-press text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {busy ? 'Membuat...' : mode === 'group' ? 'Buat Grup' : 'Buat Channel'}
          </button>
        </form>
      )}
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
      <div className="mb-3 p-2.5 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-xs text-[#252A24] dark:text-[#F2F2F2] line-clamp-2">
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
            className="w-full p-2.5 rounded-xl border border-transparent hover:border-[#E3E1DC] dark:hover:border-[#3C4738] flex items-center gap-3 hover:bg-[#F2F2F2] dark:hover:bg-[#2B3328] text-left"
          >
            <Avatar
              name={chat.title}
              imageUrl={chat.avatarUrl}
              color={chat.avatarColor}
              chatType={chat.type}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-[#252A24] dark:text-[#F2F2F2] truncate">
                {chat.title}
              </div>
              <div className="text-[11px] text-[#5E645C] dark:text-[#A3AD9E] capitalize">
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
  onLogoutCurrent,
}: {
  open: boolean;
  sessions: DeviceSession[];
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onRevokeSession: (sid: string) => Promise<void>;
  onLogoutCurrent: () => void;
}) {
  return (
    <ModalShell
      open={open}
      title="Perangkat Aktif & Sesi Login"
      subtitle="Kelola perangkat web, PWA, atau Android WebView yang tersambung ke akun Anda."
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#5E645C] dark:text-[#A3AD9E]">
            Total sesi aktif: <strong className="font-mono text-[#252A24] dark:text-[#F2F2F2]">{sessions.length}</strong>
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs font-bold text-[#D96868] dark:text-[#E58383] hover:underline"
          >
            Muat ulang
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-[#5E645C] dark:text-[#A3AD9E] text-center py-6">Memuat daftar perangkat...</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto thin-scrollbar">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MonitorSmartphone className="w-5 h-5 text-[#D96868] dark:text-[#E58383] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] truncate">
                      {s.deviceName} {s.current ? '(Perangkat ini)' : ''}
                    </div>
                    <div className="font-mono text-[10px] text-[#5E645C] dark:text-[#A3AD9E] truncate">
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
          className="w-full h-10 rounded-xl border border-[#D96868] text-[#D96868] dark:text-[#E58383] hover:bg-[#D96868] hover:text-white text-xs font-bold flex items-center justify-center gap-2 brutal-press transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar dari Perangkat Ini</span>
        </button>
      </div>
    </ModalShell>
  );
}

export function SettingsModal({
  open,
  lang,
  textScale,
  highContrast,
  notificationTone,
  vibrateEnabled,
  user,
  users,
  onClose,
  onChangeLang,
  onChangeTextScale,
  onToggleHighContrast,
  onChangeTone,
  onToggleVibrate,
  onUpdatePrivacy,
  onUnblockUser,
}: {
  open: boolean;
  lang: LanguageCode;
  textScale: TextScale;
  highContrast: boolean;
  notificationTone: NotificationTone;
  vibrateEnabled: boolean;
  user: UserProfile;
  users: Record<string, UserProfile>;
  onClose: () => void;
  onChangeLang: (lang: LanguageCode) => void;
  onChangeTextScale: (scale: TextScale) => void;
  onToggleHighContrast: () => void;
  onChangeTone: (tone: NotificationTone) => void;
  onToggleVibrate: () => void;
  onUpdatePrivacy: (patch: Partial<UserPrivacySettings>) => Promise<void>;
  onUnblockUser: (targetId: string) => Promise<void>;
}) {
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

  return (
    <ModalShell
      open={open}
      title="Privasi, Notifikasi & Tampilan"
      subtitle="Bahasa, aksesibilitas, nada notifikasi, serta kendali privasi Tolk by Lunola."
      maxWidth="max-w-lg"
      onClose={onClose}
    >
      <div className="space-y-5 text-xs">
        {/* Language & Accessibility */}
        <section className="space-y-3">
          <h3 className="font-display font-extrabold text-base text-[#252A24] dark:text-[#F2F2F2] flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-[#D96868] dark:text-[#E58383]" />
            <span>Bahasa & Aksesibilitas</span>
          </h3>

          <div className="flex items-center justify-between">
            <span className="text-[#5E645C] dark:text-[#CBBBC2] font-medium">Bahasa Antarmuka</span>
            <div className="flex gap-1">
              {(['id', 'en'] as LanguageCode[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onChangeLang(code)}
                  className={`px-3 py-1 rounded-xl border font-bold ${
                    lang === code
                      ? 'bg-[#D96868] border-[#E3E1DC] dark:border-[#F2F2F2] text-white'
                      : 'bg-[#F2F2F2] dark:bg-[#2B3328] border-[#252A24]/30 dark:border-[#3C4738] text-[#252A24] dark:text-[#F2F2F2]'
                  }`}
                >
                  {code === 'id' ? 'Indonesia' : 'English'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#5E645C] dark:text-[#CBBBC2] font-medium">Ukuran Teks</span>
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
                      ? 'bg-[#D96868] border-[#E3E1DC] dark:border-[#F2F2F2] text-white'
                      : 'bg-[#F2F2F2] dark:bg-[#2B3328] border-[#252A24]/30 dark:border-[#3C4738] text-[#252A24] dark:text-[#F2F2F2]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-[#5E645C] dark:text-[#CBBBC2] font-medium">Mode Kontras Tinggi</span>
            <input
              type="checkbox"
              checked={highContrast}
              onChange={onToggleHighContrast}
              className="h-4 w-4 accent-[#D96868]"
            />
          </label>
        </section>

        {/* Notifications */}
        <section className="pt-4 border-t-2 border-[#252A24]/15 dark:border-[#364032] space-y-3">
          <h3 className="font-display font-extrabold text-base text-[#252A24] dark:text-[#F2F2F2] flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-[#D96868] dark:text-[#E58383]" />
            <span>Notifikasi & Nada</span>
          </h3>

          <div className="flex items-center justify-between">
            <span className="text-[#5E645C] dark:text-[#CBBBC2] font-medium">Notifikasi Browser</span>
            {notifPermission === 'granted' ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">Aktif</span>
            ) : (
              <button
                type="button"
                onClick={() => void handleEnableBrowserNotif()}
                className="px-3 py-1 rounded-xl bg-[#D96868] hover:bg-[#C45454] border border-[#E3E1DC] dark:border-[#F2F2F2] text-white font-bold brutal-press"
              >
                Izinkan Notifikasi
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#5E645C] dark:text-[#CBBBC2] font-medium">Nada Dering Pesan</span>
            <select
              value={notificationTone}
              onChange={(e) => onChangeTone(e.target.value as NotificationTone)}
              className="h-8 px-2.5 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-[#252A24] dark:text-[#F2F2F2] font-semibold"
            >
              <option value="lunola">Lunola Chime</option>
              <option value="crystal">Crystal Bell</option>
              <option value="soft">Soft Tone</option>
              <option value="mute">Senyap</option>
            </select>
          </div>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-[#5E645C] dark:text-[#CBBBC2] font-medium">Getaran Pesan Masuk</span>
            <input
              type="checkbox"
              checked={vibrateEnabled}
              onChange={onToggleVibrate}
              className="h-4 w-4 accent-[#D96868]"
            />
          </label>
        </section>

        {/* Privacy */}
        <section className="pt-4 border-t-2 border-[#252A24]/15 dark:border-[#364032] space-y-3">
          <h3 className="font-display font-extrabold text-base text-[#252A24] dark:text-[#F2F2F2] flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#D96868] dark:text-[#E58383]" />
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
              <span className="text-[#5E645C] dark:text-[#CBBBC2] font-medium">{item.label}</span>
              <select
                value={privacy[item.key]}
                onChange={(e) =>
                  void onUpdatePrivacy({ [item.key]: e.target.value as PrivacyScope })
                }
                className="h-8 px-2.5 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-[#252A24] dark:text-[#F2F2F2] font-semibold"
              >
                <option value="everyone">Semua Orang</option>
                <option value="contacts">Kontak Saya</option>
                <option value="nobody">Tidak Seorang Pun</option>
              </select>
            </div>
          ))}

          {/* Blocked Users */}
          <div className="pt-2">
            <div className="text-[#252A24] dark:text-[#F2F2F2] font-bold mb-1.5 flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Pengguna Diblokir ({blockedIds.length})</span>
            </div>
            {blockedIds.length === 0 ? (
              <p className="text-[#5E645C] dark:text-[#A3AD9E]">Tidak ada pengguna yang diblokir.</p>
            ) : (
              <div className="space-y-1.5">
                {blockedIds.map((uid) => (
                  <div
                    key={uid}
                    className="flex items-center justify-between p-2 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#252A24]/20 dark:border-[#3C4738]"
                  >
                    <span className="text-[#252A24] dark:text-[#F2F2F2] font-semibold">
                      {users[uid]?.displayName || uid}
                    </span>
                    <button
                      type="button"
                      onClick={() => void onUnblockUser(uid)}
                      className="text-[#D96868] dark:text-[#E58383] hover:underline font-bold"
                    >
                      Buka Blokir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
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
          <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
            Kategori Pelanggaran
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ModerationReport['category'])}
            className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2]"
          >
            <option value="spam">Spam atau Promosi Berlebihan</option>
            <option value="scam">Penipuan / Phishing</option>
            <option value="harassment">Pelecehan / Ujaran Kebencian</option>
            <option value="illegal">Konten Ilegal</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
            Penjelasan Singkat
          </label>
          <textarea
            rows={3}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Jelaskan pelanggaran yang Anda temukan untuk ditinjau moderator..."
            className="w-full p-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] resize-none focus:outline-none focus:border-[#D96868]"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full h-10 rounded-xl bg-amber-600 hover:bg-amber-700 border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm brutal-press text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
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
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] p-1">
          <button
            type="button"
            onClick={() => setTab('docker')}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${
              tab === 'docker'
                ? 'bg-[#D96868] text-white'
                : 'text-[#5E645C] dark:text-[#A3AD9E] hover:text-[#252A24] dark:hover:text-[#F2F2F2]'
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
                ? 'bg-[#D96868] text-white'
                : 'text-[#5E645C] dark:text-[#A3AD9E] hover:text-[#252A24] dark:hover:text-[#F2F2F2]'
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
                ? 'bg-[#D96868] text-white'
                : 'text-[#5E645C] dark:text-[#A3AD9E] hover:text-[#252A24] dark:hover:text-[#F2F2F2]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android WebView</span>
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-[#252A24] border border-[#E3E1DC] dark:border-[#3C4738] text-[#F2F2F2] font-mono text-xs overflow-x-auto relative brutal-shadow-sm">
          <button
            type="button"
            onClick={copySnippet}
            className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-[#D96868] hover:bg-[#C45454] border border-[#F2F2F2]/60 text-white text-[11px] font-bold flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Disalin' : 'Salin'}</span>
          </button>
          <pre className="whitespace-pre-wrap leading-relaxed pr-16">{snippets[tab]}</pre>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5E645C] dark:text-[#A3AD9E]">
          <span>
            Endpoint aktif: <code className="font-mono font-bold text-[#D96868] dark:text-[#E58383]">{currentUrl}</code>
          </span>
          <span>
            Mode klien: <strong className="text-[#252A24] dark:text-[#F2F2F2]">{inAndroid ? 'Android WebView' : 'Web / PWA'}</strong>
          </span>
        </div>
      </div>
    </ModalShell>
  );
}
