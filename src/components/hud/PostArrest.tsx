import { HeartPulse, Check } from 'lucide-react';
import { POST_ARREST_CHECKLIST } from '../../content/protocols';
import { Panel } from '../ui/Panel';
import { useLoggedChecklist } from '../crisis/Checklist';

/** Post-cardiac-arrest care bundle, shown once ROSC is declared. */
export function PostArrest() {
  const { isOn, toggle } = useLoggedChecklist('post', 'Post-arrest');

  return (
    <Panel title="Post-arrest care bundle" icon={HeartPulse} accent="good">
      <div className="space-y-1.5">
        {POST_ARREST_CHECKLIST.map((item) => {
          const on = isOn(item.text);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(item.text)}
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
