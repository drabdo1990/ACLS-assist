import { useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';
import { KEEP_OPTIONS, parseEnrollmentCode, type Enrollment, type RetentionMode } from '../engine/prefs';
import { backfillCount, enrollDevice, sendBackfill, sendTestRecord, setRetention, unenrollDevice } from '../engine/service';
import { rejectionMessage, testResultMessage, type Message } from '../engine/uploadLabels';
import { useOutboxState, usePrefsState, useServiceVersion } from '../hooks/useService';
import { BigButton } from './ui/BigButton';
import { Chip } from './ui/Chip';
import { HoldButton } from './ui/HoldButton';
import { Panel } from './ui/Panel';
import { TextField } from './ui/TextField';
import { EnrollmentSummary, destinationTail } from './EnrollmentSummary';

const TONE: Record<Message['tone'], string> = { good: 'text-good', warn: 'text-warn', crit: 'text-crit' };

const RETENTION_MODES: Array<[RetentionMode, string]> = [
  ['all', 'Keep all'],
  ['last', 'Keep last…'],
  ['after_upload', 'Delete after upload'],
];

/** Full-screen sheet behind the header gear. The clock keeps running underneath. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const prefs = usePrefsState();
  const outbox = useOutboxState();
  useServiceVersion(); // re-render after any write (backfillCount reads storage directly)
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<Enrollment | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<Message | null>(null);
  const [backfillDismissed, setBackfillDismissed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const enrolled = prefs.enrollment;
  const queuedCount = Object.keys(outbox.entries).length;
  const toBackfill = enrolled && !backfillDismissed ? backfillCount() : 0;

  const checkCode = () => {
    const e = parseEnrollmentCode(code);
    if (!e) {
      setPending(null);
      setCodeError("That code isn't valid.");
      return;
    }
    setCodeError(null);
    setPending(e);
  };
  const confirmEnroll = () => {
    if (!pending) return;
    enrollDevice(pending);
    setPending(null);
    setCode('');
    setTestMsg(null);
    setBackfillDismissed(false);
  };
  const runTest = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      setTestMsg(testResultMessage(await sendTestRecord()));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Settings" className="fixed inset-0 z-40 overflow-y-auto bg-bg">
      <div className="safe-top sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <h2 className="text-base font-bold text-ink">Settings</h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="touch-hit ms-auto flex h-10 w-10 items-center justify-center rounded-full border border-line text-mute"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 pt-3 pb-appbar">
        <Panel title="Code upload" accent={enrolled ? 'cyber' : 'none'}>
          {enrolled ? (
            <>
              <p className="text-sm text-ink">
                Enrolled{enrolled.unit ? ` · ${enrolled.unit}` : ''} · <span className="font-mono">{destinationTail(enrolled.url)}</span>
              </p>
              <p className="mt-1 text-xs text-mute">
                {queuedCount ? `${queuedCount} code${queuedCount === 1 ? '' : 's'} waiting to send.` : 'Nothing waiting to send.'}
              </p>
              {outbox.lastRejection ? (
                <p role="alert" className="mt-1 text-xs font-bold text-crit">
                  {rejectionMessage(outbox.lastRejection.error)}
                </p>
              ) : null}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <BigButton variant="neutral" icon={Send} label={testing ? 'Sending…' : 'Send test record'} disabled={testing} onClick={runTest} />
                <HoldButton
                  variant="outline"
                  label="Stop uploading"
                  sub="Hold 2 s — this device only"
                  durationMs={2000}
                  onComplete={unenrollDevice}
                />
              </div>
              {testMsg ? (
                <p role="status" className={`mt-2 text-xs font-bold ${TONE[testMsg.tone]}`}>
                  {testMsg.text}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-mute">
              Upload is off. Codes stay on this device. Your unit&apos;s admin can give you an enrollment link or code.
            </p>
          )}
        </Panel>

        {toBackfill > 0 ? (
          <Panel title="Earlier codes" accent="cyber">
            <p className="text-sm text-ink">
              Send {toBackfill} earlier code{toBackfill === 1 ? '' : 's'} (statistics only)?
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <BigButton variant="cyber" label="Send" onClick={() => sendBackfill()} />
              <BigButton variant="outline" label="Not now" onClick={() => setBackfillDismissed(true)} />
            </div>
          </Panel>
        ) : null}

        <Panel title="Enroll with a code">
          <TextField
            label="Paste the enrollment code or link"
            value={code}
            onChange={(v) => {
              setCode(v);
              setCodeError(null);
              setPending(null);
            }}
            placeholder="https://…#enroll=…  or the code after #enroll="
            mono
            error={codeError}
          />
          {pending ? (
            <div className="mt-2 rounded-xl border border-cyber/60 bg-cyber/10 p-3">
              <EnrollmentSummary enrollment={pending} replacing={enrolled != null} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <BigButton variant="cyber" label="Enroll" onClick={confirmEnroll} />
                <BigButton variant="outline" label="Cancel" onClick={() => setPending(null)} />
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <BigButton variant="neutral" label="Check code" disabled={!code.trim()} onClick={checkCode} />
            </div>
          )}
        </Panel>

        <Panel title="History on this device">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {RETENTION_MODES.map(([mode, label]) => (
              <Chip key={mode} selected={prefs.retention.mode === mode} onClick={() => setRetention({ ...prefs.retention, mode })}>
                {label}
              </Chip>
            ))}
          </div>
          {prefs.retention.mode === 'last' ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {KEEP_OPTIONS.map((n) => (
                <Chip key={n} selected={prefs.retention.keep === n} onClick={() => setRetention({ ...prefs.retention, keep: n })}>
                  {n}
                </Chip>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-mute">
            Up to 500 codes are kept. &quot;Delete after upload&quot; removes a code from this device only once the sheet has confirmed it.
          </p>
        </Panel>

        <Panel title="This device">
          <p className="text-xs text-mute">
            Device id <span className="selectable font-mono text-ink">{prefs.deviceId}</span>
          </p>
          <p className="mt-1 text-[11px] text-mute">
            Random, created on this device. When enrolled, finished codes send their statistics, start date and time, your unit and
            a summary note with relative times. No patient identifiers are ever recorded.
          </p>
        </Panel>
      </div>
    </div>
  );
}
