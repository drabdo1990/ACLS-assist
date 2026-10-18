import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useCodeStore } from './engine/store';
import { startService } from './engine/service';
import { startTabLock } from './engine/tabLock';
import { takeEnrollFragment } from './engine/enrollLink';
import { applyDocumentLang, getLang } from './i18n/lang';

// Before the first render, so an Arabic device never flashes a left-to-right layout.
applyDocumentLang(getLang());

// Ensure PWA updates apply immediately when no code is actively running.
// Workbox serves precached assets first and updates the Service Worker in the
// background; listening for `controllerchange` reloads into the fresh bundle.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;
  let reloadWhenIdle = false;
  const reload = () => {
    refreshing = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    if (useCodeStore.getState().status === 'idle') reload();
    else reloadWhenIdle = true; // controllerchange fires once: apply the update when the code ends
  });
  useCodeStore.subscribe((s) => {
    if (reloadWhenIdle && !refreshing && s.status === 'idle') reload();
  });
  // A ward tablet can stay open for days: re-check on load, whenever the page is shown again, and hourly.
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (!reg) return;
    const check = () => void reg.update().catch(() => {}); // offline: try again next time
    check();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    setInterval(check, 60 * 60 * 1000);
  });
}

void startTabLock().then((canWrite) => {
  if (canWrite) startService();

  // Read once, before render: StrictMode double-invokes initialisers and the fragment is removed from the URL.
  const pendingEnroll = takeEnrollFragment();

  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(
      <StrictMode>
        <ErrorBoundary>
          <App pendingEnroll={pendingEnroll} />
        </ErrorBoundary>
      </StrictMode>,
    );
  }
});

