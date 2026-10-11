import { Scissors, Syringe, TriangleAlert } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { useNow } from '../../hooks/useNow';
import { formatClock } from '../../engine/timing';
import { sugammadexPlan } from '../../content/calc';
import { CICO_STEPS } from '../../content/protocols';
import { CrisisCard, Readout } from './CrisisCard';
import { BigButton } from '../ui/BigButton';

/** CICO / failed airway — DAS 2025 scalpel-bougie-tube pathway plus sugammadex rescue. */
export function CicoCard() {
  const now = useNow();
  const weightKg = useCodeStore((s) => s.weightKg);
  const crisis = useCodeStore((s) => s.crisis);
  const declareCrisis = useCodeStore((s) => s.declareCrisis);
  const resolveCrisis = useCodeStore((s) => s.resolveCrisis);
  const logCrisisDose = useCodeStore((s) => s.logCrisisDose);

  const sug = sugammadexPlan(weightKg);
  const declared = crisis.cicoDeclaredAt != null;
  const since = declared ? formatClock(now - (crisis.cicoDeclaredAt ?? now)) : null;

  return (
    <CrisisCard
      title="CICO — Can't Intubate, Can't Oxygenate"
      subtitle="DAS 2025 · scalpel–bougie–tube 6.0 · sugammadex rescue"
      icon={Scissors}
      accent="crit"
      badge={
        <span className="tnum rounded-full border border-crit/60 px-2 py-0.5 text-[10px] font-bold text-crit">
          {weightKg} kg
        </span>
      }
    >
      {!declared ? (
        <BigButton
          variant="crit"
          size="xl"
          icon={TriangleAlert}
          label="DECLARE CICO — eFONA"
          sub="Starts the front-of-neck-access clock"
          onClick={() => declareCrisis('cico')}
        />
      ) : (
        <div className="rounded-xl border border-crit bg-crit/10 p-3 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-crit">CICO declared</p>
          <p className="tnum font-mono text-4xl font-bold text-crit">{since}</p>
          <p className="text-[11px] text-mute">since declaration</p>
          <button
            type="button"
            onClick={() => resolveCrisis('cico')}
            className="touch-hit mt-2 min-h-[48px] w-full rounded-xl border border-good/60 bg-good/15 text-xs font-bold text-good active:scale-[0.98]"
          >
            Airway secured — resolve CICO timer
          </button>
        </div>
      )}

      <ol className="mt-3 space-y-1.5">
        {CICO_STEPS.map((step) => (
          <li
            key={step.n}
            className={[
              'flex gap-3 rounded-xl border p-3',
              step.critical ? 'border-crit/50 bg-crit/5' : 'border-line bg-panel2',
            ].join(' ')}
          >
            <span
              className={[
                'tnum flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono text-lg font-bold',
                step.critical ? 'border-crit text-crit' : 'border-line text-mute',
              ].join(' ')}
            >
              {step.n}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-bold ${step.critical ? 'text-crit' : 'text-ink'}`}>
                {step.title}
              </span>
              <span className="block text-xs leading-snug text-mute">{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-3 rounded-xl border border-cyber/50 bg-cyber/5 p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold text-cyber">
          <Syringe className="h-4 w-4" /> Sugammadex rescue 16 mg/kg
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Readout label="Dose" value={sug.doseMg} unit="mg" tone="cyber" />
          <Readout label="Volume" value={sug.volumeMl} unit="mL" />
          <Readout label="200 mg vials" value={sug.vials200} unit="vials" />
        </div>
        <BigButton
          className="mt-2"
          variant="cyber"
          icon={Syringe}
          label={`Log sugammadex ${sug.doseMg} mg`}
          sub={`${sug.volumeMl} mL (100 mg/mL)`}
          onClick={() =>
            logCrisisDose({
              label: `Sugammadex ${sug.doseMg} mg IV (16 mg/kg)`,
              mg: sug.doseMg,
              ml: sug.volumeMl,
              category: 'drug',
            })
          }
        />
        <p className="mt-1 text-[11px] text-mute">Reverse rocuronium/vecuronium if a neuromuscular blocker caused the failure.</p>
      </div>
    </CrisisCard>
  );
}
