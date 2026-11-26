/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const PUSH_AUTH_CACHE = 'tolk-push-auth-v1';
const PUSH_AUTH_KEY = '/__tolk_push_auth';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
self.skipWaiting();
clientsClaim();

interface PushPayload {
  title?: string;
  body?: string;
  chatId?: string;
  tag?: string;
  url?: string;
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {};
  try {
    payload = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    payload = { body: event.data?.text() || 'Pesan baru masuk' };
  }

  const title = payload.title || 'Tolk by Lunola';
  const body = payload.body || 'Anda menerima pesan baru.';
  const chatId = payload.chatId || '';
  const tag = payload.tag || (chatId ? `chat-${chatId}` : 'tolk-msg');
  const url = payload.url || (chatId ? `/?chat=${encodeURIComponent(chatId)}` : '/');

  const actions = chatId
    ? [
        {
          action: 'reply',
          type: 'text',
          title: 'Balas',
          placeholder: 'Ketik balasan...',
        },
        {
          action: 'open',
          title: 'Buka',
        },
      ]
    : [{ action: 'open', title: 'Buka' }];

  const notifOptions = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag,
    renotify: true,
    data: { chatId, url },
    actions,
  } as unknown as NotificationOptions;

  event.waitUntil(self.registration.showNotification(title, notifOptions));
});

async function getSavedAuthToken(): Promise<string | null> {
  try {
    const cache = await caches.open(PUSH_AUTH_CACHE);
    const res = await cache.match(PUSH_AUTH_KEY);
    if (!res) return null;
    const token = (await res.text()).trim();
    return token || null;
  } catch {
    return null;
  }
}

self.addEventListener('notificationclick', (event) => {
  const notifEvent = event as NotificationEvent & { reply?: string };
  const data = (notifEvent.notification.data || {}) as { chatId?: string; url?: string };
  const chatId = data.chatId || '';
  const targetUrl = data.url || '/';

  notifEvent.notification.close();

  if (notifEvent.action === 'reply' && notifEvent.reply?.trim() && chatId) {
    const replyText = notifEvent.reply.trim();
    notifEvent.waitUntil(
      (async () => {
        const token = await getSavedAuthToken();
        if (!token) {
          await self.clients.openWindow(targetUrl);
          return;
        }
        try {
          const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ text: replyText }),
          });
          if (!res.ok) {
            await self.clients.openWindow(targetUrl);
          }
        } catch {
          await self.clients.openWindow(targetUrl);
        }
      })()
    );
    return;
  }

  notifEvent.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'tolk:open-chat', chatId });
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});
