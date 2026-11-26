import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
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

type AdminCategory = 'overview' | 'people' | 'moderation' | 'system';

const ADMIN_CATEGORIES: Array<{
  key: AdminCategory;
  shortLabel: string;
  label: string;
  icon: React.ReactNode;
  menus: AdminMenu[];
}> = [
  {
    key: 'overview',
    shortLabel: 'Ringkas',
    label: 'Ringkasan & Analitik',
    icon: <LayoutDashboard className="w-4 h-4" />,
    menus: ['dashboard', 'analytics'],
  },
  {
    key: 'people',
    shortLabel: 'Pengguna',
    label: 'Pengguna & Komunitas',
    icon: <Users className="w-4 h-4" />,
    menus: ['users', 'groups'],
  },
  {
    key: 'moderation',
    shortLabel: 'Moderasi',
    label: 'Moderasi & Konten',
    icon: <Flag className="w-4 h-4" />,
    menus: ['moderation', 'stories', 'announcements'],
  },
  {
    key: 'system',
    shortLabel: 'Sistem',
    label: 'Server, Pengaturan & Log',
    icon: <Server className="w-4 h-4" />,
    menus: ['server', 'settings', 'audit'],
  },
];

const ADMIN_MENUS: Array<{
  key: AdminMenu;
  category: AdminCategory;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}> = [
  { key: 'dashboard', category: 'overview', label: 'Dashboard', shortLabel: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: 'analytics', category: 'overview', label: 'Analytics & Reports', shortLabel: 'Analitik', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'users', category: 'people', label: 'Users & Roles', shortLabel: 'Pengguna', icon: <Users className="w-4 h-4" /> },
  { key: 'groups', category: 'people', label: 'Groups & Channels', shortLabel: 'Grup & Saluran', icon: <Shield className="w-4 h-4" /> },
  { key: 'moderation', category: 'moderation', label: 'Moderation & Reports', shortLabel: 'Laporan', icon: <Flag className="w-4 h-4" /> },
  { key: 'stories', category: 'moderation', label: 'Stories & Media', shortLabel: 'Status & Media', icon: <Film className="w-4 h-4" /> },
  { key: 'announcements', category: 'moderation', label: 'Notifications & Announcements', shortLabel: 'Pengumuman', icon: <Bell className="w-4 h-4" /> },
  { key: 'server', category: 'system', label: 'Server & Storage', shortLabel: 'Server', icon: <Server className="w-4 h-4" /> },
  { key: 'settings', category: 'system', label: 'Platform Settings', shortLabel: 'Pengaturan', icon: <Settings className="w-4 h-4" /> },
  { key: 'audit', category: 'system', label: 'Audit Logs', shortLabel: 'Audit Log', icon: <FileText className="w-4 h-4" /> },
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
  const [detailItem, setDetailItem] = useState<
    | { kind: 'user'; item: UserProfile & { activeSessionsCount: number } }
    | { kind: 'group'; item: ChatRoom & { messageCount: number; reportCount: number } }
    | { kind: 'audit'; item: AuditLogEntry }
    | null
  >(null);

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
        } fixed inset-0 z-50 bg-[#161B26]/70 backdrop-blur-[2px] flex items-center justify-center p-4`}
      >
        <div
          className={`${
            closing ? 'p5-modal-out' : 'p5-modal-impact'
          } w-full max-w-md rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-lg overflow-hidden`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#E6ECF2] dark:border-[#2A364B] bg-[#F5F7FA] dark:bg-[#131924]">
            <div className="flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-[#8C0027] dark:text-[#F47296]" />
              <h2 className="font-display font-extrabold text-xl text-[#161B26] dark:text-[#F5F7FA]">
                {needsInitialClaim ? 'Klaim Awal Admin Tolk by Lunola' : 'Autentikasi Admin Panel'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog"
              className="h-8 w-8 rounded-xl border border-[#E6ECF2] dark:border-[#324058] bg-[#FFFFFF] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAdminAuth} className="p-5 space-y-4">
            <p className="text-xs text-[#5A6578] dark:text-[#CBBBC2] leading-relaxed">
              {needsInitialClaim
                ? 'Belum ada kode sandi admin yang ditetapkan. Buat kode sandi Super Admin (minimal 8 karakter) untuk mengamankan Admin Panel; hash disimpan dengan scrypt di server dan dikunci setelah diklaim.'
                : 'Masukkan kode sandi admin server untuk membuka konsol manajemen dengan prinsip least-privilege RBAC.'}
            </p>

            <div>
              <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
                {needsInitialClaim ? 'Tetapkan Kode Sandi Admin Baru' : 'Kode Sandi Admin'}
              </label>
              <input
                type="password"
                required
                minLength={needsInitialClaim ? 8 : 6}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full h-10 px-3.5 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
              />
            </div>

            {!needsInitialClaim && (
              <div>
                <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">
                  Masuk Sebagai Role (Least Privilege)
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as AdminRole)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
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
              className="w-full h-11 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm brutal-press text-white text-sm font-bold transition-colors"
            >
              {authBusy ? 'Memverifikasi...' : needsInitialClaim ? 'Klaim & Buka Admin Panel' : 'Buka Admin Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeCategory: AdminCategory =
    ADMIN_MENUS.find((m) => m.key === menu)?.category || 'overview';
  const categorySubMenus = ADMIN_MENUS.filter((m) => m.category === activeCategory);

  return (
    <div
      className={`${
        closing ? 'p5-modal-out pointer-events-none' : 'p5-modal-impact'
      } fixed inset-0 z-50 bg-[#F5F7FA] dark:bg-[#0F141E] flex flex-col md:flex-row overflow-hidden`}
    >
      {/* Navigation: Left Sidebar on Desktop, Bottom Icon Bar on Mobile */}
      <aside className="order-last md:order-first w-full md:w-64 shrink-0 bg-[#FFFFFF] dark:bg-[#171E2C] border-t md:border-t-0 md:border-r border-[#E6ECF2] dark:border-[#2A364B] flex flex-col z-20">
        <div className="hidden md:flex pt-safe-2 pb-2 px-3.5 min-h-16 items-center justify-between gap-2 border-b border-[#E6ECF2] dark:border-[#2A364B] p5-maroon-banner shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="px-1 flex items-center gap-1.5">
                <img
                  src="/assets/aistudio/tolk-symbol-small_cb061777.svg"
                  alt="Tolk"
                  className="h-4 w-4 object-contain brightness-0 invert"
                />
                <img
                  src="/assets/aistudio/tolk-wordmark_36d1b947.svg"
                  alt="Tolk by Lunola"
                  className="h-4 w-auto object-contain brightness-0 invert"
                />
              </div>
              <span className="p5-skew inline-block px-1.5 py-0.5 bg-[#161B26] text-[#FFFFFF] text-[10px] font-display font-extrabold uppercase tracking-wider">
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
            className="h-8 w-8 rounded-xl border border-[#F5F7FA] bg-[#161B26]/80 text-[#F5F7FA] hover:bg-[#161B26] flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Desktop Classified Menu */}
        <nav className="hidden md:flex flex-col overflow-y-auto p-3 gap-4 thin-scrollbar flex-1">
          {ADMIN_CATEGORIES.map((cat) => (
            <div key={cat.key} className="space-y-1">
              <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#5A6578] dark:text-[#94A3B8]">
                {cat.label}
              </div>
              {ADMIN_MENUS.filter((m) => m.category === cat.key).map((item) => {
                const active = menu === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setMenu(item.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors text-left brutal-press ${
                      active
                        ? 'bg-[#8C0027] border-[#E6ECF2] dark:border-[#F5F7FA] text-white brutal-shadow-sm'
                        : 'border-transparent text-[#5A6578] dark:text-[#CBBBC2] hover:border-[#E6ECF2] dark:hover:border-[#324058] hover:bg-[#F5F7FA] dark:hover:bg-[#232D40]'
                    }`}
                  >
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Mobile 4-Category Labeled Bottom Tab Bar */}
        <nav className="md:hidden grid grid-cols-4 gap-1 px-2 pt-1.5 pb-safe-2 bg-[#FFFFFF]/95 dark:bg-[#171E2C]/95">
          {ADMIN_CATEGORIES.map((cat) => {
            const active = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setMenu(cat.menus[0])}
                className="py-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold"
              >
                <span
                  className={`px-3.5 py-1 rounded-full transition-colors ${
                    active
                      ? 'bg-[#8C0027] text-white brutal-shadow-sm'
                      : 'text-[#5A6578] dark:text-[#94A3B8]'
                  }`}
                >
                  {cat.icon}
                </span>
                <span className={active ? 'text-[#161B26] dark:text-white' : 'text-[#5A6578] dark:text-[#94A3B8]'}>
                  {cat.shortLabel}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Admin Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="pt-safe-2 pb-2 min-h-16 px-4 sm:px-6 bg-[#FFFFFF]/95 dark:bg-[#171E2C]/95 backdrop-blur-md shadow-[0_2px_12px_rgba(15,20,30,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.22)] flex items-center justify-between gap-3 shrink-0 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              aria-label="Kembali"
              className="md:hidden h-9 w-9 rounded-xl border border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] flex items-center justify-center shrink-0 brutal-press"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-base sm:text-lg text-[#161B26] dark:text-[#F5F7FA] truncate">
                Admin <span className="text-[#8C0027] dark:text-[#F47296]">· {ADMIN_MENUS.find((m) => m.key === menu)?.shortLabel}</span>
              </div>
              <div className="md:hidden text-[10px] font-mono text-[#5A6578] dark:text-[#94A3B8] truncate">
                {ROLE_LABELS[currentUser.role]}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={refreshSection}
              aria-label="Segarkan"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E6ECF2] dark:border-[#324058] bg-[#F5F7FA] dark:bg-[#232D40] text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white brutal-press"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          </div>
        </header>

        {/* Mobile Sub-Section Pills */}
        {categorySubMenus.length > 1 && (
          <div className="md:hidden px-4 py-2 flex items-center gap-1.5 overflow-x-auto thin-scrollbar bg-[#FFFFFF] dark:bg-[#171E2C] border-b border-[#E6ECF2] dark:border-[#2A364B] shrink-0">
            {categorySubMenus.map((sub) => {
              const active = menu === sub.key;
              return (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => setMenu(sub.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors shrink-0 ${
                    active
                      ? 'bg-[#FFF2A7] text-[#161B26] border border-[#F59B00]'
                      : 'bg-[#F5F7FA] dark:bg-[#232D40] text-[#5A6578] dark:text-[#CBD5E1] border border-transparent'
                  }`}
                >
                  {sub.icon}
                  <span>{sub.shortLabel}</span>
                </button>
              );
            })}
          </div>
        )}

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
                  <div className="lg:col-span-2 p-5 rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] brutal-shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA]">
                          Aktivitas Pesan 24 Jam Terakhir
                        </h3>
                        <p className="text-xs text-[#5A6578] dark:text-[#94A3B8]">
                          Dihitung langsung dari riwayat pesan server
                        </p>
                      </div>
                      <Activity className="w-4 h-4 text-[#8C0027] dark:text-[#F47296]" />
                    </div>
                    <div className="grid grid-cols-6 gap-3 items-end h-44 pt-4">
                      {overview.trafficSeries.map((pt) => {
                        const maxVal = Math.max(1, ...overview.trafficSeries.map((x) => x.messages));
                        const pct = Math.max(8, Math.round((pt.messages / maxVal) * 100));
                        return (
                          <div key={pt.label} className="flex flex-col items-center gap-2 h-full justify-end">
                            <span className="font-mono text-[11px] font-bold tabular-nums text-[#5A6578] dark:text-[#94A3B8]">
                              {pt.messages}
                            </span>
                            <div
                              className="w-full rounded-t-[3px] bg-[#8C0027] border border-[#E6ECF2] dark:border-[#F5F7FA] transition-all"
                              style={{ height: `${pct}%` }}
                            />
                            <span className="font-mono text-[11px] font-semibold text-[#5A6578] dark:text-[#94A3B8]">{pt.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Infrastructure Health */}
                  <div className="p-5 rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] brutal-shadow-sm space-y-3">
                    <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA]">
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
                    <Search className="w-4 h-4 text-[#5A6578] dark:text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Cari username, ID, atau email..."
                      className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
                    />
                  </div>
                  <div className="text-xs text-[#5A6578] dark:text-[#94A3B8] font-mono font-bold tabular-nums">
                    {adminUsers.length} akun terdaftar
                  </div>
                </div>

                <div className="space-y-2">
                  {adminUsers.map((u) => (
                    <div
                      key={u.id}
                      className="p-3.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#171E2C] shadow-[0_2px_12px_rgba(15,20,30,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-[#161B26] dark:text-[#F5F7FA] flex items-center gap-1.5 truncate">
                          <span className="truncate">{u.displayName}</span>
                          {u.verified && <CheckCircle2 className="w-3.5 h-3.5 text-[#8C0027] dark:text-[#F47296] shrink-0" />}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] font-mono text-[#5A6578] dark:text-[#94A3B8] truncate">
                          <span>@{u.username}</span>
                          <span>·</span>
                          <span className="font-semibold text-[#161B26] dark:text-[#E2E8F0]">{ROLE_LABELS[u.role]}</span>
                          <span>·</span>
                          <span className={u.status === 'active' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                            {u.status}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDetailItem({ kind: 'user', item: u })}
                        className="px-3.5 py-1.5 rounded-full bg-[#EAF4FF] dark:bg-[#1B2436] text-[#8C0027] dark:text-[#BEDEFF] hover:bg-[#8C0027] hover:text-white text-xs font-bold shrink-0 transition-colors brutal-press"
                      >
                        Detail
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. MODERATION & REPORTS */}
            {menu === 'moderation' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] text-xs text-[#5A6578] dark:text-[#CBBBC2]">
                  Kebijakan Privasi Moderasi: Admin dan moderator hanya meninjau metadata serta konten yang dilaporkan secara eksplisit oleh pengguna, tanpa akses otomatis ke percakapan pribadi.
                </div>

                {reports.length === 0 ? (
                  <p className="text-sm text-[#5A6578] dark:text-[#94A3B8] text-center py-10">
                    Antrean laporan kosong.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {reports.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-4 rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] brutal-shadow-sm space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-bold text-[#161B26] dark:text-[#F5F7FA]">
                              {rep.targetLabel}
                            </div>
                            <div className="text-xs text-[#5A6578] dark:text-[#94A3B8] mt-0.5">
                              Tipe: {rep.targetType} · Kategori: {rep.category} · Status:{' '}
                              <span className="font-mono font-bold text-[#8C0027] dark:text-[#F47296]">
                                {rep.status}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono text-[11px] text-[#5A6578] dark:text-[#94A3B8]">
                            {formatTimeShort(rep.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-[#161B26] dark:text-[#F5F7FA]">{rep.reason}</p>
                        {rep.moderatorNote && (
                          <div className="text-xs text-[#5A6578] dark:text-[#94A3B8]">
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
                            className="px-3 py-1.5 rounded-xl border border-[#E6ECF2] dark:border-[#324058] text-xs font-bold hover:bg-[#F5F7FA] dark:hover:bg-[#232D40]"
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
                            className="px-3 py-1.5 rounded-xl border border-[#E6ECF2] dark:border-[#324058] text-xs font-bold hover:bg-[#F5F7FA] dark:hover:bg-[#232D40]"
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
                            className="px-3 py-1.5 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] border border-[#E6ECF2] dark:border-[#F5F7FA] text-white text-xs font-bold brutal-press"
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
              <div className="space-y-2">
                {groups.map((g) => (
                  <div
                    key={g.id}
                    className="p-3.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#171E2C] shadow-[0_2px_12px_rgba(15,20,30,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-[#161B26] dark:text-[#F5F7FA] truncate">
                        {g.title}
                      </div>
                      <div className="mt-0.5 text-[11px] font-mono text-[#5A6578] dark:text-[#94A3B8] truncate">
                        @{g.handle || g.id} · <span className="capitalize">{g.type}</span> ·{' '}
                        <span className={g.suspended ? 'text-rose-600 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                          {g.suspended ? 'Dibekukan' : 'Aktif'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailItem({ kind: 'group', item: g })}
                      className="px-3.5 py-1.5 rounded-full bg-[#EAF4FF] dark:bg-[#1B2436] text-[#8C0027] dark:text-[#BEDEFF] hover:bg-[#8C0027] hover:text-white text-xs font-bold shrink-0 transition-colors brutal-press"
                    >
                      Detail
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 5. STORIES & MEDIA */}
            {menu === 'stories' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stories.length === 0 ? (
                  <p className="text-xs text-[#5A6578] dark:text-[#94A3B8] col-span-full py-10 text-center">
                    Tidak ada Stories aktif saat ini.
                  </p>
                ) : (
                  stories.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] brutal-shadow-sm flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-[#5A6578] dark:text-[#94A3B8] mb-2">
                          <span className="font-mono font-bold">{s.kind} · {s.privacy}</span>
                          <span className="font-mono font-bold tabular-nums">{s.viewerIds.length} penonton</span>
                        </div>
                        <p className="text-sm font-medium text-[#161B26] dark:text-[#F5F7FA] line-clamp-3">
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
                        className="inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#8C0027] text-[#8C0027] dark:text-[#F47296] text-xs font-bold hover:bg-[#8C0027] hover:text-white brutal-press"
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
              <div className="max-w-xl p-5 rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] brutal-shadow-sm space-y-4">
                <div>
                  <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA]">
                    Kirim Pengumuman Resmi Tolk by Lunola
                  </h3>
                  <p className="text-xs text-[#5A6578] dark:text-[#94A3B8] mt-0.5">
                    Pesan akan disiarkan ke Channel Resmi Tolk by Lunola dan opsional disematkan sebagai banner global.
                  </p>
                </div>
                <textarea
                  rows={4}
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="Tulis pengumuman resmi atau info pemeliharaan sistem..."
                  className="w-full p-3 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA] focus:outline-none focus:border-[#8C0027]"
                />
                <label className="flex items-center gap-2 text-xs font-semibold text-[#161B26] dark:text-[#F5F7FA]">
                  <input
                    type="checkbox"
                    checked={pinGlobalBanner}
                    onChange={(e) => setPinGlobalBanner(e.target.checked)}
                    className="accent-[#8C0027]"
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
                  className="px-5 py-2.5 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm brutal-press text-white text-xs font-bold"
                >
                  Siarkan Pengumuman
                </button>
              </div>
            )}

            {/* 7. SERVER & STORAGE */}
            {menu === 'server' && overview && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] brutal-shadow-sm space-y-3">
                  <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA]">
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

                <div className="p-5 rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] brutal-shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#8C0027] dark:text-[#F47296]" />
                    <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA]">
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
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm brutal-press text-white text-xs font-bold"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Snapshot Backup JSON</span>
                  </button>
                </div>
              </div>
            )}

            {/* 8. ANALYTICS & REPORTS */}
            {menu === 'analytics' && overview && (
              <div className="p-5 rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] brutal-shadow-sm space-y-4">
                <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA]">
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
                className="max-w-2xl p-5 rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] brutal-shadow-sm space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">Nama Aplikasi / Branding</label>
                    <input
                      type="text"
                      value={settingsDraft.appName}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, appName: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">Batas Ukuran Upload (MB)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={settingsDraft.maxUploadMb}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, maxUploadMb: Number(e.target.value) })
                      }
                      className="w-full h-10 px-3 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm font-mono text-[#161B26] dark:text-[#F5F7FA]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">Durasi Stories (Jam)</label>
                    <input
                      type="number"
                      min={1}
                      max={72}
                      value={settingsDraft.storyExpiryHours}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, storyExpiryHours: Number(e.target.value) })
                      }
                      className="w-full h-10 px-3 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm font-mono text-[#161B26] dark:text-[#F5F7FA]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">Rate Limit (Req / Menit)</label>
                    <input
                      type="number"
                      min={20}
                      max={1000}
                      value={settingsDraft.rateLimitPerMin}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, rateLimitPerMin: Number(e.target.value) })
                      }
                      className="w-full h-10 px-3 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm font-mono text-[#161B26] dark:text-[#F5F7FA]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] mb-1">Banner Pengumuman Global</label>
                  <input
                    type="text"
                    value={settingsDraft.globalAnnouncement}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, globalAnnouncement: e.target.value })
                    }
                    placeholder="Kosongkan jika tidak ada banner aktif"
                    className="w-full h-10 px-3 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F5F7FA]"
                  />
                </div>

                <div className="space-y-2 pt-1 text-xs font-semibold">
                  <label className="flex items-center gap-2 text-[#161B26] dark:text-[#F5F7FA]">
                    <input
                      type="checkbox"
                      checked={settingsDraft.allowRegistration}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, allowRegistration: e.target.checked })
                      }
                      className="accent-[#8C0027]"
                    />
                    <span>Izinkan pendaftaran akun baru</span>
                  </label>
                  <label className="flex items-center gap-2 text-[#161B26] dark:text-[#F5F7FA]">
                    <input
                      type="checkbox"
                      checked={settingsDraft.pushEnabled}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, pushEnabled: e.target.checked })
                      }
                      className="accent-[#8C0027]"
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
                      className="accent-[#8C0027]"
                    />
                    <span>Maintenance Mode (tampilkan pemberitahuan pemeliharaan)</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm brutal-press text-white text-xs font-bold"
                >
                  Simpan Pengaturan Platform
                </button>
              </form>
            )}

            {/* 10. AUDIT LOGS */}
            {menu === 'audit' && (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#171E2C] shadow-[0_2px_12px_rgba(15,20,30,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-bold text-[#8C0027] dark:text-[#F47296] truncate">
                        {log.action}
                      </div>
                      <div className="mt-0.5 text-xs text-[#161B26] dark:text-[#F5F7FA] font-semibold truncate">
                        {log.actorName} · {log.target}
                      </div>
                      <div className="text-[11px] font-mono text-[#5A6578] dark:text-[#94A3B8]">
                        {formatTimeShort(log.createdAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailItem({ kind: 'audit', item: log })}
                      className="px-3.5 py-1.5 rounded-full bg-[#EAF4FF] dark:bg-[#1B2436] text-[#8C0027] dark:text-[#BEDEFF] hover:bg-[#8C0027] hover:text-white text-xs font-bold shrink-0 transition-colors brutal-press"
                    >
                      Detail
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Item Detail Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-[#161B26]/65 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="p5-modal-impact w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] p-5 pb-safe-3 space-y-4 brutal-shadow-lg max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display font-extrabold text-lg text-[#161B26] dark:text-[#F5F7FA] truncate">
                {detailItem.kind === 'user'
                  ? `Detail Pengguna · @${detailItem.item.username}`
                  : detailItem.kind === 'group'
                    ? `Detail ${detailItem.item.type === 'channel' ? 'Channel' : 'Grup'}`
                    : 'Detail Audit Log'}
              </h3>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                aria-label="Tutup detail"
                className="h-9 w-9 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailItem.kind === 'user' && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1E2738] space-y-1.5">
                  <StatusRow label="Nama" value={detailItem.item.displayName} />
                  <StatusRow label="Username" value={`@${detailItem.item.username}`} />
                  <StatusRow label="User ID" value={detailItem.item.id} />
                  <StatusRow label="Status Akun" value={detailItem.item.status} />
                  <StatusRow label="Verifikasi" value={detailItem.item.verified ? 'Terverifikasi' : 'Belum'} />
                  <StatusRow label="Sesi Aktif" value={String(detailItem.item.activeSessionsCount)} />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#5A6578] dark:text-[#94A3B8] mb-1">
                    Role Pengguna
                  </label>
                  <select
                    value={detailItem.item.role}
                    disabled={currentUser.role !== 'super_admin'}
                    onChange={async (e) => {
                      const nextRole = e.target.value as AdminRole;
                      try {
                        await api.adminUpdateUser(token, detailItem.item.id, { role: nextRole });
                        onNotify(`Role @${detailItem.item.username} diperbarui`);
                        setDetailItem({ kind: 'user', item: { ...detailItem.item, role: nextRole } });
                        refreshSection();
                      } catch (err) {
                        onNotify(err instanceof Error ? err.message : 'Gagal ubah role');
                      }
                    }}
                    className="w-full h-10 px-3 rounded-xl bg-[#F5F7FA] dark:bg-[#232D40] border border-[#E6ECF2] dark:border-[#324058] text-xs font-semibold"
                  >
                    {Object.entries(ROLE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      const nextVerified = !detailItem.item.verified;
                      await api.adminUpdateUser(token, detailItem.item.id, { verified: nextVerified });
                      setDetailItem({ kind: 'user', item: { ...detailItem.item, verified: nextVerified } });
                      refreshSection();
                    }}
                    className="py-2.5 px-3 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] font-bold text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white transition-colors"
                  >
                    {detailItem.item.verified ? 'Batal Verifikasi' : 'Verifikasi'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const u = detailItem.item;
                      setDetailItem(null);
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
                      });
                    }}
                    className="py-2.5 px-3 rounded-full bg-[#FFF2A7] text-[#161B26] font-bold hover:bg-[#F59B00] hover:text-white transition-colors"
                  >
                    {detailItem.item.status === 'active' ? 'Suspend' : 'Aktifkan'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const exported = await api.adminExportUser(token, detailItem.item.id);
                      downloadJson(`tolk-user-${detailItem.item.username}.json`, exported);
                      onNotify('Ekspor data pengguna diunduh');
                    }}
                    className="py-2.5 px-3 rounded-full bg-[#EAF4FF] dark:bg-[#1B2436] text-[#161B26] dark:text-[#BEDEFF] font-bold"
                  >
                    Ekspor JSON
                  </button>
                  {detailItem.item.id !== currentUser.id && detailItem.item.id !== 'usr_pujo' && (
                    <button
                      type="button"
                      onClick={() => {
                        const u = detailItem.item;
                        setDetailItem(null);
                        setConfirmAction({
                          label: `Hapus permanen akun @${u.username}? Semua sesi dan data milik pengguna ini akan dihapus.`,
                          onConfirm: async () => {
                            await api.adminDeleteUser(token, u.id);
                            onNotify(`Akun @${u.username} telah dihapus`);
                            refreshSection();
                          },
                        });
                      }}
                      className="py-2.5 px-3 rounded-full bg-rose-600 text-white font-bold"
                    >
                      Hapus Akun
                    </button>
                  )}
                </div>
              </div>
            )}

            {detailItem.kind === 'group' && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1E2738] space-y-1.5">
                  <StatusRow label="Nama" value={detailItem.item.title} />
                  <StatusRow label="Handle / ID" value={`@${detailItem.item.handle || detailItem.item.id}`} />
                  <StatusRow label="Tipe" value={detailItem.item.type} />
                  <StatusRow label="Jumlah Anggota" value={String(detailItem.item.memberIds.length)} />
                  <StatusRow label="Total Pesan" value={String(detailItem.item.messageCount)} />
                  <StatusRow label="Laporan" value={String(detailItem.item.reportCount)} />
                  <StatusRow label="Status" value={detailItem.item.suspended ? 'Dibekukan' : 'Aktif'} />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const g = detailItem.item;
                    await api.adminUpdateGroup(token, g.id, { suspended: !g.suspended });
                    onNotify(`Status ${g.title} diperbarui`);
                    setDetailItem({ kind: 'group', item: { ...g, suspended: !g.suspended } });
                    refreshSection();
                  }}
                  className="w-full py-2.5 px-4 rounded-full bg-[#8C0027] text-white font-bold"
                >
                  {detailItem.item.suspended ? 'Aktifkan Kembali' : 'Bekukan Ruang'}
                </button>
              </div>
            )}

            {detailItem.kind === 'audit' && (
              <div className="p-3.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1E2738] space-y-1.5 text-xs">
                <StatusRow label="Waktu" value={formatTimeShort(detailItem.item.createdAt)} />
                <StatusRow label="Aktor" value={`${detailItem.item.actorName} (${detailItem.item.actorRole})`} />
                <StatusRow label="Tindakan" value={detailItem.item.action} />
                <StatusRow label="Target" value={detailItem.item.target} />
                <div className="pt-2 text-[#5A6578] dark:text-[#CBD5E1] leading-relaxed">
                  {detailItem.item.details}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* High-Risk Action Re-Confirmation Modal */}
      {confirmRetained.renderedValue && (
        <div
          className={`${
            confirmRetained.closing ? 'p5-backdrop-out pointer-events-none' : 'p5-backdrop-in'
          } fixed inset-0 z-50 bg-[#161B26]/70 flex items-center justify-center p-4`}
        >
          <div
            className={`${
              confirmRetained.closing ? 'p5-modal-out' : 'p5-modal-impact'
            } w-full max-w-sm rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#F5F7FA] p-5 space-y-4 brutal-shadow-lg`}
          >
            <h3 className="font-display font-extrabold text-lg text-[#161B26] dark:text-[#F5F7FA]">
              Konfirmasi Tindakan Admin
            </h3>
            <p className="text-xs text-[#5A6578] dark:text-[#CBBBC2] leading-relaxed">
              {confirmRetained.renderedValue.label}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-3.5 py-2 rounded-xl border border-[#E6ECF2] dark:border-[#324058] text-xs font-bold text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#F5F7FA] dark:hover:bg-[#232D40] brutal-press"
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
                className="px-3.5 py-2 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] border border-[#E6ECF2] dark:border-[#F5F7FA] brutal-shadow-sm brutal-press text-white text-xs font-bold"
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
    <div className="p-4 rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] brutal-shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-[#5A6578] dark:text-[#94A3B8]">{label}</div>
      <div className="mt-1.5 font-display font-extrabold text-3xl font-mono tabular-nums text-[#8C0027] dark:text-[#F47296]">
        {value}
      </div>
      <div className="mt-1 text-[11px] font-medium text-[#5A6578] dark:text-[#94A3B8] truncate">{sub}</div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#161B26]/15 dark:border-[#2A364B] last:border-0 text-xs">
      <span className="text-[#5A6578] dark:text-[#94A3B8] font-medium">{label}</span>
      <span className="font-mono font-bold text-[#161B26] dark:text-[#F5F7FA] text-right truncate max-w-[60%]">
        {value}
      </span>
    </div>
  );
}
