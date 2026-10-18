import { useState } from 'react';
import { MAX_NAME_LEN, MAX_ROLE_LEN, validateIdentity, type Identity } from '../../engine/prefs';
import { setIdentity } from '../../engine/service';
import { useT } from '../../i18n/useT';
import { BigButton } from './BigButton';
import { TextField } from './TextField';

/** Inline identification prompt shown only when an export or upload needs a name. */
export function IdentityGate({
  onDone,
  onCancel,
}: {
  onDone: (identity: Identity) => void;
  onCancel?: () => void;
}) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const identity = validateIdentity(name, role);
    if (!identity) {
      setError(t('identity.required'));
      return;
    }
    setIdentity(identity);
    onDone(identity);
  };

  return (
    <div role="group" aria-label={t('identity.title')} className="mt-2 rounded-xl border border-cyber/60 bg-cyber/5 p-3">
      <p className="text-sm font-bold text-cyber">{t('identity.title')}</p>
      <p className="mt-0.5 text-xs leading-snug text-mute">{t('identity.note')}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <TextField
          label={t('identity.name')}
          value={name}
          onChange={(v) => {
            setName(v);
            setError(null);
          }}
          placeholder={t('identity.namePlaceholder')}
          maxLength={MAX_NAME_LEN}
          error={error}
        />
        <TextField
          label={t('identity.role')}
          value={role}
          onChange={setRole}
          placeholder={t('identity.rolePlaceholder')}
          maxLength={MAX_ROLE_LEN}
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <BigButton variant="cyber" label={t('identity.continue')} onClick={save} />
        {onCancel ? <BigButton variant="outline" label={t('identity.cancel')} onClick={onCancel} /> : null}
      </div>
    </div>
  );
}
