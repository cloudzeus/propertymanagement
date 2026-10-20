import "server-only";
import { s1, selector } from "./client";
import { PULL_ENTITIES } from "./sync/core";

/**
 * Read-only readiness checks against the SoftOne installation, one per
 * requirement of the integration spec (§3 rights, §7 integrator checklist).
 * Only getObjects / getObjectTables / getTableFields / getSelectorData are used.
 */
export type CheckStatus = "ok" | "fail" | "warn" | "skip";
export type CheckResult = { key: string; group: string; label: string; status: CheckStatus; detail: string; spec?: string };

type ObjInfo = { name: string; type?: string; caption?: string };

const REQUIRED_OBJECTS: { object: string; why: string; spec: string }[] = [
  { object: "CUSTOMER", why: "Πελάτες → TRDR (SODTYPE 13)", spec: "§4.1" },
  { object: "SUPPLIER", why: "Συνεργάτες/Προμηθευτές → TRDR (SODTYPE 12)", spec: "§4.2" },
  { object: "PRJC", why: "Κτήρια → Έργα", spec: "§4.3" },
  { object: "SERVICE", why: "Υπηρεσίες → MTRL (SODTYPE 52)", spec: "§4.4" },
  { object: "ITEM", why: "Είδη → MTRL (SODTYPE 51)", spec: "§4.4" },
  { object: "CNTR", why: "Ειδικές συμβάσεις (έργου / διαχείρισης)", spec: "§4.5-4.6" },
  { object: "CNTRTYPE", why: "Τύποι συμβάσεων", spec: "§7.7" },
  { object: "SALDOC", why: "Παραστατικά πώλησης (Φάση Β)", spec: "§4.7" },
  { object: "PURDOC", why: "Παραστατικά αγοράς (Φάση Β)", spec: "§4.8" },
];

const REQUIRED_TABLES: { object: string; table: string; fields: string[]; why: string; spec: string }[] = [
  { object: "CNTR", table: "CNTR", fields: ["CODE", "NAME", "TRNDATE", "FROMDATE", "TODATE", "CNTRTYPE", "TSODTYPE", "TRDR", "CNTRS", "PRJC", "VARCHAR01"], why: "Κεφαλίδα σύμβασης: back-to-back (CNTRS), έργο (PRJC), Orithon id (VARCHAR01)", spec: "§4.5, §11.7" },
  { object: "CNTR", table: "CNTRLINES", fields: ["LINENUM", "MSODTYPE", "MTRL", "FROMDATE", "TODATE", "VISITUNIT", "VISITNUM", "PERIODINV", "QTY1", "PRICE"], why: "Γραμμές σύμβασης: υπηρεσία + διάρκεια + περιοδική τιμολόγηση", spec: "§4.5, §4.6" },
  { object: "CUSTOMER", table: "CUSTOMER", fields: ["CODE", "NAME", "AFM", "IRSDATA", "ADDRESS", "ZIP", "CITY", "PHONE01", "EMAIL", "COUNTRY", "SOCURRENCY", "PAYMENT", "CMPMODE", "ISACTIVE"], why: "Πεδία καρτέλας πελάτη", spec: "§4.1" },
  { object: "PRJC", table: "PRJC", fields: ["CODE", "NAME", "TRDR", "PRJTYPE", "ISACTIVE", "FROMDATE"], why: "Πεδία έργου", spec: "§4.3" },
  { object: "SERVICE", table: "MTRL", fields: ["CODE", "NAME", "VAT", "MTRUNIT1", "MTRTYPE", "PRICEW", "PRICER", "ISACTIVE"], why: "Πεδία υπηρεσίας", spec: "§4.4" },
  { object: "SALDOC", table: "SRVLINES", fields: ["MTRL", "VAT", "QTY1", "PRICE"], why: "Γραμμές υπηρεσιών τιμολογίου (Φάση Β)", spec: "§4.7" },
];

