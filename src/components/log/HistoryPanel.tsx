import { useState } from 'react';
import { Download, History as HistoryIcon, Trash2 } from 'lucide-react';
import { computeAggregates } from '../../engine/history';
import { aggregateRows, recordFlags, recordTitle, uploadStatusLabel } from '../../engine/historyFormat';
import { translate } from '../../i18n/translate';
import { csvFilename, recordsToCsv } from '../../engine/csv';
import { clearAllHistory } from '../../engine/service';
import { useHistoryRecords, usePrefsState } from '../../hooks/useService';
import { needsIdentity } from '../../engine/prefs';
import { BigButton } from '../ui/BigButton';
import { HoldButton } from '../ui/HoldButton';
import { Panel } from '../ui/Panel';
import { IdentityGate } from '../ui/IdentityGate';
import { RecordDetail } from './RecordDetail';
import { downloadText } from './download';
import { useT } from '../../i18n/useT';

const PAGE = 20;

/** Past codes on this device: aggregates, the list, CSV export and clear. Statistics only — no event log is stored. */
export function HistoryPanel() {
  const { t, lang } = useT();
  const records = useHistoryRecords();
  const prefs = usePrefsState();
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [askIdentity, setAskIdentity] = useState(false);
  const shown = showAll ? records : records.slice(0, PAGE);
  const agg = computeAggregates(records);

  const exportCsv = () =>
    downloadText(csvFilename(Date.now()), recordsToCsv([...records].reverse()), 'text/csv;charset=utf-8');

  return (
    <Panel title={t('history.title', { count: records.length })} icon={HistoryIcon}>
      {records.length === 0 ? (
        <p className="text-xs text-mute">{t('history.empty')}</p>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {aggregateRows(agg, lang).map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-3 rounded-lg border border-line bg-panel2/60 px-3 py-2">
                <dt className="text-xs text-mute">{r.label}</dt>
                <dd dir="auto" className="tnum text-end text-sm font-bold text-ink">{r.value}</dd>
              </div>
            ))}
          </dl>
          {/* Totals and medians per population, each with its own n — shown once pediatric codes exist. */}
          {agg.byPopulation.pediatric.total > 0 ? (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  ['history.agg.adult', agg.byPopulation.adult],
                  ['history.agg.pediatric', agg.byPopulation.pediatric],
                ] as const
              ).map(([key, part]) => (
                <div key={key} className="rounded-xl border border-line bg-panel2/40 p-2">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-mute">
                    {t(key, { n: part.total })}
                  </p>
                  <dl className="grid grid-cols-1 gap-1">
                    {aggregateRows(part, lang)
                      .filter((r) => r.label !== translate(lang, 'history.agg.codesCounted'))
                      .map((r) => (
                        <div key={r.label} className="flex items-baseline justify-between gap-3 px-1 py-0.5">
                          <dt className="text-xs text-mute">{r.label}</dt>
                          <dd dir="auto" className="tnum text-end text-sm font-bold text-ink">{r.value}</dd>
                        </div>
                      ))}
                  </dl>
                </div>
              ))}
            </div>
          ) : null}
          <ul className="mt-3 flex flex-col gap-1">
            {shown.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  aria-expanded={openId === r.id}
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                  className={`touch-hit w-full rounded-xl border border-line bg-panel2 px-3 py-2 text-start ${r.voided ? 'opacity-60' : ''}`}
                >
                  <span className="tnum block text-sm font-bold text-ink">{recordTitle(r, undefined, lang)}</span>
                  <span className="block text-[11px] text-mute">
                    {[...recordFlags(r, lang), uploadStatusLabel(r.uploadStatus, lang)].join(' · ')}
                  </span>
                </button>
                {openId === r.id ? <RecordDetail record={r} /> : null}
              </li>
            ))}
          </ul>
          {records.length > PAGE ? (
            <button type="button" onClick={() => setShowAll((s) => !s)} className="touch-hit mt-2 text-xs font-bold text-cyber">
              {showAll ? t('history.showFewer') : t('history.showAll', { count: records.length })}
            </button>
          ) : null}
          {askIdentity ? (
            <IdentityGate
              onCancel={() => setAskIdentity(false)}
              onDone={() => {
                setAskIdentity(false);
                exportCsv();
              }}
            />
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <BigButton
              variant="neutral"
              icon={Download}
              label={t('history.exportCsv')}
              onClick={() => (needsIdentity(prefs.identity) ? setAskIdentity(true) : exportCsv())}
            />
            <HoldButton
              variant="outline"
              icon={Trash2}
              label={t('history.clearHistory')}
              sub={t('history.clearHistorySub')}
              durationMs={2500}
              onComplete={clearAllHistory}
            />
          </div>
        </>
      )}
      <p className="mt-2 text-[11px] text-mute">{t('history.retentionNote')}</p>
    </Panel>
  );
}
