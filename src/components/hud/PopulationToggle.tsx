import { Baby, TriangleAlert, User } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { browserKV } from '../../engine/kv';
import { savePopulation, type StoredPopulation } from '../../engine/prefs';
import { PEDIATRIC_CLINICAL_REVIEWED } from '../../content/profiles';
import { useT } from '../../i18n/useT';

/**
 * Adult / Pediatric segmented control (idle only). The choice is locked once the code
 * starts; the device-level preference is saved here so the toggle remembers it.
 */
export function PopulationToggle() {
  const { t } = useT();
  const population = useCodeStore((s) => s.population);
  const setPopulation = useCodeStore((s) => s.setPopulation);

  const select = (p: StoredPopulation) => {
    savePopulation(browserKV(), p);
    setPopulation(p);
  };

  const option = (p: StoredPopulation, icon: typeof User, label: string) => (
    <button
      type="button"
      aria-pressed={population === p}
      onClick={() => select(p)}
      className={[
        'touch-hit flex min-h-[56px] items-center justify-center gap-2 rounded-lg border text-base font-bold active:scale-[0.98]',
        population === p
          ? p === 'pediatric'
            ? 'border-peds bg-peds/15 text-peds'
            : 'border-cyber bg-cyber/15 text-cyber'
          : 'border-line bg-panel2 text-mute',
      ].join(' ')}
    >
      {(() => {
        const Icon = icon;
        return <Icon className="h-5 w-5" />;
      })()}
      {label}
    </button>
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-line bg-panel2/50 p-1.5">
        {option('adult', User, t('peds.toggle.adult'))}
        {option('pediatric', Baby, t('peds.toggle.pediatric'))}
      </div>
      {population === 'pediatric' && !PEDIATRIC_CLINICAL_REVIEWED ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-warn/50 bg-warn/10 px-2.5 py-2 text-xs font-bold leading-tight text-warn">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {t('peds.previewNotice')}
        </p>
      ) : null}
    </div>
  );
}
