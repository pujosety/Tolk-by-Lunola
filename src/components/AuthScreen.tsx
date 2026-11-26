import { useState } from 'react';
import { ArrowRight, Lock, Mail, ShieldCheck, User, UserPlus } from 'lucide-react';

interface AuthScreenProps {
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

export function AuthScreen({ onLogin, onRegister, notice }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="h-full w-full overflow-y-auto chat-canvas-bg text-[#252A24] dark:text-[#F2F2F2] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[440px] p5-modal-impact">
        {/* Official Tolk by Lunola Brand Header */}
        <div className="flex flex-col items-center mb-5">
          <div className="px-6 py-4 rounded-3xl bg-[#FBF9F6] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-lg flex items-center justify-center">
            <img
              src="/assets/aistudio/tolk-horizontal_7a55fc8d.svg"
              alt="Tolk by Lunola"
              className="h-11 w-auto object-contain select-none"
            />
          </div>
          <p className="mt-3 text-xs font-mono font-bold tracking-wide text-[#5E645C] dark:text-[#B7C0B3] text-center">
            Komunikasi Real-Time · Web, PWA & Android
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-lg overflow-hidden">
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 border-b-2 border-[#E3E1DC] dark:border-[#364032] bg-[#F2F2F2] dark:bg-[#191E17]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`py-3 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors border-r border-[#E3E1DC] dark:border-[#364032] ${
                mode === 'login'
                  ? 'bg-[#D96868] text-[#FBF9F6]'
                  : 'text-[#5E645C] dark:text-[#A3AD9E] hover:bg-[#EDE6DA] dark:hover:bg-[#1F1822]'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Masuk Akun
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`py-3 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'register'
                  ? 'bg-[#D96868] text-[#FBF9F6]'
                  : 'text-[#5E645C] dark:text-[#A3AD9E] hover:bg-[#EDE6DA] dark:hover:bg-[#1F1822]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Daftar Baru
            </button>
          </div>

          <div className="p-5 sm:p-6">
            {notice && (
              <div className="mb-4 px-3 py-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/50 border border-[#E3E1DC] dark:border-amber-500/60 text-xs font-semibold text-[#252A24] dark:text-amber-200">
                {notice}
              </div>
            )}

            <div className="mb-4">
              <h1 className="font-display font-extrabold text-xl leading-tight">
                {mode === 'login' ? 'Selamat Datang Kembali' : 'Buat Akun Tolk by Lunola'}
              </h1>
              <p className="mt-1 text-xs text-[#5E645C] dark:text-[#A3AD9E]">
                {mode === 'login'
                  ? 'Masuk dengan username atau email Anda untuk mulai berkirim pesan.'
                  : 'Daftar akun pribadi untuk chat, grup, panggilan suara/video, dan Stories 24 jam.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-bold mb-1">Nama Tampilan</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={48}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Nama lengkap atau panggilan"
                      className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm focus:outline-none focus:border-[#D96868]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Email <span className="font-normal text-[#6B5F64] dark:text-[#A39199]">(opsional)</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#6B5F64] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@domain.com"
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm focus:outline-none focus:border-[#D96868]"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold mb-1">
                  {mode === 'login' ? 'Username atau Email' : 'Username'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#6B5F64] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={mode === 'login' ? 'username atau nama@domain.com' : 'huruf_angka_garisbawah'}
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm font-mono focus:outline-none focus:border-[#D96868]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Kata Sandi</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#6B5F64] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    maxLength={128}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm focus:outline-none focus:border-[#D96868]"
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Bio Singkat <span className="font-normal text-[#6B5F64] dark:text-[#A39199]">(opsional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={140}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Ceritakan sedikit tentang Anda"
                    className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm focus:outline-none focus:border-[#D96868]"
                  />
                </div>
              )}

              {error && (
                <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-600 text-xs font-bold text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 rounded-xl bg-[#D96868] hover:bg-[#C45454] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm brutal-press text-[#FBF9F6] text-sm font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <span>{busy ? 'Memproses...' : mode === 'login' ? 'Masuk Sekarang' : 'Buat Akun'}</span>
                {!busy && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            <div className="mt-4 pt-3.5 border-t border-[#E6DFD3] dark:border-[#2E222A] flex items-center gap-2 text-[11px] text-[#6B5F64] dark:text-[#A39199]">
              <ShieldCheck className="w-4 h-4 text-[#D96868] dark:text-[#E58383] shrink-0" />
              <span>Akses publik memerlukan akun terdaftar. Kata sandi dienkripsi di server.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