const LOOKUPS: { editor: string; label: string; min?: number; expect?: (rows: Record<string, unknown>[]) => string | null; spec: string }[] = [
  { editor: "VAT", label: "Συντελεστές ΦΠΑ", min: 1, spec: "§7.4", expect: (rows) => {
    const pct = new Set(rows.map((r) => Number(String(r.PERCNT ?? r.percnt ?? "").replace(",", "."))).filter((n) => Number.isFinite(n)));
    const want = [24, 13, 6, 0].filter((p) => !pct.has(p));
    return want.length && pct.size ? `Δεν βρέθηκαν συντελεστές: ${want.join(" %, ")} %` : null;
  } },
  { editor: "MTRUNIT", label: "Μονάδες μέτρησης", min: 1, spec: "§7.5" },
  { editor: "PAYMENT", label: "Τρόποι πληρωμής", min: 1, spec: "§7.6" },
  { editor: "CNTRTYPE", label: "Τύποι συμβάσεων (χρειάζονται 3)", min: 3, spec: "§7.7" },
  { editor: "SERIES", label: "Σειρές παραστατικών", min: 2, spec: "§7.9" },
  { editor: "COUNTRY", label: "Χώρες", min: 1, spec: "§7.3" },
  { editor: "SOCURRENCY", label: "Νομίσματα", min: 1, spec: "§7.3" },
  { editor: "$SrvTimeUnit", label: "Μονάδες χρόνου σύμβασης («μήνες»)", min: 1, spec: "§7.8" },
  { editor: "$CNTRTYPE1", label: "Χαρακτηρισμοί σύμβασης", min: 1, spec: "§7.8" },
  { editor: "$PRJTYPE", label: "Τύποι έργου", min: 1, spec: "§7.10" },
];

