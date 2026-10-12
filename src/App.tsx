import { useEffect, useRef, useState } from 'react';
import { HeartPulse, ListOrdered, Lock, LockOpen, Search, Siren, WifiOff } from 'lucide-react';
import { useCodeStore } from './engine/store';
import { useTicker } from './hooks/useNow';
import { useWakeLock } from './hooks/useWakeLock';
import { HudScreen } from './screens/HudScreen';
import { CausesScreen } from './screens/CausesScreen';
import { LogScreen } from './screens/LogScreen';

type Tab = 'hud' | 'causes' | 'log';

const TABS: Array<{ id: Tab; label: string; icon: typeof Siren }> = [
  { id: 'hud', label: 'ACLS HUD', icon: Siren },
  { id: 'causes', label: "H's & T's", icon: Search },
  { id: 'log', label: 'Log / SBAR', icon: ListOrdered },
];

function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export default function App() {
  useTicker();
  const { active: wakeActive, supported: wakeSupported } = useWakeLock();
  const online = useOnline();
  const [tab, setTab] = useState<Tab>('hud');
  const status = useCodeStore((s) => s.status);
  const restored = useCodeStore((s) => s.restored);
  const dismissRestored = useCodeStore((s) => s.dismissRestored);

  // The post-ROSC bundle opens automatically on the transition into ROSC
  // (not on a refresh that restores an already-ROSC session).
  const prevStatus = useRef(status);
  useEffect(() => {
    if (status === 'rosc' && prevStatus.current !== 'rosc') setTab('causes');
    prevStatus.current = status;
  }, [status]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      {/* Header */}
      <header className="safe-top sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <HeartPulse className="h-5 w-5 text-crit" />
          <div className="leading-tight">
            <h1 className="font-mono text-base font-bold tracking-tight text-ink">ResusCode</h1>
            <p className="text-[10px] uppercase tracking-widest text-mute">Adult ACLS Command</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span
              title={
                wakeSupported
                  ? wakeActive
                    ? 'Screen will not sleep'
                    : 'Wake lock idle'
                  : 'Wake Lock unsupported on this browser'
              }
              className={[
                'flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold',
                wakeActive ? 'border-good/60 text-good' : 'border-line text-mute',
              ].join(' ')}
            >
              {wakeActive ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
              {wakeSupported ? (wakeActive ? 'AWAKE' : 'IDLE') : 'N/A'}
            </span>
            {!online ? (
              <span className="flex items-center gap-1 rounded-full border border-warn/60 px-2 py-1 text-[10px] font-bold text-warn">
                <WifiOff className="h-3 w-3" /> OFFLINE
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 pt-3 pb-appbar">
        {restored ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-warn/60 bg-warn/10 p-3 text-xs font-semibold text-warn">
            <span className="flex-1">Session restored from this device — timers continued from saved timestamps.</span>
            <button
              type="button"
              onClick={dismissRestored}
              className="touch-hit rounded-lg border border-warn/60 px-3 py-2 font-bold"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {tab === 'hud' ? (
          <HudScreen onEnd={() => setTab('log')} onOpenCauses={() => setTab('causes')} />
        ) : tab === 'causes' ? (
          <CausesScreen />
        ) : (
          <LogScreen />
        )}

        <p className="mt-4 text-center text-[10px] leading-relaxed text-mute">
          Clinical decision-support aid only, benchmarked to the SHA ACLS Provider Manual 2024 (AHA/ERC-aligned). Verify every dose against your local protocol.
          Not a substitute for clinical judgement. PHI-free — no identifiers stored; no data leaves this device.
        </p>
      </main>

      {/* Tab bar */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2 p-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            const badge =
              (t.id === 'log' && status !== 'idle') || (t.id === 'causes' && status === 'rosc');
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={[
                  'touch-hit relative flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border text-xs font-bold active:scale-[0.97]',
                  active ? 'border-cyber bg-cyber/15 text-cyber' : 'border-line bg-panel2 text-mute',
                ].join(' ')}
              >
                <Icon className="h-6 w-6" strokeWidth={2.3} />
                {t.label}
                {badge ? (
                  <span
                    className={`absolute top-2 right-3 h-2 w-2 rounded-full ${t.id === 'causes' ? 'bg-good' : 'bg-crit'}`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
