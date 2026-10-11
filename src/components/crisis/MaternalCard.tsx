import { Baby, Check, Scissors } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { useNow } from '../../hooks/useNow';
import { formatClock } from '../../engine/timing';
import { MATERNAL_STEPS, MATERNAL_HYSTEROTOMY_MIN, MATERNAL_DELIVERY_MIN } from '../../content/protocols';
import { CrisisCard } from './CrisisCard';
import { Checklist } from './Checklist';
import { BigButton } from '../ui/BigButton';

const HYSTEROTOMY_MS = MATERNAL_HYSTEROTOMY_MIN * 60_000;
const DELIVERY_MS = MATERNAL_DELIVERY_MIN * 60_000;

/** Maternal collapse — the 4-minute perimortem caesarean rule with live countdown. */
export function MaternalCard() {
  const now = useNow();
  const crisis = useCodeStore((s) => s.crisis);
  const status = useCodeStore((s) => s.status);
  const events = useCodeStore((s) => s.events);
  const declareCrisis = useCodeStore((s) => s.declareCrisis);
  const resolveCrisis = useCodeStore((s) => s.resolveCrisis);
  const logEvent = useCodeStore((s) => s.logEvent);

  const startedAt = crisis.maternalStartedAt;
  const elapsed = startedAt != null ? Math.max(0, now - startedAt) : 0;
  const toHysterotomy = Math.max(0, HYSTEROTOMY_MS - elapsed);
  const toDelivery = Math.max(0, DELIVERY_MS - elapsed);

  const delivered = events.some((e) => e.label === 'Fetus delivered');
  const resolved = delivered || status === 'rosc';
  const atHysterotomy = startedAt != null && !resolved && elapsed >= HYSTEROTOMY_MS;
  const atDelivery = startedAt != null && !resolved && elapsed >= DELIVERY_MS;

  return (
    <CrisisCard
      title="Maternal Collapse / Perimortem C-Section"
      subtitle="Left uterine displacement · hysterotomy by min 4 · deliver by min 5"
      icon={Baby}
      accent="good"
    >
      {startedAt == null ? (
        <BigButton
          variant="good"
          size="xl"
          icon={Baby}
          label="Start 4-minute rule"
          sub="Maternal arrest — starts code & perimortem clock"
          onClick={() => declareCrisis('maternal')}
        />
      ) : (
        <>
          <div
            className={[
              'rounded-xl border p-3 text-center',
              atHysterotomy ? 'animate-flash-bg border-crit' : 'border-good/60 bg-good/10',
            ].join(' ')}
          >
            <p className={`text-xs font-bold uppercase tracking-widest ${atHysterotomy ? 'text-white' : 'text-good'}`}>
              {delivered
                ? 'Fetus delivered'
                : status === 'rosc'
                  ? 'Maternal ROSC achieved'
                  : atDelivery
                    ? 'Deliver fetus now'
                    : atHysterotomy
                      ? 'Begin hysterotomy now'
                      : `Hysterotomy in ${MATERNAL_HYSTEROTOMY_MIN} min`}
            </p>
            <p className={`tnum font-mono text-4xl font-bold ${atHysterotomy ? 'text-white' : 'text-ink'}`}>
              {formatClock(atHysterotomy || resolved ? elapsed : toHysterotomy)}
            </p>
            <p className={`text-[11px] ${atHysterotomy ? 'text-white/80' : 'text-mute'}`}>
              {resolved
                ? 'elapsed since perimortem clock start'
                : atHysterotomy
                  ? `elapsed · delivery target ${formatClock(DELIVERY_MS)}`
                  : `until minute ${MATERNAL_HYSTEROTOMY_MIN}`}
            </p>
          </div>
          {atHysterotomy && !atDelivery ? (
            <p className="mt-2 text-center text-sm font-bold text-crit">
              No ROSC — begin resuscitative hysterotomy. Deliver by minute {MATERNAL_DELIVERY_MIN}.
            </p>
          ) : null}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <BigButton
              variant="crit"
              icon={Scissors}
              label="Log CS begun"
              onClick={() => logEvent('crisis', 'Resuscitative hysterotomy begun')}
            />
            <BigButton
              variant="good"
              icon={delivered ? Check : Baby}
              label={delivered ? 'Delivery logged' : 'Log delivery'}
              sub={delivered ? 'Tap to resolve timer' : `target ${formatClock(toDelivery)}`}
              onClick={() => {
                if (!delivered) {
                  logEvent('crisis', 'Fetus delivered');
                } else {
                  resolveCrisis('maternal');
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => resolveCrisis('maternal')}
            className="touch-hit mt-2 min-h-[48px] w-full rounded-xl border border-line bg-panel2 text-xs font-bold text-mute active:scale-[0.98]"
          >
            Stop / resolve maternal timer
          </button>
        </>
      )}

      <p className="mt-3 mb-1 text-xs font-bold uppercase tracking-widest text-mute">Actions &amp; checklist</p>
      <Checklist items={MATERNAL_STEPS} category="crisis" prefix="Maternal" />
    </CrisisCard>
  );
}

