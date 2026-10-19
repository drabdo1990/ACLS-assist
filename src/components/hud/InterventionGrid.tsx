import { useEffect, useRef, useState } from 'react';
import { Check, Pill, Syringe, Undo2, Wind, Zap } from 'lucide-react';
import { isUndoable, useCodeStore } from '../../engine/store';
import { useNow } from '../../hooks/useNow';
import { epiLockoutLabel } from '../../engine/timing';
import { playConfirm } from '../../engine/audio';
import { haptic } from '../../engine/haptics';
import {
  SHOCK_ENERGIES,
  waveformFor,
} from '../../content/calc';
import type { StepFocus } from '../../content/algorithm';
import type { WaveformType } from '../../engine/types';
import { profileFor } from '../../content/profiles';
import { BigButton } from '../ui/BigButton';
import { Chip } from '../ui/Chip';
import { Panel } from '../ui/Panel';
import { WeightControl } from '../ui/WeightControl';
import { WeightCard } from './WeightCard';
import { antiarrhythmicText } from './antiarrhythmicText';
import { epiFlushKey } from './populationText';
import { appliedPerKg, chosenShock, defaultShockChip, pediatricShockChips } from './shockChips';
import { keyed } from '../../i18n/enText';
import { useT } from '../../i18n/useT';

/** Ring that marks the button the algorithm expects next. */
const FOCUS_RING = 'ring-4 ring-warn/70 ring-offset-2 ring-offset-bg';

/** Energies offered when logging a pediatric shock with no weight (the value set on the defibrillator). */
const MANUAL_PEDS_JOULES = [5, 10, 20, 30, 50, 70, 100, 150, 200] as const;

