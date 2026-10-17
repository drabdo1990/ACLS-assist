import { useEffect, useRef, useState } from 'react';
import { HeartPulse, ListOrdered, Lock, LockOpen, Search, Settings, Siren, WifiOff } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useCodeStore } from './engine/store';
import { useNow, useTicker } from './hooks/useNow';
import { useWakeLock } from './hooks/useWakeLock';
import { cycleRemainingMs } from './engine/timing';
import { HudScreen } from './screens/HudScreen';
import { appTitleKey } from './components/hud/populationText';
import { CausesScreen } from './screens/CausesScreen';
import { LogScreen } from './screens/LogScreen';
import { AudioHint, SaveFailedChip } from './components/ui/StatusChips';
import { ClockChangeNotice } from './components/ui/ClockChangeNotice';
import { EnrollConfirm } from './components/EnrollConfirm';
import { SettingsSheet } from './components/SettingsSheet';
import type { EnrollFragment } from './engine/enrollLink';
import { useT } from './i18n/useT';
import { AR_CLINICAL_REVIEWED } from './i18n/review';

type Tab = 'hud' | 'causes' | 'log';

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

export default function App({ pendingEnroll }: { pendingEnroll: EnrollFragment }) {
  const { t, lang } = useT();
  useTicker();
  const { active: wakeActive, supported: wakeSupported } = useWakeLock();
  const online = useOnline();
  const [tab, setTab] = useState<Tab>('hud');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const status = useCodeStore((s) => s.status);
  const population = useCodeStore((s) => s.population);
  const restored = useCodeStore((s) => s.restored);
  const dismissRestored = useCodeStore((s) => s.dismissRestored);
  const staleAgeMs = useCodeStore((s) => s.staleAgeMs);
  const reset = useCodeStore((s) => s.reset);

  const now = useNow();
  const cyclic = useCodeStore(
    useShallow((s) => ({
      status: s.status,
      cycleIndex: s.cycleIndex,
      pausedAt: s.pausedAt,
      cycleStartedAt: s.cycleStartedAt,
      cyclePausedAccumMs: s.cyclePausedAccumMs,
    })),
  );
  const remaining = cycleRemainingMs(cyclic, now);
  const cycleExpired = cyclic.status === 'active' && remaining <= 0;

  const tabs: Array<{ id: Tab; label: string; icon: typeof Siren }> = [
    { id: 'hud', label: t('tab.hud'), icon: Siren },
    { id: 'causes', label: t('tab.causes'), icon: Search },
    { id: 'log', label: t('tab.log'), icon: ListOrdered },
  ];

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
            <p className="text-[10px] uppercase tracking-widest text-mute">{t(appTitleKey(population))}</p>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <SaveFailedChip />
            <AudioHint />
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
                <WifiOff className="h-3 w-3" /> {t('app.offline')}
              </span>
            ) : null}
            <button
              type="button"
              aria-label={t('app.settings')}
              onClick={() => setSettingsOpen(true)}
              className="touch-hit flex h-9 w-9 items-center justify-center rounded-full border border-line text-mute"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 pt-3 pb-appbar">
        <EnrollConfirm fragment={pendingEnroll} onEnrolled={() => setSettingsOpen(true)} />
        {lang === 'ar' && !AR_CLINICAL_REVIEWED ? (
          <p role="note" className="mb-3 rounded-xl border border-warn/60 bg-warn/10 px-3 py-2 text-xs font-semibold text-warn">
            {t('i18n.draftNotice')}
          </p>
        ) : null}
        <ClockChangeNotice />
        {restored ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-warn/60 bg-warn/10 p-3 text-xs font-semibold text-warn">
            <span className="flex-1">
              {staleAgeMs != null
                ? t('app.restored.stale', { hours: Math.floor(staleAgeMs / 3_600_000) })
                : t('app.restored.freshSession')}
            </span>
            {staleAgeMs != null ? (
              <button
                type="button"
                onClick={reset}
                className="touch-hit rounded-lg border border-warn bg-warn/20 px-3 py-2 font-bold"
              >
                {t('app.restored.fresh')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismissRestored}
              className="touch-hit rounded-lg border border-warn/60 px-3 py-2 font-bold"
            >
              {t('app.restored.dismiss')}
            </button>
          </div>
        ) : null}

        {cycleExpired && tab !== 'hud' ? (
          <div className="animate-flash-bg mb-3 flex items-center justify-between gap-3 rounded-2xl border-2 border-crit bg-crit/20 p-3 text-white">
            <div>
              <p className="text-base font-black leading-tight sm:text-lg">{t('hud.cycle.rhythmCheck')}</p>
              <p className="text-xs font-bold opacity-90">{t('hud.cycle.switchCompressors')}</p>
            </div>
            <button
              type="button"
              onClick={() => setTab('hud')}
              className="touch-hit flex shrink-0 items-center gap-1 rounded-xl border border-white bg-white/20 px-3 py-2 text-xs font-bold active:scale-95"
            >
              <Siren className="h-4 w-4" />
              {t('tab.hud')}
            </button>
          </div>
        ) : null}

        <div className={tab === 'hud' ? 'block' : 'hidden'}>
          <HudScreen onEnd={() => setTab('log')} onOpenCauses={() => setTab('causes')} />
        </div>
        <div className={tab === 'causes' ? 'block' : 'hidden'}>
          <CausesScreen />
        </div>
        <div className={tab === 'log' ? 'block' : 'hidden'}>
          <LogScreen />
        </div>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-mute">
          {t('app.disclaimer')}
        </p>
      </main>

      {/* Tab bar */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2 p-2">
          {tabs.map((tabItem) => {
            const Icon = tabItem.icon;
            const active = tab === tabItem.id;
            const badge =
              (tabItem.id === 'log' && status !== 'idle') || (tabItem.id === 'causes' && status === 'rosc');
            return (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => setTab(tabItem.id)}
                aria-current={active ? 'page' : undefined}
                className={[
                  'touch-hit relative flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border text-xs font-bold active:scale-[0.97]',
                  active ? 'border-cyber bg-cyber/15 text-cyber' : 'border-line bg-panel2 text-mute',
                ].join(' ')}
              >
                <Icon className="h-6 w-6" strokeWidth={2.3} />
                {tabItem.label}
                {badge ? (
                  <span
                    className={`absolute top-2 end-3 h-2 w-2 rounded-full ${tabItem.id === 'causes' ? 'bg-good' : 'bg-crit'}`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
