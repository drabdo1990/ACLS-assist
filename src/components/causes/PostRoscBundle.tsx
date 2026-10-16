import { HeartPulse } from 'lucide-react';
import { POST_ROSC_BUNDLE } from '../../content/protocols';
import { Checklist } from '../ui/Checklist';
import { Panel } from '../ui/Panel';
import { POST_ROSC_PREFIX } from '../../engine/eventQueries';
import { useT } from '../../i18n/useT';

/** Post-ROSC care bundle — opens automatically when ROSC is declared. */
export function PostRoscBundle() {
  const { t } = useT();
  return (
    <Panel title={t('postRosc.title')} icon={HeartPulse} accent="good">
      <Checklist items={POST_ROSC_BUNDLE} category="post" prefix={POST_ROSC_PREFIX} />
    </Panel>
  );
}
