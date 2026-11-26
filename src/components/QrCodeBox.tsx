import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

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
      color: { dark: '#111111', light: '#FFFDF9' },
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
    <div className="inline-flex flex-col items-center gap-2 p-3 rounded-[4px] bg-[#FFFDF9] border-2 border-[#111111] brutal-shadow-sm">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={label || 'QR Code'}
          width={size}
          height={size}
          className="rounded-[2px] block border border-[#111111]/20"
        />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="rounded-[2px] bg-[#EDE5D9] animate-pulse"
        />
      )}
      {label && (
        <span className="font-mono text-[11px] font-bold text-[#8B112B] max-w-[180px] truncate">
          {label}
        </span>
      )}
    </div>
  );
}
