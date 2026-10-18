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
import { ErrorBoundary } from './components/ErrorBoundary';
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

/** Owns the 5 Hz `useNow()` subscription, so each tick redraws only this banner, not the whole app. */
function RhythmCheckBanner({ onOpenHud }: { onOpenHud: () => void }) {
  const { t } = useT();
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
  if (!(cyclic.status === 'active' && cycleRemainingMs(cyclic, now) <= 0)) return null;
  return (
    <div className="animate-flash-bg mb-3 flex items-center justify-between gap-3 rounded-2xl border-2 border-crit bg-crit/20 p-3 text-white">
      <div>
        <p className="text-base font-black leading-tight sm:text-lg">{t('hud.cycle.rhythmCheck')}</p>
        <p className="text-xs font-bold opacity-90">{t('hud.cycle.switchCompressors')}</p>
      </div>
      <button
        type="button"
        onClick={onOpenHud}
        className="touch-hit flex shrink-0 items-center gap-1 rounded-xl border border-white bg-white/20 px-3 py-2 text-xs font-bold active:scale-95"
      >
        <Siren className="h-4 w-4" />
        {t('tab.hud')}
      </button>
    </div>
  );
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
      <header className="safe-top sticky top-0 z-20 border-b border-line/80 bg-[#050811]/90 shadow-[0_4px_20px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-3.5 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-crit/40 bg-crit/15 shadow-[0_0_12px_rgba(239,68,68,0.2)]">
            <HeartPulse className="h-4 w-4 text-crit" />
          </span>
          <div className="leading-tight">
            <h1 className="font-mono text-base font-bold tracking-tight text-ink">ResusCode</h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">{t(appTitleKey(population))}</p>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <SaveFailedChip />
            <AudioHint />
            <span
              title={
                wakeSupported
                  ? wakeActive
                    ? t('app.wake.titleActive')
                    : t('app.wake.titleIdle')
                  : t('app.wake.titleUnsupported')
              }
              className={[
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider',
                wakeActive
                  ? 'border-good/60 bg-good/10 text-good shadow-[0_0_10px_rgba(16,185,129,0.15)_inset]'
                  : 'border-line/90 bg-panel2/70 text-mute',
              ].join(' ')}
            >
              {wakeActive ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
              {wakeSupported ? (wakeActive ? t('app.wake.active') : t('app.wake.idle')) : t('app.wake.unsupported')}
            </span>
            {!online ? (
              <span className="flex items-center gap-1.5 rounded-full border border-warn/60 bg-warn/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-warn">
                <WifiOff className="h-3 w-3" /> {t('app.offline')}
              </span>
            ) : null}
            <button
              type="button"
              aria-label={t('app.settings')}
              onClick={() => setSettingsOpen(true)}
              className="touch-hit flex h-9 w-9 items-center justify-center rounded-full border border-line/90 bg-panel2/80 text-mute shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset] hover:border-line-bright hover:text-ink"
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

        {tab !== 'hud' ? <RhythmCheckBanner onOpenHud={() => setTab('hud')} /> : null}

        <div className={tab === 'hud' ? 'block' : 'hidden'}>
          <HudScreen onEnd={() => setTab('log')} onOpenCauses={() => setTab('causes')} />
        </div>
        {/* Own boundaries: a bad record in Log/Causes must not blank the HUD mid-code. */}
        <div className={tab === 'causes' ? 'block' : 'hidden'}>
          <ErrorBoundary>
            <CausesScreen />
          </ErrorBoundary>
        </div>
        <div className={tab === 'log' ? 'block' : 'hidden'}>
          <ErrorBoundary>
            <LogScreen />
          </ErrorBoundary>
        </div>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-mute">
          {t('app.disclaimer')}
        </p>
      </main>

      {/* Tab bar */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line/85 bg-[#060a15]/95 shadow-[0_-6px_24px_rgba(0,0,0,0.55)] backdrop-blur-xl">
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
                  'touch-hit relative flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border text-xs font-bold transition-[transform,background-color,border-color,color] duration-100 active:scale-[0.97]',
                  active
                    ? 'border-cyber/80 bg-gradient-to-b from-cyber/22 to-cyber/10 text-cyber shadow-[0_0_14px_rgba(6,182,212,0.2)_inset]'
                    : 'border-line/85 bg-panel2/80 text-mute hover:border-line-bright hover:text-ink',
                ].join(' ')}
              >
                <Icon className="h-6 w-6" strokeWidth={2.3} />
                {tabItem.label}
                {badge ? (
                  <span
                    className={`absolute top-2 end-3 h-2 w-2 rounded-full ${tabItem.id === 'causes' ? 'bg-good shadow-[0_0_8px_#10b981]' : 'bg-crit shadow-[0_0_8px_#ef4444]'}`}
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
