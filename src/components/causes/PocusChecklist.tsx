import { Check, ScanLine } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { POCUS_ITEMS } from '../../content/pocus';
import { Panel } from '../ui/Panel';

/** POCUS findings checklist — scan only during the rhythm-check pause (< 10 s). */
export function PocusChecklist() {
  const pocus = useCodeStore((s) => s.pocus);
  const togglePocus = useCodeStore((s) => s.togglePocus);

  return (
    <Panel title="Point-of-care ultrasound" icon={ScanLine} accent="cyber">
      <p className="mb-2 text-xs text-mute">Scan during the rhythm check only — never extend the pause beyond 10 s.</p>
      <div className="space-y-1.5">
        {POCUS_ITEMS.map((p) => {
          const on = !!pocus[p.id];
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => togglePocus(p.id)}
              className={[
                'touch-hit flex min-h-[64px] w-full items-start gap-3 rounded-xl border p-3 text-left active:scale-[0.98]',
                on ? 'border-cyber bg-cyber/15' : 'border-line bg-panel2',
              ].join(' ')}
            >
              <span
                className={[
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                  on ? 'border-cyber bg-cyber text-bg' : 'border-line',
                ].join(' ')}
              >
                {on ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-mute">{p.view}</span>
                <span className={`block text-sm font-bold leading-tight ${on ? 'text-cyber' : 'text-ink'}`}>
                  {p.label}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-mute">{p.meaning}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
