/**
 * Audio engine — 100% synthesized via the Web Audio API.
 *
 * No external .mp3/.wav assets exist anywhere in this app, so audio cannot fail
 * to load offline. The AudioContext is created lazily on the first user gesture
 * to satisfy mobile autoplay policies.
 */

let ctx: AudioContext | null = null;

type AudioCtor = typeof AudioContext;

function getAudioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Create/resume the shared AudioContext. Safe to call repeatedly. Returns null when unsupported. */
export function ensureAudio(): AudioContext | null {
  const Ctor = getAudioCtor();
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

export function isAudioReady(): boolean {
  return ctx != null && ctx.state === 'running';
}

interface ClickOptions {
  freq: number;
  type?: OscillatorType;
  gain?: number;
  durationMs?: number;
}

/** Schedule a single enveloped tone at an absolute AudioContext time. */
export function scheduleClick(when: number, opts: ClickOptions): void {
  const ac = ensureAudio();
  if (!ac) return;
  const t = Math.max(when, ac.currentTime);
  const dur = (opts.durationMs ?? 45) / 1000;
  const peak = opts.gain ?? 0.16;

  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = opts.type ?? 'square';
  osc.frequency.setValueAtTime(opts.freq, t);

  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

/** Immediate metronome click. Accent on the down-beat (every 10th tick) aids cadence counting. */
export function playClick(accent = false): void {
  const ac = ensureAudio();
  const when = ac ? ac.currentTime : 0;
  scheduleClick(when, {
    freq: accent ? 1320 : 880,
    type: 'square',
    gain: accent ? 0.2 : 0.14,
    durationMs: 35,
  });
}

/** Three rising two-tone pulses: the 2-minute cycle has expired. */
export function playCycleAlarm(): void {
  const ac = ensureAudio();
  if (!ac) return;
  const t = ac.currentTime;
  for (let i = 0; i < 3; i++) {
    const at = t + i * 0.42;
    scheduleClick(at, { freq: 1046, type: 'square', gain: 0.22, durationMs: 140 });
    scheduleClick(at + 0.16, { freq: 1568, type: 'square', gain: 0.22, durationMs: 160 });
  }
}

/** Soft ascending chime for ROSC. */
export function playChime(): void {
  const ac = ensureAudio();
  if (!ac) return;
  const t = ac.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    scheduleClick(t + i * 0.14, { freq: f, type: 'triangle', gain: 0.2, durationMs: 320 });
  });
}

/** Two-tone descending chime for code termination / final log. */
export function playClose(): void {
  const ac = ensureAudio();
  if (!ac) return;
  const t = ac.currentTime;
  scheduleClick(t, { freq: 587.33, type: 'triangle', gain: 0.2, durationMs: 300 });
  scheduleClick(t + 0.24, { freq: 392.0, type: 'triangle', gain: 0.2, durationMs: 420 });
}

/** Single short confirmation blip for successful logging. */
export function playConfirm(): void {
  const ac = ensureAudio();
  if (!ac) return;
  scheduleClick(ac.currentTime, { freq: 1180, type: 'sine', gain: 0.14, durationMs: 70 });
}
