import { Activity, Minus, Plus, Vibrate, Volume2, VolumeX } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { useMetronome } from '../../hooks/useMetronome';
import { ensureAudio, playClick } from '../../engine/audio';
import { hapticsSupported } from '../../engine/haptics';
import { Panel } from '../ui/Panel';

const MIN_BPM = 100;
const MAX_BPM = 110;

/** CPR metronome: blinking visual beat + synthesized audio tick + optional haptics. */
export function MetronomeCard() {
  const metronome = useCodeStore((s) => s.metronome);
  const setMetronome = useCodeStore((s) => s.setMetronome);
  const status = useCodeStore((s) => s.status);
  const { beat, running } = useMetronome();

  const canRun = status === 'active' || status === 'paused';

  const toggle = () => {
    ensureAudio(); // unlock the AudioContext on this user gesture
    const next = !metronome.on;
    setMetronome({ on: next });
    if (next && metronome.audio) playClick(true);
  };

  return (
    <Panel
      title="CPR metronome"
      icon={Activity}
      accent={running ? 'cyber' : 'none'}
      right={
        <span className="tnum text-xs font-bold text-mute">{metronome.bpm} bpm</span>
      }
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={!canRun && !metronome.on}
          className={[
            'touch-hit flex min-h-[64px] flex-1 items-center justify-center gap-3 rounded-2xl border text-lg font-bold active:scale-[0.98]',
            metronome.on
              ? 'border-cyber bg-cyber/20 text-cyber'
              : 'border-line bg-panel2 text-ink',
            !canRun ? 'opacity-40' : '',
          ].join(' ')}
        >
          <span
            key={running ? beat : 'idle'}
            className={`inline-block h-4 w-4 rounded-full ${
              running ? 'animate-beat bg-cyber' : 'bg-mute'
            }`}
            style={running ? { animationDuration: `${60 / metronome.bpm}s` } : undefined}
          />
          {metronome.on ? (status === 'paused' ? 'Metronome PAUSED' : 'Metronome ON') : 'Metronome OFF'}
        </button>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            aria-label="Decrease rate"
            onClick={() => setMetronome({ bpm: Math.max(MIN_BPM, metronome.bpm - 5) })}
            className="touch-hit flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-panel2 active:scale-95"
          >
            <Minus className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Increase rate"
            onClick={() => setMetronome({ bpm: Math.min(MAX_BPM, metronome.bpm + 5) })}
            className="touch-hit flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-panel2 active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            ensureAudio();
            setMetronome({ audio: !metronome.audio });
          }}
          className={[
            'touch-hit flex min-h-[56px] items-center justify-center gap-2 rounded-xl border text-sm font-bold active:scale-[0.97]',
            metronome.audio ? 'border-cyber/60 bg-cyber/10 text-cyber' : 'border-line bg-panel2 text-mute',
          ].join(' ')}
        >
          {metronome.audio ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          Audio {metronome.audio ? 'on' : 'off'}
        </button>
        <button
          type="button"
          onClick={() => setMetronome({ haptic: !metronome.haptic })}
          className={[
            'touch-hit flex min-h-[56px] items-center justify-center gap-2 rounded-xl border text-sm font-bold active:scale-[0.97]',
            metronome.haptic ? 'border-cyber/60 bg-cyber/10 text-cyber' : 'border-line bg-panel2 text-mute',
          ].join(' ')}
        >
          <Vibrate className="h-5 w-5" />
          Vibrate {metronome.haptic ? 'on' : 'off'}
        </button>
      </div>
      {!hapticsSupported() ? (
        <p className="mt-1 text-[11px] text-mute">Vibration unavailable on this device (iOS) — audio cues still fire.</p>
      ) : null}
      <p className="mt-1 text-[11px] text-mute">Accent tick every 10 beats aids cadence counting.</p>
    </Panel>
  );
}
