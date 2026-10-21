/* Distance zones from the base station — pure, client-safe.
 *
 * A zone table lives in AppSettings.distanceZones (null = DEFAULT_ZONES). A
 * building falls into the first zone whose maxKm >= its road distance; the
 * last zone is open (maxKm null). Zones carry the company's travel fee; the
 * same codes key Service.zonePrices and Supplier.surveyZoneFees.
 */

export type DistanceMethod = "ROAD" | "ESTIMATE";

export type DistanceZone = { code: string; label: string; maxKm: number | null; travelFee: number };

export const MAX_ZONES = 8;

export const DEFAULT_ZONES: DistanceZone[] = [
  { code: "A", label: "Ζώνη Α", maxKm: 10, travelFee: 0 },
  { code: "B", label: "Ζώνη Β", maxKm: 30, travelFee: 15 },
  { code: "C", label: "Ζώνη Γ", maxKm: 60, travelFee: 35 },
  { code: "D", label: "Ζώνη Δ", maxKm: null, travelFee: 60 },
];

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Stored JSON → zone list; anything malformed yields the defaults. */
export function parseZones(json: unknown): DistanceZone[] {
  if (!Array.isArray(json) || json.length === 0) return DEFAULT_ZONES;
  const out: DistanceZone[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") return DEFAULT_ZONES;
    const z = raw as Record<string, unknown>;
    if (typeof z.code !== "string" || typeof z.label !== "string") return DEFAULT_ZONES;
    if (!(z.maxKm === null || isNum(z.maxKm)) || !isNum(z.travelFee)) return DEFAULT_ZONES;
    out.push({ code: z.code, label: z.label, maxKm: z.maxKm as number | null, travelFee: z.travelFee });
  }
  return validateZones(out) ? DEFAULT_ZONES : out;
}

/** Null when valid, otherwise a Greek message for the settings form. */
export function validateZones(zones: DistanceZone[]): string | null {
  if (!zones.length) return "Χρειάζεται τουλάχιστον μία ζώνη";
  if (zones.length > MAX_ZONES) return `Μέγιστο ${MAX_ZONES} ζώνες`;
  if (new Set(zones.map((z) => z.code.trim())).size !== zones.length || zones.some((z) => !z.code.trim())) return "Οι κωδικοί ζωνών πρέπει να είναι μοναδικοί";
  if (zones.some((z) => typeof z.label !== "string" || !z.label.trim())) return "Κάθε ζώνη χρειάζεται όνομα";
  if (zones.some((z) => !isNum(z.travelFee) || z.travelFee < 0)) return "Τα ποσά πρέπει να είναι ≥ 0";
  const last = zones[zones.length - 1];
  if (last.maxKm !== null) return "Η τελευταία ζώνη πρέπει να είναι ανοιχτή (χωρίς όριο km)";
  const limits = zones.slice(0, -1).map((z) => z.maxKm);
  if (limits.some((k) => !isNum(k) || (k as number) <= 0)) return "Τα όρια km πρέπει να είναι θετικοί αριθμοί";
  for (let i = 1; i < limits.length; i++) if ((limits[i] as number) <= (limits[i - 1] as number)) return "Τα όρια km πρέπει να είναι σε αύξουσα σειρά";
  return null;
}

/** First zone with km <= maxKm (last zone catches the rest); null without a distance. */
const GREEK_LETTERS = ["Α", "Β", "Γ", "Δ", "Ε", "Ζ", "Η", "Θ"];
const LATIN_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/**
 * Next code/label for a new zone: the first Latin letter not in `taken`.
 * `taken` must include every code that ever existed in the saved table (not
 * only the current rows), so a removed code is never reused — Service.zonePrices
 * and Supplier.surveyZoneFees still key on it.
 */
export function nextZoneCode(taken: Iterable<string>): { code: string; label: string } {
  const used = new Set(taken);
  const idx = LATIN_LETTERS.findIndex((c) => !used.has(c));
  if (idx >= 0) return { code: LATIN_LETTERS[idx], label: `Ζώνη ${GREEK_LETTERS[idx]}` };
  let n = used.size + 1;
  while (used.has(`Z${n}`)) n++;
  return { code: `Z${n}`, label: `Ζώνη ${n}` };
}

export function zoneForKm(zones: DistanceZone[], km: number | null | undefined): DistanceZone | null {
  if (!isNum(km)) return null;
  return zones.find((z) => z.maxKm === null || km <= z.maxKm) ?? null;
}

export function zoneFee(zones: DistanceZone[], code: string | null | undefined): number {
  const z = code ? zones.find((x) => x.code === code) : null;
  return z ? z.travelFee : 0;
}

export function zoneLabel(zones: DistanceZone[], code: string | null | undefined): string {
  const z = code ? zones.find((x) => x.code === code) : null;
  return z ? z.label : "χωρίς ζώνη";
}

const fmtKm = (km: number) => km.toLocaleString("el-GR", { maximumFractionDigits: 1 });

/** «23,4 km · περ. 35′» · «≈ 23,4 km (εκτίμηση)» · «—» */
export function formatDistance(km: number | null, minutes: number | null, method: DistanceMethod | null): string {
  if (!isNum(km)) return "—";
  if (method === "ESTIMATE") return `≈ ${fmtKm(km)} km (εκτίμηση)`;
  return isNum(minutes) ? `${fmtKm(km)} km · περ. ${minutes}′` : `${fmtKm(km)} km`;
}

/** «Ζώνη Β ×2, Ζώνη Γ ×1, χωρίς ζώνη ×1» — zone order, unknown last. */
export function summarizeZones(zones: DistanceZone[], codes: (string | null | undefined)[]): string {
  const counts = new Map<string | null, number>();
  for (const c of codes) {
    const key = c && zones.some((z) => z.code === c) ? c : null;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const parts = zones.filter((z) => counts.has(z.code)).map((z) => `${z.label} ×${counts.get(z.code)}`);
  if (counts.has(null)) parts.push(`χωρίς ζώνη ×${counts.get(null)}`);
  return parts.join(", ");
}

/** One-line building badge: «23 km · περ. 35′ · Ζώνη Β»; null without a distance. */
export function describeBuildingDistance(
  b: { distanceKm: number | null; distanceMinutes: number | null; distanceMethod: string | null },
  zones: DistanceZone[],
): string | null {
  if (!isNum(b.distanceKm)) return null;
  const method = b.distanceMethod === "ESTIMATE" ? "ESTIMATE" : "ROAD";
  return `${formatDistance(b.distanceKm, b.distanceMinutes, method)} · ${zoneLabel(zones, zoneForKm(zones, b.distanceKm)?.code)}`;
}
