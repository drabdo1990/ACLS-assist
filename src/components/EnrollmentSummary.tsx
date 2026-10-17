import type { Enrollment } from '../engine/prefs';
import { useT } from '../i18n/useT';

/** `…` plus the last 8 characters of the script id — enough to recognise a destination, not the whole URL. */
export function destinationTail(url: string): string {
  const m = /\/s\/([^/]+)\/exec$/.exec(url);
  return m ? `…${m[1].slice(-8)}` : '…';
}

/** The whole script id: a forged link points at someone else's script, so the user must be able to compare all of it. */
function destinationId(url: string): string {
  const m = /\/s\/([^/]+)\/exec$/.exec(url);
  return m ? m[1] : '…';
}

export function EnrollmentSummary({ enrollment, replacing, verify = false }: { enrollment: Enrollment; replacing: boolean; verify?: boolean }) {
  const { t } = useT();
  return (
    <div className="text-xs leading-relaxed text-ink">
      <p>{t('enroll.notice')}</p>
      <p className="mt-1 text-mute">
        {t('enroll.destination')}{' '}
        <span dir="ltr" className="break-all font-mono">
          {verify ? destinationId(enrollment.url) : destinationTail(enrollment.url)}
        </span>
        {enrollment.unit ? (
          <>
            {' · '}
            {t('enroll.unit')} <b className="text-ink">{enrollment.unit}</b>
          </>
        ) : null}
      </p>
      {verify ? <p className="mt-1 font-bold text-warn">{t('enroll.checkId')}</p> : null}
      {replacing ? <p className="mt-1 font-bold text-warn">{t('enroll.replacing')}</p> : null}
      <p className="mt-1 text-mute">{t('enroll.nothingSent')}</p>
    </div>
  );
}
