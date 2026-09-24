import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Mic, PenLine, Square, Trash2, Upload } from 'lucide-react';
import { Button } from './Button';

type State = 'idle' | 'requesting' | 'recording' | 'denied' | 'unsupported';

interface Props {
  onCaptured: (blob: Blob) => void;
  onManual?: () => void;
  disabled?: boolean;
  /** `hero` is the dashboard/record workspace; `inline` is a narrower column. */
  variant?: 'hero' | 'inline';
}

const BARS = 64;
const FLOOR = 0.035;

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? '';
}

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * The voice stage — the product's visual identity.
 *
 * The waveform is driven by real microphone amplitude, so it is flat in a quiet
 * room and moves because someone is speaking. It is feedback, not decoration,
 * and the glow appears only while the microphone is genuinely live.
 */
export function VoiceStage({ onCaptured, onManual, disabled = false, variant = 'hero' }: Props) {
  const [state, setState] = useState<State>('idle');
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => new Array(BARS).fill(FLOOR));
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const teardown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    rafRef.current = null;
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  useEffect(() => {
    if (typeof window !== 'undefined'
      && (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')) {
      setState('unsupported');
    }
  }, []);

  const start = async () => {
    setError(null);
    setState('requesting');
    cancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        teardown();
        setState('idle');
        setSeconds(0);
        setLevels(new Array(BARS).fill(FLOOR));
        if (!cancelledRef.current && blob.size > 0) onCaptured(blob);
      };
      recorderRef.current = recorder;
      recorder.start();

      const AudioCtx = window.AudioContext
        ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i += 1) {
          peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
        }
        setLevels((prev) => [...prev.slice(1), Math.max(FLOOR, Math.min(1, peak * 1.9))]);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      setState('recording');
    } catch (err) {
      teardown();
      const name = (err as Error).name;
      if (name === 'NotAllowedError' || name === 'SecurityError') setState('denied');
      else {
        setState('idle');
        setError((err as Error).message || 'Could not start recording');
      }
    }
  };

  const stop = () => recorderRef.current?.stop();
  const cancel = () => { cancelledRef.current = true; recorderRef.current?.stop(); };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onCaptured(file);
  };

  if (state === 'unsupported') {
    return (
      <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center">
        <p className="text-[13.5px] text-muted">This browser can&rsquo;t record audio.</p>
        <div className="mt-5 flex justify-center"><UploadControl onPick={onPickFile} /></div>
      </div>
    );
  }

  const live = state === 'recording';
  const hero = variant === 'hero';

  return (
    <div className="w-full">
      <div
        className={`relative overflow-hidden rounded-xl border bg-surface transition-colors duration-[320ms]
          ${live ? 'border-accent-line' : 'border-line'}
          ${hero ? 'px-6 py-10 sm:px-10 sm:py-12' : 'px-5 py-8'}`}
      >
        {/* Status line — announced, not just coloured. */}
        <p
          className="flex items-center justify-center gap-2 text-[12.5px] font-medium"
          role="status"
          aria-live="polite"
        >
          {live ? (
            <>
              <span className="relative flex h-1.5 w-1.5" aria-hidden>
                <span className="ring absolute inline-flex h-full w-full rounded-full bg-record" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-record" />
              </span>
              <span className="text-record">Listening</span>
            </>
          ) : state === 'requesting' ? (
            <span className="text-muted">Waiting for microphone permission…</span>
          ) : (
            <span className="text-muted">Ready to listen</span>
          )}
        </p>

        {/* Symmetric waveform, mirrored about the centre line. */}
        <div
          className={`mt-7 flex items-center justify-center gap-[3px] ${hero ? 'h-28' : 'h-20'}`}
          aria-hidden
        >
          {levels.map((level, i) => {
            const h = Math.max(2, level * (hero ? 108 : 72));
            return (
              <span
                key={i}
                className={`w-[2px] rounded-full transition-[height] duration-[90ms]
                  ${live ? 'bg-accent' : 'bg-line-strong'}`}
                style={{ height: `${h}px`, opacity: live ? 0.32 + level * 0.68 : 0.5 }}
              />
            );
          })}
        </div>

        <p className={`tabular mt-6 text-center font-mono leading-none tracking-tight
          ${hero ? 'text-[30px]' : 'text-[22px]'} ${live ? 'text-ink' : 'text-muted'}`}>
          {clock(seconds)}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {live ? (
            <>
              <Button variant="ghost" size="md" onClick={cancel}>
                <Trash2 size={15} aria-hidden /> Discard
              </Button>
              <Button variant="primary" size="lg" onClick={stop}>
                <Square size={13} aria-hidden fill="currentColor" /> Stop &amp; process
              </Button>
            </>
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={disabled || state === 'requesting'}
              className={`group relative flex items-center justify-center rounded-full bg-accent
                text-accent-ink transition-[transform,box-shadow] duration-200
                hover:scale-[1.03] active:scale-[0.97]
                disabled:pointer-events-none disabled:opacity-40
                ${hero ? 'h-[72px] w-[72px]' : 'h-[60px] w-[60px]'}`}
            >
              <span
                className="breathe absolute -inset-2 rounded-full border border-accent-line"
                aria-hidden
              />
              <Mic size={hero ? 25 : 21} aria-hidden />
              <span className="sr-only">Start recording</span>
            </button>
          )}
        </div>

        {!live && (
          <p className="mx-auto mt-6 max-w-[22rem] text-center text-[12.5px] leading-relaxed text-muted">
            Say the customer, what you did, and the amount to charge.
          </p>
        )}

        {/* The one glow in the product, and only while the mic is truly live. */}
        {live && (
          <span
            aria-hidden
            className="mic-live pointer-events-none absolute inset-0 rounded-xl"
          />
        )}
      </div>

      {state === 'denied' && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-warning-line
          bg-warning-soft px-4 py-3.5">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="text-[13px] font-semibold text-ink">Microphone access was blocked</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-dim">
              Allow microphone access from your browser&rsquo;s address bar, or upload a recording instead.
            </p>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-center text-[12.5px] text-danger">{error}</p>}

      {!live && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <UploadControl onPick={onPickFile} />
          {onManual && (
            <Button variant="ghost" size="md" onClick={onManual}>
              <PenLine size={14} aria-hidden /> Enter manually
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function UploadControl({ onPick }: { onPick: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label
      className="inline-flex h-9.5 cursor-pointer items-center justify-center gap-2 rounded-lg border
        border-line bg-raised px-4 text-[13.5px] font-medium text-ink transition-colors duration-[120ms]
        hover:border-line-strong hover:bg-elevated
        focus-within:outline focus-within:outline-2 focus-within:outline-accent"
    >
      <Upload size={14} aria-hidden />
      Upload a recording
      <input
        type="file"
        accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm"
        className="sr-only"
        onChange={onPick}
      />
    </label>
  );
}
