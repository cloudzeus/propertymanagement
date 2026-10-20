/**
 * Pure (DB-free, network-free) pieces of the SoftOne master-data pull, so they
 * can be unit-tested: entity definitions, row normalization and the diff.
 */

export type PullEntityKey = "vat" | "unit" | "irsdata" | "series" | "district" | "zip";

/** Normalized row shape shared by all master-data tables. */
export type NormalizedRow = {
  s1Key: number;
  code: string | null;
  name: string;
  isActive: boolean;
  /** Entity-specific typed columns (percent, shortcut, sosource, …). */
  extra: Record<string, unknown>;
  raw: Record<string, unknown>;
};

export type PullEntityDef = {
  key: PullEntityKey;
  label: string;
  /** SoftOne object for getBrowserInfo. */
  object: string;
  /** Main DB table (for column prefixes). */
  table: string;
  /** SoftOne primary-key field. */
  keyField: string;
  description: string;
  /** Order of execution in the daily job (dependencies first). */
  order: number;
  /** Rows above this count are refused (sanity guard against a wrong browser). */
  maxRows: number;
  /** Which SoftOne fields we expect to find in the browser row (for the readiness check). */
  wantFields: string[];
  normalize: (row: Record<string, unknown>, col: (row: Record<string, unknown>, f: string) => unknown) => NormalizedRow | null;
};

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (v == null ? null : String(v).trim() || null);
const bool = (v: unknown): boolean => {
  if (v == null || v === "") return true;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  return !(s === "0" || s === "false" || s === "όχι" || s === "no" || s === "n");
};

/** SOSOURCE codes (document flows) as SoftOne uses them. */
export const SOSOURCE_LABELS: Record<number, string> = {
  1151: "Πελάτες (κινήσεις)", 1251: "Αγορές", 1351: "Πωλήσεις", 1451: "Προμηθευτές (κινήσεις)",
  1551: "Αποθήκη", 1651: "Παραγωγή", 1751: "Πάγια", 1851: "Εισπράξεις/Πληρωμές", 2151: "Χρεώστες/Πιστωτές",
  1051: "Ειδικές συναλλαγές", 1452: "Συμβάσεις", 1352: "Παραγγελίες πώλησης", 1252: "Παραγγελίες αγοράς",
};

export const PULL_ENTITIES: PullEntityDef[] = [
  {
    key: "vat", label: "Συντελεστές ΦΠΑ", object: "VAT", table: "VAT", keyField: "VAT", order: 1, maxRows: 500,
    description: "Οι συντελεστές ΦΠΑ της εγκατάστασης (24 %, 13 %, 6 %, 0 % …). Χρησιμοποιούνται για την αντιστοίχιση vatPct → VAT id στις υπηρεσίες/είδη.",
    wantFields: ["VAT", "NAME", "PERCNT", "ISACTIVE"],
    normalize: (row, col) => {
      const key = num(col(row, "VAT")); if (key == null) return null;
      const name = str(col(row, "NAME")) ?? `ΦΠΑ ${key}`;
      return { s1Key: key, code: str(col(row, "CODE")), name, isActive: bool(col(row, "ISACTIVE")),
        extra: { percent: num(col(row, "PERCNT")) ?? 0, myDataCode: num(col(row, "MYDATACODE")) }, raw: row };
    },
  },
  {
    key: "unit", label: "Μονάδες μέτρησης", object: "MTRUNIT", table: "MTRUNIT", keyField: "MTRUNIT", order: 2, maxRows: 1000,
    description: "Μονάδες μέτρησης (τεμ., ώρα, επίσκεψη, μήνας …). Χρησιμοποιούνται για το MTRUNIT1 των υπηρεσιών/ειδών.",
    wantFields: ["MTRUNIT", "SHORTCUT", "NAME", "ISACTIVE"],
    normalize: (row, col) => {
      const key = num(col(row, "MTRUNIT")); if (key == null) return null;
      const shortcut = str(col(row, "SHORTCUT"));
      return { s1Key: key, code: shortcut, name: str(col(row, "NAME")) ?? shortcut ?? `Μονάδα ${key}`, isActive: bool(col(row, "ISACTIVE")),
        extra: { shortcut, qDecimals: num(col(row, "QDECIMALS")), myDataCode: num(col(row, "MYDATACODE")) }, raw: row };
    },
  },
  {
    key: "irsdata", label: "Δ.Ο.Υ.", object: "IRSDATA", table: "IRSDATA", keyField: "IRSDATA", order: 3, maxRows: 2000,
    description: "Οι Δημόσιες Οικονομικές Υπηρεσίες. Η ΔΟΥ του πελάτη/συνεργάτη (κείμενο) αντιστοιχίζεται στο IRSDATA id.",
    wantFields: ["IRSDATA", "CODE", "NAME", "ISACTIVE"],
    normalize: (row, col) => {
      const key = num(col(row, "IRSDATA")); if (key == null) return null;
      return { s1Key: key, code: str(col(row, "CODE")), name: str(col(row, "NAME")) ?? `ΔΟΥ ${key}`, isActive: bool(col(row, "ISACTIVE")),
        extra: { city: str(col(row, "CITY")) }, raw: row };
    },
  },
  {
    key: "series", label: "Σειρές & τύποι παραστατικών", object: "SERIES", table: "SERIES", keyField: "SERIES", order: 4, maxRows: 5000,
    description: "Σειρές παραστατικών με τη ροή τους (πωλήσεις, αγορές, συμβάσεις …) και τον τύπο παραστατικού (TFPRMS). Από εδώ επιλέγονται οι σειρές τιμολογίων πώλησης/αγοράς.",
    wantFields: ["SERIES", "CODE", "NAME", "SOSOURCE", "ISACTIVE"],
    normalize: (row, col) => {
      const key = num(col(row, "SERIES")); if (key == null) return null;
      const sosource = num(col(row, "SOSOURCE"));
      const tfprmsRaw = col(row, "TFPRMS");
      return { s1Key: key, code: str(col(row, "CODE")), name: str(col(row, "NAME")) ?? `Σειρά ${key}`, isActive: bool(col(row, "ISACTIVE")),
        extra: {
          sosource, sosourceLabel: sosource != null ? (SOSOURCE_LABELS[sosource] ?? str(col(row, "SOSOURCENAME")) ?? null) : null,
          fprms: num(col(row, "FPRMS")), tfprms: num(tfprmsRaw), tfprmsName: str(col(row, "TFPRMSNAME")) ?? (num(tfprmsRaw) == null ? str(tfprmsRaw) : null),
          branch: num(col(row, "BRANCH")),
        }, raw: row };
    },
  },
  {
    key: "district", label: "Νομοί", object: "$DISTRICT", table: "DISTRICT", keyField: "DISTRICT", order: 5, maxRows: 1000,
    description: "Νομοί ανά χώρα (λίστα αναφοράς του SoftOne).",
    wantFields: ["DISTRICT", "CODE", "NAME"],
    normalize: (row, col) => {
      const key = num(col(row, "DISTRICT")); if (key == null) return null;
      return { s1Key: key, code: str(col(row, "CODE")), name: str(col(row, "NAME")) ?? `Νομός ${key}`, isActive: bool(col(row, "ISACTIVE")),
        extra: { country: num(col(row, "COUNTRY")) }, raw: row };
    },
  },
  {
    key: "zip", label: "Ταχ. κώδικες / περιοχές", object: "ZIP", table: "ZIP", keyField: "ZIP", order: 6, maxRows: 50_000,
    description: "Ταχυδρομικοί κώδικες με περιοχή/πόλη και νομό — το πλησιέστερο που διαθέτει το SoftOne σε μητρώο πόλεων (το TRDR.CITY είναι ελεύθερο κείμενο).",
    wantFields: ["ZIP", "CODE", "DISTRICTS", "DISTRICT"],
    normalize: (row, col) => {
      const key = num(col(row, "ZIP")); if (key == null) return null;
      const code = str(col(row, "CODE"));
      return { s1Key: key, code, name: str(col(row, "DISTRICTS")) ?? str(col(row, "NAME")) ?? code ?? `ΤΚ ${key}`, isActive: bool(col(row, "ISACTIVE")),
        extra: { district: num(col(row, "DISTRICT")), country: num(col(row, "COUNTRY")) }, raw: row };
    },
  },
];

