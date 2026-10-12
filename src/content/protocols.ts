/**
 * Post-ROSC care bundle. Kept as data (not JSX) so clinical content is reviewable in
 * isolation and can evolve without touching the UI layer.
 *
 * Benchmark: SHA ACLS Provider Manual 2024, Chapter 11 "Care Following Resuscitation"
 * (Algorithm 11.1), consistent with AHA 2020/2023 post-cardiac arrest care.
 */

export interface ChecklistItem {
  id: string;
  text: string;
  /** emphasis renders in bold / brighter ink — reserved for time-critical acts */
  critical?: boolean;
}

export const POST_ROSC_BUNDLE: ChecklistItem[] = [
  {
    id: 'airway',
    text: 'Optimise ventilation & oxygenation — ETT if not yet placed; SpO₂ 92–98%; avoid hyperventilation',
    critical: true,
  },
  {
    id: 'bp',
    text: 'Hypotension (SBP < 90): IV fluid up to 2 L, then Dopamine 5–10 mcg/kg/min (or norepinephrine / epinephrine infusion); target MAP ≥ 65',
    critical: true,
  },
  { id: 'ecg', text: '12-lead ECG — STEMI → Cath Lab; decides ICU vs CCU', critical: true },
  {
    id: 'neuro',
    text: 'Unresponsive: temperature control 32–37.5 °C for 12–24 h; seizure control; maintain cerebral perfusion',
  },
  { id: 'glucose', text: 'Correct glucose > 10 mmol/L and prevent hypoglycaemia' },
  { id: 'cause', text: 'Correct electrolytes, hypoxia and acidosis — revisit H’s & T’s' },
  { id: 'vitals', text: 'Frequent vital signs; report any deterioration immediately' },
  { id: 'icu', text: 'Transfer stable & transfer-ready to ICU / CCU; complete resuscitation record; debrief' },
];
