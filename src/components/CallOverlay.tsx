import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  RefreshCw,
  Video,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { CallRecord, UserProfile } from '../types/chat';
import { formatDuration, formatTimeShort, setAndroidCallAudioMode } from '../lib/androidBridge';
import { useAnimatedPresence, useRetainedValue } from '../lib/useAnimatedPresence';
import { useSwipeGesture } from '../lib/useSwipeGesture';
import { Avatar } from './Avatar';

export interface ActiveCallSession {
  callId: string;
  peerId: string;
  kind: 'voice' | 'video';
  direction: 'incoming' | 'outgoing';
  state: 'ringing' | 'connecting' | 'connected';
}

interface CallOverlayProps {
  session: ActiveCallSession | null;
  peerUser: UserProfile | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onAccept: () => void;
  onReject: () => void;
  onEnd: (durationSec: number) => void;
  onSwitchCamera: () => void;
}

export function CallOverlay({
  session,
  peerUser,
  localStream,
  remoteStream,
  onAccept,
  onReject,
  onEnd,
  onSwitchCamera,
}: CallOverlayProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    setMicMuted(false);
    setCamOff(false);
    setSpeakerOn(true);
    setElapsedSec(0);
  }, [session?.callId]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    setAndroidCallAudioMode(Boolean(session));
    return () => {
      setAndroidCallAudioMode(false);
    };
  }, [session]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      void remoteVideoRef.current.play().catch(() => {});
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.muted = !speakerOn;
      remoteAudioRef.current.volume = 1;
      void remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream, speakerOn]);

  useEffect(() => {
    if (!session || session.state !== 'connected') return;
    const timer = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  const { renderedValue: activeSession, closing } = useRetainedValue(session, 200);

  if (!activeSession) return null;

  const toggleMic = () => {
    const next = !micMuted;
    setMicMuted(next);
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  };

  const toggleCam = () => {
    const next = !camOff;
    setCamOff(next);
    localStream?.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
  };

  return (
    <div
      style={{
        height: 'var(--app-height, 100dvh)',
        top: 'var(--vv-offset-top, 0px)',
      }}
      className={`${
        closing ? 'p5-backdrop-out pointer-events-none' : 'p5-backdrop-in'
      } fixed inset-x-0 z-[85] bg-[#0F141E] sm:bg-[#0F141E]/92 sm:backdrop-blur-md flex items-stretch sm:items-center justify-center p-0 sm:p-4`}
    >
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div
        className={`${
          closing ? 'p5-modal-out' : 'p5-modal-impact'
        } relative w-full h-full sm:h-[88dvh] sm:max-h-[760px] sm:max-w-lg rounded-none sm:rounded-3xl bg-gradient-to-b from-[#23101B] via-[#141A26] to-[#0F141E] sm:border sm:border-[#F5F7FA]/30 overflow-hidden brutal-shadow-lg text-[#F5F7FA] flex flex-col justify-between`}
      >
        {/* Animated WhatsApp-style Doodle Wallpaper */}
        <div
          aria-hidden="true"
          className="doodle-call-bg pointer-events-none absolute inset-0"
        />

        {/* Full-Bleed Video Canvas when video call active */}
        {activeSession.kind === 'video' && (
          <div className="absolute inset-0 bg-[#0F141E] flex items-center justify-center">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-[#CBBBC2] px-6 text-center">
                <Avatar
                  name={peerUser?.displayName || 'Pengguna'}
                  imageUrl={peerUser?.avatarUrl}
                  color={peerUser?.avatarColor}
                  size="xl"
                />
                <span className="text-xs font-medium text-[#94A3B8]">
                  {activeSession.state === 'ringing' ? 'Menghubungkan video...' : 'Menunggu kamera lawan...'}
                </span>
              </div>
            )}

            {localStream && !camOff && (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="absolute top-20 sm:top-4 right-4 w-28 h-40 rounded-2xl object-cover border-2 border-white/75 brutal-shadow bg-[#1E2738] z-20"
              />
            )}
          </div>
        )}

        {/* Top Header Info */}
        <div
          className={`relative z-10 pt-safe-3 sm:pt-6 px-6 pb-4 flex flex-col items-center text-center ${
            activeSession.kind === 'video'
              ? 'bg-gradient-to-b from-black/75 via-black/35 to-transparent'
              : 'flex-1 justify-center'
          }`}
        >
          {activeSession.kind === 'voice' && (
            <div className="relative mb-2">
              <div className="absolute -inset-3 rounded-full bg-[#8C0027]/25 animate-ping" />
              <Avatar
                name={peerUser?.displayName || 'Pengguna'}
                imageUrl={peerUser?.avatarUrl}
                color={peerUser?.avatarColor}
                size="xl"
              />
            </div>
          )}

          <h2 className="mt-4 font-display font-extrabold text-2xl tracking-tight text-[#F5F7FA] drop-shadow-sm">
            {peerUser?.displayName || 'Pengguna Tolk by Lunola'}
          </h2>
          <p className="mt-2 inline-block px-3 py-1 rounded-full bg-[#8C0027]/90 border border-white/25 text-xs text-white font-mono font-bold tabular-nums">
            {activeSession.state === 'ringing' && activeSession.direction === 'incoming'
              ? activeSession.kind === 'video'
                ? 'Panggilan video masuk...'
                : 'Panggilan suara masuk...'
              : activeSession.state === 'ringing'
              ? 'Berdering...'
              : activeSession.state === 'connecting'
              ? 'Menyambungkan WebRTC...'
              : formatDuration(elapsedSec)}
          </p>
        </div>

        {/* Bottom Controls */}
        <div
          className={`relative z-10 pt-6 pb-safe-3 sm:pb-7 px-6 flex items-center justify-center gap-3.5 flex-wrap ${
            activeSession.kind === 'video'
              ? 'bg-gradient-to-t from-black/85 via-black/45 to-transparent'
              : ''
          }`}
        >
          {activeSession.direction === 'incoming' && activeSession.state === 'ringing' ? (
            <>
              <button
                type="button"
                onClick={onReject}
                aria-label="Tolak panggilan"
                className="w-16 h-16 rounded-full bg-[#8C0027] hover:bg-[#6E001F] border border-white/30 text-white flex items-center justify-center brutal-shadow-sm brutal-press"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <button
                type="button"
                onClick={onAccept}
                aria-label="Terima panggilan"
                className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 border border-white/30 text-white flex items-center justify-center brutal-shadow-sm brutal-press"
              >
                {activeSession.kind === 'video' ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleMic}
                aria-label={micMuted ? 'Aktifkan mikrofon' : 'Bisukan mikrofon'}
                className={`w-13 h-13 rounded-full border flex items-center justify-center brutal-press transition-colors ${
                  micMuted
                    ? 'bg-[#F5F7FA] border-[#F5F7FA] text-[#161B26]'
                    : 'bg-white/15 backdrop-blur-md border-white/25 hover:bg-white/25 text-[#F5F7FA]'
                }`}
              >
                {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={() => setSpeakerOn((s) => !s)}
                aria-label={speakerOn ? 'Matikan speaker' : 'Aktifkan speaker'}
                className={`w-13 h-13 rounded-full border flex items-center justify-center brutal-press transition-colors ${
                  !speakerOn
                    ? 'bg-[#F5F7FA] border-[#F5F7FA] text-[#161B26]'
                    : 'bg-white/15 backdrop-blur-md border-white/25 hover:bg-white/25 text-[#F5F7FA]'
                }`}
              >
                {speakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>

              {activeSession.kind === 'video' && (
                <>
                  <button
                    type="button"
                    onClick={toggleCam}
                    aria-label={camOff ? 'Nyalakan kamera' : 'Matikan kamera'}
                    className={`w-13 h-13 rounded-full border flex items-center justify-center brutal-press transition-colors ${
                      camOff
                        ? 'bg-[#F5F7FA] border-[#F5F7FA] text-[#161B26]'
                        : 'bg-white/15 backdrop-blur-md border-white/25 hover:bg-white/25 text-[#F5F7FA]'
                    }`}
                  >
                    {camOff ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={onSwitchCamera}
                    aria-label="Ganti kamera depan atau belakang"
                    title="Ganti kamera"
                    className="w-13 h-13 rounded-full bg-white/15 backdrop-blur-md border border-white/25 hover:bg-white/25 text-[#F5F7FA] flex items-center justify-center brutal-press transition-colors"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => onEnd(elapsedSec)}
                aria-label="Akhiri panggilan"
                className="w-15 h-15 rounded-full bg-[#8C0027] hover:bg-[#6E001F] border border-white/30 text-white flex items-center justify-center brutal-shadow-sm brutal-press"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CallHistoryModal({
  open,
  calls,
  currentUserId,
  users,
  onClose,
  onStartCall,
}: {
  open: boolean;
  calls: CallRecord[];
  currentUserId: string;
  users: Record<string, UserProfile>;
  onClose: () => void;
  onStartCall: (peerId: string, kind: 'voice' | 'video') => void;
}) {
  const { mounted, closing } = useAnimatedPresence(open, 200);
  const edgeSwipe = useSwipeGesture({
    direction: 'right',
    edgeOnlyPx: 28,
    threshold: 75,
    onTrigger: onClose,
  });
  if (!mounted) return null;

  return (
    <div
      style={{
        height: 'var(--app-height, 100dvh)',
        top: 'var(--vv-offset-top, 0px)',
      }}
      className={`fixed inset-x-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 ${closing ? 'pointer-events-none' : ''}`}
    >
      <div
        className={`${closing ? 'p5-backdrop-out' : 'p5-backdrop-in'} hidden sm:block fixed inset-0 bg-[#161B26]/65 backdrop-blur-[2px]`}
        onClick={onClose}
      />
      <div
        className={`${
          closing ? 'p5-modal-out' : 'p5-modal-impact'
        } relative z-10 w-full h-full sm:h-auto sm:max-w-md sm:max-h-[82dvh]`}
      >
        <div
          {...edgeSwipe.handlers}
          style={
            edgeSwipe.offsetX > 0
              ? { transform: `translate3d(${edgeSwipe.offsetX}px, 0, 0)` }
              : undefined
          }
          className={`${
            edgeSwipe.isDragging ? '' : 'transition-transform duration-200 ease-out'
          } touch-pan-y w-full h-full flex flex-col rounded-none sm:rounded-3xl bg-[#FFFFFF] dark:bg-[#171E2C] sm:border sm:border-[#E6ECF2] sm:dark:border-[#F5F7FA] brutal-shadow-lg overflow-hidden`}
        >
        <div className="pt-safe-2 sm:pt-4 flex items-center justify-between px-5 pb-4 border-b-2 border-[#E6ECF2] dark:border-[#2A364B] bg-[#F5F7FA] dark:bg-[#131924]">
          <div>
            <h2 className="font-display font-extrabold text-xl leading-tight text-[#161B26] dark:text-[#F5F7FA]">
              Riwayat Panggilan
            </h2>
            <p className="text-xs text-[#5A6578] dark:text-[#94A3B8]">
              Panggilan suara & video WebRTC pribadi
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup riwayat panggilan"
            className="h-10 w-10 rounded-full border border-[#E6ECF2] dark:border-[#324058] bg-[#FFFFFF] dark:bg-[#232D40] text-[#161B26] dark:text-[#F5F7FA] hover:bg-[#8C0027] hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scrollbar p-3 space-y-1.5">
          {calls.length === 0 ? (
            <p className="text-xs text-[#5A6578] dark:text-[#94A3B8] text-center py-10">
              Belum ada riwayat panggilan. Buka chat pribadi lalu tekan ikon telepon atau kamera.
            </p>
          ) : (
            calls.map((c) => {
              const isOutgoing = c.callerId === currentUserId;
              const peerId = isOutgoing ? c.calleeId : c.callerId;
              const peer = users[peerId];
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-transparent hover:border-[#E6ECF2] dark:hover:border-[#324058] hover:bg-[#F5F7FA] dark:hover:bg-[#232D40] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={peer?.displayName || 'Pengguna'}
                      imageUrl={peer?.avatarUrl}
                      color={peer?.avatarColor}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#161B26] dark:text-[#F5F7FA] truncate">
                        {peer?.displayName || 'Pengguna'}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#5A6578] dark:text-[#94A3B8]">
                        {c.status === 'missed' || c.status === 'rejected' ? (
                          <PhoneMissed className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        ) : isOutgoing ? (
                          <PhoneOutgoing className="w-3.5 h-3.5 text-[#8C0027] dark:text-[#F47296]" />
                        ) : (
                          <PhoneIncoming className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span>
                          {c.kind === 'video' ? 'Video' : 'Suara'} ·{' '}
                          {c.durationSec > 0 ? formatDuration(c.durationSec) : c.status} ·{' '}
                          <span className="font-mono">{formatTimeShort(c.startedAt)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onStartCall(peerId, c.kind);
                    }}
                    aria-label="Panggil ulang"
                    className="h-9 w-9 rounded-xl border border-[#E6ECF2] dark:border-[#324058] bg-[#EAF4FF] dark:bg-[#1B2436] text-[#8C0027] dark:text-[#F47296] hover:bg-[#8C0027] hover:text-white flex items-center justify-center brutal-press"
                  >
                    {c.kind === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
