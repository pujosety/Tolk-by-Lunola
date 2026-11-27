declare global {
  interface Window {
    LunolaTalkAndroid?: {
      isAndroidWebView?: () => boolean;
      hapticClick?: () => void;
      setStatusBarTheme?: (isDark: boolean) => void;
      setCallAudioMode?: (inCall: boolean) => void;
      showNotification?: (title: string, body: string) => void;
      showToast?: (message: string) => void;
    };
    __lunolaTalkHandleBack?: () => boolean;
  }
}

export function isRunningInAndroidWebView(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.LunolaTalkAndroid?.isAndroidWebView?.()) return true;
  return /LunolaTalkAndroid/i.test(navigator.userAgent);
}

export function triggerAndroidHaptic(): void {
  try {
    window.LunolaTalkAndroid?.hapticClick?.();
  } catch {
    // Ignore outside Android WebView
  }
}

export function syncAndroidStatusBar(isDark: boolean): void {
  try {
    window.LunolaTalkAndroid?.setStatusBarTheme?.(isDark);
  } catch {
    // Ignore outside Android WebView
  }
}

export function notifyAndroidToast(message: string): void {
  try {
    window.LunolaTalkAndroid?.showToast?.(message);
  } catch {
    // Ignore outside Android WebView
  }
}

export function notifyAndroidSystem(title: string, body: string): void {
  try {
    window.LunolaTalkAndroid?.showNotification?.(title, body);
  } catch {
    // Ignore outside Android WebView
  }
}

export function setAndroidCallAudioMode(inCall: boolean): void {
  try {
    window.LunolaTalkAndroid?.setCallAudioMode?.(inCall);
  } catch {
    // Ignore outside Android WebView
  }
}

export async function saveMediaToGallery(url: string, filename?: string): Promise<boolean> {
  const safeName =
    filename?.trim() ||
    url.split('/').pop()?.split('?')[0] ||
    `tolk-media-${Date.now()}.jpg`;
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = safeName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    notifyAndroidToast('Media disimpan ke galeri / unduhan.');
    return true;
  } catch {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = safeName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    } catch {
      return false;
    }
  }
}

export function formatTimeShort(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatChatListTime(ts: number): string {
  const now = new Date();
  const date = new Date(ts);
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  if (sameDay) return formatTimeShort(ts);

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString('id-ID', { weekday: 'short' });
  }
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
}

export function formatDateDivider(ts: number): string {
  const now = new Date();
  const date = new Date(ts);
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();
  if (sameDay) return 'Hari ini';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === date.getFullYear() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getDate() === date.getDate();
  if (isYesterday) return 'Kemarin';

  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: now.getFullYear() === date.getFullYear() ? undefined : 'numeric',
  });
}

export function formatLastSeen(ts: number): string {
  const diffMin = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 60) return `terakhir dilihat ${diffMin} menit lalu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `terakhir dilihat ${diffHours} jam lalu`;
  return `terakhir dilihat ${formatDateDivider(ts)}`;
}

export function formatDuration(sec?: number): string {
  const total = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function isSafeHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
