import { useEffect, useState } from 'react';
import { ClipboardCopy, Download, Eye, RotateCcw, Check } from 'lucide-react';
import { canResetSession, useCodeStore } from '../../engine/store';
import { buildSbar, sbarFilename } from '../../engine/sbar';
import { computeCodeStats } from '../../engine/stats';
import { BigButton } from '../ui/BigButton';
import { HoldButton } from '../ui/HoldButton';
import { Panel } from '../ui/Panel';
import { IdentityGate } from '../ui/IdentityGate';
import { usePrefsState } from '../../hooks/useService';
import { needsIdentity, type Identity } from '../../engine/prefs';
import { downloadText } from './download';
import { useT } from '../../i18n/useT';
import { browserKV } from '../../engine/kv';
import type { Lang } from '../../i18n/lang';

const SBAR_LANG_KEY = 'resuscode.sbarLang';

/** SBAR debrief export — copy to the EMR clipboard or download a .txt. */
export function SbarExport() {
  const { t, lang } = useT();
  const prefs = usePrefsState();
  const eventCount = useCodeStore((s) => s.events.length);
  const status = useCodeStore((s) => s.status);
  const reset = useCodeStore((s) => s.reset);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<'copy' | 'download' | null>(null);
  const [editingIdentity, setEditingIdentity] = useState(false);

  useEffect(() => {
    if (eventCount === 0) setPreview(null);
  }, [eventCount]);

  const [sbarLang, setSbarLang] = useState<Lang>(() => {
    const stored = browserKV()?.get(SBAR_LANG_KEY);
    if (stored === 'en' || stored === 'ar') return stored;
    return lang;
  });

  const changeSbarLang = (next: Lang) => {
    setSbarLang(next);
    browserKV()?.set(SBAR_LANG_KEY, next);
    if (preview) setPreview(build(next));
  };

  const build = (targetLang: Lang = sbarLang, identity: Identity | null = prefs.identity) => {
    const st = useCodeStore.getState();
    const now = Date.now();
    return buildSbar({ ...st, stats: computeCodeStats(st, now) }, now, { lang: targetLang, identity });
  };

  const copyNow = async (identity: Identity | null = prefs.identity) => {
    const text = build(sbarLang, identity);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        // A failed legacy copy must not report success; the catch below shows the manual-copy preview.
        if (!ok) throw new Error('copy command failed');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setPreview(text);
    }
  };

  const downloadNow = (identity: Identity | null = prefs.identity) => {
    downloadText(sbarFilename(Date.now()), build(sbarLang, identity), 'text/plain;charset=utf-8');
  };

  /** Copy and download leave the device, so they need a clinician identity. Preview does not. */
  const runExport = (which: 'copy' | 'download') => {
    if (needsIdentity(prefs.identity)) {
      setPending(which);
      return;
    }
    if (which === 'copy') void copyNow();
    else downloadNow();
  };

  return (
    <Panel title={t('sbar.exportTitle')} icon={ClipboardCopy} accent="cyber">
      {/* Export language selector */}
      <div className="mb-3 flex items-center justify-between rounded-xl border border-line bg-panel2/60 p-2 text-xs font-semibold">
        <span className="text-mute">{t('sbar.exportLang')}</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => changeSbarLang('en')}
            className={`touch-hit rounded-lg px-2.5 py-1 text-xs font-bold ${
              sbarLang === 'en' ? 'border border-cyber bg-cyber/20 text-cyber' : 'text-mute hover:text-ink'
            }`}
          >
            {t('lang.en')}
          </button>
          <button
            type="button"
            onClick={() => changeSbarLang('ar')}
            className={`touch-hit rounded-lg px-2.5 py-1 text-xs font-bold ${
              sbarLang === 'ar' ? 'border border-cyber bg-cyber/20 text-cyber' : 'text-mute hover:text-ink'
            }`}
          >
            {t('lang.ar')}
          </button>
        </div>
      </div>

      {prefs.identity ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-panel2/60 px-3 py-2 text-xs">
          <span className="min-w-0 flex-1 font-semibold text-ink">
            {t(prefs.identity.role ? 'sbar.identityRole' : 'sbar.identity', {
              name: prefs.identity.name,
              role: prefs.identity.role,
            })}
          </span>
          <button
            type="button"
            onClick={() => setEditingIdentity(true)}
            className="touch-hit shrink-0 rounded-lg border border-line px-3 py-2 font-bold text-cyber"
          >
            {t('identity.change')}
          </button>
        </div>
      ) : null}

      {editingIdentity ? (
        <div className="mb-3">
          <IdentityGate
            onCancel={() => setEditingIdentity(false)}
            onDone={() => setEditingIdentity(false)}
          />
        </div>
      ) : null}

      {pending ? (
        <div className="mb-3">
          <IdentityGate
            onCancel={() => setPending(null)}
            onDone={(identity) => {
              const which = pending;
              setPending(null);
              if (which === 'copy') void copyNow(identity);
              else downloadNow(identity);
            }}
          />
        </div>
      ) : null}

      <BigButton
        variant={copied ? 'good' : 'cyber'}
        size="xl"
        icon={copied ? Check : ClipboardCopy}
        label={copied ? t('sbar.copied') : t('sbar.copyBtn')}
        sub={t('sbar.copySub')}
        disabled={eventCount === 0}
        onClick={() => runExport('copy')}
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <BigButton
          variant="neutral"
          icon={Download}
          label={t('sbar.downloadBtn')}
          disabled={eventCount === 0}
          onClick={() => runExport('download')}
        />
        <BigButton
          variant="outline"
          icon={Eye}
          label={preview ? t('sbar.hidePreview') : t('sbar.previewBtn')}
          disabled={eventCount === 0}
          onClick={() => setPreview((p) => (p ? null : build()))}
        />
      </div>

      {preview ? (
        <pre
          dir={sbarLang === 'ar' ? 'rtl' : 'ltr'}
          className="selectable mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-black/40 p-3 font-mono text-[11px] leading-snug text-ink"
        >
          {preview}
        </pre>
      ) : null}

      {canResetSession(status) ? (
        <div className="mt-3 border-t border-line pt-3">
          <HoldButton
            variant="outline"
            size="lg"
            icon={RotateCcw}
            label={t('sbar.resetBtn')}
            durationMs={2500}
            onComplete={reset}
          />
          <p className="mt-1 text-[11px] text-mute">
            {t('sbar.resetSub')}
          </p>
        </div>
      ) : null}
    </Panel>
  );
}
