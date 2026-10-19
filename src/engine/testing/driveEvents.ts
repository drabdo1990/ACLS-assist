import { vi } from 'vitest';
import { useCodeStore } from '../store';

/**
 * Drives every store action that logs an event (plus the two component-logged ones, passed in),
 * at fixed fake times, so the resulting audit trail is deterministic.
 * Caller must have `vi.useFakeTimers()` active and mock ./audio and ./clock.
 */
export function driveEveryEvent(extra: { pulseCheck: () => void; checklistToggle: () => void }): void {
  const T0 = 1_700_000_000_000;
  const at = (ms: number) => vi.setSystemTime(T0 + ms);
  const s = () => useCodeStore.getState();
  at(0);
  s().reset();
  s().setWeight(70);
  s().startCode();
  at(30_000);
  s().pauseCode();
  at(40_000);
  s().resumeCode();
  at(120_000);
  s().resetCycle('VF');
  at(125_000);
  s().deliverShock(200);
  at(130_000);
  s().resetCycle();
  at(140_000);
  s().setRhythmBranch('nonshockable');
  at(150_000);
  s().deliverShock(360);
  at(160_000);
  s().administerEpi();
  at(170_000);
  s().resetCycle('Asystole');
  at(175_000);
  s().resetCycle('Pulse');
  at(180_000);
  s().resetCycle('PEA');
  at(185_000);
  s().resetCycle('pVT');
  at(190_000);
  // 2 s apart: the store ignores a repeat of the same dose within 1.5 s (gloved double-tap).
  let tick = 190_000;
  const step = () => at((tick += 2_000));
  s().administerAmiodarone();
  step();
  s().administerAmiodarone();
  step();
  s().administerAmiodarone();
  for (let i = 0; i < 6; i++) {
    step();
    s().administerLidocaine();
  }
  step();
  s().administerMagnesium();
  s().markAirwayPlaced('ETT');
  step(); // the store ignores an airway toggle within 1.5 s of the last one, like the doses above
  s().markAirwayPlaced();
  step();
  s().markAirwayPlaced('SGA');
  s().toggleCause('hypoxia');
  s().toggleCause('hypoxia');
  s().togglePocus('lung_sliding');
  s().togglePocus('lung_sliding');
  extra.pulseCheck();
  at(405_000);
  s().declareRosc();
  extra.checklistToggle();
  extra.checklistToggle();
  at(500_000);
  s().reArrest();
  at(600_000);
  s().terminateCode();
}
