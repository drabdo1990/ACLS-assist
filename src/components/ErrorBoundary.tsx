import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useCodeStore } from '../engine/store';

interface State {
  failed: boolean;
}

/**
 * Last line of defence: a render crash must never leave a blank screen the clinician cannot
 * recover from. Offers a one-tap reset (clears the saved session) and a plain reload.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ResusCode render error', error, info.componentStack);
  }

  private resetAndReload = () => {
    useCodeStore.getState().reset();
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-bg p-6 text-center text-ink">
        <p className="text-lg font-bold text-crit">Something went wrong</p>
        <p className="max-w-sm text-sm text-mute">
          The screen could not be drawn. Your saved session is kept unless you reset it. Reload first; reset only if
          the problem returns.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="touch-hit min-h-[64px] w-full max-w-sm rounded-xl border border-cyber/60 bg-cyber/15 font-bold text-cyber"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={this.resetAndReload}
          className="touch-hit min-h-[64px] w-full max-w-sm rounded-xl border border-crit/60 bg-crit/10 font-bold text-crit"
        >
          Reset session and reload
        </button>
      </div>
    );
  }
}
