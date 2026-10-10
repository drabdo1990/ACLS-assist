import { useState } from 'react';
import { Syringe, Pill, Wind, Zap, Check } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { useNow } from '../../hooks/useNow';
import { epiLockoutLabel } from '../../engine/timing';
import { DEFAULT_SHOCK_JOULES } from '../../content/calc';
import { BigButton } from '../ui/BigButton';
import { Chip } from '../ui/Chip';
import { Panel } from '../ui/Panel';

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
  const canLog = useCodeStore((s) => s.status === 'active' || s.status === 'paused');

  const administerEpi = useCodeStore((s) => s.administerEpi);
  const administerAmiodarone = useCodeStore((s) => s.administerAmiodarone);
  const deliverShock = useCodeStore((s) => s.deliverShock);
  const markAirwayPlaced = useCodeStore((s) => s.markAirwayPlaced);
  const logEvent = useCodeStore((s) => s.logEvent);

  const [showEnergy, setShowEnergy] = useState(false);
  const [joules, setJoules] = useState<number>(defaultJoules);
  const [shockable, setShockable] = useState(true);

  const lastEpi = epi[epi.length - 1];
  const lockout = epiLockoutLabel(lastEpi?.at, lockoutMs, now);
  const nextAmio = amio.length === 0 ? 300 : 150;

  return (
    <Panel title="ACLS interventions" icon={Syringe} accent="none">
      <div className="grid grid-cols-2 gap-2">
        <BigButton
          variant="crit"
          icon={Syringe}
          label={`Epi 1 mg IV/IO${epi.length ? ` · ×${epi.length}` : ''}`}
          sub={lockout ? `Next dose in ${lockout}` : epi.length ? 'Eligible now' : 'Tap to log'}
          disabled={!canLog}
          onClick={administerEpi}
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
          sub={airwayPlaced ? 'Continuous compressions + 1 breath/6 s' : 'Tap when secured'}
          disabled={!canLog || airwayPlaced}
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
        <button
          type="button"
          onClick={() => logEvent('rhythm', 'Pulse check — no pulse', 'Continue CPR')}
          disabled={!canLog}
          className="touch-hit mt-2 min-h-[56px] w-full rounded-xl border border-line bg-panel2 text-sm font-bold active:scale-[0.98] disabled:opacity-40"
        >
          Log pulse check — no pulse
        </button>
      </div>
    </Panel>
  );
}
