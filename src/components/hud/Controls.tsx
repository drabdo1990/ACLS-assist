import { ClipboardList, Pause, Play, Radio, RotateCcw, ShieldAlert, Siren } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { BigButton } from '../ui/BigButton';
import { HoldButton } from '../ui/HoldButton';
import { PopulationToggle } from './PopulationToggle';
import { WeightCard } from './WeightCard';
import { useT } from '../../i18n/useT';

/**
 * Primary code lifecycle controls. Interventions elsewhere are one tap; lifecycle
 * transitions that are unsafe to trigger by accident (ROSC, end code, new session)
 * are press-and-hold.
 */
export function Controls({ onEnd }: { onEnd: () => void }) {
  const { t } = useT();
  const status = useCodeStore((s) => s.status);
  const population = useCodeStore((s) => s.population);
  const startCode = useCodeStore((s) => s.startCode);
  const pauseCode = useCodeStore((s) => s.pauseCode);
  const resumeCode = useCodeStore((s) => s.resumeCode);
  const declareRosc = useCodeStore((s) => s.declareRosc);
  const terminateCode = useCodeStore((s) => s.terminateCode);
  const reArrest = useCodeStore((s) => s.reArrest);
  const reset = useCodeStore((s) => s.reset);

  if (status === 'idle') {
    return (
      <div className="flex flex-col gap-2">
        <PopulationToggle />
        {population === 'pediatric' ? <WeightCard /> : null}
        <BigButton
          variant="crit"
          size="xl"
          icon={Siren}
          label={t('hud.ctrl.startCode')}
          sub={t('hud.ctrl.startCodeSub')}
          onClick={startCode}
          className="animate-ping-crit"
        />
      </div>
    );
  }

  if (status === 'terminated') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <BigButton
          variant="cyber"
          size="lg"
          icon={ClipboardList}
          label={t('hud.ctrl.reviewCode')}
          sub={t('hud.ctrl.reviewCodeSub')}
          onClick={onEnd}
        />
        <HoldButton
          variant="outline"
          size="lg"
          icon={RotateCcw}
          label={t('hud.ctrl.newCode')}
          sub={t('hud.ctrl.newCodeSub')}
          durationMs={2500}
          onComplete={reset}
        />
      </div>
    );
  }

  if (status === 'rosc') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <BigButton
          variant="crit"
          size="lg"
          icon={Siren}
          label={t('hud.ctrl.rearrest')}
          sub={t('hud.ctrl.rearrestSub')}
          onClick={reArrest}
        />
        <BigButton
          variant="cyber"
          size="lg"
          icon={ClipboardList}
          label={t('hud.ctrl.reviewCode')}
          sub={t('hud.ctrl.reviewCodeSub')}
          onClick={onEnd}
        />
      </div>
    );
  }

  // active | paused
  return (
    <div className="grid grid-cols-2 gap-2">
      {status === 'active' ? (
        <BigButton variant="warn" size="lg" icon={Pause} label={t('hud.ctrl.pause')} onClick={pauseCode} />
      ) : (
        <BigButton variant="cyber" size="lg" icon={Play} label={t('hud.ctrl.resume')} onClick={resumeCode} />
      )}
      <HoldButton
        variant="good"
        size="lg"
        icon={Radio}
        label={t('hud.ctrl.rosc')}
        durationMs={1200}
        onComplete={declareRosc}
      />
      <HoldButton
        variant="outline"
        size="lg"
        icon={ShieldAlert}
        label={t('hud.ctrl.end')}
        sub={t('hud.ctrl.endSub')}
        durationMs={2000}
        onComplete={() => {
          terminateCode();
          onEnd();
        }}
        className="col-span-2"
      />
    </div>
  );
}
