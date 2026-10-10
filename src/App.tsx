import { useEffect, useState } from 'react';
import { ListOrdered, Lock, LockOpen, Siren, TriangleAlert, WifiOff } from 'lucide-react';
import { useCodeStore } from './engine/store';
import { useTicker } from './hooks/useNow';
import { useWakeLock } from './hooks/useWakeLock';
import { HudScreen } from './screens/HudScreen';
import { CrisisScreen } from './screens/CrisisScreen';
import { LogScreen } from './screens/LogScreen';

type Tab = 'hud' | 'crisis' | 'log';

const TABS: Array<{ id: Tab; label: string; icon: typeof Siren }> = [
  { id: 'hud', label: 'Code HUD', icon: Siren },
  { id: 'crisis', label: 'Crisis', icon: TriangleAlert },
  { id: 'log', label: 'Log', icon: ListOrdered },
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

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      {/* Header */}
      <header className="safe-top sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <Siren className="h-5 w-5 text-crit" />
          <div className="leading-tight">
            <h1 className="font-mono text-base font-bold tracking-tight text-ink">CodeOR</h1>
            <p className="text-[10px] uppercase tracking-widest text-mute">Crisis &amp; Resuscitation</p>
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

        {tab === 'hud' ? <HudScreen /> : tab === 'crisis' ? <CrisisScreen /> : <LogScreen />}

        <p className="mt-4 text-center text-[10px] leading-relaxed text-mute">
          Clinical decision-support aid only. Verify every dose against your local protocol. Not a substitute for
          clinical judgement. PHI-free — no identifiers stored; no data leaves this device.
        </p>
      </main>

      {/* Tab bar */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2 p-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={[
                  'touch-hit flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border text-xs font-bold active:scale-[0.97]',
                  active ? 'border-cyber bg-cyber/15 text-cyber' : 'border-line bg-panel2 text-mute',
                ].join(' ')}
              >
                <Icon className="h-6 w-6" strokeWidth={2.3} />
                {t.label}
                {t.id === 'log' && status !== 'idle' ? (
                  <span className="absolute mt-[-38px] ml-[34px] h-2 w-2 rounded-full bg-crit" />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
