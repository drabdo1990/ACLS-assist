import { ListOrdered } from 'lucide-react';
import { useCodeStore } from '../engine/store';
import { Timeline } from '../components/log/Timeline';
import { SbarExport } from '../components/log/SbarExport';
import { Panel } from '../components/ui/Panel';

/** View 3 — timestamped code log and SBAR export. */
export function LogScreen() {
  const eventCount = useCodeStore((s) => s.events.length);

  return (
    <div className="flex flex-col gap-3">
      <SbarExport />
      <Panel
        title={`Event log · ${eventCount} event${eventCount === 1 ? '' : 's'}`}
        icon={ListOrdered}
      >
        <Timeline />
      </Panel>
    </div>
  );
}
