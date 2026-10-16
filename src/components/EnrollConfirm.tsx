import { useState } from 'react';
import type { EnrollFragment } from '../engine/enrollLink';
import { enrollDevice, getPrefs } from '../engine/service';
import { useT } from '../i18n/useT';
import { BigButton } from './ui/BigButton';
import { EnrollmentSummary } from './EnrollmentSummary';

/** Shown once when the app was opened from an enrollment link. Nothing is stored until Enroll is tapped. */
export function EnrollConfirm({ fragment, onEnrolled }: { fragment: EnrollFragment; onEnrolled: () => void }) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  if (done || fragment.kind === 'none') return null;

  if (fragment.kind === 'invalid') {
    return (
      <div role="alert" className="mb-3 flex items-center gap-2 rounded-xl border border-crit/60 bg-crit/10 p-3 text-xs font-semibold text-crit">
        <span className="flex-1">{t('enroll.linkInvalid')}</span>
        <button type="button" onClick={() => setDone(true)} className="touch-hit rounded-lg border border-crit/60 px-3 py-2 font-bold">
          {t('enroll.dismiss')}
        </button>
      </div>
    );
  }

  const e = fragment.enrollment;
  return (
    <div className="mb-3 rounded-xl border border-cyber/60 bg-cyber/10 p-3">
      <p className="mb-1 text-sm font-bold text-cyber">{t('enroll.confirmTitle')}</p>
      <EnrollmentSummary enrollment={e} replacing={getPrefs().enrollment != null} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <BigButton
          variant="cyber"
          label={t('enroll.enroll')}
          onClick={() => {
            enrollDevice(e);
            setDone(true);
            onEnrolled();
          }}
        />
        <BigButton variant="outline" label={t('enroll.cancel')} onClick={() => setDone(true)} />
      </div>
    </div>
  );
}
