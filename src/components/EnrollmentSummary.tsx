import type { Enrollment } from '../engine/prefs';

/** `…` plus the last 8 characters of the script id — enough to recognise a destination, not the whole URL. */
export function destinationTail(url: string): string {
  const m = /\/s\/([^/]+)\/exec$/.exec(url);
  return m ? `…${m[1].slice(-8)}` : '…';
}

export function EnrollmentSummary({ enrollment, replacing }: { enrollment: Enrollment; replacing: boolean }) {
  return (
    <div className="text-xs leading-relaxed text-ink">
      <p>
        If you enroll, each finished code&apos;s statistics (times, shocks, drugs, outcome), its start date and time, your
        unit and a summary note with relative times — never patient identifiers — are sent to the Google Sheet of the admin
        who issued this code.
      </p>
      <p className="mt-1 text-mute">
        Destination <span className="font-mono">{destinationTail(enrollment.url)}</span>
        {enrollment.unit ? (
          <>
            {' '}
            · Unit <b className="text-ink">{enrollment.unit}</b>
          </>
        ) : null}
      </p>
      {replacing ? <p className="mt-1 font-bold text-warn">This replaces your current enrollment.</p> : null}
      <p className="mt-1 text-mute">Nothing is sent until you tap Enroll. You can stop at any time in Settings.</p>
    </div>
  );
}
