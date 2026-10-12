import type { PocusId } from '../engine/types';

export interface PocusItem {
  id: PocusId;
  view: string;
  label: string;
  meaning: string;
}

/**
 * Point-of-care ultrasound during the rhythm-check pause (< 10 s, ideally recorded).
 * Never prolong the compression pause to scan.
 */
export const POCUS_ITEMS: PocusItem[] = [
  {
    id: 'effusion',
    view: 'Subxiphoid / parasternal',
    label: 'Pericardial effusion',
    meaning: 'With RV collapse → tamponade: pericardiocentesis.',
  },
  {
    id: 'rv_strain',
    view: 'Subxiphoid / parasternal',
    label: 'RV dilatation / strain',
    meaning: 'RV ≥ LV → consider massive PE: thrombolysis.',
  },
  {
    id: 'contractility',
    view: 'Subxiphoid / parasternal',
    label: 'Coordinated contractility (pseudo-PEA)',
    meaning: 'Organised activity without pulse → push vasopressors, search for cause.',
  },
  {
    id: 'standstill',
    view: 'Subxiphoid / parasternal',
    label: 'True cardiac standstill',
    meaning: 'No motion → poor prognosis; informs, never solely decides, termination.',
  },
  {
    id: 'lung_sliding',
    view: 'Anterior chest (bilateral)',
    label: 'Absent lung sliding',
    meaning: 'Rule in tension pneumothorax → decompress (confirm bilateral ventilation first).',
  },
];
