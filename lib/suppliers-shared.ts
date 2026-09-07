/* Pure shared constants/helpers for the suppliers domain (safe for client components + Vitest). */

export const SUPPLIER_KINDS = ["SERVICES", "PRODUCTS", "BOTH"] as const;
export type SupplierKind = (typeof SUPPLIER_KINDS)[number];

export const SUPPLIER_KIND_LABELS: Record<SupplierKind, string> = {
  SERVICES: "Υπηρεσίες",
  PRODUCTS: "Προϊόντα",
  BOTH: "Υπηρεσίες & προϊόντα",
};

/** Which registry a supplier row belongs to (see prisma Supplier docs). */
export type SupplierScope = "company" | "private" | "platform";
export const SCOPE_LABELS: Record<SupplierScope, string> = {
  company: "Μητρώο εταιρίας",
  private: "Δικός μου",
  platform: "Εταιρία διαχείρισης",
};

// ISO weekday keys 1 (Δευτέρα) … 7 (Κυριακή)
export const WEEKDAYS = [
  { key: "1", label: "Δευτέρα", short: "Δε" },
  { key: "2", label: "Τρίτη", short: "Τρ" },
  { key: "3", label: "Τετάρτη", short: "Τε" },
  { key: "4", label: "Πέμπτη", short: "Πε" },
  { key: "5", label: "Παρασκευή", short: "Πα" },
  { key: "6", label: "Σάββατο", short: "Σα" },
  { key: "7", label: "Κυριακή", short: "Κυ" },
] as const;

export type HoursRange = [string, string];
export type WorkingHours = Record<string, HoursRange[]>;

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  "1": [["09:00", "17:00"]], "2": [["09:00", "17:00"]], "3": [["09:00", "17:00"]],
  "4": [["09:00", "17:00"]], "5": [["09:00", "17:00"]],
};

/** ΑΦΜ → digits only (null when empty). Tolerates OCR noise like "ΑΦΜ: 123 456 789". */
export function normalizeAfm(v: string | null | undefined): string | null {
  const digits = (v ?? "").replace(/\D+/g, "");
  return digits.length ? digits : null;
}

/** Greek ΑΦΜ checksum (9 digits, mod-11). Use as a warning, not a hard gate — foreign VATs differ. */
export function isValidGreekAfm(v: string | null | undefined): boolean {
  const d = normalizeAfm(v);
  if (!d || d.length !== 9) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(d[i]) * 2 ** (8 - i);
  return (sum % 11) % 10 === Number(d[8]);
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Validate/clean a working-hours object; drops malformed entries instead of throwing. */
export function normalizeWorkingHours(input: unknown): WorkingHours {
  const out: WorkingHours = {};
  if (!input || typeof input !== "object") return out;
  for (const day of WEEKDAYS) {
    const raw = (input as Record<string, unknown>)[day.key];
    if (!Array.isArray(raw)) continue;
    const ranges: HoursRange[] = [];
    for (const r of raw) {
      if (!Array.isArray(r) || r.length !== 2) continue;
      const [a, b] = r as [unknown, unknown];
      if (typeof a !== "string" || typeof b !== "string" || !HHMM.test(a) || !HHMM.test(b) || a >= b) continue;
      ranges.push([a, b]);
    }
    ranges.sort((x, y) => x[0].localeCompare(y[0]));
    if (ranges.length) out[day.key] = ranges;
  }
  return out;
}

/** Short summary for lists, e.g. "Δε–Πα 09:00–17:00 · Σα 09:00–14:00". */
export function formatHoursSummary(hours: WorkingHours | null | undefined): string {
  if (!hours) return "—";
  const groups: { days: string[]; sig: string; text: string }[] = [];
  for (const day of WEEKDAYS) {
    const ranges = hours[day.key];
    if (!ranges?.length) continue;
    const text = ranges.map(([a, b]) => `${a}–${b}`).join(", ");
    const last = groups[groups.length - 1];
    const prevKey = last ? String(Number(last.days[last.days.length - 1]) + 1) : null;
    // keep runs of consecutive days with identical hours together
    if (last && last.sig === text && prevKey === day.key) last.days.push(day.key);
    else groups.push({ days: [day.key], sig: text, text });
  }
  if (!groups.length) return "—";
  const short = (k: string) => WEEKDAYS.find((d) => d.key === k)!.short;
  return groups
    .map((g) => `${g.days.length > 1 ? `${short(g.days[0])}–${short(g.days[g.days.length - 1])}` : short(g.days[0])} ${g.text}`)
    .join(" · ");
}

/** Serializable supplier row for client components. */
export type SupplierDTO = {
  id: string;
  scope: SupplierScope;
  customerId: string | null;
  kind: SupplierKind;
  code: string | null;
  name: string;
  afm: string | null;
  doy: string | null;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  webpage: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  postalCode: string | null;
  country: string | null;
  isActive: boolean;
  remarks: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  iban: string | null;
  bank: string | null;
  paymentTermsDays: number | null;
  /** Χρέωση αυτοψίας (net) — null = δωρεάν/δεν δηλώθηκε */
  siteSurveyFee: number | null;
  /** Η αυτοψία συμψηφίζεται αν ανατεθεί η εργασία */
  siteSurveyFeeWaived: boolean;
  workingHours: WorkingHours | null;
  emergency24h: boolean;
  lat: number | null;
  lng: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  onboardedAt: string | null;
  categoryIds: string[];
  categoryNames: string[];
  usersCount: number;
  servicesCount: number;
  productsCount: number;
  createdAt: string;
};

/** Master-catalog service (defined by the company; suppliers pick from it in the wizard). */
export type ServiceCatalogItemDTO = {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  categoryId: string | null;
  categoryName: string | null;
  active: boolean;
  sortOrder: number;
};

export type SupplierFormInput = {
  kind: SupplierKind;
  code?: string | null;
  name: string;
  afm?: string | null;
  doy?: string | null;
  email?: string | null;
  phone?: string | null;
  phone2?: string | null;
  webpage?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  postalCode?: string | null;
  country?: string | null;
  isActive?: boolean;
  remarks?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  iban?: string | null;
  bank?: string | null;
  paymentTermsDays?: number | null;
  siteSurveyFee?: number | null;
  siteSurveyFeeWaived?: boolean;
  workingHours?: WorkingHours | null;
  emergency24h?: boolean;
  categoryIds?: string[];
};

export type CatalogItemDTO = {
  id: string;
  sku?: string | null;
  catalogItemId?: string | null;
  name: string;
  description: string | null;
  unit: string | null;
  price: number | null;
  vatPct: number;
  active: boolean;
  sortOrder: number;
};

export type CatalogItemInput = {
  sku?: string | null;
  name: string;
  description?: string | null;
  unit?: string | null;
  price?: number | null;
  vatPct?: number;
  active?: boolean;
  sortOrder?: number;
};

export type SupplierUserDTO = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  status: string;
  isSupplierAdmin: boolean;
  lastLoginAt: string | null;
};

/** Lightweight option for pickers (expenses, recurring tasks, assignment). */
export type SupplierOption = { id: string; name: string; afm: string | null; scope: SupplierScope; kind: SupplierKind };

export function formatPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
