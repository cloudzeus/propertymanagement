import { z } from "zod";

export const MeterDataSchema = z.object({
  meterType: z.enum(["POWER", "WATER", "GAS"]).nullable().default(null),
  meterNumber: z.string().nullable().default(null),
  unit: z.string().nullable().default(null),
  periodFrom: z.string().nullable().default(null),
  periodTo: z.string().nullable().default(null),
  previousReading: z.number().nullable().default(null),
  currentReading: z.number().nullable().default(null),
  consumption: z.number().nullable().default(null),
});

export const ExtractedDocSchema = z.object({
  docType: z.enum(["invoice", "receipt", "utility", "tax", "other"]).default("other"),
  supplierName: z.string().nullable().default(null),
  supplierVat: z.string().nullable().default(null),
  supplierDoy: z.string().nullable().default(null),
  documentNumber: z.string().nullable().default(null),
  documentDate: z.string().nullable().default(null),
  netAmount: z.number().nullable().default(null),
  vatAmount: z.number().nullable().default(null),
  totalAmount: z.number().nullable().default(null),
  suggestedCategoryCode: z.string().nullable().default(null),
  meter: MeterDataSchema.nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.5),
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
