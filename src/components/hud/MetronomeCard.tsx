import { Activity, Minus, Plus, Vibrate, Volume2, VolumeX } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { useMetronome } from '../../hooks/useMetronome';
import { ensureAudio, playClick } from '../../engine/audio';
import { hapticsSupported } from '../../engine/haptics';
import { profileFor } from '../../content/profiles';
import { Panel } from '../ui/Panel';
import { useT } from '../../i18n/useT';

const MIN_BPM = 100;
const MAX_BPM = 110;

/** CPR metronome: LED-style visual beacon + synthesized audio tick + optional haptics. */
export function MetronomeCard() {
  const { t } = useT();
  const metronome = useCodeStore((s) => s.metronome);
  const setMetronome = useCodeStore((s) => s.setMetronome);
  const status = useCodeStore((s) => s.status);
  const population = useCodeStore((s) => s.population);
  const profile = profileFor(population);
  const { beat, running } = useMetronome();

  const canRun = status === 'active' || status === 'paused';

  const toggle = () => {
    ensureAudio(); // unlock the AudioContext on this user gesture
    const next = !metronome.on;
    setMetronome({ on: next });
    if (next && metronome.audio) playClick(true);
  };

  const toggleText = metronome.on
    ? status === 'paused'
      ? t('hud.metro.paused')
      : t('hud.metro.on')
    : t('hud.metro.off');

  return (
    <Panel
      title={t('hud.metro.title')}
      icon={Activity}
      accent={running ? 'cyber' : 'none'}
      right={
        <span dir="ltr" className="tnum text-xs font-bold text-mute">{metronome.bpm} bpm</span>
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
          {/* LED-style beacon: flashes on every beat, brighter on the accented 10th. */}
          <span
            key={running ? beat : 'idle'}
            aria-hidden
            className={`inline-block h-6 w-6 rounded-full border-2 ${
              running
                ? 'animate-led border-cyber bg-cyber shadow-[0_0_14px_4px_rgba(6,182,212,0.75)]'
                : 'border-line bg-panel2'
            }`}
            style={running ? { animationDuration: `${60 / metronome.bpm}s` } : undefined}
          />
          {toggleText}
        </button>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            aria-label={t('hud.metro.dec')}
            onClick={() => setMetronome({ bpm: Math.max(MIN_BPM, metronome.bpm - 5) })}
            className="touch-hit flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-panel2 active:scale-95"
          >
            <Minus className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label={t('hud.metro.inc')}
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
          {metronome.audio ? t('hud.metro.audioOn') : t('hud.metro.audioOff')}
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
          {metronome.haptic ? t('hud.metro.vibrateOn') : t('hud.metro.vibrateOff')}
        </button>
      </div>
      {!hapticsSupported() ? (
        <p className="mt-1 text-[11px] text-mute">{t('hud.metro.noHaptics')}</p>
      ) : null}
      <p className="mt-1 text-[11px] text-mute">{t('hud.metro.accentNote')}</p>
      {population === 'pediatric' ? (
        <p className="mt-1.5 rounded-lg border border-peds/30 bg-peds/5 px-2 py-1.5 text-[11px] font-semibold leading-tight text-peds">
          {t(profile.cpr.ratioKey)} · {t(profile.cpr.depthKey)} · {t(profile.cpr.rateKey)}
        </p>
      ) : null}
    </Panel>
  );
}
