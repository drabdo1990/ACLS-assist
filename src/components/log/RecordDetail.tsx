import type { CodeRecord } from '../../engine/history';
import { statsRows, statsTimeNote } from '../../engine/statsFormat';
import { editRecordFlags } from '../../engine/service';
import { Chip } from '../ui/Chip';
import { HoldButton } from '../ui/HoldButton';
import { useT } from '../../i18n/useT';

/** Inline summary of a past code. Flag edits re-send statistics only when the device is enrolled. */
export function RecordDetail({ record }: { record: CodeRecord }) {
  const { t, lang } = useT();
  return (
    <div className="mt-2 rounded-xl border border-line bg-panel2/60 p-2">
      <dl className="grid grid-cols-1 gap-1">
        {statsRows(record.stats, lang).map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 px-1 py-1">
            <dt className="text-xs text-mute">{r.label}</dt>
            <dd dir="auto" className={`tnum text-end text-sm font-bold ${r.flag ? 'text-warn' : 'text-ink'}`}>
              {r.value}
              {r.flag ? ' ⚠' : ''}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-[11px] text-mute">{statsTimeNote(lang)}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Chip selected={record.training} onClick={() => editRecordFlags(record.id, { training: !record.training })}>
          {record.training ? `${t('history.flag.training')} ✓` : t('stats.markTraining')}
        </Chip>
        {record.voided ? (
          <Chip selected onClick={() => editRecordFlags(record.id, { voided: false })}>
            {t('stats.restore')}
          </Chip>
        ) : (
          <HoldButton
            variant="outline"
            label={t('stats.voidLabel')}
            sub={t('stats.voidSubPast')}
            durationMs={2000}
            onComplete={() => editRecordFlags(record.id, { voided: true })}
          />
        )}
      </div>
    </div>
  );
}
