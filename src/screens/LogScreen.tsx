import { ListOrdered } from 'lucide-react';
import { useCodeStore } from '../engine/store';
import { useT } from '../i18n/useT';
import { Timeline } from '../components/log/Timeline';
import { SbarExport } from '../components/log/SbarExport';
import { CodeStatsPanel } from '../components/log/CodeStatsPanel';
import { HistoryPanel } from '../components/log/HistoryPanel';
import { Panel } from '../components/ui/Panel';

/** View 3 — timestamped code log and SBAR export. */
export function LogScreen() {
  const { t } = useT();
  const eventCount = useCodeStore((s) => s.events.length);

  return (
    <div className="flex flex-col gap-3">
      <CodeStatsPanel />
      <SbarExport />
      <HistoryPanel />
      <Panel
        title={t('log.title', { count: eventCount })}
        icon={ListOrdered}
      >
        <Timeline />
      </Panel>
    </div>
  );
}
