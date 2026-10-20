import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/prisma/client";
import { browseAll, col, ping } from "../client";
import { getSoftoneConfig } from "../config";
import { PULL_ENTITIES, PULL_ORDER, diffRows, diffCounts, pullEntity as pullDef, type Diff, type ExistingRow, type NormalizedRow, type PullEntityKey, type PullEntityDef } from "./core";

/**
 * Master-data pull (SoftOne → Orithon). One run per entity:
 *   getBrowserInfo/getBrowserData (official, paginated) → normalize → diff with
 *   the local mirror → upsert by s1Key / deactivate missing → one SoftoneSyncLog row.
 * Dry run = same reads + diff, no writes at all (no log row either).
 */
export type PullOptions = { dryRun: boolean; trigger: "manual" | "scheduler"; byUserId?: string | null; sample?: number };

export type PullResult = {
  entity: PullEntityKey;
  label: string;
  object: string;
  ok: boolean;
  dryRun: boolean;
  counts: ReturnType<typeof diffCounts>;
  /** Preview (first `sample` of each bucket) so the UI can show what would change. */
  preview: { inserted: Diff["inserted"]; updated: Diff["updated"]; deactivated: Diff["deactivated"] };
  fields: string[];
  missingFields: string[];
  error?: string;
  durationMs: number;
  logId?: string;
};

type Delegate = {
  findMany: (args: { select: { s1Key: true; code: true; name: true; isActive: true } & Record<string, true> }) => Promise<Record<string, unknown>[]>;
  upsert: (args: { where: { s1Key: number }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
  updateMany: (args: { where: { s1Key: { in: number[] } }; data: Record<string, unknown> }) => Promise<unknown>;
  count: (args?: { where?: Record<string, unknown> }) => Promise<number>;
};

/** Which typed columns each entity stores beside the common ones (must match schema.prisma). */
const EXTRA_COLUMNS: Record<PullEntityKey, string[]> = {
  vat: ["percent", "myDataCode"],
  unit: ["shortcut", "qDecimals", "myDataCode"],
  irsdata: ["city"],
  series: ["sosource", "sosourceLabel", "fprms", "tfprms", "tfprmsName", "branch"],
  district: ["country"],
  zip: ["district", "country"],
};

export function delegateFor(key: PullEntityKey): Delegate {
  const map = { vat: db.softoneVat, unit: db.softoneUnit, irsdata: db.softoneIrsData, series: db.softoneSeries, district: db.softoneDistrict, zip: db.softoneZip } as const;
  return map[key] as unknown as Delegate;
}

async function loadExisting(key: PullEntityKey): Promise<ExistingRow[]> {
  const select = { s1Key: true as const, code: true as const, name: true as const, isActive: true as const, ...Object.fromEntries(EXTRA_COLUMNS[key].map((c) => [c, true as const])) };
  const rows = await delegateFor(key).findMany({ select });
  return rows.map((r) => ({
    s1Key: r.s1Key as number, code: (r.code as string | null) ?? null, name: r.name as string, isActive: r.isActive as boolean,
    extra: Object.fromEntries(EXTRA_COLUMNS[key].map((c) => [c, r[c] instanceof Object && "toNumber" in (r[c] as object) ? Number(r[c]) : r[c]])),
  }));
}

function toData(key: PullEntityKey, r: NormalizedRow, now: Date): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const c of EXTRA_COLUMNS[key]) extra[c] = r.extra[c] ?? null;
  if (key === "vat" && extra.percent == null) extra.percent = 0;
  return { code: r.code, name: r.name, isActive: r.isActive, ...extra, raw: r.raw as Prisma.InputJsonValue, source: "softone", lastSyncedAt: now };
}

