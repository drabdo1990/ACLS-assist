/**
 * Crisis protocol checklists and step sequences.
 * Kept as data (not JSX) so clinical content is reviewable in isolation and can
 * evolve without touching the UI layer.
 *
 * Reference pathways: ASRA LAST checklist, MHAUS MH treatment, DAS 2025
 * airway-failure guidance, and the 4-minute perimortem caesarean rule.
 */

export interface ChecklistItem {
  id: string;
  text: string;
  /** emphasis renders in bold / brighter ink — reserved for time-critical acts */
  critical?: boolean;
}

export interface SequenceStep {
  n: string;
  title: string;
  detail: string;
  critical?: boolean;
}

export const MH_HOTLINE = '1-800-644-9737';
export const MATERNAL_HYSTEROTOMY_MIN = 4;
export const MATERNAL_DELIVERY_MIN = 5;
export const MH_COOLING_STOP_C = 38.5;

export const LAST_CHECKLIST: ChecklistItem[] = [
  { id: 'stop', text: 'STOP local anesthetic injection immediately', critical: true },
  { id: 'call', text: 'Call for help; summon the LAST kit and 20% lipid emulsion' },
  { id: 'airway', text: '100% O₂, secure airway; avoid hypoxia, hypercarbia and acidosis' },
  { id: 'seizure', text: 'Treat seizures: benzodiazepine first-line (e.g. midazolam)' },
  { id: 'avoid', text: 'AVOID vasopressin, calcium channel blockers and beta-blockers', critical: true },
  { id: 'epi', text: 'Reduce individual epinephrine boluses to < 1 mcg/kg', critical: true },
  { id: 'bypass', text: 'Consider early cardiopulmonary bypass / ECMO — arrange it now' },
  { id: 'cpr', text: 'If arrest: prolonged CPR may be required; continue resuscitation' },
];

export const MH_CHECKLIST: ChecklistItem[] = [
  { id: 'stop', text: 'Discontinue triggering agents (volatiles, succinylcholine)', critical: true },
  { id: 'call', text: 'Call for help and the MH kit; call MHAUS hotline' },
  {
    id: 'vent',
    text: 'Hyperventilate 100% FiO₂ at 2–3× minute ventilation with charcoal filters',
    critical: true,
  },
  { id: 'dantrolene', text: 'Dantrolene 2.5 mg/kg IV — repeat until stable (up to 10 mg/kg)', critical: true },
  { id: 'cool', text: `Active cooling if > ${MH_COOLING_STOP_C} °C; stop active cooling at ${MH_COOLING_STOP_C} °C` },
  { id: 'k', text: 'Treat hyperkalemia and arrhythmias (calcium, bicarbonate, insulin/dextrose)' },
  { id: 'monitor', text: 'Monitor for rhabdomyolysis, compartment syndrome, DIC' },
  { id: 'icu', text: 'ICU for 24–48 h: risk of recrudescence' },
];

export const CICO_STEPS: SequenceStep[] = [
  { n: '1', title: 'Declare CICO', detail: 'Verbalise "can\'t intubate, can\'t oxygenate". Call for help.', critical: true },
  { n: '2', title: '100% O₂ & position', detail: 'Optimise head/neck position; continue 100% O₂ and removal of cricoid pressure.' },
  {
    n: '3',
    title: 'Neuromuscular block',
    detail: 'Ensure full relaxation. If rocuronium was used, sugammadex 16 mg/kg is an option.',
  },
  {
    n: '4',
    title: 'Scalpel',
    detail: 'Transverse stab incision through the cricothyroid membrane (scalpel-bougie-tube).',
    critical: true,
  },
  { n: '5', title: 'Bougie', detail: 'Rotate scalpel 90°, pass the bougie into the trachea — feel for tracheal clicks.', critical: true },
  { n: '6', title: 'Tube 6.0 mm', detail: 'Railroad a size 6.0 cuffed tube over the bougie; inflate the cuff.', critical: true },
  { n: '7', title: 'Confirm & ventilate', detail: 'Ventilate and confirm with sustained waveform capnography.', critical: true },
];

export const MATERNAL_STEPS: ChecklistItem[] = [
  { id: 'help', text: 'Call obstetric, neonatal and anaesthetic help immediately', critical: true },
  { id: 'cpr', text: 'Start high-quality CPR; left lateral tilt or manual uterine displacement' },
  { id: 'lud', text: 'Manual left uterine displacement to relieve aortocaval compression', critical: true },
  { id: 'airway', text: 'Secure airway early — anticipate a difficult airway; 100% O₂' },
  { id: 'lateral', text: 'Continue CPR throughout; do not delay for monitors' },
  { id: 'hyst4', text: `Begin resuscitative hysterotomy by minute ${MATERNAL_HYSTEROTOMY_MIN} if no ROSC`, critical: true },
  { id: 'deliver5', text: `Aim to deliver the fetus by minute ${MATERNAL_DELIVERY_MIN}`, critical: true },
  { id: 'ecmo', text: 'Consider ECMO / perimortem rescue if maternal ROSC not achieved' },
];

export const POST_ARREST_CHECKLIST: ChecklistItem[] = [
  { id: 'spo2', text: 'Target SpO₂ 92–98%; titrate FiO₂ — avoid hyperoxia' },
  { id: 'co2', text: 'Normocapnia: PaCO₂ 35–45 mmHg; avoid hyperventilation' },
  { id: 'map', text: 'Target MAP ≥ 65 mmHg — fluids / vasopressors', critical: true },
  { id: 'ecg', text: '12-lead ECG now → activate PCI for STEMI', critical: true },
  { id: 'temp', text: 'Temperature control 32–37.5 °C; prevent fever > 37.7 °C' },
  { id: 'glucose', text: 'Avoid hypo- and hyperglycaemia' },
  { id: 'cause', text: 'Treat the precipitating cause (revisit 4H / 4T)' },
  { id: 'neuro', text: 'Sedation, analgesia and seizure control; neuro-prognostication later' },
  { id: 'icu', text: 'Transfer to ICU / cardiac catheter lab; consider ECPR pathway' },
];
