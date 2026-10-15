import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useCodeStore } from './engine/store';

// Ensure PWA updates apply immediately when no code is actively running.
// Workbox serves precached assets first and updates the Service Worker in the
// background; listening for `controllerchange` reloads into the fresh bundle.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    if (useCodeStore.getState().status === 'idle') {
      refreshing = true;
      window.location.reload();
    }
  });
  navigator.serviceWorker.getRegistration().then((reg) => {
    void reg?.update();
  });
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

