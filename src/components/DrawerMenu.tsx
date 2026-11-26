import { useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  Download,
  LogIn,
  LogOut,
  MonitorSmartphone,
  Moon,
  Radio,
  Shield,
  Sliders,
  Sun,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';
import type { LanguageCode, UserProfile } from '../types/chat';
import { t } from '../lib/i18n';
import { usePWAInstall } from '../lib/pwa';
import { useAnimatedPresence } from '../lib/useAnimatedPresence';
import { Avatar } from './Avatar';

interface DrawerMenuProps {
  open: boolean;
  lang: LanguageCode;
  user: UserProfile;
  darkMode: boolean;
  onClose: () => void;
  onToggleDarkMode: () => void;
  onOpenNewGroup: () => void;
  onOpenNewChannel: () => void;
  onOpenSaved: () => void;
  onOpenDevices: () => void;
  onOpenSettings: () => void;
  onOpenAdminPanel: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export function DrawerMenu({
  open,
  lang,
  user,
  darkMode,
  onClose,
  onToggleDarkMode,
  onOpenNewGroup,
  onOpenNewChannel,
  onOpenSaved,
  onOpenDevices,
  onOpenSettings,
  onOpenAdminPanel,
  onOpenProfile,
  onOpenAuth,
  onLogout,
}: DrawerMenuProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { mounted, closing } = useAnimatedPresence(open, 230);

  if (!mounted) return null;

  const menuItems: Array<{
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    subtitle?: string;
    onClick: () => void;
    accent?: boolean;
  }> = [
    {
      icon: <Users className="w-5 h-5" />,
      iconBg: 'bg-[#BEDEFF] text-[#161B26]',
      label: t(lang, 'newGroup'),
      subtitle: 'Kumpul bareng circle atau tim',
      onClick: () => {
        onClose();
        onOpenNewGroup();
      },
    },
    {
      icon: <Radio className="w-5 h-5" />,
      iconBg: 'bg-[#FFF2A7] text-[#161B26]',
      label: t(lang, 'newChannel'),
      subtitle: 'Siaran info ke banyak orang',
      onClick: () => {
        onClose();
        onOpenNewChannel();
      },
    },
    {
      icon: <Bookmark className="w-5 h-5" />,
      iconBg: 'bg-[#F59B00] text-white',
      label: t(lang, 'savedMessages'),
      subtitle: 'Simpan link, foto & catatan penting',
      onClick: () => {
        onClose();
        onOpenSaved();
      },
    },
    {
      icon: <MonitorSmartphone className="w-5 h-5" />,
      iconBg: 'bg-[#FFF2A7] text-[#161B26]',
      label: t(lang, 'devices'),
      subtitle: 'Lihat HP & browser yang lagi aktif',
      onClick: () => {
        onClose();
        onOpenDevices();
      },
    },
    {
      icon: <Sliders className="w-5 h-5" />,
      iconBg: 'bg-[#E6ECF2] dark:bg-[#2B364B] text-[#161B26] dark:text-[#F1F5F9]',
      label: t(lang, 'settings'),
      subtitle: 'Tema, bahasa, ukuran teks & privasi',
      onClick: () => {
        onClose();
        onOpenSettings();
      },
    },
    ...(user.role !== 'user'
      ? [
          {
            icon: <Shield className="w-5 h-5" />,
            iconBg: 'bg-[#8C0027] text-white',
            label: t(lang, 'adminPanel'),
            subtitle: 'Dashboard, user, moderasi & log',
            accent: true,
            onClick: () => {
              onClose();
              onOpenAdminPanel();
            },
          },
        ]
      : []),
    {
      icon: <UserCircle2 className="w-5 h-5" />,
      iconBg: 'bg-[#BEDEFF] text-[#161B26]',
      label: t(lang, 'editProfile'),
      subtitle: 'Foto, bio, dan status kamu',
      onClick: () => {
        onClose();
        onOpenProfile();
      },
    },
    {
      icon: <LogIn className="w-5 h-5" />,
      iconBg: 'bg-[#FFF2A7] text-[#161B26]',
      label: t(lang, 'switchAccount'),
      subtitle: 'Masuk atau daftar akun lain',
      onClick: () => {
        onClose();
        onOpenAuth();
      },
    },
  ];

  return (
    <div className={`fixed inset-0 z-50 flex ${closing ? 'pointer-events-none' : ''}`}>
      <div
        className={`${closing ? 'p5-backdrop-out' : 'p5-backdrop-in'} hidden md:block fixed inset-0 bg-[#0F141E]/55 backdrop-blur-[2px]`}
        onClick={onClose}
      />

      <div
        className={`${
          closing ? 'p5-drawer-left-out' : 'p5-drawer-left'
        } relative z-10 w-full md:w-[332px] h-full bg-[#F5F7FA] md:bg-[#FFFFFF] dark:bg-[#0F141E] md:dark:bg-[#171E2C] md:border-r md:border-[#E6ECF2] md:dark:border-[#2A364B] brutal-shadow-lg flex flex-col`}
      >
        {/* WhatsApp "You / Kamu" Style Header */}
        <div className="pt-safe-3 px-4 pb-5 p5-maroon-banner text-white shrink-0">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Kembali"
              className="h-10 px-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold flex items-center gap-1.5 brutal-press"
            >
              <ArrowLeft className="w-4 h-4 md:hidden" />
              <X className="w-4 h-4 hidden md:block" />
              <span className="md:hidden">Kembali</span>
            </button>
            <span className="font-display font-extrabold text-base tracking-wide md:hidden">
              Kamu
            </span>
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? t(lang, 'lightMode') : t(lang, 'darkMode')}
              className="h-10 w-10 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 text-white brutal-press flex items-center justify-center"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <div className="mt-4 flex flex-col items-center text-center">
            {user.statusText && (
              <div className="mb-2 px-3 py-1 rounded-full bg-white text-[#161B26] text-[11px] font-bold brutal-shadow-sm max-w-[220px] truncate">
                {user.statusText}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProfile();
              }}
              aria-label="Ubah foto profil"
              className="rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/80 hover:scale-[1.03] transition-transform"
            >
              <Avatar
                name={user.displayName}
                imageUrl={user.avatarUrl}
                color={user.avatarColor}
                size="lg"
              />
            </button>
            <div className="mt-2.5 font-display font-extrabold text-xl leading-tight truncate text-white max-w-full">
              {user.displayName}
            </div>
            <div className="mt-0.5 text-xs text-[#FFF2A7] font-mono truncate">
              @{user.username}
              {user.role !== 'user' ? ` · ${user.role.replace('_', ' ')}` : ''}
            </div>
          </div>
        </div>

        {/* PWA Install CTA */}
        {!isInstalled && (isInstallable || isIOS) && (
          <div className="px-4 py-3 bg-[#FFF9D6] dark:bg-[#1E2738] border-b border-[#E6ECF2] dark:border-[#2A364B]">
            <button
              type="button"
              onClick={() => {
                if (isInstallable) {
                  void install();
                } else {
                  setShowIOSGuide((v) => !v);
                }
              }}
              className="w-full py-2.5 px-3 rounded-2xl bg-[#F59B00] hover:bg-[#D98800] text-white brutal-shadow-sm brutal-press p5-slash-btn text-xs font-bold flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{t(lang, 'installApp')} (PWA)</span>
            </button>
            {showIOSGuide && isIOS && (
              <p className="p5-panel-reveal mt-2 text-[11px] text-[#5A6578] dark:text-[#CBD5E1] leading-relaxed">
                Di Safari iOS, ketuk tombol <strong>Bagikan</strong> di bilah bawah lalu pilih{' '}
                <strong>Tambahkan ke Layar Utama</strong>.
              </p>
            )}
          </div>
        )}

        {/* Grouped Apple HIG-Style Menu Cards */}
        <nav className="flex-1 overflow-y-auto p-3.5 space-y-2.5 thin-scrollbar">
          <div className="rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] brutal-shadow-sm overflow-hidden divide-y divide-[#E6ECF2] dark:divide-[#2A364B]">
            {menuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={`w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left transition-colors ${
                  item.accent
                    ? 'bg-[#FFF9D6]/60 dark:bg-[#1B2436] hover:bg-[#FFF2A7]/70 dark:hover:bg-[#232D40]'
                    : 'hover:bg-[#F5F7FA] dark:hover:bg-[#1E2738]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 brutal-shadow-sm ${item.iconBg}`}
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#161B26] dark:text-[#F1F5F9] leading-tight truncate">
                      {item.label}
                    </div>
                    {item.subtitle && (
                      <div className="text-[11px] text-[#5A6578] dark:text-[#94A3B8] truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#94A3B8] shrink-0" />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full px-4 py-3.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] flex items-center justify-center gap-2 text-[#8C0027] dark:text-[#F47296] hover:bg-[#FDF0F3] dark:hover:bg-[#2B1822] font-bold text-sm brutal-shadow-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{t(lang, 'logout')}</span>
          </button>
        </nav>

        {/* Footer */}
        <div className="pt-3 pb-safe-3 px-4 border-t border-[#E6ECF2] dark:border-[#2A364B] bg-[#FFFFFF] dark:bg-[#171E2C] text-[11px] text-[#5A6578] dark:text-[#94A3B8] flex items-center justify-between gap-2">
          <div className="px-1 flex items-center">
            <img
              src="/assets/aistudio/tolk-horizontal_7a55fc8d.svg"
              alt="Tolk by Lunola"
              className="tolk-logo-adaptive h-6 w-auto object-contain select-none"
            />
          </div>
          <span className="font-mono font-bold">Tolk by Lunola</span>
        </div>
      </div>
    </div>
  );
}
