export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  error?: string | null;
}

/** Single-line text input in the app's dark style (the app had no form fields before Settings). */
export function TextField({ label, value, onChange, placeholder, mono, error }: TextFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-mute">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className={`min-h-[56px] w-full rounded-xl border bg-panel2 px-3 text-base text-ink outline-none placeholder:text-mute focus:border-cyber ${
          error ? 'border-crit' : 'border-line'
        } ${mono ? 'font-mono text-sm' : ''}`}
      />
      {error ? <span className="mt-1 block text-xs font-semibold text-crit">{error}</span> : null}
    </label>
  );
}
