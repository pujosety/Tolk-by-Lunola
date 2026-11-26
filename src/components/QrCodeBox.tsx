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
      color: { dark: '#111111', light: '#FFFFFF' },
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
    <div className="inline-flex flex-col items-center gap-2 p-3 rounded-xl bg-[#FFFFFF] border border-[#E6ECF2] brutal-shadow-sm">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={label || 'QR Code'}
          width={size}
          height={size}
          className="rounded-md block border border-[#161B26]/20"
        />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="rounded-md bg-[#EDE5D9] animate-pulse"
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
