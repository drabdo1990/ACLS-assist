import { useState } from 'react';
import { STORAGE_KEY } from '../../engine/persistence';
import { useT } from '../../i18n/useT';

const NOTICE_KEY = 'resuscode.notice.arrestClockV3';

/** Shown once to existing users (a saved session exists); fresh installs never see it. */
function alreadySeen(): boolean {
  try {
    if (window.localStorage.getItem(NOTICE_KEY) === '1') return true;
    if (window.localStorage.getItem(STORAGE_KEY) == null) {
      window.localStorage.setItem(NOTICE_KEY, '1');
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function ClockChangeNotice() {
  const { t } = useT();
  const [show, setShow] = useState(() => !alreadySeen());
  if (!show) return null;
  const dismiss = () => {
    try {
      window.localStorage.setItem(NOTICE_KEY, '1');
    } catch {
      /* storage blocked — just hide */
    }
    setShow(false);
  };
  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-cyber/60 bg-cyber/10 p-3 text-xs font-semibold text-cyber">
      <span className="flex-1">
        {t('ui.clockNotice.text')}
      </span>
      <button type="button" onClick={dismiss} className="touch-hit rounded-lg border border-cyber/60 px-3 py-2 font-bold">
        {t('ui.clockNotice.dismiss')}
      </button>
    </div>
  );
}
