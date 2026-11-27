import { useMemo, useState } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
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
      {/* Call History List */}
      <div className="p-2.5 space-y-1 flex-1">
        {calls.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#BEDEFF]/70 dark:bg-[#1F2C44] text-[#8C0027] dark:text-[#BEDEFF] mx-auto flex items-center justify-center">
              <PhoneCall className="w-7 h-7" />
            </div>
            <div className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F1F5F9]">
              Belum ada panggilan
            </div>
            <p className="text-xs text-[#5A6578] dark:text-[#94A3B8] max-w-xs mx-auto leading-relaxed">
              Ketuk tombol telepon di kanan bawah atau ikon telepon di ruang chat untuk mulai ngobrol lewat suara atau video.
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
                    className="h-11 w-11 rounded-full border border-[#E6ECF2] dark:border-[#324058] bg-[#EAF4FF] dark:bg-[#1B2436] text-[#8C0027] dark:text-[#F47296] hover:bg-[#8C0027] hover:text-white flex items-center justify-center transition-colors"
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

      {/* Floating New Call FAB (Clean circular phone button, matching Status & Chat List) */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        aria-label="Mulai panggilan baru"
        title="Panggilan Baru"
        className="flex absolute bottom-[calc(env(safe-area-inset-bottom,0px)+98px)] md:bottom-6 right-4 md:right-5 h-12 w-12 min-h-[44px] min-w-[44px] rounded-full bg-[#8C0027] hover:bg-[#6E001F] text-[#FFFFFF] shadow-[0_10px_26px_rgba(140,0,39,0.34)] active:scale-95 transition-all duration-200 items-center justify-center z-20"
      >
        <PhoneCall className="w-5 h-5" />
      </button>

      {/* New Call Contact Picker Bottom Sheet / Modal */}
      {pickerOpen && (
        <div
          onClick={() => setPickerOpen(false)}
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 p5-backdrop-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl liquid-glass p-4 pb-safe-3 space-y-3 p5-modal-impact max-h-[78dvh] flex flex-col"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-extrabold text-base text-[#161B26] dark:text-[#F5F7FA]">
                  Mulai Panggilan
                </h3>
                <p className="text-xs text-[#5A6578] dark:text-[#94A3B8]">
                  Pilih kontak untuk panggilan suara atau video
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label="Tutup daftar panggilan"
                className="h-11 w-11 rounded-full bg-[#F5F7FA] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#5A6578] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama atau @username..."
                className="w-full h-11 pl-10 pr-4 rounded-full bg-[#FFFFFF] dark:bg-[#171E2C] border border-[#E6ECF2] dark:border-[#324058] text-sm text-[#161B26] dark:text-[#F1F5F9] focus:outline-none focus:border-[#8C0027]"
              />
            </div>

            <div className="flex-1 overflow-y-auto thin-scrollbar space-y-1.5 pr-0.5">
              {contacts.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#5A6578] dark:text-[#94A3B8]">
                  Kontak tidak ditemukan.
                </div>
              ) : (
                contacts.map((u) => (
                  <div
                    key={u.id}
                    className="px-3 py-2 rounded-2xl bg-[#FFFFFF]/90 dark:bg-[#171E2C]/90 border border-[#E6ECF2] dark:border-[#2A364B] flex items-center justify-between gap-2"
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
                        <div className="text-sm font-bold text-[#161B26] dark:text-[#F1F5F9] truncate">
                          {u.displayName}
                        </div>
                        <div className="text-xs font-mono text-[#5A6578] dark:text-[#94A3B8] truncate">
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
                        className="h-11 w-11 rounded-full bg-[#EAF4FF] dark:bg-[#1B2436] text-[#8C0027] dark:text-[#F47296] hover:bg-[#8C0027] hover:text-white flex items-center justify-center transition-colors"
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
                        className="h-11 w-11 rounded-full bg-[#8C0027] text-white hover:bg-[#6E001F] flex items-center justify-center transition-colors"
                      >
                        <Video className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
