import { useState } from 'react';
import { browserKV } from '../engine/kv';
import { CORRUPT_STORAGE_KEY } from '../engine/persistence';
import { HISTORY_CORRUPT_KEY } from '../engine/history';
import { useT } from '../i18n/useT';
import { downloadText } from './log/download';

/**
 * Corrupt session/history payloads are parked instead of destroyed. Show them instead of
 * silently starting empty, so the user can download the raw copy before discarding it.
 */
export function RecoveryNotice() {
  const { t } = useT();
  const [keys] = useState(() => {
    const kv = browserKV();
    return {
      session: kv?.get(CORRUPT_STORAGE_KEY) ?? null,
      history: kv?.get(HISTORY_CORRUPT_KEY) ?? null,
    };
  });
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || (!keys.session && !keys.history)) return null;

  const download = () => {
    const parts = [
      keys.session ? `SESSION\n${keys.session}` : '',
      keys.history ? `HISTORY\n${keys.history}` : '',
    ].filter(Boolean);
    downloadText('resuscode-recovery.txt', parts.join('\n\n'), 'text/plain;charset=utf-8');
  };
  const discard = () => {
    const kv = browserKV();
    if (keys.session) kv?.remove(CORRUPT_STORAGE_KEY);
    if (keys.history) kv?.remove(HISTORY_CORRUPT_KEY);
    setDismissed(true);
  };

  return (
    <div role="alert" className="mb-3 rounded-xl border border-warn/60 bg-warn/10 p-3 text-xs text-warn">
      <p className="font-bold">{t('recovery.title')}</p>
      <p className="mt-1 leading-snug">{t('recovery.body')}</p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={download} className="touch-hit rounded-lg border border-warn/70 px-3 py-2 font-bold">
          {t('recovery.download')}
        </button>
        <button type="button" onClick={discard} className="touch-hit rounded-lg border border-warn/50 px-3 py-2 font-bold">
          {t('recovery.discard')}
        </button>
      </div>
    </div>
  );
}
