import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, RefreshCw, RotateCcw, ScanLine, X } from 'lucide-react';

interface CameraCaptureModalProps {
  open: boolean;
  mode: 'photo' | 'qr';
  onClose: () => void;
  onCapturePhoto?: (file: File) => void;
  onScanQr?: (rawValue: string) => void;
}

export function CameraCaptureModal({
  open,
  mode,
  onClose,
  onCapturePhoto,
  onScanQr,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualQr, setManualQr] = useState('');

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      setCameraReady(false);
      setCapturedDataUrl(null);
      setCameraError(null);
      setManualQr('');
      return;
    }

    let cancelled = false;
    setCameraReady(false);
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera tidak tersedia di browser ini. Gunakan unggah foto atau ketik manual.');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError('Izin kamera belum aktif. Aktifkan izin kamera atau pilih foto langsung.');
        }
      });

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, facingMode]);

  // Live QR detection via native BarcodeDetector when available
  useEffect(() => {
    if (!open || mode !== 'qr' || cameraError) return;
    const BD = (window as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => {
        detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
      };
    }).BarcodeDetector;
    if (!BD) return;

    let active = true;
    const detector = new BD({ formats: ['qr_code'] });
    const interval = window.setInterval(async () => {
      const video = videoRef.current;
      if (!active || !video || video.readyState < 2) return;
      try {
        const codes = await detector.detect(video);
        const hit = codes.find((c) => c.rawValue && c.rawValue.trim().length > 0);
        if (hit?.rawValue && onScanQr) {
          active = false;
          window.clearInterval(interval);
          stopStream();
          onScanQr(hit.rawValue.trim());
          onClose();
        }
      } catch {
        // Ignore single-frame detection errors
      }
    }, 450);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [open, mode, cameraError, onScanQr, onClose]);

  if (!open) return null;

  const handleSnap = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth <= 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedDataUrl(canvas.toDataURL('image/jpeg', 0.9));
  };

  const handleConfirmPhoto = async () => {
    if (!capturedDataUrl || !onCapturePhoto) return;
    const res = await fetch(capturedDataUrl);
    const blob = await res.blob();
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapturePhoto(file);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[65] bg-[#0F141E] text-white flex flex-col">
      {/* Top Bar */}
      <div className="pt-safe-3 px-4 pb-3 flex items-center justify-between gap-3 bg-[#0F141E]/85 backdrop-blur-md z-10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup kamera"
          className="h-10 px-3 rounded-2xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Tutup</span>
        </button>
        <div className="font-display font-extrabold text-base flex items-center gap-1.5">
          {mode === 'qr' ? <ScanLine className="w-4 h-4 text-[#FFF2A7]" /> : <Camera className="w-4 h-4 text-[#BEDEFF]" />}
          <span>{mode === 'qr' ? 'Scan QR Kontak' : 'Ambil Foto'}</span>
        </div>
        <button
          type="button"
          onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
          aria-label="Ganti kamera"
          className="h-10 w-10 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Viewfinder */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
        {capturedDataUrl ? (
          <img src={capturedDataUrl} alt="Hasil foto" className="max-h-full max-w-full object-contain" />
        ) : cameraError ? (
          <div className="px-6 text-center max-w-sm space-y-3">
            <Camera className="w-10 h-10 text-[#BEDEFF] mx-auto" />
            <p className="text-xs text-white/80 leading-relaxed">{cameraError}</p>
            {mode === 'photo' && (
              <>
                <input
                  ref={fallbackInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f && onCapturePhoto) {
                      onCapturePhoto(f);
                      onClose();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fallbackInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-2xl bg-[#8C0027] text-white text-xs font-bold"
                >
                  Buka Kamera Bawaan / Galeri
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
              onLoadedData={() => setCameraReady(true)}
              onPlaying={() => setCameraReady(true)}
              className={`w-full h-full object-cover transition-opacity duration-200 ${
                cameraReady ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0F141E]">
                <div className="relative h-16 w-16 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-[3px] border-white/15 border-t-[#FFF2A7] border-r-[#BEDEFF] animate-spin" />
                  <img
                    src="/assets/aistudio/tolk-symbol-small_cb061777.svg"
                    alt="Tolk"
                    className="h-8 w-8 object-contain brightness-0 invert select-none"
                  />
                </div>
                <span className="text-xs font-semibold text-white/75">
                  Menyiapkan kamera...
                </span>
              </div>
            )}
            {mode === 'qr' && cameraReady && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-60 h-60 rounded-3xl border-4 border-[#FFF2A7] shadow-[0_0_0_9999px_rgba(15,20,30,0.55)]" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="pt-4 pb-safe-3 px-5 bg-[#0F141E]/95 border-t border-white/10 shrink-0">
        {mode === 'qr' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualQr.trim() || !onScanQr) return;
              onScanQr(manualQr.trim());
              onClose();
            }}
            className="max-w-md mx-auto flex gap-2"
          >
            <input
              type="text"
              value={manualQr}
              onChange={(e) => setManualQr(e.target.value)}
              placeholder="Atau tempel link / ketik @username..."
              className="flex-1 h-11 px-3.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder:text-white/50 focus:outline-none focus:border-[#FFF2A7]"
            />
            <button
              type="submit"
              className="px-4 h-11 rounded-xl bg-[#8C0027] hover:bg-[#6E001F] text-white text-xs font-bold shrink-0"
            >
              Cari
            </button>
          </form>
        ) : capturedDataUrl ? (
          <div className="max-w-sm mx-auto flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setCapturedDataUrl(null)}
              className="flex-1 h-12 rounded-2xl bg-white/15 hover:bg-white/25 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Ulangi</span>
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmPhoto()}
              className="flex-1 h-12 rounded-2xl bg-[#8C0027] hover:bg-[#6E001F] text-white text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Gunakan Foto</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={onClose}
              aria-label="Batal"
              className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              type="button"
              disabled={Boolean(cameraError)}
              onClick={handleSnap}
              aria-label="Jepret foto"
              className="h-16 w-16 rounded-full bg-white border-4 border-[#BEDEFF] flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
            >
              <span className="h-12 w-12 rounded-full bg-[#8C0027]" />
            </button>
            <div className="w-11" />
          </div>
        )}
      </div>
    </div>
  );
}
