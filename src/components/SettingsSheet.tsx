import { useEffect, useState } from 'react';
import { Languages, Send, UserRound, X } from 'lucide-react';
import {
  KEEP_OPTIONS,
  MAX_NAME_LEN,
  MAX_ROLE_LEN,
  needsIdentity,
  parseEnrollmentCode,
  validateIdentity,
  type Enrollment,
  type RetentionMode,
} from '../engine/prefs';
import { backfillCount, enrollDevice, sendBackfill, sendTestRecord, setIdentity, setRetention, unenrollDevice } from '../engine/service';
import type { SendResult } from '../engine/upload';
import { rejectionMessage, testResultMessage, type Message } from '../engine/uploadLabels';
import { useOutboxState, usePrefsState, useServiceVersion } from '../hooks/useService';
import { LANGS, setLang } from '../i18n/lang';
import type { MessageKey } from '../i18n/en';
import { useT } from '../i18n/useT';
import { BigButton } from './ui/BigButton';
import { Chip } from './ui/Chip';
import { HoldButton } from './ui/HoldButton';
import { Panel } from './ui/Panel';
import { TextField } from './ui/TextField';
import { IdentityGate } from './ui/IdentityGate';
import { EnrollmentSummary, destinationTail } from './EnrollmentSummary';

const TONE: Record<Message['tone'], string> = { good: 'text-good', warn: 'text-warn', crit: 'text-crit' };

const RETENTION_MODES: Array<[RetentionMode, MessageKey]> = [
  ['all', 'settings.retention.all'],
  ['last', 'settings.retention.last'],
  ['after_upload', 'settings.retention.afterUpload'],
];

