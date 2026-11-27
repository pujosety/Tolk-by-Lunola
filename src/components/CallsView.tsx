import { useMemo, useState } from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Plus,
  Search,
  Video,
  X,
} from 'lucide-react';
import type { CallRecord, UserProfile } from '../types/chat';
import { formatDuration, formatTimeShort } from '../lib/androidBridge';
import { Avatar } from './Avatar';

interface CallsViewProps {
  calls: CallRecord[];
  currentUser: UserProfile;
  users: Record<string, UserProfile>;
  onlineUserIds: Set<string>;
  onStartCall: (peerId: string, kind: 'voice' | 'video') => void;
}

export function CallsView({
  calls,
  currentUser,
  users,
  onlineUserIds,
  onStartCall,
}: CallsViewProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const contacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Object.values(users).filter(
      (u) => u.id !== currentUser.id && u.id !== 'usr_bot'
    );
    if (!q) return list;
    return list.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    );
  }, [users, currentUser.id, query]);

  return (
    <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto thin-scrollbar pb-28 md:pb-4">
      {/* Quick Action Banner */}
      <div className="px-4 py-3 border-b border-[#E6ECF2] dark:border-[#2A364B] flex items-center justify-between gap-3 bg-[#FFFFFF] dark:bg-[#171E2C]">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[#5A6578] dark:text-[#94A3B8]">
            Riwayat Panggilan
          </div>
          <p className="text-[11px] text-[#5A6578] dark:text-[#94A3B8]">
            Suara & video WebRTC pribadi
          </p>
        </div>
      </div>

      {/* Inline New Call Contact Picker */}
      {pickerOpen && (
        <div className="shrink-0 p5-panel-reveal p-3.5 border-b border-[#E6ECF2] dark:border-[#2A364B] bg-[#F5F7FA] dark:bg-[#131924] space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-[#5A6578] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari kontak untuk ditelepon..."
              className="w-full h-9 pl-9 pr-3 rounded-full bg-[#FFFFFF] dark:bg-[#1E2738] border border-[#E6ECF2] dark:border-[#2E3B52] text-xs text-[#161B26] dark:text-[#F1F5F9] focus:outline-none focus:border-[#8C0027]"
            />
          </div>
          <div className="max-h-72 overflow-y-auto thin-scrollbar space-y-1.5 pb-1">
            {contacts.length === 0 ? (
              <div className="py-4 text-center text-xs text-[#5A6578] dark:text-[#94A3B8]">
                Kontak tidak ditemukan.
              </div>
            ) : (
              contacts.map((u) => (
                <div
                  key={u.id}
                  className="px-2.5 py-2 rounded-xl bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#2A364B] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      name={u.displayName}
                      imageUrl={u.avatarUrl}
                      color={u.avatarColor}
                      online={onlineUserIds.has(u.id)}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#161B26] dark:text-[#F1F5F9] truncate">
                        {u.displayName}
                      </div>
                      <div className="text-[11px] font-mono text-[#5A6578] dark:text-[#94A3B8] truncate">
                        @{u.username}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setPickerOpen(false);
                        onStartCall(u.id, 'voice');
                      }}
                      aria-label={`Panggilan suara ke ${u.displayName}`}
                      className="h-10 w-10 rounded-full bg-[#EAF4FF] dark:bg-[#1B2436] text-[#8C0027] dark:text-[#F47296] hover:bg-[#8C0027] hover:text-white flex items-center justify-center brutal-press"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPickerOpen(false);
                        onStartCall(u.id, 'video');
                      }}
                      aria-label={`Panggilan video ke ${u.displayName}`}
                      className="h-10 w-10 rounded-full bg-[#FFF2A7] dark:bg-[#2B2618] text-[#161B26] dark:text-[#FFF2A7] hover:bg-[#F59B00] hover:text-white flex items-center justify-center brutal-press"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Call History List */}
      <div className="p-2.5 space-y-1 flex-1">
        {calls.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#BEDEFF]/70 dark:bg-[#1F2C44] text-[#8C0027] dark:text-[#BEDEFF] mx-auto flex items-center justify-center">
              <Phone className="w-7 h-7" />
            </div>
            <div className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F1F5F9]">
              Belum ada panggilan
            </div>
            <p className="text-xs text-[#5A6578] dark:text-[#94A3B8] max-w-xs mx-auto leading-relaxed">
              Tekan tombol <strong>Panggilan Baru</strong> di atas atau ikon telepon di ruang chat untuk mulai ngobrol lewat suara atau video.
            </p>
          </div>
        ) : (
          calls.map((c) => {
            const isOutgoing = c.callerId === currentUser.id;
            const peerId = isOutgoing ? c.calleeId : c.callerId;
            const peer = users[peerId];
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl hover:bg-[#F5F7FA] dark:hover:bg-[#1E2738] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    name={peer?.displayName || 'Pengguna'}
                    imageUrl={peer?.avatarUrl}
                    color={peer?.avatarColor}
                    online={peer ? onlineUserIds.has(peer.id) : false}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-bold truncate ${
                        c.status === 'missed' || c.status === 'rejected'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-[#161B26] dark:text-[#F5F7FA]'
                      }`}
                    >
                      {peer?.displayName || 'Pengguna'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#5A6578] dark:text-[#94A3B8]">
                      {c.status === 'missed' || c.status === 'rejected' ? (
                        <PhoneMissed className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      ) : isOutgoing ? (
                        <PhoneOutgoing className="w-3.5 h-3.5 text-[#8C0027] dark:text-[#F47296] shrink-0" />
                      ) : (
                        <PhoneIncoming className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      )}
                      <span className="truncate">
                        {c.kind === 'video' ? 'Video' : 'Suara'} ·{' '}
                        {c.durationSec > 0 ? formatDuration(c.durationSec) : c.status} ·{' '}
                        <span className="font-mono">{formatTimeShort(c.startedAt)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onStartCall(peerId, c.kind)}
                    aria-label="Panggil ulang"
                    className="h-9 w-9 rounded-xl border border-[#E6ECF2] dark:border-[#324058] bg-[#EAF4FF] dark:bg-[#1B2436] text-[#8C0027] dark:text-[#F47296] hover:bg-[#8C0027] hover:text-white flex items-center justify-center brutal-press"
                  >
                    {c.kind === 'video' ? (
                      <Video className="w-4 h-4" />
                    ) : (
                      <Phone className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      </div>

      {/* Floating New Call FAB (matching Status & Chat List) */}
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        aria-label={pickerOpen ? 'Tutup pemilih panggilan' : 'Panggilan baru'}
        title={pickerOpen ? 'Tutup' : 'Panggilan Baru'}
        className="flex absolute bottom-[calc(env(safe-area-inset-bottom,0px)+98px)] md:bottom-6 right-4 md:right-5 h-12 w-12 min-h-[44px] min-w-[44px] rounded-full bg-[#8C0027] hover:bg-[#6E001F] text-[#FFFFFF] border border-white/60 dark:border-[#F5F7FA]/40 brutal-shadow-maroon brutal-press p5-slash-btn items-center justify-center z-20"
      >
        {pickerOpen ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
      </button>
    </div>
  );
}
