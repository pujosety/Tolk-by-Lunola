import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy } from 'lucide-react';
import type { UserProfile } from '../types/chat';
import { Avatar } from './Avatar';

export function QrCodeBox({
  value,
  label,
  size = 168,
}: {
  value: string;
  label?: string;
  size?: number;
}) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      color: { dark: '#161B26', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [value, size]);

  return (
    <div className="inline-flex flex-col items-center gap-2 p-3 rounded-2xl bg-[#FFFFFF] border border-[#E6ECF2] brutal-shadow-sm">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={label || 'QR Code'}
          width={size}
          height={size}
          className="rounded-xl block"
        />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="rounded-xl bg-[#F5F7FA] animate-pulse"
        />
      )}
      {label && (
        <span className="font-mono text-[11px] font-bold text-[#8C0027] max-w-[180px] truncate">
          {label}
        </span>
      )}
    </div>
  );
}

export function DigitalProfileQrCard({ user }: { user: UserProfile }) {
  const [copied, setCopied] = useState(false);
  const profileUrl = `${window.location.origin}/?add=${encodeURIComponent(`@${user.username}`)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="w-full max-w-xs mx-auto rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] brutal-shadow-lg overflow-hidden">
      {/* Playful Gradient Top Header */}
      <div className="h-20 p5-maroon-banner relative px-4 pt-3 flex items-start justify-between">
        <img
          src="/assets/aistudio/tolk-horizontal_7a55fc8d.svg"
          alt="Tolk by Lunola"
          className="h-7 w-auto object-contain brightness-0 invert"
        />
        <span className="px-2.5 py-0.5 rounded-full bg-[#FFF2A7] text-[#161B26] text-[10px] font-bold">
          ID Card
        </span>
      </div>

      {/* Overlapping Avatar + Identity */}
      <div className="px-5 pb-5 -mt-8 flex flex-col items-center text-center">
        <div className="p-1 rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] brutal-shadow-sm">
          <Avatar
            name={user.displayName}
            imageUrl={user.avatarUrl}
            color={user.avatarColor}
            size="lg"
          />
        </div>

        <h3 className="mt-2.5 font-display font-extrabold text-lg text-[#161B26] dark:text-[#F5F7FA] leading-tight">
          {user.displayName}
        </h3>
        <p className="text-xs font-mono font-bold text-[#8C0027] dark:text-[#F47296]">
          @{user.username}
        </p>
        {user.bio && (
          <p className="mt-1 text-[11px] text-[#5A6578] dark:text-[#94A3B8] line-clamp-2 max-w-[220px]">
            {user.bio}
          </p>
        )}

        <div className="mt-4">
          <QrCodeBox value={profileUrl} size={172} />
        </div>

        <p className="mt-2.5 text-[11px] text-[#5A6578] dark:text-[#94A3B8]">
          Scan QR ini dari menu Mulai Obrolan untuk langsung add kontak.
        </p>

        <button
          type="button"
          onClick={() => void handleCopy()}
          className="mt-3 w-full py-2.5 px-4 rounded-2xl bg-[#EAF4FF] dark:bg-[#232D40] hover:bg-[#BEDEFF] text-[#161B26] dark:text-[#F5F7FA] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#8C0027]" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Link Profil Disalin' : 'Salin Link Profil'}</span>
        </button>
      </div>
    </div>
  );
}
