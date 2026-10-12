import { HeartPulse } from 'lucide-react';
import { POST_ROSC_BUNDLE } from '../../content/protocols';
import { Checklist } from '../ui/Checklist';
import { Panel } from '../ui/Panel';

/** Post-ROSC care bundle — opens automatically when ROSC is declared. */
export function PostRoscBundle() {
  return (
    <Panel title="Post-ROSC bundle" icon={HeartPulse} accent="good">
      <Checklist items={POST_ROSC_BUNDLE} category="post" prefix="Post-ROSC" />
    </Panel>
  );
}
