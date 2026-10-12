import type { CauseId } from '../engine/types';

export interface Cause {
  id: CauseId;
  label: string;
  group: 'H' | 'T';
  /** One-sentence bedside clue. */
  clue: string;
  /** Immediate countermeasure. */
  action: string;
}

/**
 * Reversible causes of cardiac arrest — benchmarked against the SHA ACLS Provider
 * Manual 2024 (Table 3.4 Differential Diagnosis), which lists Hypoglycaemia as an
 * additional H. Tension pneumothorax is retained from AHA/ERC.
 */
export const CAUSES: Cause[] = [
  {
    id: 'hypoxia',
    label: 'Hypoxia',
    group: 'H',
    clue: 'Chronic heart/lung disease, airway obstruction, tube displacement; cyanosis.',
    action: 'Patent airway, supplemental 100% O₂, BVM ventilation, advanced airway; confirm with capnography.',
  },
  {
    id: 'hypovolemia',
    label: 'Hypovolemia',
    group: 'H',
    clue: 'Trauma, internal bleeding, blood loss, burns, vomiting/diarrhoea; flat neck veins.',
    action: 'Rapid IV/IO fluid; blood transfusion for haemorrhage.',
  },
  {
    id: 'hypothermia',
    label: 'Hypothermia',
    group: 'H',
    clue: 'Cold exposure or cold-water immersion, elderly, drug/alcohol intoxication.',
    action: 'Measure core temperature; warm IV fluids and active rewarming.',
  },
  {
    id: 'hydrogen_ion',
    label: 'Hydrogen ion (acidosis)',
    group: 'H',
    clue: 'Renal failure, DKA, overdose (TCA, aspirin, cocaine, diphenhydramine).',
    action: 'Adequate ventilation; IV sodium bicarbonate (≈1 mEq/kg); ABG/VBG, lactate.',
  },
  {
    id: 'hypo_hyperkalemia',
    label: 'Hyper / Hypokalemia',
    group: 'H',
    clue: 'Renal failure, recent dialysis, DKA, ACE-I/ARB; peaked T, wide QRS, sine wave.',
    action:
      'HyperK: calcium chloride, glucose + insulin, sodium bicarbonate, nebulised albuterol, diuretics, dialysis. HypoK: K⁺ / Mg²⁺ replacement.',
  },
  {
    id: 'hypoglycemia',
    label: 'Hypoglycaemia',
    group: 'H',
    clue: 'Insulin / sulfonylurea use, alcohol, acute renal failure, type 1 DM.',
    action: 'Check glucose now; unconscious patient: glucagon IV/IM (or IV dextrose per local protocol).',
  },
  {
    id: 'tension_ptx',
    label: 'Tension pneumothorax',
    group: 'T',
    clue: 'Trauma, central line, ventilated patient; absent breath sounds, high airway pressure.',
    action: 'Immediate needle decompression or finger thoracostomy.',
  },
  {
    id: 'tamponade',
    label: 'Tamponade (cardiac)',
    group: 'T',
    clue: 'Chest trauma, large acute MI, pacing-wire removal after CABG; JVD, muffled heart sounds.',
    action: 'POCUS / echo; echo-guided pericardiocentesis.',
  },
  {
    id: 'toxins',
    label: 'Toxins',
    group: 'T',
    clue: 'Overdose history, substance abuse, suicidal ideation, toxidrome.',
    action:
      'Maintain airway and give antidote: naloxone (opioids), lipid emulsion (LAST), glucagon / high-dose insulin (β-blocker / CCB).',
  },
  {
    id: 'thrombosis_pulmonary',
    label: 'Thrombosis (pulmonary)',
    group: 'T',
    clue: 'DVT/PE history, immobility, recent surgery, cancer, pregnancy; PEA is typical.',
    action:
      'Thrombolysis (empirical if PE suspected), or surgical / mechanical embolectomy; consider eCPR.',
  },
  {
    id: 'thrombosis_coronary',
    label: 'Thrombosis (coronary)',
    group: 'T',
    clue: 'CAD / prior MI, PCI or CABG, chest pain before arrest, refractory VF.',
    action: '12-lead after ROSC; emergent PCI / Cath Lab (or thrombolysis); consider eCPR.',
  },
];

export const CAUSE_GROUP_LABEL: Record<'H' | 'T', string> = {
  H: `${CAUSES.filter((c) => c.group === 'H').length} H's`,
  T: `${CAUSES.filter((c) => c.group === 'T').length} T's`,
};
