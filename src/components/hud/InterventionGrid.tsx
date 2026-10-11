import { useState } from 'react';
import { Syringe, Pill, Wind, Zap, Check, TriangleAlert, Undo2 } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { useNow } from '../../hooks/useNow';
import { epiLockoutLabel } from '../../engine/timing';
import { DEFAULT_SHOCK_JOULES, EPINEPHRINE, epiLastBolusCeilingMcg } from '../../content/calc';
import { BigButton } from '../ui/BigButton';
import { Chip } from '../ui/Chip';
import { Panel } from '../ui/Panel';

const OR_QUICK_DRUGS = [
  { label: 'Calcium chloride 1 g IV', short: 'CaCl₂ 1 g', mg: 1000 },
  { label: 'Sodium bicarbonate 50 mEq IV', short: 'NaHCO₃ 50 mEq' },
  { label: 'Magnesium sulfate 2 g IV', short: 'MgSO₄ 2 g', mg: 2000 },
  { label: 'Lidocaine 100 mg IV', short: 'Lido 100 mg', mg: 100 },
  { label: 'Atropine 0.5 mg IV', short: 'Atropine 0.5 mg', mg: 0.5 },
  { label: 'Epinephrine 20 mcg IV (titrated)', short: 'Epi 20 mcg', mg: 0.02 },
] as const;

/**
 * One-tap ACLS intervention log. Every press is auto-timestamped by the store.
 * Nothing here blocks the clinician: dose-guidance timers are advisory, never gates.
 */
