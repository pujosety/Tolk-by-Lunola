import { useState } from 'react';
import {
  Bookmark,
  Download,
  LogIn,
  LogOut,
  MonitorSmartphone,
  Moon,
  Phone,
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
  onOpenCalls: () => void;
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
  onOpenCalls,
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
    label: string;
    subtitle?: string;
    onClick: () => void;
    accent?: boolean;
  }> = [
    {
      icon: <Users className="w-5 h-5" />,
      label: t(lang, 'newGroup'),
      onClick: () => {
        onClose();
        onOpenNewGroup();
      },
    },
    {
      icon: <Radio className="w-5 h-5" />,
      label: t(lang, 'newChannel'),
      onClick: () => {
        onClose();
        onOpenNewChannel();
      },
    },
    {
      icon: <Bookmark className="w-5 h-5" />,
      label: t(lang, 'savedMessages'),
      onClick: () => {
        onClose();
        onOpenSaved();
      },
    },
    {
      icon: <Phone className="w-5 h-5" />,
      label: t(lang, 'calls'),
      onClick: () => {
        onClose();
        onOpenCalls();
      },
    },
    {
      icon: <MonitorSmartphone className="w-5 h-5" />,
      label: t(lang, 'devices'),
      onClick: () => {
        onClose();
        onOpenDevices();
      },
    },
    {
      icon: <Sliders className="w-5 h-5" />,
      label: t(lang, 'settings'),
      subtitle: 'Bahasa, Aksesibilitas, Privasi, Notifikasi',
      onClick: () => {
        onClose();
        onOpenSettings();
      },
    },
    ...(user.role !== 'user'
      ? [
          {
            icon: <Shield className="w-5 h-5" />,
            label: t(lang, 'adminPanel'),
            subtitle: 'Dashboard, RBAC, Moderasi, Audit Log',
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
      label: t(lang, 'editProfile'),
      onClick: () => {
        onClose();
        onOpenProfile();
      },
    },
    {
      icon: <LogIn className="w-5 h-5" />,
      label: t(lang, 'switchAccount'),
      onClick: () => {
        onClose();
        onOpenAuth();
      },
    },
  ];

  return (
    <div className={`fixed inset-0 z-50 flex ${closing ? 'pointer-events-none' : ''}`}>
      <div
        className={`${closing ? 'p5-backdrop-out' : 'p5-backdrop-in'} fixed inset-0 bg-[#252A24]/60 backdrop-blur-[1px]`}
        onClick={onClose}
      />

      <div
        className={`${
          closing ? 'p5-drawer-left-out' : 'p5-drawer-left'
        } relative z-10 w-[308px] max-w-[86vw] h-full bg-[#FBF9F6] dark:bg-[#1E241C] border-r-2 border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-lg flex flex-col`}
      >
        {/* Persona 5 Diagonal Maroon Profile Header */}
        <div className="pt-safe-5 px-5 pb-4 p5-maroon-banner text-[#FBF9F6] border-b-2 border-[#E3E1DC] dark:border-[#F2F2F2]">
          <div className="flex items-start justify-between">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProfile();
              }}
              aria-label="Ubah foto profil"
              title="Ubah foto profil"
              className="rounded-xl focus:outline-none focus:ring-2 focus:ring-white/80 hover:scale-[1.03] transition-transform"
            >
              <Avatar
                name={user.displayName}
                imageUrl={user.avatarUrl}
                color={user.avatarColor}
                size="lg"
              />
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleDarkMode}
                aria-label={darkMode ? t(lang, 'lightMode') : t(lang, 'darkMode')}
                className="h-9 w-9 rounded-xl border border-[#E3E1DC] bg-[#FBF9F6] text-[#252A24] hover:bg-[#252A24] hover:text-[#FBF9F6] brutal-shadow-sm brutal-press flex items-center justify-center"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup menu"
                className="h-9 w-9 rounded-xl border border-[#E3E1DC] bg-[#252A24] text-[#FBF9F6] hover:bg-[#FBF9F6] hover:text-[#252A24] brutal-shadow-sm brutal-press flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-3.5">
            <div className="p5-skew inline-block bg-[#252A24] text-[#FBF9F6] px-2.5 py-0.5 max-w-full">
              <span className="p5-unskew font-display font-extrabold text-lg leading-tight truncate block">
                {user.displayName}
              </span>
            </div>
            <div className="mt-1 text-xs text-[#F9DADA] font-mono truncate">
              @{user.username}
              {user.role !== 'user' ? ` · ${user.role.replace('_', ' ')}` : ''}
            </div>
          </div>
        </div>

        {/* PWA Install CTA */}
        {!isInstalled && (isInstallable || isIOS) && (
          <div className="px-4 py-3 bg-[#FCEAEA] dark:bg-[#2B2424] border-b-2 border-[#E3E1DC] dark:border-[#364032]">
            <button
              type="button"
              onClick={() => {
                if (isInstallable) {
                  void install();
                } else {
                  setShowIOSGuide((v) => !v);
                }
              }}
              className="w-full py-2 px-3 rounded-xl bg-[#D96868] hover:bg-[#C45454] text-[#FBF9F6] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm brutal-press p5-slash-btn text-xs font-bold flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{t(lang, 'installApp')} (PWA)</span>
            </button>
            {showIOSGuide && isIOS && (
              <p className="p5-panel-reveal mt-2 text-[11px] text-[#5E645C] dark:text-[#C6CEC2] leading-relaxed">
                Di Safari iOS, ketuk tombol <strong>Bagikan</strong> di bilah bawah lalu pilih{' '}
                <strong>Tambahkan ke Layar Utama</strong>.
              </p>
            )}
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 thin-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={`p5-row-motion w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-left border ${
                item.accent
                  ? 'border-[#D96868] bg-[#FCEAEA] dark:bg-[#2E2223] text-[#D96868] dark:text-[#E58383] hover:bg-[#D96868] hover:text-[#FBF9F6]'
                  : 'border-transparent text-[#252A24] dark:text-[#F2F2F2] hover:border-[#E3E1DC] dark:hover:border-[#D96868] hover:bg-[#F2F2F2] dark:hover:bg-[#2B3328]'
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight">{item.label}</div>
                {item.subtitle && (
                  <div className="text-[11px] opacity-75 truncate">{item.subtitle}</div>
                )}
              </div>
            </button>
          ))}

          <div className="my-2 border-t-2 border-[#252A24]/15 dark:border-[#364032]" />

          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-left text-[#B91C1C] dark:text-[#FF6B81] border border-transparent hover:border-[#B91C1C] hover:bg-[#FEF2F2] dark:hover:bg-[#2B1217] transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-semibold">{t(lang, 'logout')}</span>
          </button>
        </nav>

        {/* Footer */}
        <div className="pt-3 pb-safe-3 px-4 border-t-2 border-[#E3E1DC] dark:border-[#364032] bg-[#F2F2F2] dark:bg-[#191E17] text-[11px] text-[#5E645C] dark:text-[#A3AD9E] flex items-center justify-between gap-2">
          <div className="px-2 py-1 rounded-lg bg-[#FBF9F6] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-sm flex items-center">
            <img
              src="/assets/aistudio/tolk-horizontal_7a55fc8d.svg"
              alt="Tolk by Lunola"
              className="h-5 w-auto object-contain select-none"
            />
          </div>
          <span className="font-mono font-bold">Tolk by Lunola</span>
        </div>
      </div>
    </div>
  );
}
