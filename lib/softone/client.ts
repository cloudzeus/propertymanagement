import "server-only";
import iconv from "iconv-lite";
import { gunzipSync } from "node:zlib";
import { db } from "@/lib/db";
import { getSoftoneConfig, type SoftoneConfig } from "./config";

/**
 * SoftOne Web Services client (official services only — softone.gr/ws).
 * - Two-step auth: login → authenticate. The permanent clientID is cached in
 *   SoftoneSettings (one row) for the whole day and reused; re-auth only on
 *   errorcode -100/-101 (session expired).
 * - Responses are gzip + windows-1253: ALWAYS arrayBuffer → gunzip → iconv.
 * - Connection details come from lib/softone/config (DB-first, env fallback).
 */
export type S1Response<T = Record<string, unknown>> = ({ success: true } & T) | { success: false; errorcode?: number; error?: string };

export type S1Company = { COMPANY?: number | string; COMPANYNAME?: string; BRANCH?: number | string; BRANCHNAME?: string; MODULE?: number | string; MODULENAME?: string; REFID?: number | string; REFIDNAME?: string; USERID?: number | string; FINALDATE?: string; [k: string]: unknown };

/** Greek explanation for the error codes the official docs document. */
export function explainErrorCode(code: number | undefined, error?: string): string {
  switch (code) {
    case -101:
    case -100: return "Η συνεδρία (clientID) έληξε ή δεν είναι έγκυρη — απαιτείται νέο login → authenticate.";
    case 101: return "Ανεπαρκή δικαιώματα: ο λογαριασμός Web Services δεν έχει πρόσβαση σε αυτό το αντικείμενο/ενέργεια.";
    case 13:
    case 213: return "Το reqID της λίστας έληξε — πρέπει να ξαναεκτελεστεί το getBrowserInfo.";
    case 0: return `Επιχειρησιακό σφάλμα του SoftOne${error ? `: ${error}` : ""}.`;
    default: return error ?? "Άγνωστο σφάλμα.";
  }
}

