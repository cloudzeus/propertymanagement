export type TryResult<T> = { ok: true; value: T } | { ok: false; error: Error };

export function buildModelChain(primary: string, fallbacks: string[]): string[] {
  const seen = new Set<string>([primary]);
  const chain = [primary];
  for (const m of fallbacks) {
    if (!seen.has(m)) { seen.add(m); chain.push(m); }
  }
  return chain;
}

export async function tryModels<T>(chain: string[], fn: (model: string) => Promise<TryResult<T>>): Promise<T> {
  let lastErr: Error = new Error("tryModels: empty chain");
  for (const model of chain) {
    const r = await fn(model);
    if (r.ok) return r.value;
    lastErr = r.error;
  }
  throw lastErr;
}
