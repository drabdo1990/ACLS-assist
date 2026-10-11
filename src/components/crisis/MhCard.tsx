import { Flame, Phone, Syringe, Thermometer, Wind } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { dantrolenePlan, ryanodexPlan } from '../../content/calc';
import { MH_CHECKLIST, MH_COOLING_STOP_C, MH_HOTLINE } from '../../content/protocols';
import { CrisisCard, Readout } from './CrisisCard';
import { Checklist } from './Checklist';
import { BigButton } from '../ui/BigButton';

/** Malignant Hyperthermia — dantrolene dosing (legacy vials + Ryanodex) and the MHAUS pathway. */
export function MhCard() {
  const weightKg = useCodeStore((s) => s.weightKg);
  const crisis = useCodeStore((s) => s.crisis);
  const declareCrisis = useCodeStore((s) => s.declareCrisis);
  const resolveCrisis = useCodeStore((s) => s.resolveCrisis);
  const logCrisisDose = useCodeStore((s) => s.logCrisisDose);

  const dant = dantrolenePlan(weightKg);
  const ryan = ryanodexPlan(weightKg);

  return (
    <CrisisCard
      title="Malignant Hyperthermia"
      subtitle="Stop triggers · 100% O₂ 2–3× MV · dantrolene 2.5 mg/kg"
      icon={Flame}
      accent="warn"
      badge={
        <span className="tnum rounded-full border border-warn/60 px-2 py-0.5 text-[10px] font-bold text-warn">
          {weightKg} kg
        </span>
      }
    >
      {crisis.mhDeclaredAt == null ? (
        <BigButton
          variant="warn"
          icon={Flame}
          label="Declare / suspect MH"
          sub="Stop volatile + suxamethonium immediately"
          onClick={() => declareCrisis('mh')}
        />
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-warn/60 bg-warn/10 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wider text-warn">MH protocol active</span>
          <button
            type="button"
            onClick={() => resolveCrisis('mh')}
            className="touch-hit rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs font-bold text-ink active:scale-95"
          >
            Resolve MH
          </button>
        </div>
      )}

      <div className="mt-3 rounded-xl border border-warn/50 bg-warn/5 p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold text-warn">
          <Syringe className="h-4 w-4" /> Dantrolene 2.5 mg/kg IV
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Readout label="Target dose" value={dant.doseMg} unit="mg" tone="warn" />
          <Readout label="20 mg vials needed" value={dant.vials20} unit="vials" tone="crit" />
          <Readout label="Sterile water" value={dant.reconVolumeMl} unit="mL" />
          <Readout label="Volume to give" value={dant.adminVolumeMl} unit="mL" />
        </div>
        <p className="mt-1 text-[11px] text-mute">
          {dant.vials20} × 20 mg vials reconstituted with 60 mL each ({dant.concentrationMgPerMl} mg/mL);
          total reconstituted {dant.reconTotalMg} mg.
        </p>
        <BigButton
          className="mt-2"
          variant="warn"
          icon={Syringe}
          label={`Log dantrolene ${dant.doseMg} mg`}
          sub={`${dant.vials20} vials · ${dant.adminVolumeMl} mL`}
          onClick={() =>
            logCrisisDose({
              label: `Dantrolene ${dant.doseMg} mg IV (${dant.vials20} × 20 mg vials)`,
              mg: dant.doseMg,
              ml: dant.adminVolumeMl,
              category: 'drug',
            })
          }
        />
      </div>

      <div className="mt-3 rounded-xl border border-line bg-panel2 p-3">
        <p className="mb-2 text-sm font-bold text-ink">Ryanodex (250 mg single vial)</p>
        <div className="grid grid-cols-2 gap-2">
          <Readout label="Vials (250 mg)" value={ryan.vials} unit="vials" />
          <Readout label="Concentration" value={ryan.concentrationMgPerMl} unit="mg/mL" />
          <Readout label="Target dose" value={ryan.doseMg} unit="mg" />
          <Readout label="Volume" value={ryan.volumeMl} unit="mL" />
        </div>
        <BigButton
          className="mt-2"
          variant="neutral"
          icon={Syringe}
          label={`Log Ryanodex ${ryan.doseMg} mg`}
          sub={`${ryan.vials} vial(s) · ${ryan.volumeMl} mL`}
          onClick={() =>
            logCrisisDose({
              label: `Ryanodex ${ryan.doseMg} mg IV (${ryan.vials} × 250 mg vial)`,
              mg: ryan.doseMg,
              ml: ryan.volumeMl,
              category: 'drug',
            })
          }
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Readout label="Ventilation" value="100% FiO₂" tone="cyber" />
        <Readout label="Charcoal filters" value="2–3× MV" tone="cyber" />
      </div>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-mute">
        <Wind className="h-3.5 w-3.5" /> Hyperventilate at 2–3× minute ventilation with charcoal filters.
      </p>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-mute">
        <Thermometer className="h-3.5 w-3.5" /> Actively cool if &gt; {MH_COOLING_STOP_C} °C — stop active cooling at{' '}
        {MH_COOLING_STOP_C} °C.
      </p>

      <a
        href={`tel:${MH_HOTLINE.replace(/\D/g, '')}`}
        className="touch-hit mt-3 flex min-h-[64px] items-center justify-center gap-2 rounded-2xl border border-crit bg-crit/15 text-base font-bold text-crit active:scale-[0.98]"
      >
        <Phone className="h-5 w-5" /> MHAUS Hotline {MH_HOTLINE}
      </a>

      <p className="mt-3 mb-1 text-xs font-bold uppercase tracking-widest text-mute">Checklist</p>
      <Checklist items={MH_CHECKLIST} category="crisis" prefix="MH" />
    </CrisisCard>
  );
}
