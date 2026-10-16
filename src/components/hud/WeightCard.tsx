import { Minus, Plus, Scale } from 'lucide-react';
import { useState } from 'react';
import { useCodeStore } from '../../engine/store';
import { AGE_CHIPS, estimateWeightFromAgeMonths } from '../../content/profiles/pediatric';
import { Chip } from '../ui/Chip';
import { useT, type TFn } from '../../i18n/useT';
import { stepKg, stepperValue } from './weightStepper';

const KG_CHIPS = [3, 5, 10, 15, 20, 30, 40];

/** Age chip label: Newborn (0 m), "6 m", "4 y". */
function ageChipLabel(ageMonths: number, t: TFn): string {
  if (ageMonths === 0) return t('peds.age.newborn');
  return ageMonths < 12
    ? t('peds.age.months', { months: ageMonths })
    : t('peds.age.years', { years: ageMonths / 12 });
}

/**
 * Pediatric weight card: a kg stepper with quick measured chips, plus an APLS
 * estimate-from-age row. Works on the idle screen (prepares the session) and during
 * a pediatric code (correction; the store logs the event).
 */
export function WeightCard() {
  const { t } = useT();
  const weightKg = useCodeStore((s) => s.weightKg);
  const weightSource = useCodeStore((s) => s.weightSource);
  const ageMonths = useCodeStore((s) => s.ageMonths);
  const setPediatricWeight = useCodeStore((s) => s.setPediatricWeight);
  // A manual stepper edit; null = follow the weight already set on the code (default 15 when none).
  const [draftKg, setDraftKg] = useState<number | null>(null);
  const stepperKg = stepperValue(draftKg, weightKg);

  const summary =
    weightKg == null
      ? t('peds.weight.notSet')
      : weightSource === 'estimated'
        ? ageMonths != null && ageMonths < 12
          ? t('peds.weight.summary.estimatedMonths', { kg: weightKg, months: ageMonths })
          : t('peds.weight.summary.estimated', { kg: weightKg, years: ageMonths != null ? ageMonths / 12 : 0 })
        : t('peds.weight.summary.measured', { kg: weightKg });

  return (
    <div className="rounded-xl border border-peds/40 bg-peds/5 p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <Scale className="h-4 w-4 text-peds" />
        <span className="text-xs font-bold uppercase tracking-widest text-peds">{t('peds.weight.title')}</span>
        <span className="ms-auto text-sm font-bold text-peds" dir="ltr">
          {summary}
        </span>
      </div>

      {/* kg stepper + measured quick chips */}
      <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-mute">{t('peds.weight.measuredChips')}</p>
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          aria-label={t('ui.weight.dec')}
          onClick={() => setDraftKg(stepKg(stepperKg, -1))}
          className="touch-hit flex w-12 items-center justify-center rounded-xl border border-line bg-panel2 active:scale-95"
        >
          <Minus className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label={t('ui.weight.set')}
          onClick={() => {
            setPediatricWeight(stepperKg, 'measured');
            setDraftKg(null);
          }}
          className="touch-hit flex-1 rounded-xl border border-peds bg-peds/15 text-peds active:scale-[0.98]"
        >
          <span className="tnum font-mono text-xl font-bold" dir="ltr">
            {stepperKg} kg
          </span>
        </button>
        <button
          type="button"
          aria-label={t('ui.weight.inc')}
          onClick={() => setDraftKg(stepKg(stepperKg, 1))}
          className="touch-hit flex w-12 items-center justify-center rounded-xl border border-line bg-panel2 active:scale-95"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1">
        {KG_CHIPS.map((kg) => (
          <Chip
            key={kg}
            selected={weightSource === 'measured' && weightKg === kg}
            onClick={() => {
              setDraftKg(null);
              setPediatricWeight(kg, 'measured');
            }}
            className="min-w-0 px-0.5"
          >
            <span dir="ltr">{kg}</span>
          </Chip>
        ))}
      </div>

      {/* Estimate from age (APLS) */}
      <p className="mt-2.5 mb-1 text-[11px] font-bold uppercase tracking-widest text-mute">
        {t('peds.weight.estimateFromAge')}
      </p>
      <div className="grid grid-cols-5 gap-1">
        {AGE_CHIPS.map((m) => (
          <Chip
            key={m}
            selected={weightSource === 'estimated' && ageMonths === m}
            onClick={() => {
              const kg = estimateWeightFromAgeMonths(m);
              if (kg != null) {
                setDraftKg(null);
                setPediatricWeight(kg, 'estimated', m);
              }
            }}
            className="min-w-0 px-0.5 text-[11px]"
          >
            {ageChipLabel(m, t)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
