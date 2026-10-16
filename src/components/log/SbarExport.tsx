import { useState } from 'react';
import { ClipboardCopy, Download, Eye, RotateCcw, Check } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { buildSbar, sbarFilename } from '../../engine/sbar';
import { computeCodeStats } from '../../engine/stats';
import { BigButton } from '../ui/BigButton';
import { HoldButton } from '../ui/HoldButton';
import { Panel } from '../ui/Panel';

/** SBAR debrief export — copy to the EMR clipboard or download a .txt. */
export function SbarExport() {
  const eventCount = useCodeStore((s) => s.events.length);
  const reset = useCodeStore((s) => s.reset);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const build = () => {
    const st = useCodeStore.getState();
    const now = Date.now();
    return buildSbar({ ...st, stats: computeCodeStats(st, now) }, now);
  };

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
    // Revoke after the browser has had time to start the download (immediate revoke is flaky on some mobile browsers).
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Panel title="SBAR export" icon={ClipboardCopy} accent="cyber">
      <BigButton
        variant={copied ? 'good' : 'cyber'}
        size="xl"
        icon={copied ? Check : ClipboardCopy}
        label={copied ? 'Copied to clipboard' : 'Copy SBAR Resuscitation Summary'}
        sub="Plain-text note ready to paste into the EHR/EMR"
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
          Hold 2.5 s to clear the current code from the screen. Finished codes stay in History on this device.
        </p>
      </div>
    </Panel>
  );
}
