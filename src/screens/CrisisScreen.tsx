import { RotateCcw } from 'lucide-react';
import { hasCrisisClock, useCodeStore } from '../engine/store';
import { WeightControl } from '../components/crisis/WeightControl';
import { LastCard } from '../components/crisis/LastCard';
import { MhCard } from '../components/crisis/MhCard';
import { CicoCard } from '../components/crisis/CicoCard';
import { MaternalCard } from '../components/crisis/MaternalCard';
import { HoldButton } from '../components/ui/HoldButton';

/** View 2 — critical crisis action cards with dynamic weight scaling. */
export function CrisisScreen() {
  const status = useCodeStore((s) => s.status);
  const crisisClock = useCodeStore(hasCrisisClock);
  const hasEvents = useCodeStore((s) => s.events.length > 0);
  const reset = useCodeStore((s) => s.reset);

  return (
    <div className="flex flex-col gap-3">
      <WeightControl />
      <LastCard />
      <MhCard />
      <CicoCard />
      <MaternalCard />
      {status === 'idle' && (crisisClock || hasEvents) ? (
        <HoldButton
          variant="outline"
          size="lg"
          icon={RotateCcw}
          label="End crisis session"
          sub="Hold 2.5 s — clears session & releases wake lock (export from Log first)"
          durationMs={2500}
          onComplete={reset}
        />
      ) : null}
    </div>
  );
}

