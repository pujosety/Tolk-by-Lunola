import { useEffect } from 'react';
import {
  MonitorSmartphone,
  Radio,
  Shield,
  Sliders,
  Star,
  Users,
} from 'lucide-react';
import type { LanguageCode, UserProfile } from '../types/chat';
import { t } from '../lib/i18n';
import { useAnimatedPresence } from '../lib/useAnimatedPresence';

interface HeaderOverflowMenuProps {
  open: boolean;
  lang: LanguageCode;
  user: UserProfile;
  onClose: () => void;
  onOpenNewGroup: () => void;
  onOpenNewChannel: () => void;
  onOpenStarred: () => void;
  onOpenDevices: () => void;
  onOpenSettings: () => void;
  onOpenAdminPanel: () => void;
}

export function HeaderOverflowMenu({
  open,
  lang,
  user,
  onClose,
  onOpenNewGroup,
  onOpenNewChannel,
  onOpenStarred,
  onOpenDevices,
  onOpenSettings,
  onOpenAdminPanel,
}: HeaderOverflowMenuProps) {
  const { mounted, closing } = useAnimatedPresence(open, 175);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!mounted) return null;

  const items: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    accent?: boolean;
  }> = [
    {
      label: t(lang, 'newGroup'),
      icon: <Users className="w-4 h-4 text-[#0284C7] dark:text-[#7DD3FC]" />,
      onClick: () => {
        onClose();
        onOpenNewGroup();
      },
    },
    {
      label: t(lang, 'newChannel'),
      icon: <Radio className="w-4 h-4 text-[#D97706] dark:text-[#FBBF24]" />,
      onClick: () => {
        onClose();
        onOpenNewChannel();
      },
    },
    {
      label: 'Pesan Berbintang',
      icon: <Star className="w-4 h-4 text-[#F59B00]" />,
      onClick: () => {
        onClose();
        onOpenStarred();
      },
    },
    {
      label: t(lang, 'devices'),
      icon: <MonitorSmartphone className="w-4 h-4 text-[#161B26] dark:text-[#CBD5E1]" />,
      onClick: () => {
        onClose();
        onOpenDevices();
      },
    },
    {
      label: t(lang, 'settings'),
      icon: <Sliders className="w-4 h-4 text-[#5A6578] dark:text-[#94A3B8]" />,
      onClick: () => {
        onClose();
        onOpenSettings();
      },
    },
    ...(user.role !== 'user'
      ? [
          {
            label: t(lang, 'adminPanel'),
            icon: <Shield className="w-4 h-4 text-[#8C0027] dark:text-[#F47296]" />,
            accent: true,
            onClick: () => {
              onClose();
              onOpenAdminPanel();
            },
          },
        ]
      : []),
  ];

  return (
    <div className={`fixed inset-0 z-50 ${closing ? 'pointer-events-none' : ''}`}>
      <div
        className="fixed inset-0 bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="menu"
        aria-label="Menu utama"
        className={`${
          closing ? 'p5-menu-right-out' : 'p5-menu-right-in'
        } fixed top-[calc(env(safe-area-inset-top,0px)+54px)] right-3 md:left-[210px] md:right-auto w-60 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C2434] border border-[#E6ECF2] dark:border-[#2E3B52] brutal-shadow-lg overflow-hidden py-1.5`}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            onClick={item.onClick}
            className={`w-full px-4 py-3 flex items-center gap-3 text-left text-sm font-semibold transition-colors ${
              item.accent
                ? 'text-[#8C0027] dark:text-[#F47296] bg-[#FFF9D6]/45 dark:bg-[#232D40]/60 hover:bg-[#FFF2A7]/60 dark:hover:bg-[#2B374E]'
                : 'text-[#161B26] dark:text-[#F1F5F9] hover:bg-[#F5F7FA] dark:hover:bg-[#253044]'
            }`}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