/** Pull one entity. Never throws: errors are reported in the result (and logged unless dry run). */
export async function pullEntity(key: PullEntityKey, opts: PullOptions): Promise<PullResult> {
  const def = pullDef(key) as PullEntityDef;
  const started = Date.now();
  const sample = opts.sample ?? 25;
  const base = { entity: key, label: def.label, object: def.object, dryRun: opts.dryRun, fields: [] as string[], missingFields: [] as string[] };
  const fail = async (error: string): Promise<PullResult> => {
    const durationMs = Date.now() - started;
    const counts = { fetched: 0, inserted: 0, updated: 0, unchanged: 0, deactivated: 0, skipped: 0 };
    let logId: string | undefined;
    if (!opts.dryRun) {
      const log = await db.softoneSyncLog.create({ data: { entity: key, entityId: "*", object: def.object, action: "pull", direction: "PULL", status: "ERROR", counts, error, byUserId: opts.byUserId ?? null, trigger: opts.trigger, durationMs } }).catch(() => null);
      logId = log?.id;
    }
    return { ...base, ok: false, counts, preview: { inserted: [], updated: [], deactivated: [] }, error, durationMs, logId };
  };

  const cfg = await getSoftoneConfig();
  if (!cfg) return fail("Το SoftOne δεν είναι ρυθμισμένο ή η σύνδεση είναι ανενεργή.");

  const res = await browseAll(def.object, "", { pageSize: 500, max: def.maxRows });
  if (!res.success) return fail(`${def.object}: ${res.error ?? "σφάλμα ανάγνωσης"}${res.errorcode != null ? ` (κωδικός ${res.errorcode})` : ""}`);
  if (res.total > def.maxRows) return fail(`${def.object}: το SoftOne επέστρεψε ${res.total} γραμμές (> όριο ${def.maxRows}) — ελέγξτε τη λίστα/φίλτρο.`);

  const fields = res.fields;
  const missingFields = def.wantFields.filter((f) => !fields.some((n) => n === f || n.endsWith(`.${f}`) || n.toLowerCase() === f.toLowerCase()));
  const normalized = res.rows.map((r) => def.normalize(r, col));
  const existing = await loadExisting(key);
  const diff = diffRows(normalized, existing);
  const counts = diffCounts(diff);
  const preview = { inserted: diff.inserted.slice(0, sample), updated: diff.updated.slice(0, sample), deactivated: diff.deactivated.slice(0, sample) };

  if (opts.dryRun) {
    return { ...base, fields, missingFields, ok: true, counts, preview, durationMs: Date.now() - started };
  }

  const now = new Date();
  const d = delegateFor(key);
  const changedKeys = new Set([...diff.inserted, ...diff.updated].map((x) => x.s1Key));
  let error: string | undefined;
  try {
    for (const r of normalized) {
      if (!r || !changedKeys.has(r.s1Key)) continue;
      const data = toData(key, r, now);
      await d.upsert({ where: { s1Key: r.s1Key }, create: { s1Key: r.s1Key, ...data }, update: data });
    }
    // Rows that disappeared from SoftOne are deactivated, never deleted.
    const gone = diff.deactivated.map((x) => x.s1Key);
    if (gone.length) await d.updateMany({ where: { s1Key: { in: gone } }, data: { isActive: false, lastSyncedAt: now } });
    // Touch lastSyncedAt on unchanged rows too (cheap, keeps «τελευταίος συγχρονισμός» honest).
    const unchanged = normalized.filter((r): r is NormalizedRow => !!r && !changedKeys.has(r.s1Key)).map((r) => r.s1Key);
    for (let i = 0; i < unchanged.length; i += 1000) await d.updateMany({ where: { s1Key: { in: unchanged.slice(i, i + 1000) } }, data: { lastSyncedAt: now } });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const durationMs = Date.now() - started;
  const log = await db.softoneSyncLog.create({
    data: {
      entity: key, entityId: "*", object: def.object, action: "pull", direction: "PULL", status: error ? "ERROR" : "OK",
      counts, error: error ?? null, byUserId: opts.byUserId ?? null, trigger: opts.trigger, durationMs,
      response: { fields, missingFields, preview } as Prisma.InputJsonValue,
    },
  }).catch(() => null);
  if (!error) await db.softoneSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", lastMasterSyncAt: now }, update: { lastMasterSyncAt: now } }).catch(() => {});
  return { ...base, fields, missingFields, ok: !error, counts, preview, error, durationMs, logId: log?.id };
}

export type PullAllResult = { skipped?: string; results: PullResult[] };

/**
 * Daily job body: every entity in order. Skips (without touching SoftOne) when
 * the integration is disabled; logs a SKIPPED row when enabled but the
 * connection test fails.
 */
export async function pullAllMasterData(opts: Omit<PullOptions, "dryRun"> & { dryRun?: boolean; only?: PullEntityKey[] }): Promise<PullAllResult> {
  const s = await db.softoneSettings.findUnique({ where: { id: "singleton" }, select: { enabled: true, syncEnabled: true } });
  const cfg = await getSoftoneConfig();
  if (!cfg) return { skipped: "Η διασύνδεση SoftOne δεν είναι ρυθμισμένη.", results: [] };
  if (opts.trigger === "scheduler" && !s?.syncEnabled) return { skipped: "Ο αυτόματος συγχρονισμός είναι απενεργοποιημένος (Ρυθμίσεις → SoftOne → Σύνδεση).", results: [] };
  const p = await ping();
  if (!p.ok) {
    if (!opts.dryRun) await db.softoneSyncLog.create({ data: { entity: "*", entityId: "*", object: "*", action: "pull", direction: "PULL", status: "SKIPPED", error: p.message, trigger: opts.trigger, byUserId: opts.byUserId ?? null } }).catch(() => null);
    return { skipped: `Η δοκιμή σύνδεσης απέτυχε: ${p.message}`, results: [] };
  }
  const keys = opts.only ?? PULL_ORDER;
  const results: PullResult[] = [];
  for (const k of keys) results.push(await pullEntity(k, { dryRun: !!opts.dryRun, trigger: opts.trigger, byUserId: opts.byUserId }));
  return { results };
}

/** Row counts + last sync per entity for the Συγχρονισμός page. */
export async function masterDataStatus() {
  const logs = await db.softoneSyncLog.findMany({ where: { direction: "PULL", action: "pull" }, orderBy: { createdAt: "desc" }, take: 200, select: { entity: true, status: true, createdAt: true, counts: true, error: true } });
  return Promise.all(PULL_ENTITIES.map(async (e) => {
    const d = delegateFor(e.key);
    const [total, active] = await Promise.all([d.count(), d.count({ where: { isActive: true } })]);
    const last = logs.find((l) => l.entity === e.key);
    const lastOk = logs.find((l) => l.entity === e.key && l.status === "OK");
    return { key: e.key, label: e.label, object: e.object, description: e.description, total, active, lastRunAt: last?.createdAt ?? null, lastStatus: last?.status ?? null, lastError: last?.error ?? null, lastOkAt: lastOk?.createdAt ?? null, lastCounts: (lastOk?.counts ?? null) as Record<string, number> | null };
  }));
}
