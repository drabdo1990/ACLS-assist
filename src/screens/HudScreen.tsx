import { HeartPulse } from 'lucide-react';
import { useCodeStore } from '../engine/store';
import { MasterClock } from '../components/hud/MasterClock';
import { Controls } from '../components/hud/Controls';
import { CyclePanel } from '../components/hud/CyclePanel';
import { MetronomeCard } from '../components/hud/MetronomeCard';
import { RhythmBranch } from '../components/hud/RhythmBranch';
import { InterventionGrid } from '../components/hud/InterventionGrid';

import { useT } from '../i18n/useT';

/** Screen 1 — the ACLS command HUD. */
export function HudScreen({ onEnd, onOpenCauses }: { onEnd: () => void; onOpenCauses: () => void }) {
  const { t } = useT();
  const status = useCodeStore((s) => s.status);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-line bg-panel/80 p-3">
        <MasterClock />
        <div className="mt-3">
          <Controls onEnd={onEnd} />
        </div>
      </div>

      {status === 'rosc' ? (
        <button
          type="button"
          onClick={onOpenCauses}
          className="touch-hit flex min-h-[64px] items-center gap-3 rounded-2xl border border-good bg-good/15 px-4 text-left text-good active:scale-[0.98]"
        >
          <HeartPulse className="h-7 w-7 shrink-0" />
          <span>
            <span className="block text-lg font-bold leading-tight">{t('hud.roscBanner.title')}</span>
            <span className="block text-xs opacity-80">{t('hud.roscBanner.sub')}</span>
          </span>
        </button>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <CyclePanel />
        <div className="flex flex-col gap-3">
          <RhythmBranch />
          <MetronomeCard />
        </div>
      </div>

      <InterventionGrid />
    </div>
  );
}
