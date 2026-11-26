import { useEffect, useState } from 'react';
import { Bookmark, Megaphone, Users } from 'lucide-react';
import type { ChatType } from '../types/chat';

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  chatType?: ChatType;
  online?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-7 h-7 text-[11px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-12 h-12 text-base',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-3xl',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function Avatar({
  name,
  imageUrl,
  color = '#8B112B',
  size = 'md',
  chatType,
  online = false,
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [imageUrl]);
  const sizeCls = SIZE_CLASSES[size];

  const renderFallback = () => {
    if (chatType === 'saved') {
      return <Bookmark className="w-1/2 h-1/2 text-[#FFFDF9] fill-[#FFFDF9]/25" />;
    }
    if (chatType === 'channel') {
      return <Megaphone className="w-1/2 h-1/2 text-[#FFFDF9]" />;
    }
    if (chatType === 'group') {
      return <Users className="w-1/2 h-1/2 text-[#FFFDF9]" />;
    }
    return (
      <span className="font-display font-extrabold tracking-wide text-[#FFFDF9]">
        {getInitials(name)}
      </span>
    );
  };

  return (
    <div className={`relative shrink-0 ${sizeCls}`}>
      {imageUrl && !imgFailed ? (
        <img
          src={imageUrl}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full rounded-[4px] object-cover border-2 border-[#111111] dark:border-[#F4EFE6] brutal-shadow-sm bg-[#F4EFE6] dark:bg-[#221B24]"
        />
      ) : (
        <div
          className="w-full h-full rounded-[4px] flex items-center justify-center select-none border-2 border-[#111111] dark:border-[#F4EFE6] brutal-shadow-sm"
          style={{ backgroundColor: color === '#0284C7' ? '#8B112B' : color }}
        >
          {renderFallback()}
        </div>
      )}

      {online && (
        <span
          aria-label="Online"
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-[2px] bg-[#16A34A] border-2 border-[#111111] dark:border-[#161218]"
        />
      )}
    </div>
  );
}