export function InterventionGrid() {
  const now = useNow();
  const shocks = useCodeStore((s) => s.shocks);
  const epi = useCodeStore((s) => s.epi);
  const amio = useCodeStore((s) => s.amio);
  const airwayPlaced = useCodeStore((s) => s.airwayPlaced);
  const lockoutMs = useCodeStore((s) => s.settings.epiLockoutMs);
  const defaultJoules = useCodeStore((s) => s.settings.defaultJoules);
  const setSetting = useCodeStore((s) => s.setSetting);
  const status = useCodeStore((s) => s.status);
  const canLog = status === 'active' || status === 'paused';
  const weightKg = useCodeStore((s) => s.weightKg);
  const lastDeclared = useCodeStore((s) => s.crisis.lastDeclaredAt != null);
  const eventCount = useCodeStore((s) => s.events.length);

  const administerEpi = useCodeStore((s) => s.administerEpi);
  const administerAmiodarone = useCodeStore((s) => s.administerAmiodarone);
  const deliverShock = useCodeStore((s) => s.deliverShock);
  const markAirwayPlaced = useCodeStore((s) => s.markAirwayPlaced);
  const logEvent = useCodeStore((s) => s.logEvent);
  const logCrisisDose = useCodeStore((s) => s.logCrisisDose);
  const undoLastEvent = useCodeStore((s) => s.undoLastEvent);

  const [showEnergy, setShowEnergy] = useState(false);
  const [joules, setJoules] = useState<number>(defaultJoules);
  const [shockable, setShockable] = useState(true);

  const lastEpi = epi[epi.length - 1];
  const lockout = epiLockoutLabel(lastEpi?.at, lockoutMs, now);
  const epiDueNow = epi.length > 0 && !lockout && status === 'active';
  const nextAmio = amio.length === 0 ? 300 : 150;
  const lastMaxMcg = epiLastBolusCeilingMcg(weightKg);

  return (
    <Panel title="ACLS interventions" icon={Syringe} accent="none">
      {lastDeclared ? (
        <div className="mb-2 rounded-xl border border-crit bg-crit/15 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-crit">
            <TriangleAlert className="h-4 w-4 shrink-0" /> LAST active — Epinephrine caution ({EPINEPHRINE.lastCaution})
          </p>
          <p className="mt-0.5 text-xs text-ink">
            Avoid standard 1 mg boluses. Max individual bolus for {weightKg} kg is{' '}
            <strong className="font-mono text-crit">&le;{lastMaxMcg} mcg</strong>.
          </p>
          <BigButton
            className="mt-2"
            variant="warn"
            icon={Syringe}
            label={`Epi ${lastMaxMcg} mcg IV (LAST <1 mcg/kg)`}
            sub="Logs weight-capped low-dose bolus"
            disabled={!canLog}
            onClick={() => administerEpi(lastMaxMcg)}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <BigButton
          variant={lastDeclared ? 'outline' : 'crit'}
          icon={Syringe}
          label={`Epi 1 mg IV/IO${epi.length ? ` · ×${epi.length}` : ''}`}
          sub={
            lastDeclared
              ? 'Caution: 1 mg exceeds LAST <1 mcg/kg cap'
              : lockout
                ? `Next dose in ${lockout}`
                : epiDueNow
                  ? 'DUE NOW — Tap to log'
                  : 'Tap to log'
          }
          className={epiDueNow && !lastDeclared ? 'animate-flash-bg border-crit text-white' : ''}
          disabled={!canLog}
          onClick={() => administerEpi()}
        />
        <BigButton
          variant="warn"
          icon={Pill}
          label={`Amiodarone ${nextAmio} mg${amio.length ? ` · ×${amio.length}` : ''}`}
          sub={amio.length === 0 ? 'First dose' : amio.length === 1 ? 'Second dose' : 'Additional'}
          disabled={!canLog}
          onClick={administerAmiodarone}
        />
        <BigButton
          variant={airwayPlaced ? 'good' : 'neutral'}
          icon={airwayPlaced ? Check : Wind}
          label={airwayPlaced ? 'Airway placed' : 'Advanced airway'}
          sub={airwayPlaced ? 'Continuous + 1 breath/6 s (tap to undo)' : 'Tap when secured'}
          disabled={!canLog}
          onClick={markAirwayPlaced}
        />
        <BigButton
          variant="cyber"
          icon={Zap}
          label={`Shock${shocks.length ? ` · ×${shocks.length}` : ''}`}
          sub={shocks.length ? `Last ${shocks[shocks.length - 1].joules} J` : 'Select energy'}
          disabled={!canLog}
          onClick={() => setShowEnergy((v) => !v)}
        />
      </div>

      {showEnergy ? (
        <div className="mt-2 rounded-xl border border-cyber/50 bg-cyber/5 p-2">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyber">Defibrillation energy</p>
          <div className="grid grid-cols-3 gap-2">
            {DEFAULT_SHOCK_JOULES.map((j) => (
              <Chip key={j} selected={joules === j} onClick={() => setJoules(j)}>
                {j} J
              </Chip>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShockable((v) => !v)}
            className="touch-hit mt-2 flex min-h-[56px] w-full items-center justify-between rounded-xl border border-line bg-panel2 px-4 text-sm font-bold active:scale-[0.98]"
          >
            <span>Rhythm shockable (VF / pVT)</span>
            <span className={shockable ? 'text-good' : 'text-mute'}>{shockable ? 'YES' : 'NO'}</span>
          </button>
          <BigButton
            className="mt-2"
            variant="crit"
            icon={Zap}
            label={`Deliver shock ${joules} J`}
            sub={`Logs shock #${shocks.length + 1}`}
            onClick={() => {
              deliverShock(joules, shockable);
              setShowEnergy(false);
            }}
          />
        </div>
      ) : null}

      <div className="mt-3 border-t border-line pt-3">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-mute">OR perioperative drugs</p>
        <div className="grid grid-cols-3 gap-1.5">
          {OR_QUICK_DRUGS.map((d) => (
            <button
              key={d.short}
              type="button"
              disabled={!canLog}
              onClick={() => logCrisisDose({ label: d.label, mg: 'mg' in d ? d.mg : undefined, category: 'drug' })}
              className="touch-hit min-h-[52px] rounded-xl border border-line bg-panel2 px-2 text-xs font-bold text-ink active:scale-[0.97] disabled:opacity-40"
            >
              {d.short}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-mute">Epi re-dose interval</p>
        <div className="grid grid-cols-3 gap-2">
          {[3, 4, 5].map((min) => {
            const ms = min * 60_000;
            return (
              <Chip
                key={min}
                selected={lockoutMs === ms}
                onClick={() => setSetting({ epiLockoutMs: ms })}
              >
                {min} min
              </Chip>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => logEvent('rhythm', 'Pulse check — no pulse', 'Continue CPR')}
            disabled={!canLog}
            className="touch-hit min-h-[56px] w-full rounded-xl border border-line bg-panel2 px-2 text-sm font-bold active:scale-[0.98] disabled:opacity-40"
          >
            Log no pulse
          </button>
          <button
            type="button"
            onClick={undoLastEvent}
            disabled={eventCount <= 2}
            className="touch-hit flex min-h-[56px] w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-panel2 px-2 text-sm font-bold text-mute active:scale-[0.98] disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" /> Undo last log
          </button>
        </div>
      </div>
    </Panel>
  );
}

