import { PrismaClient } from "./prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDbUrls, poolConfigFromEnv, redactUrl } from "./db-url";

/**
 * The app's Prisma client. Connects to DATABASE_URL, which in production (and in local
 * development) is PgBouncer in transaction mode (:6432). Migrations and seeds use
 * DIRECT_URL via prisma.config.ts. Spec: docs/superpowers/specs/2026-10-23-pgbouncer-design.md
 *
 * One `pg.Pool` per Node process: the client is cached on globalThis in every
 * environment so separate route bundles never open a second pool.
 */
function createClient() {
  const { pooled, viaPooler, warnings } = resolveDbUrls(process.env);
  const pool = poolConfigFromEnv(process.env);
  for (const w of warnings) console.warn(`[db] ${w}`);
  if (process.env.NODE_ENV !== "test") {
    console.info(`[db] ${viaPooler ? "via PgBouncer" : "direct"} ${redactUrl(pooled)} (pool max ${pool.max})`);
  }
  const adapter = new PrismaPg(
    {
      connectionString: pooled || undefined,
      max: pool.max,
      idleTimeoutMillis: pool.idleTimeoutMillis,
      connectionTimeoutMillis: pool.connectionTimeoutMillis,
      application_name: pool.application_name,
    },
    { onPoolError: (err) => console.error("[db] pool error:", err.message) },
  );
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

declare global {
  var prisma: PrismaClient | undefined;
}

export const db = globalThis.prisma ?? createClient();
globalThis.prisma = db;
