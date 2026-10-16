/** Shared `{name}` interpolation for English (enText) and every language (translate). Pure, never throws. */
export type ParamValue = string | number;
export type Params = Record<string, ParamValue>;

/**
 * Replace `{name}` with params[name].
 * - A string starting with `@` is a message key, rendered via `resolveKey`.
 * - A number in a param named `*Ms` is a duration, rendered via `duration`.
 * - A missing param leaves `{name}` in place.
 */
export function interpolate(
  template: string,
  params: Params | undefined,
  resolveKey: (key: string) => string,
  duration: (ms: number) => string,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) return whole;
    const v = params[name];
    if (typeof v === 'number') return name.endsWith('Ms') ? duration(v) : String(v);
    if (typeof v === 'string') return v.startsWith('@') ? resolveKey(v.slice(1)) : v;
    return whole;
  });
}
