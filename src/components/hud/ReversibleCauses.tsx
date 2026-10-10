import { HeartPulse } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { CAUSES, CAUSE_GROUP_LABEL } from '../../content/causes';
import { Panel } from '../ui/Panel';

/** Reversible-causes checklist (4 H's / 4 T's). Each activated cause is stamped into the log/SBAR. */
export function ReversibleCauses() {
  const causes = useCodeStore((s) => s.causes);
  const toggleCause = useCodeStore((s) => s.toggleCause);
  const canLog = useCodeStore((s) => s.status === 'active' || s.status === 'paused');

  return (
    <Panel title="Reversible causes — 4 H's & 4 T's" icon={HeartPulse} accent="warn">
      <div className="space-y-2">
        {(['H', 'T'] as const).map((group) => (
          <div key={group}>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-mute">
              {CAUSE_GROUP_LABEL[group]}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CAUSES.filter((c) => c.group === group).map((c) => {
                const on = !!causes[c.id];
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    disabled={!canLog}
                    onClick={() => toggleCause(c.id)}
                    title={c.hint}
                    className={[
                      'touch-hit flex min-h-[60px] flex-col justify-center rounded-xl border px-3 text-left active:scale-[0.97] disabled:opacity-40',
                      on ? 'border-warn bg-warn/20 text-warn' : 'border-line bg-panel2 text-ink',
                    ].join(' ')}
                  >
                    <span className="text-sm font-bold leading-tight">{c.label}</span>
                    <span className="mt-0.5 text-[11px] leading-tight opacity-70">{c.hint}</span>
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
