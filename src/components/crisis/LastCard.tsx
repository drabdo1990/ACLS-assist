import { useEffect } from 'react';
import { Droplet, Syringe, TriangleAlert } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { lastLipidPlan, lipidCumulative } from '../../content/calc';
import { LAST_CHECKLIST } from '../../content/protocols';
import { CrisisCard, Readout } from './CrisisCard';
import { Checklist } from './Checklist';
import { ProgressBar } from '../ui/ProgressBar';
import { BigButton } from '../ui/BigButton';

const LIPID_CEILING_ALERT = 'ALERT — 20% lipid 12 mL/kg ceiling exceeded';

/** LAST — 20% lipid emulsion therapy with live cumulative 12 mL/kg ceiling tracking. */
export function LastCard() {
  const weightKg = useCodeStore((s) => s.weightKg);
  const crisis = useCodeStore((s) => s.crisis);
  const doses = useCodeStore((s) => s.crisisDoses);
  const declareCrisis = useCodeStore((s) => s.declareCrisis);
  const logCrisisDose = useCodeStore((s) => s.logCrisisDose);

  const plan = lastLipidPlan(weightKg);
  // Only boluses carry a volume; infusions are logged as a rate and are not summed here.
  const administered = doses
    .filter((d) => d.label.startsWith('20% Lipid') && d.ml != null)
    .reduce((sum, d) => sum + (d.ml ?? 0), 0);
  const cum = lipidCumulative(weightKg, administered);

  // Derived from the persisted log so remounting the card never re-logs the alert.
  const warned = doses.some((d) => d.label === LIPID_CEILING_ALERT);
  useEffect(() => {
    if (cum.exceeded && !warned) {
      logCrisisDose({ label: LIPID_CEILING_ALERT, ml: Math.round(administered) });
    }
  }, [cum.exceeded, warned, administered, logCrisisDose]);

  const declared = crisis.lastDeclaredAt != null;

  return (
    <CrisisCard
      title="LAST — Local Anesthetic Toxicity"
      subtitle="20% lipid emulsion · stop injection · avoid vasopressin/CCB/β-blockers"
      icon={Droplet}
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
          icon={TriangleAlert}
          label="Declare LAST"
          sub="Starts the LAST clock and logs the event"
          onClick={() => declareCrisis('last')}
        />
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Readout label="Bolus 1.5 mL/kg" value={plan.bolusMl} unit="mL" tone="crit" />
        <Readout label="Infusion 0.25 mL/kg/min" value={plan.infusionMlPerMin} unit="mL/min" tone="cyber" />
        <Readout label="If hypotensive (double)" value={plan.infusionMaxMlPerMin} unit="mL/min" tone="warn" />
        <Readout label="Max cumulative 12 mL/kg" value={plan.cumulativeCapMl} unit="mL" />
      </div>
      {plan.bolusCapped ? (
        <p className="mt-1 text-[11px] font-bold text-warn">Bolus capped at 100 mL per protocol ceiling.</p>
      ) : null}
      {plan.infusionMlPerMin ? (
        <p className="mt-1 text-[11px] text-mute">Bolus runs {plan.bolusDurationLabel}.</p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <BigButton
          variant="crit"
          icon={Droplet}
          label={`Log lipid bolus ${plan.bolusMl} mL`}
          onClick={() =>
            logCrisisDose({ label: '20% Lipid Emulsion bolus (1.5 mL/kg)', ml: plan.bolusMl, category: 'drug' })
          }
        />
        <BigButton
          variant="cyber"
          icon={Syringe}
          label={`Start infusion ${plan.infusionMlPerMin} mL/min`}
          onClick={() =>
            logCrisisDose({
              label: `20% Lipid Emulsion infusion started at ${plan.infusionMlPerMin} mL/min (0.25 mL/kg/min)`,
              category: 'drug',
            })
          }
        />
        <BigButton
          variant="warn"
          icon={Syringe}
          label={`Double infusion ${plan.infusionMaxMlPerMin} mL/min`}
          onClick={() =>
            logCrisisDose({
              label: `20% Lipid Emulsion infusion DOUBLED to ${plan.infusionMaxMlPerMin} mL/min (0.5 mL/kg/min)`,
              category: 'drug',
            })
          }
          className="col-span-2"
        />
      </div>

      <div className="mt-3 rounded-xl border border-line bg-panel2 p-3">
        <div className="mb-1 flex items-center justify-between text-xs font-bold">
          <span className="uppercase tracking-widest text-mute">Cumulative lipid</span>
          <span className={`tnum font-mono ${cum.exceeded ? 'text-crit' : 'text-ink'}`}>
            {cum.totalMl} / {cum.capMl} mL
          </span>
        </div>
        <ProgressBar
          value={cum.pctOfCap}
          barClassName={cum.exceeded ? 'bg-crit' : cum.pctOfCap > 0.75 ? 'bg-warn' : 'bg-cyber'}
        />
        {cum.exceeded ? (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-crit">
            <TriangleAlert className="h-3.5 w-3.5" /> 12 mL/kg ceiling exceeded — significant overdose risk.
          </p>
        ) : null}
        <p className="mt-1 text-[11px] text-mute">
          Counts logged boluses only — add infused volume (rate × minutes run) when judging the ceiling.
        </p>
      </div>

      <p className="mt-3 mb-1 text-xs font-bold uppercase tracking-widest text-mute">Checklist</p>
      <Checklist items={LAST_CHECKLIST} category="crisis" prefix="LAST" />
    </CrisisCard>
  );
}
