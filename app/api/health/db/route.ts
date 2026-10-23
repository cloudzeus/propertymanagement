import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { getEffectiveSession } from "@/lib/auth-effective";
import { resolveDbUrls, poolConfigFromEnv, redactUrl } from "@/lib/db-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health/db — is the app talking to PostgreSQL, and through PgBouncer?
 * Access: the REAL SUPER_ADMIN session (impersonation does not count) or the header
 * `x-health-token` equal to HEALTH_TOKEN (for curl / uptime checks).
 * Spec: docs/superpowers/specs/2026-10-23-pgbouncer-design.md §6
 */
function tokenMatches(given: string | null): boolean {
  const expected = process.env.HEALTH_TOKEN;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function authorized(req: NextRequest): Promise<boolean> {
  if (tokenMatches(req.headers.get("x-health-token"))) return true;
  const eff = await getEffectiveSession().catch(() => null);
  return eff?.real.role === "SUPER_ADMIN";
}

type BackendRow = {
  pid: number;
  port: number | null;
  app: string;
  user: string;
  db: string;
  version: string;
};

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { pooled, viaPooler } = resolveDbUrls(process.env);
  const pool = poolConfigFromEnv(process.env);
  const t0 = performance.now();
  try {
    const [row] = await db.$queryRaw<BackendRow[]>`
      SELECT pg_backend_pid()::int AS "pid",
             inet_server_port()::int AS "port",
             current_setting('application_name') AS "app",
             current_user::text AS "user",
             current_database()::text AS "db",
             version() AS "version"`;
    const [{ n: serverConnections }] = await db.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS "n" FROM pg_stat_activity
      WHERE datname = current_database() AND application_name = current_setting('application_name')`;
    const latencyMs = Math.round(performance.now() - t0);
    return Response.json({
      ok: true,
      viaPooler,
      url: redactUrl(pooled),
      poolMax: pool.max,
      backend: {
        pid: row.pid,
        serverPort: row.port,
        applicationName: row.app,
        user: row.user,
        database: row.db,
        version: row.version.split(" on ")[0],
      },
      serverConnections,
      latencyMs,
    });
  } catch (e) {
    console.error("[health/db]", e instanceof Error ? e.message : e);
    return Response.json(
      { ok: false, viaPooler, url: redactUrl(pooled), error: "database unreachable", latencyMs: Math.round(performance.now() - t0) },
      { status: 503 },
    );
  }
}
