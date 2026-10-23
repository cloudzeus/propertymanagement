/**
 * Pure helpers for the two database URLs (no I/O, safe to unit-test).
 *
 *  - DATABASE_URL → the app's pooled connection (PgBouncer :6432, transaction mode)
 *  - DIRECT_URL   → straight to PostgreSQL (:5432) for `prisma migrate deploy`, seeds
 *                   and anything that needs session semantics (advisory locks, SET …)
 *
 * Spec: docs/superpowers/specs/2026-10-23-pgbouncer-design.md
 */

export const POOLER_PORT = 6432;
const PG_DEFAULT_PORT = 5432;

/** The env keys this module reads. Accepts `process.env` directly (index signature). */
export type DbEnv = {
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  DB_POOL_MAX?: string;
  DB_POOL_IDLE_MS?: string;
  DB_POOL_CONNECT_TIMEOUT_MS?: string;
  DB_APPLICATION_NAME?: string;
} & { [key: string]: string | undefined };

function parse(url: string): URL | null {
  if (!url) return null;
  try {
    // WHATWG URL handles postgres:// / postgresql:// as "special-less" schemes but
    // still exposes host/port/searchParams, which is all we need.
    const u = new URL(url);
    if (!u.hostname) return null;
    return u;
  } catch {
    return null;
  }
}

/** Port of a connection URL, 5432 when omitted, null when the string is not a URL. */
export function urlPort(url: string): number | null {
  const u = parse(url);
  if (!u) return null;
  if (!u.port) return PG_DEFAULT_PORT;
  const n = Number(u.port);
  return Number.isFinite(n) ? n : null;
}

/** True when the URL targets PgBouncer: port 6432, or an explicit `pgbouncer=true`. */
export function isPoolerUrl(url: string): boolean {
  const u = parse(url);
  if (!u) return false;
  if (u.searchParams.get("pgbouncer") === "true") return true;
  return urlPort(url) === POOLER_PORT;
}

export type ResolvedDbUrls = {
  /** What `lib/db.ts` connects to. */
  pooled: string;
  /** What migrations / seeds connect to (falls back to `pooled`). */
  direct: string;
  /** Whether the app traffic goes through PgBouncer. */
  viaPooler: boolean;
  /** Human-readable misconfiguration notes; log them, never throw at import time. */
  warnings: string[];
};

export function resolveDbUrls(env: DbEnv): ResolvedDbUrls {
  const warnings: string[] = [];
  const pooled = env.DATABASE_URL ?? "";
  if (!pooled) warnings.push("DATABASE_URL is not set — the database client will fail on first use");
  const viaPooler = isPoolerUrl(pooled);
  const direct = env.DIRECT_URL || pooled;
  if (viaPooler && !env.DIRECT_URL) {
    warnings.push("DIRECT_URL is not set while DATABASE_URL points at PgBouncer — `prisma migrate deploy` and seeds would run through the pooler (advisory locks break in transaction mode). Set DIRECT_URL to the :5432 URL.");
  }
  if (env.DIRECT_URL && isPoolerUrl(env.DIRECT_URL)) {
    warnings.push("DIRECT_URL points at the pooler (port 6432 / pgbouncer=true); it must be the direct PostgreSQL URL.");
  }
  return { pooled, direct, viaPooler, warnings };
}

export type PoolConfig = {
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  application_name: string;
};

function intInRange(raw: string | undefined, def: number, min: number, max: number): number {
  if (raw === undefined || raw === "") return def;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return def;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * node-postgres Pool options for the app. `max` is per Node process; with PgBouncer in
 * front, 10 is plenty for one Next.js instance and keeps the pooler's client count low.
 */
export function poolConfigFromEnv(env: DbEnv): PoolConfig {
  return {
    max: intInRange(env.DB_POOL_MAX, 10, 1, 100),
    idleTimeoutMillis: intInRange(env.DB_POOL_IDLE_MS, 30_000, 1_000, 3_600_000),
    connectionTimeoutMillis: intInRange(env.DB_POOL_CONNECT_TIMEOUT_MS, 10_000, 1_000, 120_000),
    application_name: env.DB_APPLICATION_NAME || "orithon-web",
  };
}

/** Connection URL with the password replaced by `***` — safe for logs and health output. */
export function redactUrl(url: string): string {
  return url.replace(/^([a-z][a-z0-9+.-]*:\/\/[^:/@\s]+):[^@/\s]*@/i, "$1:***@");
}
