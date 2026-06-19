import { z } from "zod";

/**
 * Parse a money/number value that an LLM may return as a number OR a messy
 * string ("123.45 EUR", "1.234,56 €", "€ 12,00"). Returns a clean number or null.
 * Handles both Greek (1.234,56) and English (1,234.56) thousand/decimal separators.
 */
export function parseAmount(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.replace(/[^\d.,-]/g, "").trim();
  if (!s || s === "-" || s === "." || s === ",") return null;
  const hasDot = s.includes("."), hasComma = s.includes(",");
  if (hasDot && hasComma) {
    // The last-occurring separator is the decimal mark; the other groups thousands.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(/,/g, ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// A numeric field tolerant of strings/currency; never throws — bad input → null.
const looseAmount = z.preprocess(parseAmount, z.number().nullable()).catch(null);

/**
 * Normalize a date to YYYY-MM-DD. Accepts ISO, dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy.
 * Returns the cleaned ISO string, or the original string if it can't be parsed
 * (so nothing is lost — the user can fix it in the form), or null.
 */
export function normalizeDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}

const looseDate = z.preprocess(normalizeDate, z.string().nullable()).catch(null);

export const MeterDataSchema = z.object({
  meterType: z.enum(["POWER", "WATER", "GAS"]).nullable().catch(null).default(null),
  meterNumber: z.coerce.string().nullable().catch(null).default(null),
  unit: z.coerce.string().nullable().catch(null).default(null),
  periodFrom: looseDate.default(null),
  periodTo: looseDate.default(null),
  previousReading: looseAmount.default(null),
  currentReading: looseAmount.default(null),
  consumption: looseAmount.default(null),
});

export const ExtractedDocSchema = z.object({
  docType: z.enum(["invoice", "receipt", "utility", "tax", "other"]).catch("other").default("other"),
  supplierName: z.coerce.string().nullable().catch(null).default(null),
  supplierVat: z.coerce.string().nullable().catch(null).default(null),
  supplierDoy: z.coerce.string().nullable().catch(null).default(null),
  documentNumber: z.coerce.string().nullable().catch(null).default(null),
  documentDate: looseDate.default(null),
  netAmount: looseAmount.default(null),
  vatAmount: looseAmount.default(null),
  totalAmount: looseAmount.default(null),
  suggestedCategoryCode: z.coerce.string().nullable().catch(null).default(null),
  meter: MeterDataSchema.nullable().catch(null).default(null),
  confidence: z.coerce.number().catch(0.5).default(0.5),
});

export type ExtractedDoc = z.infer<typeof ExtractedDocSchema>;

export const REQUIRED_FIELDS: (keyof ExtractedDoc)[] = ["supplierName", "documentDate", "totalAmount"];

export function countMissingRequired(d: Partial<ExtractedDoc>): number {
  return REQUIRED_FIELDS.filter((k) => {
    const v = d[k];
    return v == null || v === "";
  }).length;
}

export function buildSystemPrompt(categoryCodes: string[]): string {
  return [
    "Είσαι σύστημα εξαγωγής δεδομένων από ελληνικά παραστατικά (τιμολόγια, αποδείξεις, λογαριασμοί ΔΕΗ/νερού/αερίου, φορολογικά έγγραφα).",
    "Διάβασε το έγγραφο και επίστρεψε ΑΥΣΤΗΡΑ ένα JSON object με τα πεδία:",
    "docType, supplierName, supplierVat (ΑΦΜ), supplierDoy (ΔΟΥ), documentNumber, documentDate (YYYY-MM-DD), netAmount (καθαρή αξία), vatAmount (ΦΠΑ), totalAmount (σύνολο), suggestedCategoryCode, meter, confidence (0..1).",
    "Τα ποσά ως αριθμοί με τελεία υποδιαστολή (1234.56). Ό,τι δεν βρίσκεις → null.",
    "Αν είναι λογαριασμός κοινής ωφέλειας, συμπλήρωσε το αντικείμενο meter: { meterType (POWER|WATER|GAS), meterNumber, unit (kWh|m3), periodFrom, periodTo, previousReading (προηγούμενη ένδειξη), currentReading (τρέχουσα ένδειξη), consumption (κατανάλωση) }.",
    `Το suggestedCategoryCode πρέπει να είναι ΕΝΑ από: ${categoryCodes.join(", ")} ή null.`,
    "Επίστρεψε μόνο το JSON, χωρίς επεξήγηση, χωρίς markdown code fences.",
  ].join("\n");
}
