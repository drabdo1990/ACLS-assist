import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { MAX_UNIT_LEN, makeEnrollmentLink } from '../engine/prefs';
import type { MessageKey } from '../i18n/en';
import { useT } from '../i18n/useT';
import { BigButton } from './ui/BigButton';
import { Panel } from './ui/Panel';
import { TextField } from './ui/TextField';

type Field = 'url' | 'key' | 'unit';
const ERROR_TEXT: Record<Field, MessageKey> = {
  url: 'settings.admin.errorUrl',
  key: 'settings.admin.errorKey',
  unit: 'settings.admin.errorUnit',
};

/**
 * Admin tool: turns the Apps Script URL + unit key into the enrollment link (admin/SETUP.md step 8).
 * Nothing is stored or sent; the fields live in this component, which Settings unmounts when it closes.
 */
export function EnrollmentLinkMaker() {
  const { t } = useT();
  const [form, setForm] = useState({ url: '', key: '', unit: '' });
  const [bad, setBad] = useState<Field | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');

  const edit = (field: Field) => (v: string) => {
    setForm({ ...form, [field]: v });
    setBad(null);
    setLink(null);
    setCopy('idle');
  };
  const make = () => {
    const r = makeEnrollmentLink(window.location.origin + window.location.pathname, form);
    setBad(r.ok ? null : r.field);
    setLink(r.ok ? r.link : null);
    setCopy('idle');
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link ?? '');
      setCopy('copied');
    } catch {
      setCopy('failed'); // the link stays on screen, selectable, for a manual copy
    }
  };
  const err = (field: Field) => (bad === field ? t(ERROR_TEXT[field]) : null);

  return (
    <Panel title={t('settings.admin.title')} icon={Link2}>
      <p className="mb-2 text-xs leading-snug text-mute">{t('settings.admin.note')}</p>
      <div className="flex flex-col gap-2">
        <TextField
          label={t('settings.admin.url')}
          value={form.url}
          onChange={edit('url')}
          placeholder={t('settings.admin.urlPlaceholder')}
          mono
          dir="ltr"
          error={err('url')}
        />
        <TextField label={t('settings.admin.key')} value={form.key} onChange={edit('key')} mono dir="ltr" error={err('key')} />
        <TextField
          label={t('settings.admin.unit')}
          value={form.unit}
          onChange={edit('unit')}
          maxLength={MAX_UNIT_LEN}
          error={err('unit')}
        />
        <BigButton variant="neutral" label={t('settings.admin.make')} disabled={!form.url.trim() || !form.key.trim()} onClick={make} />
      </div>
      {link ? (
        <div className="mt-3 rounded-xl border border-cyber/60 bg-cyber/10 p-3">
          <p className="text-xs font-bold text-mute">{t('settings.admin.linkLabel')}</p>
          <p dir="ltr" className="selectable mt-1 break-all font-mono text-xs text-ink">
            {link}
          </p>
          <p className="mt-2 text-[11px] font-semibold text-warn">{t('settings.admin.warn')}</p>
          <div className="mt-2">
            <BigButton
              variant={copy === 'copied' ? 'good' : 'cyber'}
              label={copy === 'copied' ? t('settings.admin.copied') : t('settings.admin.copy')}
              onClick={() => void copyLink()}
            />
          </div>
          {copy === 'failed' ? (
            <p role="alert" className="mt-1 text-xs font-bold text-crit">
              {t('settings.admin.copyFailed')}
            </p>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
