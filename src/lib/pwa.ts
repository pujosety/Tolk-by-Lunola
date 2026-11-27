import { useEffect, useState } from 'react';
import type { NotificationTone } from '../types/chat';
import { isRunningInAndroidWebView, notifyAndroidSystem } from './androidBridge';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}

export function playNotificationSound(tone: NotificationTone, vibrate = true): void {
  if (vibrate && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(45);
    } catch {
      // Ignore vibration errors
    }
  }
  if (tone === 'mute' || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (tone === 'lunola') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);
    } else if (tone === 'crystal') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1046.5, now);
      osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.12);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // Audio playback blocked before user gesture
  }
}

const PUSH_AUTH_CACHE = 'tolk-push-auth-v1';
const PUSH_AUTH_KEY = '/__tolk_push_auth';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function syncPushAuthToken(token: string | null): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await caches.open(PUSH_AUTH_CACHE);
    if (token) {
      await cache.put(PUSH_AUTH_KEY, new Response(token));
    } else {
      await cache.delete(PUSH_AUTH_KEY);
    }
  } catch {
    // Ignore cache storage errors in restricted contexts
  }
}

export async function ensureWebPushSubscribed(token: string): Promise<void> {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return;
  }
  if (Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const keyRes = await fetch('/api/push/vapid-public-key');
      if (!keyRes.ok) return;
      const { publicKey } = (await keyRes.json()) as { publicKey?: string };
      if (!publicKey) return;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
      }),
    });
  } catch {
    // Ignore push subscription errors on unsupported browsers
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

export function showBrowserNotification(
  title: string,
  body: string,
  tag?: string,
  options?: { forceInForeground?: boolean }
): void {
  if (typeof window === 'undefined') return;
  if (isRunningInAndroidWebView()) {
    notifyAndroidSystem(title, body, tag);
    return;
  }
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden && !options?.forceInForeground) return;
  const trimmedBody = body.slice(0, 140);
  const chatId = tag || '';
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.ready
      .then((reg) => {
        const actions = chatId
          ? [
              {
                action: 'reply',
                type: 'text',
                title: 'Balas',
                placeholder: 'Ketik balasan...',
              },
              { action: 'open', title: 'Buka' },
            ]
          : undefined;
        const notifOptions = {
          body: trimmedBody,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: chatId ? `chat-${chatId}` : undefined,
          data: { chatId, url: chatId ? `/?chat=${encodeURIComponent(chatId)}` : '/' },
          actions,
        } as unknown as NotificationOptions;
        return reg.showNotification(title, notifOptions);
      })
      .catch(() => {
        new Notification(title, {
          body: trimmedBody,
          icon: '/pwa-192x192.png',
          tag,
        });
      });
    return;
  }
  try {
    new Notification(title, {
      body: trimmedBody,
      icon: '/pwa-192x192.png',
      tag,
    });
  } catch {
    // Ignore notification errors in restricted iframes
  }
}