export const PULL_ORDER: PullEntityKey[] = [...PULL_ENTITIES].sort((a, b) => a.order - b.order).map((e) => e.key);

export function pullEntity(key: string): PullEntityDef | undefined {
  return PULL_ENTITIES.find((e) => e.key === key);
}

/** What the local table currently holds for one S1 key (only the compared columns). */
export type ExistingRow = { s1Key: number; code: string | null; name: string; isActive: boolean; extra: Record<string, unknown> };

export type DiffItem = { s1Key: number; code: string | null; name: string; changes?: Record<string, { from: unknown; to: unknown }> };
export type Diff = {
  fetched: number;
  inserted: DiffItem[];
  updated: DiffItem[];
  unchanged: number;
  /** Local rows whose S1 key no longer comes back → deactivated (never deleted). */
  deactivated: DiffItem[];
  /** Rows the normalizer refused (no key). */
  skipped: number;
};

const same = (a: unknown, b: unknown): boolean => {
  if (a == null && b == null) return true;
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return String(a ?? "") === String(b ?? "");
};

/** Compare normalized SoftOne rows with what we already hold. Pure. */
export function diffRows(incoming: (NormalizedRow | null)[], existing: ExistingRow[]): Diff {
  const byKey = new Map(existing.map((e) => [e.s1Key, e]));
  const seen = new Set<number>();
  const diff: Diff = { fetched: incoming.length, inserted: [], updated: [], unchanged: 0, deactivated: [], skipped: 0 };
  for (const r of incoming) {
    if (!r) { diff.skipped++; continue; }
    seen.add(r.s1Key);
    const cur = byKey.get(r.s1Key);
    if (!cur) { diff.inserted.push({ s1Key: r.s1Key, code: r.code, name: r.name }); continue; }
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (!same(cur.code, r.code)) changes.code = { from: cur.code, to: r.code };
    if (!same(cur.name, r.name)) changes.name = { from: cur.name, to: r.name };
    if (cur.isActive !== r.isActive) changes.isActive = { from: cur.isActive, to: r.isActive };
    for (const [k, v] of Object.entries(r.extra)) if (!same(cur.extra[k], v)) changes[k] = { from: cur.extra[k] ?? null, to: v ?? null };
    if (Object.keys(changes).length) diff.updated.push({ s1Key: r.s1Key, code: r.code, name: r.name, changes });
    else diff.unchanged++;
  }
  for (const e of existing) if (!seen.has(e.s1Key) && e.isActive) diff.deactivated.push({ s1Key: e.s1Key, code: e.code, name: e.name });
  return diff;
}

export function diffCounts(d: Diff) {
  return { fetched: d.fetched, inserted: d.inserted.length, updated: d.updated.length, unchanged: d.unchanged, deactivated: d.deactivated.length, skipped: d.skipped };
}
