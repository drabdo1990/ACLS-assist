import { Check, Search } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { CAUSES } from '../../content/causes';
import { Panel } from '../ui/Panel';
import { useT } from '../../i18n/useT';

/**
 * H's & T's audit grid (SHA ACLS 2024 Table 3.4 + tension pneumothorax). Each tile shows the bedside clue and the immediate
 * countermeasure; tapping marks it addressed and stamps it into the log/SBAR.
 */
export function CausesGrid() {
  const { t } = useT();
  const causes = useCodeStore((s) => s.causes);
  const toggleCause = useCodeStore((s) => s.toggleCause);
  const done = CAUSES.filter((c) => causes[c.id]).length;

  return (
    <Panel
      title={t('causes.title')}
      icon={Search}
      accent="warn"
      right={
        <span className="tnum text-xs font-bold text-warn">
          {done}/{CAUSES.length}
        </span>
      }
    >
      <div className="space-y-3">
        {(['H', 'T'] as const).map((group) => (
          <div key={group}>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-mute">{t(`causes.group.${group}`)}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CAUSES.filter((c) => c.group === group).map((c) => {
                const on = !!causes[c.id];
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleCause(c.id)}
                    className={[
                      'touch-hit flex min-h-[72px] items-start gap-3 rounded-xl border p-3 text-left active:scale-[0.98]',
                      on ? 'border-warn bg-warn/15' : 'border-line bg-panel2',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                        on ? 'border-warn bg-warn text-bg' : 'border-line',
                      ].join(' ')}
                    >
                      {on ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-base font-bold leading-tight ${on ? 'text-warn' : 'text-ink'}`}>
                        {t(`cause.${c.id}.label`)}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-mute">{t(`cause.${c.id}.clue`)}</span>
                      <span className="mt-1 block text-xs font-semibold leading-snug text-cyber">→ {t(`cause.${c.id}.action`)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
