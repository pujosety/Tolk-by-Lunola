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
      className={`${
        closing ? 'p5-backdrop-out pointer-events-none' : 'p5-backdrop-in'
      } fixed inset-0 z-50 bg-[#151914]/92 backdrop-blur-md flex items-center justify-center p-4`}
    >
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div
        className={`${
          closing ? 'p5-modal-out' : 'p5-modal-impact'
        } relative w-full max-w-lg rounded-3xl bg-[#1E241C] border border-[#F2F2F2] overflow-hidden brutal-shadow-lg text-[#F2F2F2]`}
      >
        {/* Video Canvas when video call active */}
        {activeSession.kind === 'video' && (
          <div className="relative h-80 bg-[#151914] border-b-2 border-[#364032] flex items-center justify-center">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-[#CBBBC2]">
                <Avatar
                  name={peerUser?.displayName || 'Pengguna'}
                  imageUrl={peerUser?.avatarUrl}
                  color={peerUser?.avatarColor}
                  size="xl"
                />
                <span className="text-xs font-medium text-[#A3AD9E]">
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
                className="absolute bottom-3 right-3 w-28 h-36 rounded-xl object-cover border border-[#F2F2F2] brutal-shadow-sm bg-[#252C22]"
              />
            )}
          </div>
        )}

        {/* Voice Call Header or Video Info */}
        <div className="p-6 flex flex-col items-center text-center">
          {activeSession.kind === 'voice' && (
            <Avatar
              name={peerUser?.displayName || 'Pengguna'}
              imageUrl={peerUser?.avatarUrl}
              color={peerUser?.avatarColor}
              size="xl"
            />
          )}

          <h2 className="mt-4 font-display font-extrabold text-2xl tracking-tight text-[#F2F2F2]">
            {peerUser?.displayName || 'Pengguna Tolk by Lunola'}
          </h2>
          <p className="mt-1.5 inline-block px-2.5 py-0.5 rounded-lg bg-[#D96868] border border-[#F2F2F2] text-xs text-white font-mono font-bold tabular-nums">
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

          {/* Controls */}
          <div className="mt-7 flex items-center justify-center gap-3 flex-wrap">
            {activeSession.direction === 'incoming' && activeSession.state === 'ringing' ? (
              <>
                <button
                  type="button"
                  onClick={onReject}
                  aria-label="Tolak panggilan"
                  className="w-14 h-14 rounded-xl bg-[#D96868] hover:bg-[#C45454] border border-[#F2F2F2] text-white flex items-center justify-center brutal-shadow-sm brutal-press"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={onAccept}
                  aria-label="Terima panggilan"
                  className="w-14 h-14 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-[#F2F2F2] text-white flex items-center justify-center brutal-shadow-sm brutal-press"
                >
                  {activeSession.kind === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={micMuted ? 'Aktifkan mikrofon' : 'Bisukan mikrofon'}
                  className={`w-12 h-12 rounded-xl border flex items-center justify-center brutal-press transition-colors ${
                    micMuted
                      ? 'bg-[#F2F2F2] border-[#F2F2F2] text-[#252A24]'
                      : 'bg-[#2B3328] border-[#3C4738] hover:border-[#F2F2F2] text-[#F2F2F2]'
                  }`}
                >
                  {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setSpeakerOn((s) => !s)}
                  aria-label={speakerOn ? 'Matikan speaker' : 'Aktifkan speaker'}
                  className={`w-12 h-12 rounded-xl border flex items-center justify-center brutal-press transition-colors ${
                    !speakerOn
                      ? 'bg-[#F2F2F2] border-[#F2F2F2] text-[#252A24]'
                      : 'bg-[#2B3328] border-[#3C4738] hover:border-[#F2F2F2] text-[#F2F2F2]'
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
                      className={`w-12 h-12 rounded-xl border flex items-center justify-center brutal-press transition-colors ${
                        camOff
                          ? 'bg-[#F2F2F2] border-[#F2F2F2] text-[#252A24]'
                          : 'bg-[#2B3328] border-[#3C4738] hover:border-[#F2F2F2] text-[#F2F2F2]'
                      }`}
                    >
                      {camOff ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                    </button>
                    <button
                      type="button"
                      onClick={onSwitchCamera}
                      aria-label="Ganti kamera depan atau belakang"
                      title="Ganti kamera"
                      className="w-12 h-12 rounded-xl bg-[#2B3328] border border-[#3C4738] hover:border-[#F2F2F2] text-[#F2F2F2] flex items-center justify-center brutal-press transition-colors"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => onEnd(elapsedSec)}
                  aria-label="Akhiri panggilan"
                  className="w-14 h-14 rounded-xl bg-[#D96868] hover:bg-[#C45454] border border-[#F2F2F2] text-white flex items-center justify-center brutal-shadow-sm brutal-press"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
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
  if (!mounted) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${closing ? 'pointer-events-none' : ''}`}>
      <div
        className={`${closing ? 'p5-backdrop-out' : 'p5-backdrop-in'} fixed inset-0 bg-[#252A24]/65 backdrop-blur-[2px]`}
        onClick={onClose}
      />
      <div
        className={`${
          closing ? 'p5-modal-out' : 'p5-modal-impact'
        } relative z-10 w-full max-w-md max-h-[82dvh] flex flex-col rounded-3xl bg-[#FBF9F6] dark:bg-[#1E241C] border border-[#E3E1DC] dark:border-[#F2F2F2] brutal-shadow-lg overflow-hidden`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#E3E1DC] dark:border-[#364032] bg-[#F2F2F2] dark:bg-[#191E17]">
          <div>
            <h2 className="font-display font-extrabold text-xl leading-tight text-[#252A24] dark:text-[#F2F2F2]">
              Riwayat Panggilan
            </h2>
            <p className="text-xs text-[#5E645C] dark:text-[#A3AD9E]">
              Panggilan suara & video WebRTC pribadi
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup riwayat panggilan"
            className="h-8 w-8 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] bg-[#FBF9F6] dark:bg-[#2B3328] text-[#252A24] dark:text-[#F2F2F2] hover:bg-[#D96868] hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scrollbar p-3 space-y-1.5">
          {calls.length === 0 ? (
            <p className="text-xs text-[#5E645C] dark:text-[#A3AD9E] text-center py-10">
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
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-transparent hover:border-[#E3E1DC] dark:hover:border-[#3C4738] hover:bg-[#F2F2F2] dark:hover:bg-[#2B3328] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={peer?.displayName || 'Pengguna'}
                      imageUrl={peer?.avatarUrl}
                      color={peer?.avatarColor}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#252A24] dark:text-[#F2F2F2] truncate">
                        {peer?.displayName || 'Pengguna'}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#5E645C] dark:text-[#A3AD9E]">
                        {c.status === 'missed' || c.status === 'rejected' ? (
                          <PhoneMissed className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        ) : isOutgoing ? (
                          <PhoneOutgoing className="w-3.5 h-3.5 text-[#D96868] dark:text-[#E58383]" />
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
                    className="h-9 w-9 rounded-xl border border-[#E3E1DC] dark:border-[#3C4738] bg-[#FCEAEA] dark:bg-[#2E2223] text-[#D96868] dark:text-[#E58383] hover:bg-[#D96868] hover:text-white flex items-center justify-center brutal-press"
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
  );
}
