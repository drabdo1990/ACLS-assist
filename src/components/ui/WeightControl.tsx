import { Minus, Plus, Scale } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { Chip } from './Chip';
import { useT } from '../../i18n/useT';

const PRESETS = [50, 70, 90, 110];

/** Dosing weight control (lidocaine mg/kg): quick chips plus a 5 kg stepper. Persists with the session. */
export function WeightControl() {
  const { t } = useT();
  const weightKg = useCodeStore((s) => s.weightKg);
  const setWeight = useCodeStore((s) => s.setWeight);

  return (
    <div className="rounded-xl border border-line bg-panel2/50 p-2">
      <div className="mb-2 flex items-center gap-2">
        <Scale className="h-4 w-4 text-mute" />
        <span className="text-xs font-bold uppercase tracking-widest text-mute">{t('ui.weight.title')}</span>
        <span className="tnum ml-auto font-mono text-xl font-bold text-cyber">{weightKg} kg</span>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        <button
          type="button"
          aria-label={t('ui.weight.dec')}
          onClick={() => setWeight(weightKg - 5)}
          className="touch-hit flex min-h-[56px] items-center justify-center rounded-xl border border-line bg-panel2 active:scale-95"
        >
          <Minus className="h-5 w-5" />
        </button>
        {PRESETS.map((kg) => (
          <Chip key={kg} selected={weightKg === kg} onClick={() => setWeight(kg)} className="min-w-0 px-1">
            {kg}
          </Chip>
        ))}
        <button
          type="button"
          aria-label={t('ui.weight.inc')}
          onClick={() => setWeight(weightKg + 5)}
          className="touch-hit flex min-h-[56px] items-center justify-center rounded-xl border border-line bg-panel2 active:scale-95"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
