import { useEffect, useRef, useState } from 'react';
import { Check, Pill, Syringe, Undo2, Wind, Zap } from 'lucide-react';
import { isUndoable, useCodeStore } from '../../engine/store';
import { useNow } from '../../hooks/useNow';
import { epiLockoutLabel } from '../../engine/timing';
import { playConfirm } from '../../engine/audio';
import { haptic } from '../../engine/haptics';
import {
  SHOCK_ENERGIES,
  amiodaroneDoseMg,
  lidocaineBudget,
  lidocaineDose,
  waveformFor,
} from '../../content/calc';
import { nextAclsStep, type StepFocus } from '../../content/algorithm';
import { BigButton } from '../ui/BigButton';
import { Chip } from '../ui/Chip';
import { Panel } from '../ui/Panel';
import { WeightControl } from '../ui/WeightControl';
import { keyed } from '../../i18n/enText';
import { useT } from '../../i18n/useT';

/** Ring that marks the button the algorithm expects next. */
const FOCUS_RING = 'ring-4 ring-warn/70 ring-offset-2 ring-offset-bg';

/**
 * One-tap ACLS intervention grid. Every press is auto-timestamped by the store.
 * Nothing here blocks the clinician: dose timers and algorithm hints are advisory.
 */
export function InterventionGrid() {
  const { t } = useT();
  const now = useNow();
  const status = useCodeStore((s) => s.status);
  const shocks = useCodeStore((s) => s.shocks);
  const epi = useCodeStore((s) => s.epi);
  const amio = useCodeStore((s) => s.amio);
  const lido = useCodeStore((s) => s.lido);
  const antiarrhythmic = useCodeStore((s) => s.antiarrhythmic);
  const airwayPlaced = useCodeStore((s) => s.airwayPlaced);
  const airwayType = useCodeStore((s) => s.airwayType);
  const branch = useCodeStore((s) => s.rhythmBranch);
  const causesChecked = useCodeStore((s) => Object.values(s.causes).filter(Boolean).length);
  const weightKg = useCodeStore((s) => s.weightKg);
  const lockoutMs = useCodeStore((s) => s.settings.epiLockoutMs);
  const defaultJoules = useCodeStore((s) => s.settings.defaultJoules);
  const canUndo = useCodeStore((s) => {
    const last = s.events[s.events.length - 1];
    return last != null && isUndoable(last);
  });

  const administerEpi = useCodeStore((s) => s.administerEpi);
  const deliverShock = useCodeStore((s) => s.deliverShock);
  const setAntiarrhythmic = useCodeStore((s) => s.setAntiarrhythmic);
  const administerAntiarrhythmic = useCodeStore((s) => s.administerAntiarrhythmic);
  const markAirwayPlaced = useCodeStore((s) => s.markAirwayPlaced);
  const setSetting = useCodeStore((s) => s.setSetting);
  const logEvent = useCodeStore((s) => s.logEvent);
  const administerMagnesium = useCodeStore((s) => s.administerMagnesium);
  const undoLastEvent = useCodeStore((s) => s.undoLastEvent);

  const [showEnergy, setShowEnergy] = useState(false);
  const [joules, setJoules] = useState<number>(defaultJoules);

  const canLog = status === 'active' || status === 'paused';
  const lastEpi = epi[epi.length - 1];
  const lockout = epiLockoutLabel(lastEpi?.at, lockoutMs, now);
  const epiEligible = epi.length > 0 && !lockout && canLog;

  // Audible + haptic nudge the moment the re-dose interval elapses (once per dose).
  const nudgedFor = useRef<number | null>(null);
  useEffect(() => {
    if (epiEligible && lastEpi && nudgedFor.current !== lastEpi.at) {
      nudgedFor.current = lastEpi.at;
      playConfirm();
      haptic.warn();
    }
  }, [epiEligible, lastEpi]);

  const focus: StepFocus | null = canLog
    ? nextAclsStep({
        branch,
        shocks: shocks.length,
        epi: epi.length,
        antiarrhythmic: amio.length + lido.length,
        causesChecked,
      }).focus
    : null;
  const ring = (f: StepFocus) => (focus === f ? FOCUS_RING : '');

  const isLido = antiarrhythmic === 'lidocaine';
  const lidoNext = lidocaineDose(weightKg, lido.length);
  const lidoBudget = lidocaineBudget(
    weightKg,
    lido.map((d) => d.mg ?? 0),
  );
  const aaLabel = isLido
    ? `Lidocaine ${lidoNext.minMg}–${lidoNext.maxMg} mg`
    : `Amiodarone ${amiodaroneDoseMg(amio.length)} mg`;
  const aaCount = isLido ? lido.length : amio.length;
  const aaSub = isLido
    ? lidoBudget.nextExceeds
      ? t('hud.grid.lido.exceeds', { given: lidoBudget.givenMg, max: lidoBudget.maxMg })
      : t('hud.grid.lido.sub', {
          n: lido.length + 1,
          perKg: lidoNext.perKgLabel,
          interval: lido.length ? ' q5–10 min' : '',
          kg: weightKg,
        })
    : amio.length === 0
      ? t('hud.grid.amio.sub1')
      : amio.length === 1
        ? t('hud.grid.amio.sub2')
        : t('hud.grid.amio.subMax');

  return (
    <Panel title={t('hud.grid.title')} icon={Syringe} accent="none">
      {/* Ventilation guidance banner */}
      <div
        className={[
          'mb-3 flex items-center gap-2 rounded-xl border px-3 py-2.5',
          airwayPlaced ? 'border-good/60 bg-good/10 text-good' : 'border-cyber/50 bg-cyber/10 text-cyber',
        ].join(' ')}
      >
        <Wind className="h-5 w-5 shrink-0" />
        <p className="text-sm font-bold leading-tight">
          {airwayPlaced
            ? t('hud.grid.vent.ett')
            : t('hud.grid.vent.none')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Epinephrine */}
        <BigButton
          variant="crit"
          icon={Syringe}
          label={`Epi 1 mg${epi.length ? ` · ×${epi.length}` : ''}`}
          sub={
            lockout
              ? t('hud.grid.epi.next', { lockout })
              : epiEligible
                ? t('hud.grid.epi.eligible')
                : t('hud.grid.epi.flush')
          }
          className={[epiEligible ? 'animate-flash-bg' : '', ring('epi')].join(' ')}
          disabled={!canLog}
          onClick={administerEpi}
        />

        {/* Defibrillation */}
        <BigButton
          variant="cyber"
          icon={Zap}
          label={shocks.length ? t('hud.grid.shock.titleCount', { n: shocks.length }) : t('hud.grid.shock.title')}
          sub={
            shocks.length
              ? t('hud.grid.shock.last', { n: shocks.length, joules: shocks[shocks.length - 1].joules })
              : t('hud.grid.shock.select')
          }
          className={ring('shock')}
          disabled={!canLog}
          onClick={() => setShowEnergy((v) => !v)}
        />
      </div>

      {showEnergy ? (
        <div className="mt-2 rounded-xl border border-cyber/50 bg-cyber/5 p-2">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyber">{t('hud.grid.energyTitle')}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {SHOCK_ENERGIES.map((e) => (
              <Chip
                key={e.joules}
                selected={joules === e.joules}
                onClick={() => setJoules(e.joules)}
                className="min-w-0 flex-col px-1 leading-tight"
              >
                <span>{e.joules}J</span>
                <span className="text-[10px] font-semibold opacity-70">{e.waveform === 'monophasic' ? 'Mono' : 'Bi'}</span>
              </Chip>
            ))}
          </div>
          <BigButton
            className="mt-2"
            variant="crit"
            icon={Zap}
            label={t('hud.grid.shock.deliver', { n: shocks.length + 1, joules })}
            sub={t('hud.grid.shock.waveformSub', { waveform: t(`waveform.${waveformFor(joules)}`) })}
            onClick={() => {
              deliverShock(joules);
              setShowEnergy(false);
            }}
          />
        </div>
      ) : null}

      {/* Antiarrhythmic */}
      <div className={`mt-2 rounded-xl border border-warn/40 bg-warn/5 p-2 ${ring('antiarrhythmic')}`}>
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          <Chip selected={!isLido} onClick={() => setAntiarrhythmic('amiodarone')}>
            Amiodarone{amio.length ? ` ×${amio.length}` : ''}
          </Chip>
          <Chip selected={isLido} onClick={() => setAntiarrhythmic('lidocaine')}>
            Lidocaine{lido.length ? ` ×${lido.length}` : ''}
          </Chip>
        </div>
        <BigButton
          variant="warn"
          icon={Pill}
          label={`${aaLabel}${aaCount ? ` · ×${aaCount}` : ''}`}
          sub={aaSub}
          className={isLido && lidoBudget.nextExceeds ? 'border-crit text-crit' : ''}
          disabled={!canLog}
          onClick={administerAntiarrhythmic}
        />
        {isLido ? (
          <div className="mt-2">
            <WeightControl />
          </div>
        ) : null}
      </div>

      {/* Advanced airway */}
      <div className="mt-2">
        {airwayPlaced ? (
          <BigButton
            variant="good"
            icon={Check}
            label={t('hud.grid.airwayPlaced', { type: airwayType === 'SGA' ? 'SGA' : 'ETT' })}
            sub={t('hud.grid.airwayActiveSub')}
            disabled={!canLog}
            onClick={() => markAirwayPlaced()}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <BigButton
              variant="neutral"
              icon={Wind}
              label={t('hud.grid.ett')}
              sub={t('hud.grid.ettSub')}
              disabled={!canLog}
              onClick={() => markAirwayPlaced('ETT')}
            />
            <BigButton
              variant="neutral"
              icon={Wind}
              label={t('hud.grid.sga')}
              sub={t('hud.grid.sgaSub')}
              disabled={!canLog}
              onClick={() => markAirwayPlaced('SGA')}
            />
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-mute">{t('hud.grid.epiInterval')}</p>
        <div className="grid grid-cols-3 gap-2">
          {[3, 4, 5].map((min) => {
            const ms = min * 60_000;
            return (
              <Chip key={min} selected={lockoutMs === ms} onClick={() => setSetting({ epiLockoutMs: ms })}>
                {min} min
              </Chip>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={administerMagnesium}
            disabled={!canLog}
            className="touch-hit min-h-[64px] w-full rounded-xl border border-warn/50 bg-warn/10 px-1 text-xs font-bold leading-tight text-warn active:scale-[0.98] disabled:opacity-40"
          >
            Mg 1–2 g
            <span className="block text-[10px] font-semibold opacity-80">{t('hud.grid.mgIndication')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const m = keyed('ev.pulseCheck', undefined, 'ev.pulseCheck.detail');
              logEvent('rhythm', m.label, m.detail, m.i18n);
            }}
            disabled={!canLog}
            className="touch-hit min-h-[64px] w-full rounded-xl border border-line bg-panel2 px-2 text-sm font-bold active:scale-[0.98] disabled:opacity-40"
          >
            {t('hud.grid.logNoPulse')}
          </button>
          <button
            type="button"
            onClick={undoLastEvent}
            disabled={!canUndo}
            className="touch-hit flex min-h-[64px] w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-panel2 px-2 text-sm font-bold text-mute active:scale-[0.98] disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4 rtl:-scale-x-100" /> {t('hud.grid.undo')}
          </button>
        </div>
      </div>
    </Panel>
  );
}
