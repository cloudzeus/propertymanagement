import "server-only";
import iconv from "iconv-lite";
import { gunzipSync } from "node:zlib";
import { db } from "@/lib/db";

/**
 * SoftOne Web Services client (official services only — softone.gr/ws).
 * - Two-step auth: login → authenticate. The permanent clientID is cached in
 *   SoftoneSettings (one row) for the whole day and reused; re-auth only on
 *   errorcode -100/-101 (session expired).
 * - Responses are gzip + windows-1253: ALWAYS arrayBuffer → gunzip → iconv.
 * - Secrets live in env (SOFTONE_*); installation ids live in SoftoneSettings.
 */
export type S1Response<T = Record<string, unknown>> = ({ success: true } & T) | { success: false; errorcode?: number; error?: string };

export function softoneEnv() {
  const serial = process.env.SOFTONE_SERIAL ?? process.env.S1_SERIAL ?? "";
  const url = process.env.SOFTONE_URL ?? (serial ? `https://${serial}.oncloud.gr/s1services` : "");
  return {
    url,
    appId: process.env.SOFTONE_APPID ?? process.env.S1_APP_ID ?? "",
    username: process.env.SOFTONE_USERNAME ?? process.env.S1_USERNAME ?? "",
    password: process.env.SOFTONE_PASSWORD ?? process.env.S1_PASSWORD ?? "",
    company: process.env.SOFTONE_COMPANY ?? process.env.S1_COMPANY ?? "",
    branch: process.env.SOFTONE_BRANCH ?? process.env.S1_BRANCH ?? "1000",
    module: process.env.SOFTONE_MODULE ?? process.env.S1_MODULE ?? "0",
    refid: process.env.SOFTONE_REFID ?? process.env.S1_REFID ?? "",
  };
}

export function isSoftoneConfigured(): boolean {
  const e = softoneEnv();
  return !!(e.url && e.appId && e.username && e.password && e.company && e.refid);
}

async function rawFetch<T>(payload: object): Promise<S1Response<T>> {
  const { url } = softoneEnv();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept-Encoding": "gzip" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  let buf = Buffer.from(await res.arrayBuffer());
  const enc = res.headers.get("content-encoding") ?? "";
  // fetch usually inflates gzip itself; guard for proxies that don't
  if (enc.includes("gzip") && buf.length > 1 && buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  const text = iconv.decode(buf, "win1253");
  try {
    return JSON.parse(text) as S1Response<T>;
  } catch {
    return { success: false, error: `Μη έγκυρη απάντηση (${res.status}): ${text.slice(0, 200)}` };
  }
}

const today = () => new Date().toISOString().slice(0, 10);

async function loadSession(): Promise<string | null> {
  const s = await db.softoneSettings.findUnique({ where: { id: "singleton" }, select: { clientId: true, clientIdDate: true } });
  return s?.clientId && s.clientIdDate === today() ? s.clientId : null;
}
async function saveSession(clientId: string | null) {
  await db.softoneSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", clientId, clientIdDate: clientId ? today() : null }, update: { clientId, clientIdDate: clientId ? today() : null } });
}

/** login → authenticate; returns the permanent clientID. */
export async function authenticate(): Promise<{ clientId: string; companies?: unknown[] }> {
  const e = softoneEnv();
  if (!isSoftoneConfigured()) throw new Error("Το SoftOne δεν είναι ρυθμισμένο (SOFTONE_* env)");
  const login = await rawFetch<{ clientID: string; objs?: unknown[] }>({ service: "login", username: e.username, password: e.password, appId: e.appId, VERSION: "2" });
  if (!login.success) throw new Error(`SoftOne login: ${(login as { error?: string }).error ?? "άγνωστο σφάλμα"}`);
  const auth = await rawFetch<{ clientID: string }>({ service: "authenticate", clientID: login.clientID, company: e.company, branch: e.branch, module: e.module, refid: e.refid, VERSION: "2" });
  if (!auth.success) throw new Error(`SoftOne authenticate: ${(auth as { error?: string }).error ?? "άγνωστο σφάλμα"}`);
  await saveSession(auth.clientID);
  return { clientId: auth.clientID, companies: login.objs };
}

async function clientId(): Promise<string> {
  return (await loadSession()) ?? (await authenticate()).clientId;
}

/** Call any official service with the cached session; one transparent re-auth on session expiry. */
export async function s1<T = Record<string, unknown>>(service: string, params: Record<string, unknown> = {}): Promise<S1Response<T>> {
  const e = softoneEnv();
  const call = async (cid: string) => rawFetch<T>({ service, clientID: cid, appId: e.appId, VERSION: "2", ...params });
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

/** Browser query → all rows (bounded). filters use SoftOne syntax: "TRDR.AFM=123*". */
export async function browse(object: string, filters = "", opts: { list?: string; limit?: number } = {}) {
  const info = await s1<{ reqID: string; totalcount: number; fields: { name: string }[] }>("getBrowserInfo", { object, list: opts.list ?? "", filters });
  if (!info.success) return info;
  const rows = await s1<{ rows: unknown[][]; fields?: { name: string }[] }>("getBrowserData", { reqID: info.reqID, start: 0, limit: opts.limit ?? 200 });
  if (!rows.success) return rows;
  const names = (rows.fields ?? info.fields).map((f) => f.name);
  return { success: true as const, total: info.totalcount, rows: rows.rows.map((r) => Object.fromEntries(r.map((v, i) => [names[i], v]))) };
}

/** Lookup rows of an EditList/selector (e.g. VAT, MTRUNIT, COUNTRY, SOCURRENCY, CNTRTYPE, SERIES). */
export async function selector(editor: string, value = "") {
  return s1<{ data: Record<string, unknown>[] }>("getSelectorData", { editor, value });
}

/** Heartbeat + version (no session needed beyond login). */
export async function ping(): Promise<{ ok: boolean; message: string; version?: string; companies?: unknown[] }> {
  try {
    const { companies } = await authenticate();
    const p = await s1<{ ver?: string; sn?: string }>("ping");
    const message = p.success ? `Σύνδεση ΟΚ${p.ver ? ` · έκδοση ${p.ver}` : ""}` : `Login ΟΚ, ping: ${(p as { error?: string }).error ?? "-"}`;
    await db.softoneSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", lastPingAt: new Date(), lastPingOk: true, lastPingMessage: message }, update: { lastPingAt: new Date(), lastPingOk: true, lastPingMessage: message } });
    return { ok: true, message, version: p.success ? p.ver : undefined, companies };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.softoneSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", lastPingAt: new Date(), lastPingOk: false, lastPingMessage: message }, update: { lastPingAt: new Date(), lastPingOk: false, lastPingMessage: message } }).catch(() => {});
    return { ok: false, message };
  }
}
