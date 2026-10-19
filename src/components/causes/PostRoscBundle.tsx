import { HeartPulse } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { profileFor } from '../../content/profiles';
import { Checklist } from '../ui/Checklist';
import { Panel } from '../ui/Panel';
import { POST_ROSC_PREFIX } from '../../engine/eventQueries';
import { useT } from '../../i18n/useT';

/** Post-ROSC care bundle — opens automatically when ROSC is declared. Pediatric codes get the pediatric bundle. */
export function PostRoscBundle() {
  const { t } = useT();
  const population = useCodeStore((s) => s.population);
  const rosc = useCodeStore((s) => s.status === 'rosc');
  const peds = population === 'pediatric';
  return (
    <Panel title={t('postRosc.title')} icon={HeartPulse} accent="good">
      <Checklist
        items={profileFor(population).postRoscBundle}
        category="post"
        prefix={POST_ROSC_PREFIX}
        itemKeyPrefix={peds ? 'pPostRosc' : 'postRosc'}
        disabled={!rosc}
      />
    </Panel>
  );
}
