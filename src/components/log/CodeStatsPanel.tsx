import { BarChart3 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useCodeStore } from '../../engine/store';
import { useNow } from '../../hooks/useNow';
import { computeCodeStats } from '../../engine/stats';
import { statsRows, statsTimeNote } from '../../engine/statsFormat';
import { Panel } from '../ui/Panel';
import { Chip } from '../ui/Chip';
import { HoldButton } from '../ui/HoldButton';
import { useT } from '../../i18n/useT';

/** End-of-code statistics (same rows as the SBAR section) plus Training / Void flags. */
export function CodeStatsPanel() {
  const { t, lang } = useT();
  const now = useNow();
  const session = useCodeStore(
    useShallow((s) => ({
      population: s.population,
      weightKg: s.weightKg,
      weightSource: s.weightSource,
      ageMonths: s.ageMonths,
      status: s.status,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      roscAccumMs: s.roscAccumMs,
      pausedAt: s.pausedAt,
      pausedAccumMs: s.pausedAccumMs,
      events: s.events,
      shocks: s.shocks,
      epi: s.epi,
      amio: s.amio,
      lido: s.lido,
      causes: s.causes,
      pocus: s.pocus,
    })),
  );
  const training = useCodeStore((s) => s.training);
  const voided = useCodeStore((s) => s.voided);
  const setTraining = useCodeStore((s) => s.setTraining);
  const setVoided = useCodeStore((s) => s.setVoided);

  const stats = computeCodeStats(session, now);
  if (!stats) return null;

  return (
    <Panel
      title={t('stats.title')}
      icon={BarChart3}
      accent={voided ? 'none' : 'cyber'}
      className={voided ? 'opacity-60' : ''}
    >
      {voided ? (
        <p className="mb-2 rounded-lg border border-line px-3 py-2 text-xs font-bold text-mute">
          {t('stats.voidedNotice')}
        </p>
      ) : null}
      <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {statsRows(stats, lang).map((r) => (
          <div
            key={r.label}
            className="flex items-baseline justify-between gap-3 rounded-lg border border-line bg-panel2/60 px-3 py-2"
          >
            <dt className="text-xs text-mute">{r.label}</dt>
            <dd dir="auto" className={`tnum text-end text-sm font-bold ${r.flag ? 'text-warn' : 'text-ink'}`}>
              {r.value}
              {r.flag ? ' ⚠' : ''}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-mute">{statsTimeNote(lang)}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Chip selected={training} onClick={() => setTraining(!training)}>
          {training ? t('stats.trainingActive') : t('stats.markTraining')}
        </Chip>
        {voided ? (
          <Chip selected onClick={() => setVoided(false)}>
            {t('stats.restore')}
          </Chip>
        ) : (
          <HoldButton
            variant="outline"
            label={t('stats.voidLabel')}
            sub={t('stats.voidSub')}
            durationMs={2000}
            onComplete={() => setVoided(true)}
          />
        )}
      </div>
    </Panel>
  );
}
