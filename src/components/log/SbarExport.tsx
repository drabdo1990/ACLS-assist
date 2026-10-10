import { useState } from 'react';
import { ClipboardCopy, Download, Eye, RotateCcw, Check } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { buildSbar, sbarFilename } from '../../engine/sbar';
import { BigButton } from '../ui/BigButton';
import { HoldButton } from '../ui/HoldButton';
import { Panel } from '../ui/Panel';

/** SBAR debrief export — copy to the EMR clipboard or download a .txt. */
export function SbarExport() {
  const eventCount = useCodeStore((s) => s.events.length);
  const reset = useCodeStore((s) => s.reset);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const build = () => buildSbar(useCodeStore.getState(), Date.now());

  const copy = async () => {
    const text = build();
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
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setPreview(text);
    }
  };

  const download = () => {
    const text = build();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sbarFilename(Date.now());
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Panel title="SBAR export" icon={ClipboardCopy} accent="cyber">
      <BigButton
        variant={copied ? 'good' : 'cyber'}
        size="xl"
        icon={copied ? Check : ClipboardCopy}
        label={copied ? 'Copied to clipboard' : 'Copy SBAR summary'}
        sub="Plain-text debrief for the EMR/EHR"
        disabled={eventCount === 0}
        onClick={copy}
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <BigButton
          variant="neutral"
          icon={Download}
          label="Download .txt"
          disabled={eventCount === 0}
          onClick={download}
        />
        <BigButton
          variant="outline"
          icon={Eye}
          label={preview ? 'Hide preview' : 'Preview'}
          disabled={eventCount === 0}
          onClick={() => setPreview((p) => (p ? null : build()))}
        />
      </div>

      {preview ? (
        <pre className="selectable mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-black/40 p-3 font-mono text-[11px] leading-snug text-ink">
          {preview}
        </pre>
      ) : null}

      <div className="mt-3 border-t border-line pt-3">
        <HoldButton
          variant="outline"
          size="lg"
          icon={RotateCcw}
          label="Reset session"
          durationMs={2500}
          onComplete={reset}
        />
        <p className="mt-1 text-[11px] text-mute">
          Hold 2.5 s to clear this code from the device. No data was ever sent anywhere.
        </p>
      </div>
    </Panel>
  );
}
