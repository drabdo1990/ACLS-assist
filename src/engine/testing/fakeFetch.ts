export interface FetchCall {
  url: string;
  init?: RequestInit;
}

/** Sequential scripted `fetch`: each call consumes the next step (the last step repeats). An Error step throws. */
export function fakeFetch(...steps: Array<Response | Error>): { fetch: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  let i = 0;
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const step = steps[Math.min(i, steps.length - 1)];
    i += 1;
    if (step instanceof Error) throw step;
    return step.clone();
  }) as typeof fetch;
  return { fetch: fn, calls };
}

export const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });
export const html = (body = '<html><title>خطأ</title></html>', status = 200): Response => new Response(body, { status });
