import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  CheckCircle2,
  Database,
  Download,
  FileText,
  Film,
  Flag,
  LayoutDashboard,
  Lock,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  AdminOverviewPayload,
  AdminRole,
  AuditLogEntry,
  ChatRoom,
  ModerationReport,
  PlatformSettings,
  StoryItem,
  UserAccountStatus,
  UserProfile,
} from '../types/chat';
import { api } from '../lib/api';
import { formatTimeShort } from '../lib/androidBridge';
import { useAnimatedPresence, useRetainedValue } from '../lib/useAnimatedPresence';

type AdminMenu =
  | 'dashboard'
  | 'users'
  | 'moderation'
  | 'groups'
  | 'stories'
  | 'announcements'
  | 'server'
  | 'analytics'
  | 'settings'
  | 'audit';

const ADMIN_MENUS: Array<{ key: AdminMenu; label: string; icon: React.ReactNode }> = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: 'users', label: 'Users & Roles', icon: <Users className="w-4 h-4" /> },
  { key: 'moderation', label: 'Moderation & Reports', icon: <Flag className="w-4 h-4" /> },
  { key: 'groups', label: 'Groups & Channels', icon: <Shield className="w-4 h-4" /> },
  { key: 'stories', label: 'Stories & Media', icon: <Film className="w-4 h-4" /> },
  { key: 'announcements', label: 'Notifications & Announcements', icon: <Bell className="w-4 h-4" /> },
  { key: 'server', label: 'Server & Storage', icon: <Server className="w-4 h-4" /> },
  { key: 'analytics', label: 'Analytics & Reports', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'settings', label: 'Platform Settings', icon: <Settings className="w-4 h-4" /> },
  { key: 'audit', label: 'Audit Logs', icon: <FileText className="w-4 h-4" /> },
];

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  administrator: 'Administrator',
  moderator: 'Moderator',
  support: 'Support',
  server_operator: 'Server Operator',
  audit_viewer: 'Audit Viewer',
  user: 'User',
};

interface AdminPanelProps {
  open: boolean;
  token: string;
  currentUser: UserProfile;
  adminAuthState: {
    hasClaimedAdmin: boolean;
    envPasscodeConfigured: boolean;
  };
  onClose: () => void;
  onUserUpdated: (user: UserProfile) => void;
  onSettingsUpdated: (settings: PlatformSettings) => void;
  onNotify: (msg: string) => void;
}

