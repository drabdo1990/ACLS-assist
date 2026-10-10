import { useState } from 'react';
import { HeartPulse, Check } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { POST_ARREST_CHECKLIST } from '../../content/protocols';
import { Panel } from '../ui/Panel';

/** Post-cardiac-arrest care bundle, shown once ROSC is declared. */
export function PostArrest() {
  const logEvent = useCodeStore((s) => s.logEvent);
  const [done, setDone] = useState<Record<string, boolean>>({});

  return (
    <Panel title="Post-arrest care bundle" icon={HeartPulse} accent="good">
      <div className="space-y-1.5">
        {POST_ARREST_CHECKLIST.map((item) => {
          const on = !!done[item.id];
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const next = !on;
                setDone((d) => ({ ...d, [item.id]: next }));
                if (next) logEvent('post', `Post-arrest: ${item.text}`);
              }}
              className={[
                'touch-hit flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-3 text-left active:scale-[0.98]',
                on ? 'border-good bg-good/15' : 'border-line bg-panel2',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                  on ? 'border-good bg-good text-bg' : 'border-line',
                ].join(' ')}
              >
                {on ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
              </span>
              <span className={`text-sm font-semibold leading-tight ${on ? 'text-good' : 'text-ink'}`}>
                {item.text}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
