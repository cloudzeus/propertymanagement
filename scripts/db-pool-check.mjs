#!/usr/bin/env node
/**
 * Read-only check of the two database URLs and of the PgBouncer admin console.
 *
 *   node --env-file=.env scripts/db-pool-check.mjs
 *
 * 1. DATABASE_URL (pooled) → connect, SELECT backend pid / server port / application_name
 * 2. DIRECT_URL  (direct) → same
 * 3. Server facts for sizing: max_connections, password_encryption, pg_stat_activity summary
 * 4. If DATABASE_URL is a pooler URL → connect to the `pgbouncer` admin database with the
 *    same credentials and run SHOW POOLS / SHOW STATS (needs the user in STATS_USERS).
 *
 * Nothing here writes. Exit code 1 when any step fails.
 * Spec: docs/superpowers/specs/2026-10-23-pgbouncer-design.md §6, §8
 */
import pg from "pg";

const POOLER_PORT = 6432;
const redact = (u) => u.replace(/^([a-z][a-z0-9+.-]*:\/\/[^:/@\s]+):[^@/\s]*@/i, "$1:***@");
const isPooler = (u) => {
  try { const x = new URL(u); return x.searchParams.get("pgbouncer") === "true" || Number(x.port || 5432) === POOLER_PORT; } catch { return false; }
};

let failed = false;
const fail = (msg) => { failed = true; console.error(`  ✗ ${msg}`); };

async function probe(label, url) {
  console.log(`\n${label}: ${redact(url)}`);
  const c = new pg.Client({ connectionString: url, application_name: "db-pool-check", connectionTimeoutMillis: 10_000, statement_timeout: 10_000 });
  const t0 = performance.now();
  try {
    await c.connect();
    const { rows: [r] } = await c.query(
      `SELECT pg_backend_pid()::int AS pid, inet_server_port()::int AS port, current_setting('application_name') AS app,
              current_user AS usr, current_database() AS db, split_part(version(), ' on ', 1) AS version`,
    );
    const ms = Math.round(performance.now() - t0);
    console.log(`  ✓ connected in ${ms} ms — backend pid ${r.pid}, server port ${r.port}, application_name "${r.app}", user ${r.usr}, db ${r.db}`);
    console.log(`    ${r.version}`);
    // A second round trip: through a transaction-mode pooler the backend pid may differ.
    const { rows: [r2] } = await c.query("SELECT pg_backend_pid()::int AS pid");
    if (r2.pid !== r.pid) console.log(`  ↳ second query ran on a different backend (pid ${r2.pid}) — transaction pooling in effect`);
  } catch (e) {
    fail(`${label}: ${e.message}`);
  } finally {
    await c.end().catch(() => {});
  }
}

/** Server-side facts that matter for sizing (read-only; some rows need superuser and are skipped). */
async function serverFacts(url) {
  console.log(`\nPostgreSQL server facts (via ${redact(url)})`);
  const c = new pg.Client({ connectionString: url, application_name: "db-pool-check", connectionTimeoutMillis: 10_000, statement_timeout: 10_000 });
  try {
    await c.connect();
    const { rows: settings } = await c.query(
      `SELECT name, setting FROM pg_settings WHERE name IN ('max_connections','superuser_reserved_connections','password_encryption',
         'idle_in_transaction_session_timeout','statement_timeout','shared_buffers','work_mem') ORDER BY name`,
    );
    console.table(settings);
    const { rows: activity } = await c.query(
      `SELECT coalesce(state,'(none)') AS state, count(*)::int AS n FROM pg_stat_activity
       WHERE datname = current_database() GROUP BY 1 ORDER BY 2 DESC`,
    );
    console.log("  pg_stat_activity (this database)");
    console.table(activity);
    const { rows: apps } = await c.query(
      `SELECT coalesce(nullif(application_name,''),'(none)') AS application_name, count(*)::int AS n FROM pg_stat_activity
       WHERE datname = current_database() GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
    );
    console.table(apps);
    const { rows: ext } = await c.query("SELECT extname, extversion FROM pg_extension ORDER BY 1");
    console.log("  extensions: " + ext.map((e) => `${e.extname} ${e.extversion}`).join(", "));
    const pe = settings.find((r) => r.name === "password_encryption")?.setting;
    if (pe && pe !== "scram-sha-256") console.warn(`  ! password_encryption is "${pe}" — set AUTH_TYPE=${pe} in infra/pgbouncer/.env (compose default is scram-sha-256)`);
  } catch (e) {
    fail(`server facts: ${e.message}`);
  } finally {
    await c.end().catch(() => {});
  }
}

async function adminConsole(url) {
  const u = new URL(url);
  u.pathname = "/pgbouncer";
  u.search = "";
  console.log(`\nPgBouncer admin console: ${redact(u.toString())}`);
  const c = new pg.Client({ connectionString: u.toString(), connectionTimeoutMillis: 10_000 });
  try {
    await c.connect();
    const pools = await c.query("SHOW POOLS");
    const cols = ["database", "user", "cl_active", "cl_waiting", "sv_active", "sv_idle", "sv_used", "maxwait", "pool_mode"];
    console.log("  SHOW POOLS");
    console.table(pools.rows.map((r) => Object.fromEntries(cols.filter((k) => k in r).map((k) => [k, r[k]]))));
    const stats = await c.query("SHOW STATS");
    const scols = ["database", "total_xact_count", "total_query_count", "avg_xact_time", "avg_query_time", "avg_wait_time"];
    console.log("  SHOW STATS");
    console.table(stats.rows.map((r) => Object.fromEntries(scols.filter((k) => k in r).map((k) => [k, r[k]]))));
    const cfg = await c.query("SHOW CONFIG");
    const want = new Set(["pool_mode", "max_client_conn", "default_pool_size", "min_pool_size", "reserve_pool_size", "max_db_connections", "server_idle_timeout", "server_lifetime", "idle_transaction_timeout", "auth_type"]);
    console.log("  SHOW CONFIG (selected)");
    console.table(cfg.rows.filter((r) => want.has(r.key)).map((r) => ({ key: r.key, value: r.value })));
  } catch (e) {
    fail(`admin console: ${e.message} (is the user listed in STATS_USERS / ADMIN_USERS?)`);
  } finally {
    await c.end().catch(() => {});
  }
}

const pooled = process.env.DATABASE_URL;
const direct = process.env.DIRECT_URL;
if (!pooled) { console.error("DATABASE_URL is not set (run with --env-file=.env)"); process.exit(1); }

console.log(`DATABASE_URL ${isPooler(pooled) ? "→ PgBouncer" : "→ direct PostgreSQL (no pooler)"}`);
if (!direct) console.warn("DIRECT_URL is not set — migrations would use DATABASE_URL" + (isPooler(pooled) ? " (through the pooler: fix this)" : ""));
else if (isPooler(direct)) fail("DIRECT_URL points at the pooler; it must be the :5432 URL");

await probe("DATABASE_URL (app)", pooled);
if (direct && direct !== pooled) await probe("DIRECT_URL (migrations)", direct);
await serverFacts(direct || pooled);
if (isPooler(pooled)) await adminConsole(pooled);

console.log(failed ? "\nRESULT: FAILED" : "\nRESULT: OK");
process.exit(failed ? 1 : 0);
