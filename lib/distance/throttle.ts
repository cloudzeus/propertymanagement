/* Minimal rate limiter: serialises calls and spaces them by minIntervalMs.
 * Pure (injectable clock/sleep) so the routing providers' 1 req/s policy is
 * testable without timers.
 */

export type Throttle = <T>(fn: () => Promise<T>) => Promise<T>;

export function createThrottle(minIntervalMs: number, deps: { now?: () => number; sleep?: (ms: number) => Promise<void> } = {}): Throttle {
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last = Number.NEGATIVE_INFINITY;
  let chain: Promise<unknown> = Promise.resolve();
  return <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(async () => {
      const wait = last + minIntervalMs - now();
      if (wait > 0) await sleep(wait);
      last = now();
      return fn();
    });
    chain = run.catch(() => {});
    return run;
  };
}

/** Shared limiter for every outbound routing-provider call (OSRM public policy: ≤ 1 req/s). */
export const providerThrottle: Throttle = createThrottle(1000);
