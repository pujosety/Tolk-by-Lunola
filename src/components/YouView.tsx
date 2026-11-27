import { useState } from 'react';
import {
  ChevronRight,
  Download,
  LogOut,
  MonitorSmartphone,
  Moon,
  Palette,
  QrCode,
  Shield,
  Sliders,
  Star,
  Sun,
  UserCircle2,
} from 'lucide-react';
import type { LanguageCode, UserProfile } from '../types/chat';
import { t } from '../lib/i18n';
import { usePWAInstall } from '../lib/pwa';
import { Avatar } from './Avatar';

interface YouViewProps {
  lang: LanguageCode;
  user: UserProfile;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenProfile: () => void;
  onOpenQrCard: () => void;
  onOpenStarred: () => void;
  onOpenDevices: () => void;
  onOpenSettings: () => void;
  onOpenAdminPanel: () => void;
  onLogout: () => void;
}

export function YouView({
  lang,
  user,
  darkMode,
  onToggleDarkMode,
  onOpenProfile,
  onOpenQrCard,
  onOpenStarred,
  onOpenDevices,
  onOpenSettings,
  onOpenAdminPanel,
  onLogout,
}: YouViewProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const menuSections: Array<{
    title: string;
    items: Array<{
      icon: React.ReactNode;
      iconBg: string;
      label: string;
      subtitle: string;
      onClick: () => void;
      accent?: boolean;
    }>;
  }> = [
    {
      title: 'Akun & Profil',
      items: [
        {
          icon: <UserCircle2 className="w-5 h-5" />,
          iconBg: 'bg-[#BEDEFF] text-[#161B26]',
          label: t(lang, 'editProfile'),
          subtitle: 'Foto, nama tampilan, bio & status',
          onClick: onOpenProfile,
        },
      ],
    },
    {
      title: 'Personalisasi & Simpanan',
      items: [
        {
          icon: <Palette className="w-5 h-5" />,
          iconBg: 'bg-[#FFF2A7] text-[#161B26]',
          label: 'Tampilan & Tema Chat',
          subtitle: 'Wallpaper chat, gaya bubble & warna',
          onClick: onOpenSettings,
        },
        {
          icon: <Star className="w-5 h-5" />,
          iconBg: 'bg-[#F59B00] text-white',
          label: 'Pesan Berbintang',
          subtitle: 'Lihat semua pesan penting yang ditandai',
          onClick: onOpenStarred,
        },
      ],
    },
    {
      title: 'Perangkat & Sistem',
      items: [
        {
          icon: <MonitorSmartphone className="w-5 h-5" />,
          iconBg: 'bg-[#E6ECF2] dark:bg-[#2B364B] text-[#161B26] dark:text-[#F1F5F9]',
          label: t(lang, 'devices'),
          subtitle: 'Kelola HP & browser yang aktif',
          onClick: onOpenDevices,
        },
        {
          icon: <Sliders className="w-5 h-5" />,
          iconBg: 'bg-[#E6ECF2] dark:bg-[#2B364B] text-[#161B26] dark:text-[#F1F5F9]',
          label: t(lang, 'settings'),
          subtitle: 'Bahasa, ukuran teks, nada & privasi',
          onClick: onOpenSettings,
        },
        ...(user.role !== 'user'
          ? [
              {
                icon: <Shield className="w-5 h-5" />,
                iconBg: 'bg-[#8C0027] text-white',
                label: t(lang, 'adminPanel'),
                subtitle: 'Moderasi & pengaturan sistem',
                onClick: onOpenAdminPanel,
                accent: true,
              },
            ]
          : []),
      ],
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto thin-scrollbar p-3.5 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-4 space-y-3 bg-[#F5F7FA] dark:bg-[#0F141E]">
      {/* WhatsApp "You" Profile Card */}
      <div className="rounded-3xl p5-maroon-banner text-white p-4 brutal-shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onOpenProfile}
              aria-label="Edit profil"
              className="rounded-2xl shrink-0 hover:scale-[1.03] transition-transform"
            >
              <Avatar
                name={user.displayName}
                imageUrl={user.avatarUrl}
                color={user.avatarColor}
                size="md"
              />
            </button>
            <div className="min-w-0">
              {user.statusText && (
                <div className="inline-block mb-1 px-2.5 py-0.5 rounded-full bg-white text-[#161B26] text-[10px] font-bold max-w-[180px] truncate">
                  {user.statusText}
                </div>
              )}
              <div className="font-display font-extrabold text-base leading-tight truncate">
                {user.displayName}
              </div>
              <div className="text-[11px] font-mono text-[#FFF2A7] truncate">
                @{user.username}
                {user.role !== 'user' ? ` · ${user.role.replace('_', ' ')}` : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenQrCard}
              aria-label="Tampilkan Kartu QR"
              title="Kartu QR Saya"
              className="h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white flex items-center justify-center brutal-press"
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? t(lang, 'lightMode') : t(lang, 'darkMode')}
              title={darkMode ? t(lang, 'lightMode') : t(lang, 'darkMode')}
              className="h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white flex items-center justify-center brutal-press"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* PWA Install CTA */}
      {!isInstalled && (isInstallable || isIOS) && (
        <div className="rounded-2xl p-3 bg-[#FFF9D6] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B]">
          <button
            type="button"
            onClick={() => {
              if (isInstallable) {
                void install();
              } else {
                setShowIOSGuide((v) => !v);
              }
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-[#F59B00] hover:bg-[#D98800] text-white brutal-shadow-sm brutal-press text-xs font-bold flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>{t(lang, 'installApp')} (PWA)</span>
          </button>
          {showIOSGuide && isIOS && (
            <p className="mt-2 text-[11px] text-[#5A6578] dark:text-[#CBD5E1] leading-relaxed">
              Di Safari iOS, ketuk <strong>Bagikan</strong> lalu pilih{' '}
              <strong>Tambahkan ke Layar Utama</strong>.
            </p>
          )}
        </div>
      )}

      {/* Classified Menu Sections */}
      <div className="space-y-4">
        {menuSections.map((section) => (
          <div key={section.title} className="space-y-1.5">
            <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-[#5A6578] dark:text-[#94A3B8]">
              {section.title}
            </div>
            <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] overflow-hidden">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left transition-colors ${
                    item.accent
                      ? 'bg-[#FFF9D6]/50 dark:bg-[#1B2436] hover:bg-[#FFF2A7]/70 dark:hover:bg-[#232D40]'
                      : 'hover:bg-[#F5F7FA] dark:hover:bg-[#1E2738]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${item.iconBg}`}
                    >
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#161B26] dark:text-[#F1F5F9] leading-tight truncate">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-[#5A6578] dark:text-[#94A3B8] truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Logout Button */}
      <button
        type="button"
        onClick={onLogout}
        className="w-full px-4 py-3.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] flex items-center justify-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold text-sm transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span>{t(lang, 'logout')}</span>
      </button>
    </div>
  );
}
