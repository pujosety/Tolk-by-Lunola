import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  MessageCircleHeart,
  Moon,
  PhoneCall,
  QrCode,
  RefreshCw,
  Sparkles,
  Sun,
  UserPlus,
} from 'lucide-react';
import { api } from '../lib/api';
import { QrCodeBox } from './QrCodeBox';

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
  onQrLoginSuccess?: (token: string) => Promise<void>;
  notice?: string | null;
}

const SPRING_MORPH = { type: 'spring' as const, stiffness: 380, damping: 32, mass: 0.9 };

export function AuthScreen({
  darkMode,
  onToggleDarkMode,
  onLogin,
  onRegister,
  onQrLoginSuccess,
  notice,
}: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'qr'>('login');
  const [qrChallenge, setQrChallenge] = useState<{
    challengeId: string;
    secret: string;
    expiresAt: number;
  } | null>(null);
  const [qrExpired, setQrExpired] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);

  const loadQrChallenge = useCallback(async () => {
    setQrLoading(true);
    setQrExpired(false);
    try {
      const next = await api.createQrLogin();
      setQrChallenge(next);
    } catch {
      setQrExpired(true);
    } finally {
      setQrLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== 'qr' || qrExpired) return;
    if (!qrChallenge) {
      void loadQrChallenge();
      return;
    }
    const timer = window.setInterval(() => {
      void api
        .pollQrLogin(qrChallenge.challengeId, qrChallenge.secret)
        .then((res) => {
          if (res.status === 'expired') {
            setQrExpired(true);
          } else if (res.status === 'approved' && res.token) {
            window.clearInterval(timer);
            void onQrLoginSuccess?.(res.token);
          }
        })
        .catch(() => {});
    }, 2000);
    return () => window.clearInterval(timer);
  }, [mode, qrChallenge, qrExpired, loadQrChallenge, onQrLoginSuccess]);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const syncViewport = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height));
      setKeyboardInset(inset > 90 ? inset : 0);
    };
    syncViewport();
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    return () => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
    };
  }, []);

  const isMobileKeyboardOpen = keyboardInset > 90 || isInputFocused;

  const handleFormFocusCapture = (e: React.FocusEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
    setIsInputFocused(true);
    window.setTimeout(() => {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 150);
  };

  const handleFormBlurCapture = (e: React.FocusEvent<HTMLFormElement>) => {
    const next = e.relatedTarget as HTMLElement | null;
    if (next && e.currentTarget.contains(next)) return;
    window.setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
        setIsInputFocused(false);
      }
    }, 120);
  };

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
    <div
      style={keyboardInset > 0 ? { paddingBottom: `${keyboardInset + 20}px` } : undefined}
      className="relative h-full w-full overflow-y-auto chat-canvas-bg text-[#161B26] dark:text-[#F5F7FA] flex flex-col px-safe transition-[padding-bottom] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]"
    >
      {/* Top-Right Theme Toggle */}
      <div className="pt-safe-3 px-4 sm:px-6 flex justify-end shrink-0 z-10">
        <motion.button
          type="button"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={onToggleDarkMode}
          aria-label={darkMode ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
          className="h-10 w-10 rounded-2xl border border-[#E6ECF2] dark:border-[#2A364B] bg-[#FFFFFF] dark:bg-[#171E2C] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-shadow-sm flex items-center justify-center"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </motion.button>
      </div>

      {/* Centered Split Morphing Card */}
      <div
        className={`flex-1 flex justify-center px-4 pb-safe-3 sm:p-6 md:items-center ${
          isMobileKeyboardOpen ? 'items-start pt-1' : 'items-center pt-2'
        }`}
      >
        <motion.div
          layout
          transition={SPRING_MORPH}
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-full max-w-[880px] grid grid-cols-1 md:grid-cols-12 rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-white/80 dark:border-[#2A364B] brutal-shadow-lg overflow-hidden"
        >
          {/* Left Panel: Strong Branding & Fun Animated Chat Showcase (collapses on mobile when keyboard opens so form moves up) */}
          <div
            className={`md:col-span-5 p-5 sm:p-7 p5-maroon-banner text-white flex-col justify-between gap-5 relative overflow-hidden ${
              isMobileKeyboardOpen ? 'hidden md:flex' : 'flex'
            }`}
          >
            <motion.div
              animate={{ y: [0, -10, 0], x: [0, 6, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/15 blur-xl"
            />
            <motion.div
              animate={{ y: [0, 8, 0], x: [0, -6, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
              className="pointer-events-none absolute -bottom-12 -left-10 w-40 h-40 rounded-full bg-[#F59B00]/35 blur-xl"
            />

            <div className="relative z-10">
              <div className="inline-flex items-center">
                <img
                  src="/assets/aistudio/tolk-horizontal_7a55fc8d.svg"
                  alt="Tolk by Lunola"
                  className="h-12 w-auto object-contain select-none brightness-0 invert"
                />
              </div>

              <h1 className="mt-5 font-display font-extrabold text-2xl sm:text-3xl leading-tight tracking-tight text-white">
                Tempat Ngumpul &amp; Ngobrol Tanpa Ribet.
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-white/90 leading-relaxed">
                DM temen, bikin grup circle, call suara/video, sampai update Story 24 jam dalam satu tempat.
              </p>
            </div>

            {/* Playful Animated Mini Chat Preview */}
            <div className="relative z-10 hidden sm:flex flex-col gap-2.5 p-3.5 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, ...SPRING_MORPH }}
                className="self-start max-w-[85%] px-3.5 py-2 rounded-2xl rounded-bl-md bg-[#FFFFFF] text-[#161B26] text-xs font-medium brutal-shadow-sm"
              >
                Lagi pada di mana nih? Ayo kumpul!
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, ...SPRING_MORPH }}
                className="self-end max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-md bg-[#BEDEFF] text-[#161B26] text-xs font-bold brutal-shadow-sm"
              >
                Udah online di Tolk, langsung gas!
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, ...SPRING_MORPH }}
                className="self-start inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF2A7] text-[#161B26] text-[11px] font-bold"
              >
                <span className="w-2 h-2 rounded-full bg-[#F59B00] animate-pulse" />
                <span>lagi ngetik...</span>
              </motion.div>
            </div>

            {/* Feature Pills */}
            <div className="relative z-10 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 border border-white/30 text-[11px] font-bold">
                <MessageCircleHeart className="w-3.5 h-3.5" />
                Chat Instan
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 border border-white/30 text-[11px] font-bold">
                <PhoneCall className="w-3.5 h-3.5" />
                Call Jernih
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 border border-white/30 text-[11px] font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                Story 24 Jam
              </span>
            </div>
          </div>

          {/* Right Panel: Morphing Auth Form */}
          <motion.div
            layout
            transition={SPRING_MORPH}
            className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center"
          >
            {/* Smooth Sliding Pill Mode Switcher */}
            <div className="relative grid grid-cols-2 md:grid-cols-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#0F141E] border border-[#E6ECF2] dark:border-[#2A364B] p-1.5 mb-5">
              <span
                aria-hidden="true"
                style={{
                  transform: `translate3d(${(mode === 'login' ? 0 : mode === 'register' ? 1 : 2) * 100}%, 0, 0)`,
                }}
                className="pointer-events-none absolute top-1.5 bottom-1.5 left-1.5 w-[calc((100%-12px)/2)] md:w-[calc((100%-12px)/3)] rounded-xl bg-[#8C0027] brutal-shadow-sm transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
              />
              {(['login', 'register', 'qr'] as const).map((tabKey) => {
                const active = mode === tabKey;
                return (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => {
                      setMode(tabKey);
                      setError('');
                      if (tabKey === 'qr' && qrExpired) {
                        setQrChallenge(null);
                        setQrExpired(false);
                      }
                    }}
                    className={`relative py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors duration-200 z-10 ${
                      active
                        ? 'text-white'
                        : 'text-[#5A6578] dark:text-[#94A3B8] hover:text-[#161B26] dark:hover:text-[#F5F7FA]'
                    } ${tabKey === 'qr' ? 'hidden md:flex' : ''}`}
                  >
                    {tabKey === 'login' ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Masuk</span>
                      </>
                    ) : tabKey === 'register' ? (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Daftar</span>
                      </>
                    ) : (
                      <>
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Login QR</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {notice && (
              <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-[#FFF9D6] dark:bg-[#232C1E] border border-[#BEDEFF]/40 text-xs font-semibold text-[#161B26] dark:text-[#E2E8F0]">
                {notice}
              </div>
            )}

            {/* Morphing Header Text */}
            <div className="mb-4 min-h-[54px]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                >
                  <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[#161B26] dark:text-[#F5F7FA]">
                    {mode === 'login'
                      ? 'Balik Lagi, Gas Ngobrol!'
                      : mode === 'register'
                        ? 'Bikin Akun Tolk'
                        : 'Masuk Cepat Pakai QR'}
                  </h2>
                  <p className="mt-1 text-xs text-[#5A6578] dark:text-[#94A3B8]">
                    {mode === 'login'
                      ? 'Masuk pakai username atau email kamu.'
                      : mode === 'register'
                        ? 'Bikin akun dulu biar bisa add temen dan mulai chat.'
                        : 'Scan kode QR ini dari menu Perangkat Tertaut di HP kamu.'}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {mode === 'qr' ? (
              <div className="flex flex-col items-center justify-center py-3 space-y-4">
                <div className="p-4 rounded-3xl bg-[#F5F7FA] dark:bg-[#0F141E] border border-[#E6ECF2] dark:border-[#2A364B] flex flex-col items-center gap-3">
                  {qrLoading || !qrChallenge ? (
                    <div className="w-[184px] h-[184px] rounded-2xl bg-[#E6ECF2]/60 dark:bg-[#1E2738] flex items-center justify-center text-xs text-[#5A6578] dark:text-[#94A3B8]">
                      Menyiapkan QR...
                    </div>
                  ) : qrExpired ? (
                    <div className="w-[184px] h-[184px] rounded-2xl bg-[#FFF9D6] dark:bg-[#1E2738] flex flex-col items-center justify-center gap-2.5 p-4 text-center">
                      <span className="text-xs font-bold text-[#161B26] dark:text-[#F1F5F9]">
                        QR kedaluwarsa
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setQrChallenge(null);
                          setQrExpired(false);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#8C0027] text-white text-xs font-bold flex items-center gap-1.5 brutal-press"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Muat Ulang</span>
                      </button>
                    </div>
                  ) : (
                    <QrCodeBox
                      value={`tolk-qr-login:${qrChallenge.challengeId}:${qrChallenge.secret}`}
                      label="Scan dari Tolk di HP"
                      size={184}
                    />
                  )}
                </div>
                <ol className="text-xs text-[#5A6578] dark:text-[#94A3B8] space-y-1 text-left w-full max-w-xs">
                  <li>1. Buka Tolk by Lunola di HP yang sudah login.</li>
                  <li>2. Masuk ke tab <strong>Kamu</strong> lalu pilih <strong>Perangkat Tertaut</strong>.</li>
                  <li>3. Ketuk <strong>Tautkan Perangkat (Scan QR)</strong> dan arahkan ke layar ini.</li>
                </ol>
              </div>
            ) : (

            <motion.form
              layout
              transition={SPRING_MORPH}
              onSubmit={handleSubmit}
              onFocusCapture={handleFormFocusCapture}
              onBlurCapture={handleFormBlurCapture}
              className="space-y-3.5"
            >
              <AnimatePresence initial={false}>
                {mode === 'register' && (
                  <motion.div
                    key="register-top-fields"
                    initial={{ opacity: 0, height: 0, y: -6 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -6 }}
                    transition={SPRING_MORPH}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-0.5">
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
                          className="w-full h-11 px-4 rounded-full bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027] transition-colors"
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
                          className="w-full h-11 px-4 rounded-full bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027] transition-colors"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div layout transition={SPRING_MORPH}>
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
                  className="w-full h-11 px-4 rounded-full bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] text-sm font-mono text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027] transition-colors"
                />
              </motion.div>

              <motion.div layout transition={SPRING_MORPH}>
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
                    className="w-full h-11 pl-4 pr-11 rounded-full bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027] transition-colors"
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
              </motion.div>

              <AnimatePresence initial={false}>
                {mode === 'register' && (
                  <motion.div
                    key="register-bio-field"
                    initial={{ opacity: 0, height: 0, y: -6 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -6 }}
                    transition={SPRING_MORPH}
                    className="overflow-hidden"
                  >
                    <div className="pb-0.5">
                      <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
                        Bio Singkat (opsional)
                      </label>
                      <input
                        type="text"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tulis bio singkat"
                        className="w-full h-11 px-4 rounded-full bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027] transition-colors"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    className="px-3.5 py-2.5 rounded-xl bg-[#EAF4FF] dark:bg-[#1B2436] border border-[#8C0027]/40 text-xs font-semibold text-[#6E001F] dark:text-[#F47296]"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                layout
                type="submit"
                disabled={busy}
                whileHover={{ y: -1.5 }}
                whileTap={{ scale: 0.975 }}
                transition={SPRING_MORPH}
                className="w-full h-12 rounded-2xl bg-[#8C0027] hover:bg-[#6E001F] text-white brutal-shadow-maroon p5-slash-btn text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={busy ? 'busy' : mode}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14 }}
                  >
                    {busy
                      ? 'Lagi proses...'
                      : mode === 'register'
                        ? 'Gabung Sekarang'
                        : 'Masuk Sekarang'}
                  </motion.span>
                </AnimatePresence>
                {!busy && <ArrowRight className="w-4 h-4" />}
              </motion.button>
            </motion.form>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