export async function rawFetch<T>(url: string, payload: object, timeoutMs = 25_000): Promise<S1Response<T>> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Encoding": "gzip" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: ac.signal,
    });
    let buf = Buffer.from(await res.arrayBuffer());
    const enc = res.headers.get("content-encoding") ?? "";
    // fetch usually inflates gzip itself; guard for proxies that don't
    if (enc.includes("gzip") && buf.length > 1 && buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
    const text = iconv.decode(buf, "win1253");
    try {
      return JSON.parse(text) as S1Response<T>;
    } catch {
      return { success: false, error: `Μη έγκυρη απάντηση (HTTP ${res.status}): ${text.slice(0, 200)}` };
    }
  } catch (e) {
    const msg = e instanceof Error ? (e.name === "AbortError" ? `Λήξη χρόνου (${timeoutMs / 1000}s) — ο server δεν απάντησε` : e.message) : String(e);
    return { success: false, error: `Αποτυχία επικοινωνίας: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

async function loadSession(): Promise<string | null> {
  const s = await db.softoneSettings.findUnique({ where: { id: "singleton" }, select: { clientId: true, clientIdDate: true } });
  return s?.clientId && s.clientIdDate === today() ? s.clientId : null;
}
async function saveSession(clientId: string | null) {
  await db.softoneSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", clientId, clientIdDate: clientId ? today() : null },
    update: { clientId, clientIdDate: clientId ? today() : null },
  });
}

export type LoginResult = { clientId: string; companies: S1Company[]; version?: string; serial?: string };

/**
 * login → authenticate against an explicit config. Pure network: nothing is
 * persisted (used by the connection test and by `authenticate()` below).
 */
export async function loginAndAuthenticate(cfg: SoftoneConfig): Promise<LoginResult> {
  const login = await rawFetch<{ clientID: string; objs?: S1Company[]; ver?: string; sn?: string }>(cfg.url, {
    service: "login", username: cfg.username, password: cfg.password, appId: cfg.appId, VERSION: "2",
  });
  if (!login.success) {
    const err = new Error(`Login: ${explainErrorCode(login.errorcode, login.error)}`) as Error & { errorcode?: number; step?: string };
    err.errorcode = login.errorcode; err.step = "login";
    throw err;
  }
  const auth = await rawFetch<{ clientID: string }>(cfg.url, {
    service: "authenticate", clientID: login.clientID, company: cfg.company, branch: cfg.branch, module: cfg.module, refid: cfg.refid, VERSION: "2",
  });
  if (!auth.success) {
    const err = new Error(`Authenticate: ${explainErrorCode(auth.errorcode, auth.error)}`) as Error & { errorcode?: number; step?: string };
    err.errorcode = auth.errorcode; err.step = "authenticate";
    throw err;
  }
  return { clientId: auth.clientID, companies: login.objs ?? [], version: login.ver, serial: login.sn };
}

/** login → authenticate with the resolved config; caches the permanent clientID for the day. */
export async function authenticate(): Promise<LoginResult> {
  const cfg = await getSoftoneConfig();
  if (!cfg) throw new Error("Το SoftOne δεν είναι ρυθμισμένο (Ρυθμίσεις → SoftOne → Σύνδεση ή μεταβλητές SOFTONE_*)");
  const r = await loginAndAuthenticate(cfg);
  await saveSession(r.clientId);
  return r;
}

async function clientId(): Promise<string> {
  return (await loadSession()) ?? (await authenticate()).clientId;
}

/** Call any official service with the cached session; one transparent re-auth on session expiry. */
export async function s1<T = Record<string, unknown>>(service: string, params: Record<string, unknown> = {}): Promise<S1Response<T>> {
  const cfg = await getSoftoneConfig();
  if (!cfg) return { success: false, error: "Το SoftOne δεν είναι ρυθμισμένο" };
  const call = async (cid: string) => rawFetch<T>(cfg.url, { service, clientID: cid, appId: cfg.appId, VERSION: "2", ...params });
  let r = await call(await clientId());
  if (!r.success && (r.errorcode === -101 || r.errorcode === -100)) {
    await saveSession(null);
    r = await call((await authenticate()).clientId);
  }
  return r;
}

/* ── Convenience wrappers ──────────────────────────────────────────────── */

export async function getData<T = Record<string, unknown>>(object: string, key: number | string, form?: string) {
  return s1<{ data: T }>("getData", { object, key: String(key), ...(form ? { form } : {}) });
}

/** Insert (no key) or update (key) — data = { [TABLE]: [ {...} ] }. Returns the record id. */
export async function setData(object: string, data: Record<string, unknown[]>, key?: number | string) {
  return s1<{ id: string }>("setData", { OBJECT: object, ...(key != null ? { KEY: String(key) } : {}), data });
}

export type BrowseResult = { success: true; total: number; fields: string[]; rows: Record<string, unknown>[] } | { success: false; errorcode?: number; error?: string };

/** Browser query → rows as objects (bounded by `limit`). filters use SoftOne syntax: "TRDR.AFM=123*". */
export async function browse(object: string, filters = "", opts: { list?: string; limit?: number; start?: number } = {}): Promise<BrowseResult> {
  const info = await s1<{ reqID: string; totalcount: number; fields: { name: string }[] }>("getBrowserInfo", { object, list: opts.list ?? "", filters });
  if (!info.success) return info;
  const rows = await s1<{ rows: unknown[][]; fields?: { name: string }[] }>("getBrowserData", { reqID: info.reqID, start: opts.start ?? 0, limit: opts.limit ?? 200 });
  if (!rows.success) return rows;
  const names = (rows.fields ?? info.fields ?? []).map((f) => f.name);
  return { success: true, total: info.totalcount, fields: names, rows: (rows.rows ?? []).map((r) => Object.fromEntries(r.map((v, i) => [names[i] ?? String(i), v]))) };
}

/** Browser query → ALL rows, paginated (pageSize per getBrowserData call, hard cap `max`). */
export async function browseAll(object: string, filters = "", opts: { list?: string; pageSize?: number; max?: number } = {}): Promise<BrowseResult> {
  const pageSize = opts.pageSize ?? 500;
  const max = opts.max ?? 20_000;
  const info = await s1<{ reqID: string; totalcount: number; fields: { name: string }[] }>("getBrowserInfo", { object, list: opts.list ?? "", filters });
  if (!info.success) return info;
  const total = Number(info.totalcount ?? 0);
  let names: string[] = (info.fields ?? []).map((f) => f.name);
  const out: Record<string, unknown>[] = [];
  for (let start = 0; start < Math.min(total, max); start += pageSize) {
    const page = await s1<{ rows: unknown[][]; fields?: { name: string }[] }>("getBrowserData", { reqID: info.reqID, start, limit: pageSize });
    if (!page.success) return page;
    if (page.fields?.length) names = page.fields.map((f) => f.name);
    for (const r of page.rows ?? []) out.push(Object.fromEntries(r.map((v, i) => [names[i] ?? String(i), v])));
    if ((page.rows?.length ?? 0) < pageSize) break;
  }
  return { success: true, total, fields: names, rows: out };
}

/** Lookup rows of an EditList/selector (e.g. VAT, MTRUNIT, COUNTRY, SOCURRENCY, CNTRTYPE, SERIES). */
export async function selector(editor: string, value = "") {
  return s1<{ data: Record<string, unknown>[] }>("getSelectorData", { editor, value });
}

export type ConnectionTest = {
  ok: boolean;
  message: string;
  step?: "login" | "authenticate" | "ping";
  errorcode?: number;
  version?: string;
  serial?: string;
  companies: S1Company[];
  selected?: S1Company | null;
};

/**
 * «Δοκιμή σύνδεσης»: login → authenticate → ping with an explicit config.
 * Persists only the last-test outcome (never the clientID of an unsaved config).
 */
export async function testConnection(cfg: SoftoneConfig): Promise<ConnectionTest> {
  let result: ConnectionTest;
  try {
    const r = await loginAndAuthenticate(cfg);
    const p = await rawFetch<{ ver?: string; sn?: string }>(cfg.url, { service: "ping", clientID: r.clientId, appId: cfg.appId, VERSION: "2" });
    const version = (p.success && p.ver) || r.version;
    const selected = r.companies.find((c) => String(c.COMPANY) === cfg.company && (c.BRANCH == null || String(c.BRANCH) === cfg.branch)) ?? r.companies.find((c) => String(c.COMPANY) === cfg.company) ?? null;
    result = {
      ok: true,
      message: `Σύνδεση ΟΚ${version ? ` · SoftOne ${version}` : ""}${selected?.COMPANYNAME ? ` · ${selected.COMPANYNAME}` : ""}`,
      version, serial: r.serial, companies: r.companies, selected,
      ...(p.success ? {} : { step: "ping" as const }),
    };
  } catch (e) {
    const err = e as Error & { errorcode?: number; step?: "login" | "authenticate" };
    result = { ok: false, message: err.message ?? String(e), step: err.step, errorcode: err.errorcode, companies: [] };
  }
  await db.softoneSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", lastPingAt: new Date(), lastPingOk: result.ok, lastPingMessage: result.message },
    update: { lastPingAt: new Date(), lastPingOk: result.ok, lastPingMessage: result.message },
  }).catch(() => {});
  return result;
}

/** Heartbeat with the resolved config (used by the cron job guard). */
export async function ping(): Promise<ConnectionTest> {
  const cfg = await getSoftoneConfig();
  if (!cfg) return { ok: false, message: "Το SoftOne δεν είναι ρυθμισμένο", companies: [] };
  return testConnection(cfg);
}

/** Read a column from a browser row whether SoftOne named it "FIELD" or "TABLE.FIELD". */
export function col(row: Record<string, unknown>, field: string): unknown {
  if (field in row) return row[field];
  const suffix = `.${field}`;
  for (const k of Object.keys(row)) if (k.endsWith(suffix)) return row[k];
  const lower = field.toLowerCase();
  for (const k of Object.keys(row)) { const kk = k.toLowerCase(); if (kk === lower || kk.endsWith(`.${lower}`)) return row[k]; }
  return undefined;
}