/** Full-screen sheet behind the header gear. The clock keeps running underneath. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useT();
  const prefs = usePrefsState();
  const outbox = useOutboxState();
  useServiceVersion(); // re-render after any write (backfillCount reads storage directly)
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<Enrollment | null>(null);
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [testing, setTesting] = useState(false);
  // The raw result is kept (not its text) so the message follows a language switch.
  const [testResult, setTestResult] = useState<SendResult | 'not_enrolled' | null>(null);
  const [backfillDismissed, setBackfillDismissed] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [identitySaved, setIdentitySaved] = useState(false);
  const [needIdentity, setNeedIdentity] = useState<{ run: () => void } | null>(null);
  const [retentionDraft, setRetentionDraft] = useState(prefs.retention);

  useEffect(() => {
    if (!open) return;
    setName(prefs.identity?.name ?? '');
    setRole(prefs.identity?.role ?? '');
    setIdentitySaved(false);
    setIdentityError(null);
    setRetentionDraft(prefs.retention);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!needIdentity) return;
    document.getElementById('identity-gate')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [needIdentity]);

  if (!open) return null;

  const enrolled = prefs.enrollment;
  const queuedCount = Object.keys(outbox.entries).length;
  const toBackfill = enrolled && !backfillDismissed ? backfillCount() : 0;
  const testMsg = testResult ? testResultMessage(testResult, lang) : null;

  const checkCode = () => {
    const e = parseEnrollmentCode(code);
    setCodeInvalid(!e);
    setPending(e);
  };
  const confirmEnroll = () => {
    if (!pending) return;
    enrollDevice(pending);
    setPending(null);
    setCode('');
    setTestResult(null);
    setBackfillDismissed(false);
  };
  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await sendTestRecord());
    } finally {
      setTesting(false);
    }
  };
  /** Every data-leaving action (enroll, test upload, backfill) requires a local identity first. */
  const requireIdentity = (run: () => void) => {
    if (!needsIdentity(prefs.identity)) run();
    else setNeedIdentity({ run });
  };
  const saveIdentity = () => {
    const identity = validateIdentity(name, role);
    if (!identity) {
      setIdentityError(t('identity.required'));
      return;
    }
    setIdentity(identity);
    setIdentitySaved(true);
    setIdentityError(null);
  };
  const clearIdentity = () => {
    setIdentity(null);
    setName('');
    setRole('');
    setIdentitySaved(false);
    setIdentityError(null);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={t('settings.title')} className="fixed inset-0 z-40 overflow-y-auto bg-bg">
      <div className="safe-top sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <h2 className="text-base font-bold text-ink">{t('settings.title')}</h2>
          <button
            type="button"
            aria-label={t('settings.close')}
            onClick={onClose}
            className="touch-hit ms-auto flex h-10 w-10 items-center justify-center rounded-full border border-line text-mute"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 pt-3 pb-appbar">
        <Panel title={t('lang.label')} icon={Languages}>
          <div className="grid grid-cols-2 gap-2">
            {LANGS.map((l) => (
              <Chip key={l} selected={lang === l} onClick={() => setLang(l)}>
                <span lang={l}>{t(l === 'en' ? 'lang.en' : 'lang.ar')}</span>
              </Chip>
            ))}
          </div>
          {lang === 'ar' ? <p className="mt-2 text-[11px] text-warn">{t('i18n.draftNotice')}</p> : null}
        </Panel>

        <Panel title={t('settings.identity.title')} icon={UserRound} accent={prefs.identity ? 'good' : 'none'}>
          <p className="text-xs leading-snug text-mute">{t('identity.note')}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <TextField
              label={t('identity.name')}
              value={name}
              onChange={(v) => {
                setName(v);
                setIdentitySaved(false);
                setIdentityError(null);
              }}
              placeholder={t('identity.namePlaceholder')}
              maxLength={MAX_NAME_LEN}
              error={identityError}
            />
            <TextField
              label={t('identity.role')}
              value={role}
              onChange={(v) => {
                setRole(v);
                setIdentitySaved(false);
              }}
              placeholder={t('identity.rolePlaceholder')}
              maxLength={MAX_ROLE_LEN}
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <BigButton
              variant={identitySaved ? 'good' : 'neutral'}
              label={identitySaved ? t('identity.saved') : t('settings.identity.save')}
              onClick={saveIdentity}
            />
            <BigButton
              variant="outline"
              label={t('settings.identity.clear')}
              disabled={!prefs.identity}
              onClick={clearIdentity}
            />
          </div>
        </Panel>

        {needIdentity ? (
          <div id="identity-gate">
            <IdentityGate
              onCancel={() => setNeedIdentity(null)}
              onDone={(identity) => {
                setName(identity.name);
                setRole(identity.role);
                setIdentitySaved(true);
                const run = needIdentity.run;
                setNeedIdentity(null);
                run();
              }}
            />
          </div>
        ) : null}

        <Panel title={t('settings.upload.title')} accent={enrolled ? 'cyber' : 'none'}>
          {enrolled ? (
            <>
              <p className="text-sm text-ink">
                {t('settings.upload.enrolled')}
                {enrolled.unit ? ` · ${enrolled.unit}` : ''} ·{' '}
                <span dir="ltr" className="font-mono">
                  {destinationTail(enrolled.url)}
                </span>
              </p>
              <p className="mt-1 text-xs text-mute">
                {queuedCount ? t('settings.upload.waiting', { n: queuedCount }) : t('settings.upload.nothingWaiting')}
              </p>
              {outbox.lastRejection ? (
                <p role="alert" className="mt-1 text-xs font-bold text-crit">
                  {rejectionMessage(outbox.lastRejection.error, lang)}
                </p>
              ) : null}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <BigButton
                  variant="neutral"
                  icon={Send}
                  label={testing ? t('settings.upload.sending') : t('settings.upload.sendTest')}
                  disabled={testing}
                  onClick={() => requireIdentity(() => void runTest())}
                />
                <HoldButton
                  variant="outline"
                  label={t('settings.upload.stop')}
                  sub={t('settings.upload.stopSub')}
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
            <p className="text-xs text-mute">{t('settings.upload.off')}</p>
          )}
        </Panel>

        {toBackfill > 0 ? (
          <Panel title={t('settings.backfill.title')} accent="cyber">
            <p className="text-sm text-ink">{t('settings.backfill.ask', { n: toBackfill })}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <BigButton variant="cyber" label={t('settings.backfill.send')} onClick={() => requireIdentity(() => sendBackfill())} />
              <BigButton variant="outline" label={t('settings.backfill.notNow')} onClick={() => setBackfillDismissed(true)} />
            </div>
          </Panel>
        ) : null}

        <Panel title={t('settings.enroll.title')}>
          <TextField
            label={t('settings.enroll.field')}
            value={code}
            onChange={(v) => {
              setCode(v);
              setCodeInvalid(false);
              setPending(null);
            }}
            placeholder={t('settings.enroll.placeholder')}
            mono
            dir="ltr"
            error={codeInvalid ? t('settings.enroll.invalid') : null}
          />
          {pending ? (
            <div className="mt-2 rounded-xl border border-cyber/60 bg-cyber/10 p-3">
              <EnrollmentSummary enrollment={pending} replacing={enrolled != null} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <BigButton variant="cyber" label={t('enroll.enroll')} onClick={() => requireIdentity(confirmEnroll)} />
                <BigButton variant="outline" label={t('enroll.cancel')} onClick={() => setPending(null)} />
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <BigButton variant="neutral" label={t('settings.enroll.check')} disabled={!code.trim()} onClick={checkCode} />
            </div>
          )}
        </Panel>

        <Panel title={t('settings.history.title')}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {RETENTION_MODES.map(([mode, key]) => (
              <Chip
                key={mode}
                selected={retentionDraft.mode === mode}
                onClick={() => setRetentionDraft({ ...retentionDraft, mode })}
              >
                {t(key)}
              </Chip>
            ))}
          </div>
          {retentionDraft.mode === 'last' ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {KEEP_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  selected={retentionDraft.keep === n}
                  onClick={() => setRetentionDraft({ ...retentionDraft, keep: n })}
                >
                  {n}
                </Chip>
              ))}
            </div>
          ) : null}
          <div className="mt-2">
            <HoldButton
              variant="outline"
              label={t('settings.retention.apply')}
              sub={t('settings.retention.applySub')}
              durationMs={2000}
              disabled={
                retentionDraft.mode === prefs.retention.mode &&
                (retentionDraft.mode !== 'last' || retentionDraft.keep === prefs.retention.keep)
              }
              onComplete={() => setRetention(retentionDraft)}
            />
          </div>
          <p className="mt-2 text-[11px] text-mute">{t('settings.retention.note')}</p>
        </Panel>

        <Panel title={t('settings.device.title')}>
          <p className="text-xs text-mute">
            {t('settings.device.id')}{' '}
            <span dir="ltr" className="selectable font-mono text-ink">
              {prefs.deviceId}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-mute">{t('settings.device.note')}</p>
        </Panel>
      </div>
    </div>
  );
}