/**
 * One-tap ACLS intervention grid. Every press is auto-timestamped by the store.
 * Nothing here blocks the clinician: dose timers and algorithm hints are advisory.
 *
 * Phase 4a: the grid reads the session's ProtocolProfile. Adult labels are unchanged;
 * pediatric labels are weight-based and read "Set weight" until a weight exists —
 * logging without a calculated dose stays available (the store records no mg).
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
  // Index of the pediatric energy chip the clinician tapped (null = follow the algorithm default).
  const [tappedChip, setTappedChip] = useState<number | null>(null);
  const [manualJoules, setManualJoules] = useState<number | null>(null);
  const [waveform360, setWaveform360] = useState<WaveformType>('biphasic');
  const [showWeight, setShowWeight] = useState(false);

  const population = useCodeStore((s) => s.population);
  const profile = profileFor(population);
  const peds = population === 'pediatric';
  const noWeight = peds && weightKg == null;

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
    ? profile.algorithm({
        branch,
        shocks: shocks.length,
        epi: epi.length,
        antiarrhythmic: amio.length + lido.length,
        causesChecked,
      }).focus
    : null;
  const ring = (f: StepFocus) => (focus === f ? FOCUS_RING : '');

  // ---- Pediatric dose labels (null weight → "Set weight", logging stays available) ----
  const pedsEpi = peds && weightKg != null ? profile.epinephrine(weightKg, epi.length) : null;
  const pedsMag = peds && weightKg != null ? profile.magnesium(weightKg) : null;
  const shockChips = peds && weightKg != null ? pediatricShockChips(profile, weightKg) : [];
  const chosenChip = tappedChip ?? defaultShockChip(shocks.length);
  // One value drives the highlighted chip, the Deliver label and the energy that is logged.
  const nextShock = chosenShock(shockChips, tappedChip, shocks.length)?.energy ?? null;

  // A new shock, a new code or a population switch starts from the algorithm default again.
  useEffect(() => {
    setTappedChip(null);
    setManualJoules(null);
  }, [shocks.length, status, population]);

  // Never carry the previous code's energy into the next one. Only reset on idle so a pause
  // or an in-code status change does not discard the energy the clinician just selected.
  useEffect(() => {
    if (status !== 'idle') return;
    setJoules(defaultJoules);
    setShowEnergy(false);
  }, [status, population, defaultJoules]);

  const isLido = antiarrhythmic === 'lidocaine';
  const aa = antiarrhythmicText({ profile, peds, isLido, weightKg, amio, lido, t });
  const aaCount = isLido ? lido.length : amio.length;

  const openWeight = () => setShowWeight(true);
  const logAnyway = 'peds.grid.logNoWeight';

  return (
    <Panel title={t('hud.grid.title')} icon={Syringe} accent="none">
      {/* Pediatric "Set weight" banner + inline weight card */}
      {noWeight && canLog ? (
        <>
          <button
            type="button"
            onClick={openWeight}
            className="mb-3 flex min-h-[56px] w-full items-center justify-center rounded-xl border border-crit bg-crit/10 px-3 text-sm font-bold text-crit active:scale-[0.98]"
          >
            {t('peds.setWeightBanner')}
          </button>
          {showWeight ? (
            <div className="mb-3">
              <WeightCard />
            </div>
          ) : null}
        </>
      ) : null}

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
            ? t(peds ? profile.ventilationWithAirwayKey : 'hud.grid.vent.ett')
            : peds
              ? t('peds.vent.none', { ratio: t(profile.cpr.ratioKey) })
              : t('hud.grid.vent.none')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Epinephrine */}
        <BigButton
          variant="crit"
          icon={Syringe}
          label={
            noWeight
              ? t('peds.setWeight')
              : peds && pedsEpi
                ? `${t('peds.grid.epi.title', { mg: pedsEpi.mg, mL: pedsEpi.mL })}${pedsEpi.capped ? ` ${t('peds.max')}` : ''}${epi.length ? ` · ×${epi.length}` : ''}`
                : `Epi 1 mg${epi.length ? ` · ×${epi.length}` : ''}`
          }
          sub={
            lockout
              ? t('hud.grid.epi.next', { lockout })
              : epiEligible
                ? t('hud.grid.epi.eligible')
                : t(epiFlushKey(population))
          }
          className={[epiEligible ? 'animate-flash-bg' : '', ring('epi')].join(' ')}
          disabled={!canLog}
          onClick={noWeight ? openWeight : administerEpi}
        />

        {/* Defibrillation */}
        <BigButton
          variant="cyber"
          icon={Zap}
          label={
            noWeight
              ? t('peds.setWeight')
              : peds && nextShock
                ? `${t('peds.grid.shock.jkg', { joules: nextShock.joules, perKg: appliedPerKg(nextShock, weightKg as number) })}${nextShock.capped ? ` ${t('peds.max')}` : ''}`
                : shocks.length
                  ? t('hud.grid.shock.titleCount', { n: shocks.length })
                  : t('hud.grid.shock.title')
          }
          sub={
            noWeight
              ? t('peds.setWeightBanner')
              : peds && nextShock
                ? shocks.length
                  ? t('hud.grid.shock.last', { n: shocks.length, joules: shocks[shocks.length - 1].joules })
                  : t('peds.grid.energyNote')
                : shocks.length
                  ? t('hud.grid.shock.last', { n: shocks.length, joules: shocks[shocks.length - 1].joules })
                  : t('hud.grid.shock.select')
          }
          className={ring('shock')}
          disabled={!canLog}
          onClick={noWeight ? openWeight : () => setShowEnergy((v) => !v)}
        />
      </div>

      {/* Pediatric "log anyway" — dose/energy not calculated: epi is recorded with no mg, a shock with the
          energy the clinician set on the defibrillator and no J/kg. Logging is never blocked by a missing weight. */}
      {noWeight && canLog ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={administerEpi}
            disabled={!canLog}
            className="min-h-[56px] w-full rounded-xl border border-line bg-panel2 px-2 text-xs font-bold text-mute active:scale-[0.98] disabled:opacity-40"
          >
            {t('peds.grid.epi.logNoWeight')}
          </button>
          <button
            type="button"
            onClick={() => setShowEnergy((v) => !v)}
            disabled={!canLog}
            className="min-h-[56px] w-full rounded-xl border border-line bg-panel2 px-2 text-xs font-bold text-mute active:scale-[0.98] disabled:opacity-40"
          >
            {t('peds.grid.shock.logNoWeight')}
          </button>
        </div>
      ) : null}

      {showEnergy ? (
        peds && weightKg != null ? (
          <div className="mt-2 rounded-xl border border-cyber/50 bg-cyber/5 p-2">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyber">{t('hud.grid.energyTitle')}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {shockChips.map((c, i) => (
                <Chip
                  key={c.key}
                  selected={i === chosenChip}
                  onClick={() => setTappedChip(i)}
                  className="min-w-0 flex-col px-1 leading-tight"
                >
                  <span className="text-[11px]">{t(c.key)}</span>
                  <span className="tnum text-[10px] font-semibold opacity-70" dir="ltr">
                    {c.energy.joules}J{c.energy.capped ? ` ${t('peds.max')}` : ''}
                  </span>
                </Chip>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-mute">{t('peds.grid.energyNote')}</p>
            <BigButton
              className="mt-2"
              variant="crit"
              icon={Zap}
              disabled={!canLog || nextShock == null}
              label={t('hud.grid.shock.deliver', { n: shocks.length + 1, joules: nextShock?.joules ?? 0 })}
              sub={t('peds.grid.shock.jkg', {
                joules: nextShock?.joules ?? 0,
                perKg: nextShock ? appliedPerKg(nextShock, weightKg) : 0,
              })}
              onClick={() => {
                // Log the J/kg actually applied (the 200 J ceiling can make it lower than the nominal rate).
                if (nextShock) deliverShock(nextShock.joules, appliedPerKg(nextShock, weightKg));
                setShowEnergy(false);
              }}
            />
          </div>
        ) : peds ? (
          <div className="mt-2 rounded-xl border border-cyber/50 bg-cyber/5 p-2">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyber">{t('hud.grid.energyTitle')}</p>
            <div className="grid grid-cols-5 gap-1.5">
              {MANUAL_PEDS_JOULES.map((j) => (
                <Chip key={j} selected={manualJoules === j} onClick={() => setManualJoules(j)} className="min-w-0 px-0.5">
                  <span className="tnum" dir="ltr">
                    {j}J
                  </span>
                </Chip>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-mute">{t('peds.grid.shock.manualNote')}</p>
            <BigButton
              className="mt-2"
              variant="crit"
              icon={Zap}
              disabled={!canLog || manualJoules == null}
              label={t('hud.grid.shock.deliver', { n: shocks.length + 1, joules: manualJoules ?? 0 })}
              onClick={() => {
                if (manualJoules != null) deliverShock(manualJoules, null);
                setShowEnergy(false);
                setManualJoules(null);
              }}
            />
          </div>
        ) : (
          <div className="mt-2 rounded-xl border border-cyber/50 bg-cyber/5 p-2">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyber">{t('hud.grid.energyTitle')}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {SHOCK_ENERGIES.map((e) => {
                const is360 = e.joules === 360;
                const wf = is360 ? waveform360 : e.waveform;
                return (
                  <Chip
                    key={e.joules}
                    selected={joules === e.joules}
                    onClick={() => setJoules(e.joules)}
                    className="min-w-0 flex-col px-1 leading-tight"
                  >
                    <span>{e.joules}J</span>
                    <span className="text-[10px] font-semibold opacity-70">{wf === 'monophasic' ? 'Mono' : 'Bi'}</span>
                  </Chip>
                );
              })}
            </div>
            {joules === 360 ? (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-line bg-panel2/60 px-2 py-1.5 text-xs">
                <span className="font-semibold text-mute">{t('hud.grid.shock.waveformLabel')}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setWaveform360('biphasic')}
                    className={`touch-hit rounded-md px-2 py-1 text-xs font-bold ${
                      waveform360 === 'biphasic' ? 'border border-cyber bg-cyber/20 text-cyber' : 'text-mute'
                    }`}
                  >
                    {t('waveform.biphasic')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaveform360('monophasic')}
                    className={`touch-hit rounded-md px-2 py-1 text-xs font-bold ${
                      waveform360 === 'monophasic' ? 'border border-cyber bg-cyber/20 text-cyber' : 'text-mute'
                    }`}
                  >
                    {t('waveform.monophasic')}
                  </button>
                </div>
              </div>
            ) : null}
            <BigButton
              className="mt-2"
              variant="crit"
              icon={Zap}
              disabled={!canLog}
              label={t('hud.grid.shock.deliver', { n: shocks.length + 1, joules })}
              sub={t('hud.grid.shock.waveformSub', { waveform: t(`waveform.${joules === 360 ? waveform360 : waveformFor(joules)}` as never) })}
              onClick={() => {
                deliverShock(joules, null, joules === 360 ? waveform360 : undefined);
                setShowEnergy(false);
              }}
            />
          </div>
        )
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
          label={`${aa.label}${aaCount && !(peds && noWeight) ? ` · ×${aaCount}` : ''}`}
          sub={aa.sub}
          className={aa.exceeds ? 'border-crit text-crit' : ''}
          disabled={!canLog}
          onClick={peds && noWeight ? openWeight : administerAntiarrhythmic}
        />
        {peds && noWeight ? (
          <button
            type="button"
            onClick={administerAntiarrhythmic}
            disabled={!canLog}
            className="mt-2 min-h-[56px] w-full rounded-xl border border-line bg-panel2 px-2 text-xs font-bold text-mute active:scale-[0.98] disabled:opacity-40"
          >
            {t(logAnyway)}
          </button>
        ) : null}
        {isLido && !peds && status !== 'terminated' ? (
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
            onClick={peds && noWeight ? openWeight : administerMagnesium}
            disabled={!canLog}
            className="touch-hit min-h-[64px] w-full rounded-xl border border-warn/50 bg-warn/10 px-1 text-xs font-bold leading-tight text-warn active:scale-[0.98] disabled:opacity-40"
          >
            {noWeight
              ? t('peds.setWeight')
              : peds && pedsMag
                ? `${t('peds.grid.mag.title', { minMg: pedsMag.minMg, maxMg: pedsMag.maxMg })}${pedsMag.capped ? ` ${t('peds.max')}` : ''}`
                : 'Mg 1–2 g'}
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
        {peds && noWeight && canLog ? (
          <button
            type="button"
            onClick={administerMagnesium}
            className="mt-2 min-h-[56px] w-full rounded-xl border border-line bg-panel2 px-2 text-xs font-bold text-mute active:scale-[0.98]"
          >
            {t('peds.grid.mag.logNoWeight')}
          </button>
        ) : null}
      </div>
    </Panel>
  );
}
