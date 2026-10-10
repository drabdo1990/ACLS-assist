import { Minus, Plus, Scale } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { Chip } from '../ui/Chip';

const PRESETS = [50, 70, 90, 110];

/** Shared protocol weight control: quick chips plus a 5 kg stepper. Persists with the session. */
export function WeightControl() {
  const weightKg = useCodeStore((s) => s.weightKg);
  const setWeight = useCodeStore((s) => s.setWeight);

  return (
    <div className="rounded-2xl border border-line bg-panel/80 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Scale className="h-4 w-4 text-mute" />
        <span className="text-xs font-bold uppercase tracking-widest text-mute">Protocol weight</span>
        <span className="tnum ml-auto font-mono text-xl font-bold text-cyber">{weightKg} kg</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((kg) => (
          <Chip key={kg} selected={weightKg === kg} onClick={() => setWeight(kg)}>
            {kg}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-label="Decrease weight"
          onClick={() => setWeight(weightKg - 5)}
          className="touch-hit flex h-14 flex-1 items-center justify-center rounded-xl border border-line bg-panel2 active:scale-95"
        >
          <Minus className="h-6 w-6" />
        </button>
        <button
          type="button"
          aria-label="Increase weight"
          onClick={() => setWeight(weightKg + 5)}
          className="touch-hit flex h-14 flex-1 items-center justify-center rounded-xl border border-line bg-panel2 active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
      <p className="mt-1 text-[11px] text-mute">Used to scale every crisis dose below. Not linked to any identifier.</p>
    </div>
  );
}
