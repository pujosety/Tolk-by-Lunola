import { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  MessageCircleHeart,
  Moon,
  PhoneCall,
  Sparkles,
  Sun,
  UserPlus,
} from 'lucide-react';

interface AuthScreenProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onLogin: (payload: { username: string; password: string }) => Promise<void>;
  onRegister: (payload: {
    username: string;
    displayName: string;
    email?: string;
    password: string;
    bio?: string;
  }) => Promise<void>;
  notice?: string | null;
}

export function AuthScreen({
  darkMode,
  onToggleDarkMode,
  onLogin,
  onRegister,
  notice,
}: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await onLogin({ username, password });
      } else {
        await onRegister({ username, displayName, email, password, bio });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autentikasi gagal. Periksa kembali data Anda.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative h-full w-full overflow-y-auto chat-canvas-bg text-[#161B26] dark:text-[#F5F7FA] flex flex-col">
      {/* Top-Right Theme Toggle */}
      <div className="pt-safe-3 px-4 sm:px-6 flex justify-end shrink-0 z-10">
        <button
          type="button"
          onClick={onToggleDarkMode}
          aria-label={darkMode ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
          className="h-10 w-10 rounded-2xl border border-[#E6ECF2] dark:border-[#2A364B] bg-[#FFFFFF] dark:bg-[#171E2C] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-shadow-sm brutal-press flex items-center justify-center"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Centered Split 3D Pastel Card */}
      <div className="flex-1 flex items-center justify-center px-4 pt-2 pb-safe-3 sm:p-6">
        <div className="w-full max-w-[880px] p5-modal-impact grid grid-cols-1 md:grid-cols-12 rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-white/80 dark:border-[#2A364B] brutal-shadow-lg overflow-hidden">
          {/* Left Panel: Strong Branding & Fun 3D Pastel Chat Showcase */}
          <div className="md:col-span-5 p-6 sm:p-7 p5-maroon-banner text-white flex flex-col justify-between gap-6 relative overflow-hidden">
            {/* Soft 3D ambient spheres */}
            <div className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/15 blur-xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 w-40 h-40 rounded-full bg-[#F59B00]/35 blur-xl" />

            <div className="relative z-10">
              <div className="inline-flex items-center px-4 py-2.5 rounded-2xl bg-[#FFFFFF] border border-white/80 brutal-shadow-sm">
                <img
                  src="/assets/aistudio/tolk-horizontal_7a55fc8d.svg"
                  alt="Tolk by Lunola"
                  className="h-8 w-auto object-contain select-none"
                />
              </div>

              <h1 className="mt-5 font-display font-extrabold text-2xl sm:text-3xl leading-tight tracking-tight text-white">
                Ngobrol Lebih Seru, Cepat &amp; Dekat.
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-white/90 leading-relaxed">
                Ruang obrolan hangat untuk chat personal, grup seru, panggilan suara/video, dan Stories 24 jam.
              </p>
            </div>

            {/* Playful 3D Pastel Mini Chat Preview */}
            <div className="relative z-10 hidden sm:flex flex-col gap-2.5 p-3.5 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25">
              <div className="self-start max-w-[85%] px-3.5 py-2 rounded-2xl rounded-bl-md bg-[#FFFFFF] text-[#161B26] text-xs font-medium brutal-shadow-sm">
                Lagi pada di mana nih? Ayo kumpul!
              </div>
              <div className="self-end max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-md bg-[#BEDEFF] text-[#161B26] text-xs font-bold brutal-shadow-sm">
                Udah online di Tolk, langsung gas!
              </div>
              <div className="self-start inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF2A7] text-[#161B26] text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-[#F59B00] animate-pulse" />
                <span>Sedang mengetik...</span>
              </div>
            </div>

            {/* Feature Pills */}
            <div className="relative z-10 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 border border-white/30 text-[11px] font-bold">
                <MessageCircleHeart className="w-3.5 h-3.5" />
                Chat Real-Time
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 border border-white/30 text-[11px] font-bold">
                <PhoneCall className="w-3.5 h-3.5" />
                Panggilan HD
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 border border-white/30 text-[11px] font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                Stories 24 Jam
              </span>
            </div>
          </div>

          {/* Right Panel: Clean 3D Pastel Auth Form */}
          <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center">
            {/* 3D Pill Mode Switcher */}
            <div className="flex rounded-2xl bg-[#F5F7FA] dark:bg-[#0F141E] border border-[#E6ECF2] dark:border-[#2A364B] p-1.5 mb-5 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  mode === 'login'
                    ? 'bg-[#8C0027] text-white brutal-shadow-sm'
                    : 'text-[#5A6578] dark:text-[#94A3B8] hover:text-[#161B26] dark:hover:text-[#F5F7FA]'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Masuk Akun</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  mode === 'register'
                    ? 'bg-[#8C0027] text-white brutal-shadow-sm'
                    : 'text-[#5A6578] dark:text-[#94A3B8] hover:text-[#161B26] dark:hover:text-[#F5F7FA]'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Daftar Baru</span>
              </button>
            </div>

            {notice && (
              <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-[#FFF9D6] dark:bg-[#232C1E] border border-[#BEDEFF]/40 text-xs font-semibold text-[#161B26] dark:text-[#E2E8F0]">
                {notice}
              </div>
            )}

            <div className="mb-4">
              <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[#161B26] dark:text-[#F5F7FA]">
                {mode === 'login' ? 'Selamat Datang Kembali!' : 'Gabung ke Tolk by Lunola'}
              </h2>
              <p className="mt-1 text-xs text-[#5A6578] dark:text-[#94A3B8]">
                {mode === 'login'
                  ? 'Masuk dengan akun Anda untuk melanjutkan obrolan.'
                  : 'Buat akun baru dan mulai terhubung dalam hitungan detik.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'register' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
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
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
                    />
                  </div>
                </div>
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
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] text-sm font-mono text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
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
                    className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#5A6578] dark:text-[#94A3B8] hover:text-[#8C0027]"
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
                    className="w-full h-11 px-3.5 rounded-xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
                  />
                </div>
              )}

              {error && (
                <div className="px-3.5 py-2.5 rounded-xl bg-[#EAF4FF] dark:bg-[#1B2436] border border-[#8C0027]/40 text-xs font-semibold text-[#6E001F] dark:text-[#F47296]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full h-12 rounded-2xl bg-[#8C0027] hover:bg-[#6E001F] text-white brutal-shadow-maroon brutal-press p5-slash-btn text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>
                  {busy
                    ? 'Memproses...'
                    : mode === 'register'
                      ? 'Buat Akun Sekarang'
                      : 'Masuk ke Tolk'}
                </span>
                {!busy && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
