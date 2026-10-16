import { Activity, ArrowRight, Check, Zap } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useCodeStore } from '../../engine/store';
import { nextAclsStep } from '../../content/algorithm';
import type { RhythmBranch as Branch } from '../../engine/types';
import { Panel } from '../ui/Panel';
import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n/en';

const BRANCHES: Array<{ id: Branch; titleKey: MessageKey; subKey: MessageKey; on: string }> = [
  { id: 'shockable', titleKey: 'hud.branch.shockable.title', subKey: 'hud.branch.shockable.sub', on: 'border-crit bg-crit/20 text-crit' },
  { id: 'nonshockable', titleKey: 'hud.branch.nonshockable.title', subKey: 'hud.branch.nonshockable.sub', on: 'border-cyber bg-cyber/20 text-cyber' },
];

/** AHA/ERC algorithm branch selector with a live "do this next" sequence. */
export function RhythmBranch() {
  const { t } = useT();
  const s = useCodeStore(
    useShallow((st) => ({
      branch: st.rhythmBranch,
      shocks: st.shocks.length,
      epi: st.epi.length,
      antiarrhythmic: st.amio.length + st.lido.length,
      causesChecked: Object.values(st.causes).filter(Boolean).length,
    })),
  );
  const setRhythmBranch = useCodeStore((st) => st.setRhythmBranch);
  const view = nextAclsStep(s);

  return (
    <Panel title={t('hud.branch.title')} icon={Activity} accent={s.branch === 'shockable' ? 'crit' : s.branch ? 'cyber' : 'none'}>
      <div className="grid grid-cols-2 gap-2">
        {BRANCHES.map((b) => {
          const selected = s.branch === b.id;
          return (
            <button
              key={b.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setRhythmBranch(b.id)}
              className={[
                'touch-hit flex min-h-[72px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 text-center active:scale-[0.97]',
                selected ? b.on : 'border-line bg-panel2 text-ink',
              ].join(' ')}
            >
              <span className="flex items-center gap-1.5 text-lg font-bold leading-tight">
                {b.id === 'shockable' ? <Zap className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
                {t(b.titleKey)}
              </span>
              <span className="text-xs font-semibold opacity-80">{t(b.subKey)}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 rounded-xl border border-line bg-black/20 p-2.5">
        <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-mute">{t(view.titleKey as MessageKey)}</p>
        {view.steps.length ? (
          <ol className="space-y-1">
            {view.steps.map((step) => (
              <li
                key={step.id}
                className={[
                  'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm leading-tight',
                  step.state === 'current' ? 'border border-warn bg-warn/15 font-bold text-warn' : '',
                  step.state === 'done' ? 'text-mute line-through decoration-1' : '',
                  step.state === 'todo' ? 'text-ink' : '',
                ].join(' ')}
              >
                {step.state === 'done' ? (
                  <Check className="h-4 w-4 shrink-0 text-good" />
                ) : step.state === 'current' ? (
                  <ArrowRight className="h-4 w-4 shrink-0" />
                ) : (
                  <span className="h-4 w-4 shrink-0" />
                )}
                {t(step.key as MessageKey)}
              </li>
            ))}
          </ol>
        ) : null}
        <p className={`text-xs leading-snug text-mute ${view.steps.length ? 'mt-1.5 border-t border-line pt-1.5' : ''}`}>
          {view.focus == null && view.steps.length ? <strong className="text-ink">{t('hud.branch.then')} </strong> : null}
          {t(view.ongoingKey as MessageKey)}
        </p>
      </div>
    </Panel>
  );
}
