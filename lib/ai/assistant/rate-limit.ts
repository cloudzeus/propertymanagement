/** Sliding-window per-key limiter (in-memory; single instance). Idle keys are swept once per window so the map never grows unbounded. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private lastSweep = 0;
  constructor(private limit: number, private windowMs: number) {}
  /** Number of keys currently tracked (for tests/metrics). */
  get size(): number { return this.hits.size; }
  allow(key: string, now = Date.now()): boolean {
    this.sweep(now);
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (arr.length >= this.limit) { this.hits.set(key, arr); return false; }
    arr.push(now);
    this.hits.set(key, arr);
    return true;
  }
  private sweep(now: number) {
    if (now - this.lastSweep < this.windowMs) return;
    this.lastSweep = now;
    for (const [k, arr] of this.hits) if (!arr.some((t) => now - t < this.windowMs)) this.hits.delete(k);
  }
}
