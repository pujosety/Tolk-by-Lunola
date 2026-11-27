import { useState } from 'react';
import { Bell, CheckCircle2, Megaphone, Sparkles, UserPlus } from 'lucide-react';
import type { FriendRequest, PlatformSettings, UserProfile } from '../types/chat';
import { formatTimeShort } from '../lib/androidBridge';
import { Avatar } from './Avatar';

interface NotificationsUpdatesViewProps {
  currentUserId: string;
  users: Record<string, UserProfile>;
  friendRequests: FriendRequest[];
  settings: PlatformSettings | null;
  onRespondRequest: (requestId: string, action: 'accept' | 'reject') => Promise<void>;
}

export function NotificationsUpdatesView({
  currentUserId,
  users,
  friendRequests,
  settings,
  onRespondRequest,
}: NotificationsUpdatesViewProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const incomingPending = friendRequests.filter(
    (r) => r.toUserId === currentUserId && r.status === 'pending'
  );
  const outgoingPending = friendRequests.filter(
    (r) => r.fromUserId === currentUserId && r.status === 'pending'
  );
  const announcement = settings?.globalAnnouncement?.trim() || '';

  return (
    <div className="flex-1 overflow-y-auto thin-scrollbar p-3.5 pb-28 md:pb-4 space-y-5 bg-[#FFFFFF] dark:bg-[#171E2C]">
      {/* Platform Announcement / System Update */}
      <section className="space-y-2">
        <div className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wider text-[#5A6578] dark:text-[#94A3B8]">
          <Megaphone className="w-3.5 h-3.5 text-[#8C0027] dark:text-[#F47296]" />
          <span>Info & Pengumuman</span>
        </div>
        {announcement ? (
          <div className="p-3.5 rounded-2xl bg-[#EAF4FF] dark:bg-[#1B2436] border border-[#8C0027]/30 text-xs text-[#161B26] dark:text-[#F5F7FA] leading-relaxed brutal-shadow-sm">
            {announcement}
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] flex items-center gap-3 text-xs text-[#5A6578] dark:text-[#94A3B8]">
            <Sparkles className="w-4 h-4 text-[#F59B00] shrink-0" />
            <span>Semua sistem berjalan normal. Tidak ada pengumuman baru.</span>
          </div>
        )}
      </section>

      {/* Incoming Friend Requests */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5A6578] dark:text-[#94A3B8]">
            <UserPlus className="w-3.5 h-3.5 text-[#F59B00]" />
            <span>Permintaan Kontak ({incomingPending.length})</span>
          </div>
        </div>

        {incomingPending.length === 0 ? (
          <div className="p-5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] text-center space-y-2">
            <div className="w-11 h-11 rounded-full bg-[#E6ECF2] dark:bg-[#2A364B] text-[#5A6578] dark:text-[#94A3B8] mx-auto flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div className="text-xs font-semibold text-[#5A6578] dark:text-[#94A3B8]">
              Belum ada permintaan kontak masuk.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {incomingPending.map((req) => {
              const sender = users[req.fromUserId];
              if (!sender) return null;
              return (
                <div
                  key={req.id}
                  className="p-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] flex items-center justify-between gap-2 brutal-shadow-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      name={sender.displayName}
                      imageUrl={sender.avatarUrl}
                      color={sender.avatarColor}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#161B26] dark:text-[#F5F7FA] truncate">
                        {sender.displayName}
                      </div>
                      <div className="text-xs font-mono text-[#8C0027] dark:text-[#F47296] truncate">
                        @{sender.username} · {formatTimeShort(req.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={async () => {
                        setBusyId(req.id);
                        try {
                          await onRespondRequest(req.id, 'reject');
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-[#E6ECF2] dark:border-[#2A364B] bg-[#FFFFFF] dark:bg-[#171E2C] text-xs font-bold text-[#5A6578] dark:text-[#94A3B8] hover:text-[#8C0027]"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={async () => {
                        setBusyId(req.id);
                        try {
                          await onRespondRequest(req.id, 'accept');
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#F59B00] hover:bg-[#D98800] text-white text-xs font-bold brutal-shadow-sm brutal-press"
                    >
                      Terima
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Outgoing Pending */}
      {outgoingPending.length > 0 && (
        <section className="space-y-2">
          <div className="px-1 text-xs font-bold uppercase tracking-wider text-[#5A6578] dark:text-[#94A3B8]">
            Menunggu Persetujuan ({outgoingPending.length})
          </div>
          <div className="space-y-1.5">
            {outgoingPending.map((req) => {
              const target = users[req.toUserId];
              if (!target) return null;
              return (
                <div
                  key={req.id}
                  className="p-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2A364B] flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-semibold text-[#161B26] dark:text-[#F1F5F9] truncate">
                    {target.displayName} (@{target.username})
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#E6ECF2] dark:bg-[#2A364B] text-[11px] font-bold text-[#5A6578] dark:text-[#94A3B8]">
                    Menunggu
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* App Status Footer Card */}
      <section className="p-3.5 rounded-2xl bg-[#FFF9D6]/60 dark:bg-[#1B2436] border border-[#E6ECF2] dark:border-[#2A364B] flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="text-xs text-[#161B26] dark:text-[#E2E8F0]">
          <span className="font-bold">Tolk by Lunola</span> aktif dengan sinkronisasi real-time dan Pesan Berbintang.
        </div>
      </section>
    </div>
  );
}
