import type { CauseId } from '../engine/types';

export interface Cause {
  id: CauseId;
  label: string;
  group: 'H' | 'T';
  hint: string;
}

/** Reversible causes of cardiac arrest — 4 H's and 4 T's, tuned for the OR. */
export const CAUSES: Cause[] = [
  { id: 'hypoxia', label: 'Hypoxia', group: 'H', hint: 'Check airway/FiO₂, circuit disconnect, endobronchial intubation' },
  { id: 'hypovolemia', label: 'Hypovolemia', group: 'H', hint: 'Hemorrhage, third-spacing, anaphylaxis — give volume/blood' },
  { id: 'hypo_hyperkalemia', label: 'Hypo / Hyperkalemia', group: 'H', hint: 'Calcium, bicarbonate, insulin/dextrose, renal failure' },
  { id: 'hypothermia', label: 'Hypothermia', group: 'H', hint: 'Rewarm — active warming, warm fluids' },
  { id: 'tension_ptx', label: 'Tension Pneumothorax', group: 'T', hint: 'Needle decompression → chest drain' },
  { id: 'tamponade', label: 'Tamponade', group: 'T', hint: 'Cardiac — pericardial drainage; post-cardiac surgery reopen' },
  { id: 'toxins', label: 'Toxins (LAST / anesthetic)', group: 'T', hint: 'Lipid emulsion, stop local anesthetic, treat LAST' },
  { id: 'thrombosis', label: 'Thrombosis (PE / coronary)', group: 'T', hint: 'Thrombolysis, PCI — consider massive PE' },
];

export const CAUSE_GROUP_LABEL: Record<'H' | 'T', string> = {
  H: "4 H's",
  T: "4 T's",
};