export async function runReadinessChecks(): Promise<{ ok: boolean; version?: string; results: CheckResult[] }> {
  const results: CheckResult[] = [];
  const push = (r: CheckResult) => results.push(r);

  // 1. Object catalog
  const objs = await s1<{ objs?: ObjInfo[]; objects?: ObjInfo[]; data?: ObjInfo[] }>("getObjects");
  if (!objs.success) {
    push({ key: "objects", group: "Αντικείμενα", label: "Κατάλογος αντικειμένων (getObjects)", status: "fail", detail: `${objs.error ?? "σφάλμα"}${objs.errorcode != null ? ` (κωδικός ${objs.errorcode})` : ""}` });
    return { ok: false, results };
  }
  const list = (objs.objs ?? objs.objects ?? objs.data ?? []) as ObjInfo[];
  const names = new Set(list.map((o) => String((o as { name?: string; object?: string }).name ?? (o as { object?: string }).object ?? "").toUpperCase()));
  push({ key: "objects", group: "Αντικείμενα", label: "Κατάλογος αντικειμένων (getObjects)", status: "ok", detail: `${list.length} αντικείμενα διαθέσιμα στον λογαριασμό` });
  for (const r of REQUIRED_OBJECTS) {
    const has = names.size === 0 || names.has(r.object);
    push({ key: `obj:${r.object}`, group: "Αντικείμενα", label: `${r.object} — ${r.why}`, status: has ? "ok" : "fail", detail: has ? "Διαθέσιμο" : "Δεν επιστρέφεται από το getObjects — λείπει το αντικείμενο ή τα δικαιώματα του λογαριασμού.", spec: r.spec });
  }

  // 2. Tables & fields of the objects we write to
  for (const t of REQUIRED_TABLES) {
    const tables = await s1<{ tables?: { name: string }[]; data?: { name: string }[] }>("getObjectTables", { object: t.object });
    if (!tables.success) { push({ key: `tbl:${t.object}.${t.table}`, group: "Πίνακες & πεδία", label: `${t.object} / ${t.table}`, status: "fail", detail: `getObjectTables: ${tables.error ?? "σφάλμα"}`, spec: t.spec }); continue; }
    const tnames = new Set((tables.tables ?? tables.data ?? []).map((x) => String((x as { name?: string; table?: string }).name ?? (x as { table?: string }).table ?? "").toUpperCase()));
    if (tnames.size && !tnames.has(t.table)) { push({ key: `tbl:${t.object}.${t.table}`, group: "Πίνακες & πεδία", label: `${t.object} / ${t.table} — ${t.why}`, status: "fail", detail: `Ο πίνακας δεν υπάρχει στο αντικείμενο (διαθέσιμοι: ${[...tnames].join(", ")})`, spec: t.spec }); continue; }
    const fields = await s1<{ fields?: { name: string }[]; data?: { name: string }[] }>("getTableFields", { object: t.object, table: t.table });
    if (!fields.success) { push({ key: `tbl:${t.object}.${t.table}`, group: "Πίνακες & πεδία", label: `${t.object} / ${t.table} — ${t.why}`, status: "warn", detail: `getTableFields: ${fields.error ?? "σφάλμα"}`, spec: t.spec }); continue; }
    const fnames = new Set((fields.fields ?? fields.data ?? []).map((f) => String((f as { name?: string }).name ?? "").toUpperCase()));
    const missing = t.fields.filter((f) => !fnames.has(f));
    push({ key: `tbl:${t.object}.${t.table}`, group: "Πίνακες & πεδία", label: `${t.object} / ${t.table} — ${t.why}`, status: missing.length ? (missing.includes("VARCHAR01") && missing.length === 1 ? "warn" : "fail") : "ok", detail: missing.length ? `Λείπουν πεδία: ${missing.join(", ")}` : `Όλα τα πεδία υπάρχουν (${t.fields.length})`, spec: t.spec });
  }

  // 3. Lookups the parameters page needs
  for (const l of LOOKUPS) {
    const r = await selector(l.editor);
    if (!r.success) { push({ key: `sel:${l.editor}`, group: "Λίστες παραμέτρων", label: `${l.label} (${l.editor})`, status: l.editor.startsWith("$") ? "warn" : "fail", detail: `getSelectorData: ${r.error ?? "σφάλμα"}`, spec: l.spec }); continue; }
    const rows = r.data ?? [];
    const extra = l.expect?.(rows) ?? null;
    const tooFew = rows.length < (l.min ?? 1);
    push({ key: `sel:${l.editor}`, group: "Λίστες παραμέτρων", label: `${l.label} (${l.editor})`, status: tooFew ? "fail" : extra ? "warn" : "ok", detail: tooFew ? `Βρέθηκαν ${rows.length} εγγραφές (απαιτούνται ≥ ${l.min})` : extra ?? `${rows.length} εγγραφές`, spec: l.spec });
  }

  // 4. Master-data browsers used by the pull engine
  for (const e of PULL_ENTITIES) {
    const info = await s1<{ reqID: string; totalcount: number; fields: { name: string }[] }>("getBrowserInfo", { object: e.object, list: "", filters: "" });
    if (!info.success) { push({ key: `pull:${e.key}`, group: "Master data (pull)", label: `${e.label} (${e.object})`, status: "fail", detail: `getBrowserInfo: ${info.error ?? "σφάλμα"}` }); continue; }
    const fnames = (info.fields ?? []).map((f) => f.name);
    const missing = e.wantFields.filter((f) => !fnames.some((n) => n === f || n.endsWith(`.${f}`) || n.toLowerCase() === f.toLowerCase()));
    push({ key: `pull:${e.key}`, group: "Master data (pull)", label: `${e.label} (${e.object})`, status: missing.length ? "warn" : "ok", detail: `${info.totalcount} γραμμές · στήλες: ${fnames.join(", ") || "—"}${missing.length ? ` · λείπουν: ${missing.join(", ")}` : ""}` });
  }

  return { ok: results.every((r) => r.status !== "fail"), results };
}
