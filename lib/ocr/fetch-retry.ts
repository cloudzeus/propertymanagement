type RetryOpts = { retries?: number; baseMs?: number; label?: string };

export async function fetchWithRetry(url: string, init: RequestInit, opts: RetryOpts = {}): Promise<Response> {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 400;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status !== 429 && res.status !== 503) return res;
      if (attempt === retries) return res;
    } catch (err) {
      lastErr = err;
      if (attempt === retries) throw err;
    }
    await new Promise((r) => setTimeout(r, baseMs * Math.pow(2, attempt)));
  }
  throw lastErr ?? new Error("fetchWithRetry: exhausted");
}
