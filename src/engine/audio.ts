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

const audioListeners = new Set<() => void>();
const notifyAudio = () => audioListeners.forEach((fn) => fn());

/** Subscribe to AudioContext creation / state changes (for the "sound off" hint). */
export function subscribeAudioState(fn: () => void): () => void {
  audioListeners.add(fn);
  return () => {
    audioListeners.delete(fn);
  };
}

export function isAudioSupported(): boolean {
  return getAudioCtor() != null;
}

/** Create/resume the shared AudioContext. Safe to call repeatedly. Returns null when unsupported. */
export function ensureAudio(): AudioContext | null {
  const Ctor = getAudioCtor();
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
      ctx.addEventListener('statechange', notifyAudio);
      notifyAudio();
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

/** 10-second warning: three soft, evenly spaced chimes before the cycle ends. */
export function playWarningChimes(): void {
  const ac = ensureAudio();
  if (!ac) return;
  const t = ac.currentTime;
  for (let i = 0; i < 3; i++) {
    scheduleClick(t + i * 0.32, { freq: 1318.5, type: 'sine', gain: 0.18, durationMs: 220 });
  }
}

/** One frequency-swept sawtooth "whoop" — the building block of the klaxon. */
function sweep(ac: AudioContext, when: number, from: number, to: number, durS: number, peak: number): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(from, when);
  osc.frequency.linearRampToValueAtTime(to, when + durS);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(peak, when + 0.02);
  g.gain.setValueAtTime(peak, when + durS - 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, when + durS);
  osc.connect(g).connect(ac.destination);
  osc.start(when);
  osc.stop(when + durS + 0.03);
}

/**
 * Cycle-expiry klaxon: three harsh rising two-tone sawtooth sweeps. Deliberately
 * timbrally distinct from the sine warning chimes so the team can tell them apart.
 */
export function playKlaxon(): void {
  const ac = ensureAudio();
  if (!ac) return;
  const t = ac.currentTime;
  for (let i = 0; i < 3; i++) {
    const at = t + i * 0.62;
    sweep(ac, at, 440, 880, 0.26, 0.2);
    sweep(ac, at + 0.28, 587, 1175, 0.26, 0.2);
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
