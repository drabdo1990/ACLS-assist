import { useCodeStore } from '../engine/store';
import { MasterClock } from '../components/hud/MasterClock';
import { Controls } from '../components/hud/Controls';
import { CyclePanel } from '../components/hud/CyclePanel';
import { MetronomeCard } from '../components/hud/MetronomeCard';
import { InterventionGrid } from '../components/hud/InterventionGrid';
import { ReversibleCauses } from '../components/hud/ReversibleCauses';
import { PostArrest } from '../components/hud/PostArrest';

/** View 1 — the active code / CPR tracker HUD. */
export function HudScreen() {
  const status = useCodeStore((s) => s.status);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-line bg-panel/80 p-3">
        <MasterClock />
        <div className="mt-3">
          <Controls />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <CyclePanel />
        <MetronomeCard />
      </div>

      <InterventionGrid />

      {status === 'rosc' ? <PostArrest /> : null}

      <ReversibleCauses />
    </div>
  );
}