export function AdminPanel({
  open,
  token,
  currentUser,
  adminAuthState,
  onClose,
  onUserUpdated,
  onSettingsUpdated,
  onNotify,
}: AdminPanelProps) {
  const [menu, setMenu] = useState<AdminMenu>('dashboard');
  const [passcode, setPasscode] = useState('');
  const [selectedRole, setSelectedRole] = useState<AdminRole>('super_admin');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [overview, setOverview] = useState<AdminOverviewPayload | null>(null);
  const [adminUsers, setAdminUsers] = useState<Array<UserProfile & { activeSessionsCount: number }>>([]);
  const [userSearch, setUserSearch] = useState('');
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [groups, setGroups] = useState<Array<ChatRoom & { messageCount: number; reportCount: number }>>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings | null>(null);

  const [announcementText, setAnnouncementText] = useState('');
  const [pinGlobalBanner, setPinGlobalBanner] = useState(true);
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    label: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const isAdmin = currentUser.role !== 'user';

  const refreshSection = useCallback(async () => {
    if (!open || !isAdmin) return;
    setLoading(true);
    try {
      const ov = await api.adminOverview(token);
      setOverview(ov);
      setSettingsDraft((prev) => prev || ov.settings);

      if (menu === 'users') {
        const res = await api.adminUsers(token, userSearch);
        setAdminUsers(res.users);
      } else if (menu === 'moderation') {
        const res = await api.adminReports(token);
        setReports(res.reports);
      } else if (menu === 'groups') {
        const res = await api.adminGroups(token);
        setGroups(res.groups);
      } else if (menu === 'stories') {
        const res = await api.adminStories(token);
        setStories(res.stories);
      } else if (menu === 'audit') {
        const res = await api.adminAuditLogs(token);
        setAuditLogs(res.logs);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal memuat data admin');
    } finally {
      setLoading(false);
    }
  }, [open, isAdmin, menu, token, userSearch, onNotify]);

  useEffect(() => {
    refreshSection();
  }, [refreshSection]);

  const { mounted, closing } = useAnimatedPresence(open, 210);
  const confirmRetained = useRetainedValue(confirmAction, 200);

  if (!mounted) return null;

  const needsInitialClaim =
    !adminAuthState.envPasscodeConfigured && !adminAuthState.hasClaimedAdmin;

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    try {
      const res = needsInitialClaim
        ? await api.adminClaim(token, passcode)
        : await api.adminUnlock(token, passcode, selectedRole);
      onUserUpdated(res.user);
      setPasscode('');
      onNotify(`Admin Panel terbuka (${ROLE_LABELS[res.user.role]})`);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Verifikasi admin gagal');
    } finally {
      setAuthBusy(false);
    }
  };

  const downloadJson = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Gate: Server-verified Admin Claim / Unlock Form
  if (!isAdmin) {
    return (
      <div
        className={`${
          closing ? 'p5-backdrop-out pointer-events-none' : 'p5-backdrop-in'
        } fixed inset-0 z-50 bg-[#252A24]/70 backdrop-blur-[2px] flex items-center justify-center p-4`}
      >
        <div
          className={`${
            closing ? 'p5-modal-out' : 'p5-modal-impact'
          } w-full max-w-md rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-lg overflow-hidden`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#E3E1DC] dark:border-[#364032] bg-[#F2F2F2] dark:bg-[#191E17]">
            <div className="flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-[#D96868] dark:text-[#E58383]" />
              <h2 className="font-display font-extrabold text-xl text-[#252A24] dark:text-[#F2F2F2]">
                {needsInitialClaim ? 'Klaim Awal Admin Tolk by Lunola' : 'Autentikasi Admin Panel'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog"
              className="h-8 w-8 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] bg-[#FBF9F6] dark:bg-[#2B3328] text-[#252A24] dark:text-[#F2F2F2] hover:bg-[#D96868] hover:text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAdminAuth} className="p-5 space-y-4">
            <p className="text-xs text-[#5E645C] dark:text-[#CBBBC2] leading-relaxed">
              {needsInitialClaim
                ? 'Belum ada kode sandi admin yang ditetapkan. Buat kode sandi Super Admin (minimal 8 karakter) untuk mengamankan Admin Panel; hash disimpan dengan scrypt di server dan dikunci setelah diklaim.'
                : 'Masukkan kode sandi admin server untuk membuka konsol manajemen dengan prinsip least-privilege RBAC.'}
            </p>

            <div>
              <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
                {needsInitialClaim ? 'Tetapkan Kode Sandi Admin Baru' : 'Kode Sandi Admin'}
              </label>
              <input
                type="password"
                required
                minLength={needsInitialClaim ? 8 : 6}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full h-10 px-3.5 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
              />
            </div>

            {!needsInitialClaim && (
              <div>
                <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">
                  Masuk Sebagai Role (Least Privilege)
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as AdminRole)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
                >
                  <option value="super_admin">Super Admin (Akses Penuh)</option>
                  <option value="administrator">Administrator (Platform & Pengguna)</option>
                  <option value="moderator">Moderator (Laporan & Moderasi)</option>
                  <option value="support">Support (Baca Terbatas)</option>
                  <option value="server_operator">Server Operator (Infrastruktur & Backup)</option>
                  <option value="audit_viewer">Audit Viewer (Log Read-Only)</option>
                </select>
              </div>
            )}

            {authError && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{authError}</p>}

            <button
              type="submit"
              disabled={authBusy}
              className="w-full h-11 rounded-xl bg-[#D96868] hover:bg-[#C45454] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm brutal-press text-white text-sm font-bold transition-colors"
            >
              {authBusy ? 'Memverifikasi...' : needsInitialClaim ? 'Klaim & Buka Admin Panel' : 'Buka Admin Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        closing ? 'p5-modal-out pointer-events-none' : 'p5-modal-impact'
      } fixed inset-0 z-50 bg-[#F2F2F2] dark:bg-[#151914] flex flex-col md:flex-row overflow-hidden`}
    >
      {/* Left Admin Navigation (10 Modules) */}
      <aside className="w-full md:w-64 shrink-0 bg-[#FBF9F6] dark:bg-[#1E241C] border-b-2 md:border-b-0 md:border-r-2 border-[#E3E1DC] dark:border-[#364032] flex flex-col">
        <div className="pt-safe-2 pb-2 px-3.5 min-h-16 flex items-center justify-between gap-2 border-b-2 border-[#E3E1DC] dark:border-[#364032] p5-maroon-banner shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="px-2 py-0.5 rounded-lg bg-[#FBF9F6] border border-[#E3E1DC] brutal-shadow-sm flex items-center gap-1.5">
                <img
                  src="/assets/aistudio/tolk-symbol-small_cb061777.svg"
                  alt="Tolk"
                  className="h-4 w-4 object-contain"
                />
                <img
                  src="/assets/aistudio/tolk-wordmark_36d1b947.svg"
                  alt="Tolk by Lunola"
                  className="h-4 w-auto object-contain"
                />
              </div>
              <span className="p5-skew inline-block px-1.5 py-0.5 bg-[#252A24] text-[#FBF9F6] text-[10px] font-display font-extrabold uppercase tracking-wider">
                <span className="p5-unskew">Admin</span>
              </span>
            </div>
            <div className="mt-1 text-[11px] font-mono font-bold text-white/90 truncate">
              {ROLE_LABELS[currentUser.role]}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Admin Panel"
            className="h-8 w-8 rounded-xl border border-[#F2F2F2] bg-[#252A24]/80 text-[#F2F2F2] hover:bg-[#252A24] flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex md:flex-col overflow-x-auto md:overflow-y-auto p-2.5 gap-1.5 thin-scrollbar">
          {ADMIN_MENUS.map((item) => {
            const active = menu === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setMenu(item.key)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-bold whitespace-nowrap shrink-0 transition-colors text-left brutal-press ${
                  active
                    ? 'bg-[#D96868] border-[#E3E1DC] dark:border-[#F2F2F2] text-white brutal-shadow-sm'
                    : 'border-transparent text-[#5E645C] dark:text-[#CBBBC2] hover:border-[#E3E1DC] dark:hover:border-[#3C4738] hover:bg-[#F2F2F2] dark:hover:bg-[#2B3328]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Admin Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 px-6 bg-[#FBF9F6] dark:bg-[#1E241C] border-b-2 border-[#E3E1DC] dark:border-[#364032] flex items-center justify-between gap-4 shrink-0">
          <div className="font-display font-extrabold text-lg text-[#252A24] dark:text-[#F2F2F2] truncate">
            Admin Panel / <span className="text-[#D96868] dark:text-[#E58383]">{ADMIN_MENUS.find((m) => m.key === menu)?.label}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={refreshSection}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] bg-[#F2F2F2] dark:bg-[#2B3328] text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] hover:bg-[#D96868] hover:text-white brutal-press"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto thin-scrollbar p-6">
          <div key={menu} className="p5-panel-reveal max-w-6xl mx-auto space-y-6">
            {/* 1. DASHBOARD */}
            {menu === 'dashboard' && overview && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard label="Total Pengguna" value={overview.metrics.totalUsers} sub={`DAU ${overview.metrics.dau} · MAU ${overview.metrics.mau}`} />
                  <KpiCard label="Total Pesan" value={overview.metrics.totalMessages} sub={`${overview.metrics.onlineNow} pengguna online`} />
                  <KpiCard label="Grup & Channel" value={overview.metrics.totalGroups + overview.metrics.totalChannels} sub={`${overview.metrics.activeStories} Stories 24j · ${overview.metrics.totalCalls} panggilan`} />
                  <KpiCard label="Laporan Terbuka" value={overview.metrics.openReports} sub={`RAM ${overview.server.memoryRssMb} MB · WS ${overview.server.wsConnections}`} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Live Activity Chart */}
                  <div className="lg:col-span-2 p-5 rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#364032] brutal-shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-display font-extrabold text-base text-[#252A24] dark:text-[#F2F2F2]">
                          Aktivitas Pesan 24 Jam Terakhir
                        </h3>
                        <p className="text-xs text-[#5E645C] dark:text-[#A3AD9E]">
                          Dihitung langsung dari riwayat pesan server
                        </p>
                      </div>
                      <Activity className="w-4 h-4 text-[#D96868] dark:text-[#E58383]" />
                    </div>
                    <div className="grid grid-cols-6 gap-3 items-end h-44 pt-4">
                      {overview.trafficSeries.map((pt) => {
                        const maxVal = Math.max(1, ...overview.trafficSeries.map((x) => x.messages));
                        const pct = Math.max(8, Math.round((pt.messages / maxVal) * 100));
                        return (
                          <div key={pt.label} className="flex flex-col items-center gap-2 h-full justify-end">
                            <span className="font-mono text-[11px] font-bold tabular-nums text-[#5E645C] dark:text-[#A3AD9E]">
                              {pt.messages}
                            </span>
                            <div
                              className="w-full rounded-t-[3px] bg-[#D96868] border border-[#E3E1DC] dark:border-[#F2F2F2] transition-all"
                              style={{ height: `${pct}%` }}
                            />
                            <span className="font-mono text-[11px] font-semibold text-[#5E645C] dark:text-[#A3AD9E]">{pt.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Infrastructure Health */}
                  <div className="p-5 rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#364032] brutal-shadow-sm space-y-3">
                    <h3 className="font-display font-extrabold text-base text-[#252A24] dark:text-[#F2F2F2]">
                      Status Layanan & Penyimpanan
                    </h3>
                    <StatusRow label="Engine" value={overview.server.tinodeMode} />
                    <StatusRow label="Runtime" value={overview.server.runtime} />
                    <StatusRow label="Uptime" value={`${overview.server.uptimeSec} detik`} />
                    <StatusRow label="Media Storage" value={`${overview.server.mediaStorageMb} MB (${overview.server.mediaFilesCount} file)`} />
                    <StatusRow label="Database Store" value={`${overview.server.storeSizeKb} KB`} />
                    <StatusRow label="TLS / HTTPS" value={overview.server.tlsStatus} />
                  </div>
                </div>
              </>
            )}

            {/* 2. USERS & ROLES */}
            {menu === 'users' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search className="w-4 h-4 text-[#5E645C] dark:text-[#A3AD9E] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Cari username, ID, atau email..."
                      className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
                    />
                  </div>
                  <div className="text-xs text-[#5E645C] dark:text-[#A3AD9E] font-mono font-bold tabular-nums">
                    {adminUsers.length} akun terdaftar
                  </div>
                </div>

                <div className="rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#364032] brutal-shadow-sm overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b-2 border-[#E3E1DC] dark:border-[#364032] bg-[#F2F2F2] dark:bg-[#191E17] text-[#5E645C] dark:text-[#A3AD9E]">
                      <tr>
                        <th className="py-3 px-4 font-bold uppercase tracking-wide">Pengguna</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wide">Role</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wide">Status</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wide text-right">Sesi</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wide text-right">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#111111]/15 dark:divide-[#364032]">
                      {adminUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-[#F2F2F2] dark:hover:bg-[#2B3328]">
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#252A24] dark:text-[#F2F2F2] flex items-center gap-1.5">
                              <span>{u.displayName}</span>
                              {u.verified && <CheckCircle2 className="w-3.5 h-3.5 text-[#D96868] dark:text-[#E58383]" />}
                            </div>
                            <div className="font-mono text-[11px] text-[#5E645C] dark:text-[#A3AD9E]">
                              @{u.username} · {u.id}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={u.role}
                              disabled={currentUser.role !== 'super_admin'}
                              onChange={async (e) => {
                                try {
                                  await api.adminUpdateUser(token, u.id, {
                                    role: e.target.value as AdminRole,
                                  });
                                  onNotify(`Role @${u.username} diperbarui`);
                                  refreshSection();
                                } catch (err) {
                                  onNotify(err instanceof Error ? err.message : 'Gagal ubah role');
                                }
                              }}
                              className="px-2 py-1 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-xs font-semibold"
                            >
                              {Object.entries(ROLE_LABELS).map(([k, label]) => (
                                <option key={k} value={k}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            <span
                              className={
                                u.status === 'active'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              {u.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                            {u.activeSessionsCount}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  await api.adminUpdateUser(token, u.id, { verified: !u.verified });
                                  refreshSection();
                                }}
                                className="px-2.5 py-1 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] font-bold hover:bg-[#D96868] hover:text-white"
                              >
                                {u.verified ? 'Batal Verifikasi' : 'Verifikasi'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmAction({
                                    label:
                                      u.status === 'active'
                                        ? `Suspend akun @${u.username} dan cabut semua sesi aktif?`
                                        : `Aktifkan kembali akun @${u.username}?`,
                                    onConfirm: async () => {
                                      const nextStatus: UserAccountStatus =
                                        u.status === 'active' ? 'suspended' : 'active';
                                      await api.adminUpdateUser(token, u.id, { status: nextStatus });
                                      onNotify(`Status @${u.username}: ${nextStatus}`);
                                      refreshSection();
                                    },
                                  })
                                }
                                className="px-2.5 py-1 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] font-bold hover:bg-[#D96868] hover:text-white"
                              >
                                {u.status === 'active' ? 'Suspend' : 'Aktifkan'}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const exported = await api.adminExportUser(token, u.id);
                                  downloadJson(`tolk-user-${u.username}.json`, exported);
                                  onNotify('Ekspor data pengguna diunduh');
                                }}
                                className="px-2.5 py-1 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] font-bold hover:bg-[#D96868] hover:text-white"
                              >
                                Ekspor
                              </button>
                              {u.id !== currentUser.id && u.id !== 'usr_pujo' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmAction({
                                      label: `Hapus permanen akun @${u.username}? Semua sesi dan data milik pengguna ini akan dihapus.`,
                                      onConfirm: async () => {
                                        await api.adminDeleteUser(token, u.id);
                                        onNotify(`Akun @${u.username} telah dihapus`);
                                        refreshSection();
                                      },
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] font-bold text-[#D96868] dark:text-[#FF8DA6] hover:bg-[#D96868] hover:text-white"
                                >
                                  Hapus
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. MODERATION & REPORTS */}
            {menu === 'moderation' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#364032] text-xs text-[#5E645C] dark:text-[#CBBBC2]">
                  Kebijakan Privasi Moderasi: Admin dan moderator hanya meninjau metadata serta konten yang dilaporkan secara eksplisit oleh pengguna, tanpa akses otomatis ke percakapan pribadi.
                </div>

                {reports.length === 0 ? (
                  <p className="text-sm text-[#5E645C] dark:text-[#A3AD9E] text-center py-10">
                    Antrean laporan kosong.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {reports.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-4 rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#364032] brutal-shadow-sm space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-bold text-[#252A24] dark:text-[#F2F2F2]">
                              {rep.targetLabel}
                            </div>
                            <div className="text-xs text-[#5E645C] dark:text-[#A3AD9E] mt-0.5">
                              Tipe: {rep.targetType} · Kategori: {rep.category} · Status:{' '}
                              <span className="font-mono font-bold text-[#D96868] dark:text-[#E58383]">
                                {rep.status}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono text-[11px] text-[#5E645C] dark:text-[#A3AD9E]">
                            {formatTimeShort(rep.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-[#252A24] dark:text-[#F2F2F2]">{rep.reason}</p>
                        {rep.moderatorNote && (
                          <div className="text-xs text-[#5E645C] dark:text-[#A3AD9E]">
                            Catatan moderator: {rep.moderatorNote}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              await api.adminUpdateReport(token, rep.id, {
                                status: 'reviewing',
                                moderatorNote: 'Sedang ditinjau oleh tim moderasi.',
                              });
                              refreshSection();
                            }}
                            className="px-3 py-1.5 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] text-xs font-bold hover:bg-[#F2F2F2] dark:hover:bg-[#2B3328]"
                          >
                            Tandai Reviewing
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await api.adminUpdateReport(token, rep.id, {
                                status: 'resolved',
                                resolution: 'Tidak ditemukan pelanggaran / selesai ditinjau.',
                              });
                              refreshSection();
                            }}
                            className="px-3 py-1.5 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] text-xs font-bold hover:bg-[#F2F2F2] dark:hover:bg-[#2B3328]"
                          >
                            Selesaikan (Resolved)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({
                                label: `Hapus konten / bekukan target laporan "${rep.targetLabel}"?`,
                                onConfirm: async () => {
                                  await api.adminUpdateReport(token, rep.id, {
                                    removeContent: true,
                                    moderatorNote: 'Ditindak sesuai kebijakan komunitas.',
                                  });
                                  onNotify('Konten bermasalah berhasil ditindak');
                                  refreshSection();
                                },
                              })
                            }
                            className="px-3 py-1.5 rounded-xl bg-[#D96868] hover:bg-[#C45454] border border-[#E3E1DC] dark:border-[#F2F2F2] text-white text-xs font-bold brutal-press"
                          >
                            Hapus / Bekukan Konten
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. GROUPS & CHANNELS */}
            {menu === 'groups' && (
              <div className="rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#364032] brutal-shadow-sm overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b-2 border-[#E3E1DC] dark:border-[#364032] bg-[#F2F2F2] dark:bg-[#191E17] text-[#5E645C] dark:text-[#A3AD9E]">
                    <tr>
                      <th className="py-3 px-4 font-bold uppercase tracking-wide">Nama</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wide">Tipe</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wide text-right">Anggota</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wide text-right">Pesan</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wide text-right">Status</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wide text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#111111]/15 dark:divide-[#364032]">
                    {groups.map((g) => (
                      <tr key={g.id} className="hover:bg-[#F2F2F2] dark:hover:bg-[#2B3328]">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#252A24] dark:text-[#F2F2F2]">{g.title}</div>
                          <div className="font-mono text-[11px] text-[#5E645C] dark:text-[#A3AD9E]">@{g.handle || g.id}</div>
                        </td>
                        <td className="py-3 px-4 capitalize font-semibold">{g.type}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">{g.memberIds.length}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">{g.messageCount}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {g.suspended ? 'Dibekukan' : 'Aktif'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              await api.adminUpdateGroup(token, g.id, { suspended: !g.suspended });
                              onNotify(`Status ${g.title} diperbarui`);
                              refreshSection();
                            }}
                            className="px-2.5 py-1 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] font-bold hover:bg-[#D96868] hover:text-white"
                          >
                            {g.suspended ? 'Aktifkan' : 'Bekukan'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 5. STORIES & MEDIA */}
            {menu === 'stories' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stories.length === 0 ? (
                  <p className="text-xs text-[#5E645C] dark:text-[#A3AD9E] col-span-full py-10 text-center">
                    Tidak ada Stories aktif saat ini.
                  </p>
                ) : (
                  stories.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#364032] brutal-shadow-sm flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-[#5E645C] dark:text-[#A3AD9E] mb-2">
                          <span className="font-mono font-bold">{s.kind} · {s.privacy}</span>
                          <span className="font-mono font-bold tabular-nums">{s.viewerIds.length} penonton</span>
                        </div>
                        <p className="text-sm font-medium text-[#252A24] dark:text-[#F2F2F2] line-clamp-3">
                          {s.text || 'Media status'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await api.adminDeleteStory(token, s.id);
                          onNotify('Status dihapus');
                          refreshSection();
                        }}
                        className="inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#D96868] text-[#D96868] dark:text-[#E58383] text-xs font-bold hover:bg-[#D96868] hover:text-white brutal-press"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Status</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 6. NOTIFICATIONS & ANNOUNCEMENTS */}
            {menu === 'announcements' && (
              <div className="max-w-xl p-5 rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#364032] brutal-shadow-sm space-y-4">
                <div>
                  <h3 className="font-display font-extrabold text-base text-[#252A24] dark:text-[#F2F2F2]">
                    Kirim Pengumuman Resmi Tolk by Lunola
                  </h3>
                  <p className="text-xs text-[#5E645C] dark:text-[#A3AD9E] mt-0.5">
                    Pesan akan disiarkan ke Channel Resmi Tolk by Lunola dan opsional disematkan sebagai banner global.
                  </p>
                </div>
                <textarea
                  rows={4}
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="Tulis pengumuman resmi atau info pemeliharaan sistem..."
                  className="w-full p-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2] focus:outline-none focus:border-[#D96868]"
                />
                <label className="flex items-center gap-2 text-xs font-semibold text-[#252A24] dark:text-[#F2F2F2]">
                  <input
                    type="checkbox"
                    checked={pinGlobalBanner}
                    onChange={(e) => setPinGlobalBanner(e.target.checked)}
                    className="accent-[#D96868]"
                  />
                  <span>Tampilkan juga sebagai banner pengumuman global di aplikasi</span>
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    if (!announcementText.trim()) return;
                    const res = await api.adminSendAnnouncement(token, announcementText.trim(), pinGlobalBanner);
                    onSettingsUpdated(res.settings);
                    setAnnouncementText('');
                    onNotify('Pengumuman resmi berhasil disiarkan');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#D96868] hover:bg-[#C45454] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm brutal-press text-white text-xs font-bold"
                >
                  Siarkan Pengumuman
                </button>
              </div>
            )}

            {/* 7. SERVER & STORAGE */}
            {menu === 'server' && overview && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#364032] brutal-shadow-sm space-y-3">
                  <h3 className="font-display font-extrabold text-base text-[#252A24] dark:text-[#F2F2F2]">
                    Kesehatan Server & Infrastruktur
                  </h3>
                  <StatusRow label="Layanan Chat" value={overview.server.tinodeMode} />
                  <StatusRow label="Koneksi WebSocket Aktif" value={String(overview.server.wsConnections)} />
                  <StatusRow label="CPU Cores & Load (1m)" value={`${overview.server.cpuCores} core · load ${overview.server.loadAvg1m}`} />
                  <StatusRow label="Memori RSS / Heap" value={`${overview.server.memoryRssMb} MB / ${overview.server.memoryHeapMb} MB`} />
                  <StatusRow label="Rate Limit Diblokir" value={`${overview.server.rateLimitBlocked} permintaan`} />
                  <StatusRow label="WebRTC STUN / TURN" value={overview.server.turnStunStatus} />
                  <StatusRow label="Domain & Sertifikat TLS" value={overview.server.tlsStatus} />
                </div>

                <div className="p-5 rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#364032] brutal-shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#D96868] dark:text-[#E58383]" />
                    <h3 className="font-display font-extrabold text-base text-[#252A24] dark:text-[#F2F2F2]">
                      Penyimpanan Media & Backup
                    </h3>
                  </div>
                  <StatusRow label="Total File Media" value={`${overview.server.mediaFilesCount} file (${overview.server.mediaStorageMb} MB)`} />
                  <StatusRow label="Ukuran Database Store" value={`${overview.server.storeSizeKb} KB`} />
                  <StatusRow
                    label="Backup Terakhir"
                    value={
                      overview.server.lastBackupAt
                        ? formatTimeShort(overview.server.lastBackupAt)
                        : 'Belum pernah diekspor'
                    }
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const data = await api.adminBackup(token);
                      downloadJson(`tolk-by-lunola-backup-${Date.now()}.json`, data);
                      onNotify('Backup database (tanpa kredensial) berhasil diunduh');
                      refreshSection();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D96868] hover:bg-[#C45454] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm brutal-press text-white text-xs font-bold"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Snapshot Backup JSON</span>
                  </button>
                </div>
              </div>
            )}

            {/* 8. ANALYTICS & REPORTS */}
            {menu === 'analytics' && overview && (
              <div className="p-5 rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#364032] brutal-shadow-sm space-y-4">
                <h3 className="font-display font-extrabold text-base text-[#252A24] dark:text-[#F2F2F2]">
                  Ringkasan Pertumbuhan & Aktivitas Platform
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <KpiCard label="Akun Baru (24j)" value={overview.metrics.newUsersToday} sub="Registrasi harian" />
                  <KpiCard label="DAU / MAU" value={`${overview.metrics.dau} / ${overview.metrics.mau}`} sub="Retensi aktif" />
                  <KpiCard label="Total Panggilan" value={overview.metrics.totalCalls} sub="Suara & Video WebRTC" />
                  <KpiCard label="Stories Aktif" value={overview.metrics.activeStories} sub="Siklus 24 jam" />
                </div>
              </div>
            )}

            {/* 9. PLATFORM SETTINGS */}
            {menu === 'settings' && settingsDraft && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const res = await api.adminUpdateSettings(token, settingsDraft);
                    onSettingsUpdated(res.settings);
                    setSettingsDraft(res.settings);
                    onNotify('Pengaturan platform disimpan');
                  } catch (err) {
                    onNotify(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan');
                  }
                }}
                className="max-w-2xl p-5 rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#364032] brutal-shadow-sm space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">Nama Aplikasi / Branding</label>
                    <input
                      type="text"
                      value={settingsDraft.appName}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, appName: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">Batas Ukuran Upload (MB)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={settingsDraft.maxUploadMb}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, maxUploadMb: Number(e.target.value) })
                      }
                      className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm font-mono text-[#252A24] dark:text-[#F2F2F2]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">Durasi Stories (Jam)</label>
                    <input
                      type="number"
                      min={1}
                      max={72}
                      value={settingsDraft.storyExpiryHours}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, storyExpiryHours: Number(e.target.value) })
                      }
                      className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm font-mono text-[#252A24] dark:text-[#F2F2F2]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">Rate Limit (Req / Menit)</label>
                    <input
                      type="number"
                      min={20}
                      max={1000}
                      value={settingsDraft.rateLimitPerMin}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, rateLimitPerMin: Number(e.target.value) })
                      }
                      className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm font-mono text-[#252A24] dark:text-[#F2F2F2]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] mb-1">Banner Pengumuman Global</label>
                  <input
                    type="text"
                    value={settingsDraft.globalAnnouncement}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, globalAnnouncement: e.target.value })
                    }
                    placeholder="Kosongkan jika tidak ada banner aktif"
                    className="w-full h-10 px-3 rounded-xl bg-[#F2F2F2] dark:bg-[#2B3328] border border-[#E3E1DC] dark:border-[#3C4738] text-sm text-[#252A24] dark:text-[#F2F2F2]"
                  />
                </div>

                <div className="space-y-2 pt-1 text-xs font-semibold">
                  <label className="flex items-center gap-2 text-[#252A24] dark:text-[#F2F2F2]">
                    <input
                      type="checkbox"
                      checked={settingsDraft.allowRegistration}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, allowRegistration: e.target.checked })
                      }
                      className="accent-[#D96868]"
                    />
                    <span>Izinkan pendaftaran akun baru</span>
                  </label>
                  <label className="flex items-center gap-2 text-[#252A24] dark:text-[#F2F2F2]">
                    <input
                      type="checkbox"
                      checked={settingsDraft.pushEnabled}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, pushEnabled: e.target.checked })
                      }
                      className="accent-[#D96868]"
                    />
                    <span>Aktifkan Push Notification Web & Android</span>
                  </label>
                  <label className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold">
                    <input
                      type="checkbox"
                      checked={settingsDraft.maintenanceMode}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, maintenanceMode: e.target.checked })
                      }
                      className="accent-[#D96868]"
                    />
                    <span>Maintenance Mode (tampilkan pemberitahuan pemeliharaan)</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#D96868] hover:bg-[#C45454] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm brutal-press text-white text-xs font-bold"
                >
                  Simpan Pengaturan Platform
                </button>
              </form>
            )}

            {/* 10. AUDIT LOGS */}
            {menu === 'audit' && (
              <div className="rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#364032] brutal-shadow-sm overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b-2 border-[#E3E1DC] dark:border-[#364032] bg-[#F2F2F2] dark:bg-[#191E17] text-[#5E645C] dark:text-[#A3AD9E]">
                    <tr>
                      <th className="py-3 px-4 font-bold uppercase tracking-wide">Waktu</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wide">Aktor</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wide">Tindakan</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wide">Target</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wide">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#111111]/15 dark:divide-[#364032]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F2F2F2] dark:hover:bg-[#2B3328]">
                        <td className="py-2.5 px-4 font-mono tabular-nums text-[#5E645C] dark:text-[#A3AD9E] whitespace-nowrap">
                          {formatTimeShort(log.createdAt)}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-[#252A24] dark:text-[#F2F2F2] font-semibold">
                          {log.actorName} <span className="font-mono text-[#5E645C] dark:text-[#A3AD9E]">({log.actorRole})</span>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-[#D96868] dark:text-[#E58383] whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-[#252A24] dark:text-[#F2F2F2]">{log.target}</td>
                        <td className="py-2.5 px-4 text-[#5E645C] dark:text-[#A3AD9E]">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* High-Risk Action Re-Confirmation Modal */}
      {confirmRetained.renderedValue && (
        <div
          className={`${
            confirmRetained.closing ? 'p5-backdrop-out pointer-events-none' : 'p5-backdrop-in'
          } fixed inset-0 z-50 bg-[#252A24]/70 flex items-center justify-center p-4`}
        >
          <div
            className={`${
              confirmRetained.closing ? 'p5-modal-out' : 'p5-modal-impact'
            } w-full max-w-sm rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#F2F2F2] p-5 space-y-4 brutal-shadow-lg`}
          >
            <h3 className="font-display font-extrabold text-lg text-[#252A24] dark:text-[#F2F2F2]">
              Konfirmasi Tindakan Admin
            </h3>
            <p className="text-xs text-[#5E645C] dark:text-[#CBBBC2] leading-relaxed">
              {confirmRetained.renderedValue.label}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-3.5 py-2 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] text-xs font-bold text-[#252A24] dark:text-[#F2F2F2] hover:bg-[#F2F2F2] dark:hover:bg-[#2B3328] brutal-press"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = confirmRetained.renderedValue;
                  setConfirmAction(null);
                  if (target) await target.onConfirm();
                }}
                className="px-3.5 py-2 rounded-xl bg-[#D96868] hover:bg-[#C45454] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm brutal-press text-white text-xs font-bold"
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub: string;
}) {
  return (
    <div className="p-4 rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#364032] brutal-shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-[#5E645C] dark:text-[#A3AD9E]">{label}</div>
      <div className="mt-1.5 font-display font-extrabold text-3xl font-mono tabular-nums text-[#D96868] dark:text-[#E58383]">
        {value}
      </div>
      <div className="mt-1 text-[11px] font-medium text-[#5E645C] dark:text-[#A3AD9E] truncate">{sub}</div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#252A24]/15 dark:border-[#364032] last:border-0 text-xs">
      <span className="text-[#5E645C] dark:text-[#A3AD9E] font-medium">{label}</span>
      <span className="font-mono font-bold text-[#252A24] dark:text-[#F2F2F2] text-right truncate max-w-[60%]">
        {value}
      </span>
    </div>
  );
}
