import type { CSSProperties } from 'react';
import type {
  BubbleAccentId,
  BubbleStyleId,
  ChatAppearancePrefs,
  ChatWallpaperId,
} from '../types/chat';

export const DEFAULT_CHAT_APPEARANCE: ChatAppearancePrefs = {
  wallpaper: 'default',
  customWallpaperUrl: null,
  bubbleStyle: 'tiktok',
  bubbleAccent: 'burgundy',
};

export const WALLPAPER_OPTIONS: Array<{
  id: ChatWallpaperId;
  label: string;
  swatch: string;
}> = [
  { id: 'default', label: 'Sky & Butter', swatch: 'linear-gradient(135deg, #BEDEFF 0%, #FFF2A7 100%)' },
  { id: 'sky-breeze', label: 'Sky Pastel', swatch: 'linear-gradient(135deg, #BEDEFF 0%, #EAF4FF 100%)' },
  { id: 'butter-warm', label: 'Butter Cream', swatch: 'linear-gradient(135deg, #FFF2A7 0%, #FFF9D6 100%)' },
  { id: 'burgundy-glow', label: 'Burgundy Dusk', swatch: 'linear-gradient(135deg, #8C0027 0%, #F59B00 100%)' },
  { id: 'minimal', label: 'Polos Bersih', swatch: '#F5F7FA' },
];

export const BUBBLE_STYLE_OPTIONS: Array<{ id: BubbleStyleId; label: string }> = [
  { id: 'tiktok', label: 'TikTok Sleek' },
  { id: 'classic', label: 'Klasik' },
  { id: 'clay', label: '3D Pastel' },
  { id: 'outline', label: 'Outline' },
];

export const BUBBLE_ACCENT_OPTIONS: Array<{
  id: BubbleAccentId;
  label: string;
  hex: string;
  ownBg: string;
  ownBorder: string;
}> = [
  {
    id: 'burgundy',
    label: 'Burgundy',
    hex: '#8C0027',
    ownBg: 'bg-[#8C0027] text-white',
    ownBorder: 'border-[#8C0027]',
  },
  {
    id: 'amber',
    label: 'Amber',
    hex: '#F59B00',
    ownBg: 'bg-[#F59B00] text-white',
    ownBorder: 'border-[#F59B00]',
  },
  {
    id: 'sky',
    label: 'Sky Blue',
    hex: '#0284C7',
    ownBg: 'bg-[#0284C7] text-white',
    ownBorder: 'border-[#0284C7]',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    hex: '#059669',
    ownBg: 'bg-[#059669] text-white',
    ownBorder: 'border-[#059669]',
  },
  {
    id: 'violet',
    label: 'Violet',
    hex: '#7C3AED',
    ownBg: 'bg-[#7C3AED] text-white',
    ownBorder: 'border-[#7C3AED]',
  },
];

export function getWallpaperStyle(
  prefs: ChatAppearancePrefs,
  isDark: boolean
): CSSProperties {
  if (prefs.wallpaper === 'custom' && prefs.customWallpaperUrl) {
    return {
      backgroundImage: `${
        isDark
          ? 'linear-gradient(rgba(15, 20, 30, 0.58), rgba(15, 20, 30, 0.58))'
          : 'linear-gradient(rgba(245, 247, 250, 0.35), rgba(245, 247, 250, 0.35))'
      }, url(${prefs.customWallpaperUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  switch (prefs.wallpaper) {
    case 'sky-breeze':
      return {
        backgroundImage: isDark
          ? 'radial-gradient(circle at 20% 20%, rgba(190, 222, 255, 0.14), transparent 55%), linear-gradient(160deg, #0F141E 0%, #152238 100%)'
          : 'radial-gradient(circle at 20% 20%, rgba(190, 222, 255, 0.75), transparent 55%), linear-gradient(160deg, #EAF4FF 0%, #F5F7FA 100%)',
      };
    case 'butter-warm':
      return {
        backgroundImage: isDark
          ? 'radial-gradient(circle at 80% 20%, rgba(255, 242, 167, 0.12), transparent 55%), linear-gradient(160deg, #14171F 0%, #241F16 100%)'
          : 'radial-gradient(circle at 80% 20%, rgba(255, 242, 167, 0.8), transparent 55%), linear-gradient(160deg, #FFF9D6 0%, #F5F7FA 100%)',
      };
    case 'burgundy-glow':
      return {
        backgroundImage: isDark
          ? 'radial-gradient(circle at 20% 15%, rgba(140, 0, 39, 0.3), transparent 50%), radial-gradient(circle at 85% 85%, rgba(245, 155, 0, 0.14), transparent 50%)'
          : 'radial-gradient(circle at 20% 15%, rgba(140, 0, 39, 0.12), transparent 50%), radial-gradient(circle at 85% 85%, rgba(245, 155, 0, 0.14), transparent 50%)',
      };
    case 'minimal':
      return {
        backgroundImage: 'none',
        backgroundColor: isDark ? '#0F141E' : '#F5F7FA',
      };
    default:
      return {};
  }
}

export function getBubbleClasses(prefs: ChatAppearancePrefs, isOwn: boolean): string {
  const accent =
    BUBBLE_ACCENT_OPTIONS.find((a) => a.id === prefs.bubbleAccent) || BUBBLE_ACCENT_OPTIONS[0];

  const radius =
    prefs.bubbleStyle === 'tiktok'
      ? isOwn
        ? 'rounded-[20px] rounded-br-[4px]'
        : 'rounded-[20px] rounded-bl-[4px]'
      : prefs.bubbleStyle === 'clay'
        ? 'rounded-3xl'
        : 'rounded-2xl';

  if (prefs.bubbleStyle === 'outline') {
    return `${radius} border-2 ${
      isOwn
        ? `${accent.ownBorder} bg-[#FFFFFF]/90 dark:bg-[#171E2C]/90 text-[#161B26] dark:text-[#F5F7FA]`
        : 'border-[#E6ECF2] dark:border-[#2A364B] bg-[#FFFFFF]/85 dark:bg-[#171E2C]/85 text-[#161B26] dark:text-[#F5F7FA]'
    } backdrop-blur-sm`;
  }

  if (prefs.bubbleStyle === 'tiktok') {
    return `${radius} border ${
      isOwn
        ? `${accent.ownBg} border-transparent shadow-sm`
        : 'bg-[#FFFFFF] dark:bg-[#1E2738] text-[#161B26] dark:text-[#F5F7FA] border-[#E6ECF2] dark:border-[#2A364B] shadow-sm'
    }`;
  }

  if (prefs.bubbleStyle === 'clay') {
    return `${radius} border brutal-shadow ${
      isOwn
        ? `${accent.ownBg} border-white/25`
        : 'bg-[#FFFFFF] dark:bg-[#1E2738] text-[#161B26] dark:text-[#F5F7FA] border-white/80 dark:border-[#2A364B]'
    }`;
  }

  // classic
  return `${radius} border brutal-shadow-sm ${
    isOwn
      ? `${accent.ownBg} border-transparent`
      : 'bg-[#FFFFFF] dark:bg-[#1E2738] text-[#161B26] dark:text-[#F5F7FA] border-[#E6ECF2] dark:border-[#2A364B]'
  }`;
}
