import { Pause, Play, Radio, ShieldAlert, Siren, RotateCcw } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { BigButton } from '../ui/BigButton';
import { HoldButton } from '../ui/HoldButton';

/** Primary code lifecycle controls. Destructive actions are press-and-hold. */
export function Controls() {
  const status = useCodeStore((s) => s.status);
  const startCode = useCodeStore((s) => s.startCode);
  const pauseCode = useCodeStore((s) => s.pauseCode);
  const resumeCode = useCodeStore((s) => s.resumeCode);
  const declareRosc = useCodeStore((s) => s.declareRosc);
  const terminateCode = useCodeStore((s) => s.terminateCode);
  const reArrest = useCodeStore((s) => s.reArrest);
  const reset = useCodeStore((s) => s.reset);

  if (status === 'idle') {
    return (
      <BigButton
        variant="crit"
        size="xl"
        icon={Siren}
        label="START CODE"
        sub="Begin CPR timer, cycle clock and logging"
        onClick={startCode}
        className="animate-ping-crit"
      />
    );
  }

  if (status === 'terminated') {
    return (
      <HoldButton
        variant="outline"
        size="lg"
        icon={RotateCcw}
        label="Start new code"
        sub="Hold 2.5 s — clears this session (export from Log first)"
        durationMs={2500}
        onComplete={reset}
      />
    );
  }

  if (status === 'rosc') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <BigButton
          variant="crit"
          size="lg"
          icon={Siren}
          label="Re-arrest"
          sub="Resume CPR"
          onClick={reArrest}
        />
        <HoldButton
          variant="outline"
          size="lg"
          icon={RotateCcw}
          label="End session"
          sub="Hold 2.5 s — export from Log first"
          durationMs={2500}
          onComplete={reset}
        />
      </div>
    );
  }

  // active | paused
  return (
    <div className="grid grid-cols-2 gap-2">
      {status === 'active' ? (
        <BigButton variant="warn" size="lg" icon={Pause} label="Pause" onClick={pauseCode} />
      ) : (
        <BigButton variant="cyber" size="lg" icon={Play} label="Resume" onClick={resumeCode} />
      )}
      <HoldButton
        variant="good"
        size="lg"
        icon={Radio}
        label="ROSC"
        durationMs={1200}
        onComplete={declareRosc}
      />
      <HoldButton
        variant="outline"
        size="lg"
        icon={ShieldAlert}
        label="Terminate code"
        durationMs={2000}
        onComplete={terminateCode}
        className="col-span-2"
      />
    </div>
  );
}
