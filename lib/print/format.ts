// Shared formatting helpers for the printable documents (no server-only code).

export const eur = (n: number) => `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
export const num = (n: number | null | undefined, digits = 2) => (n == null ? "—" : n.toLocaleString("el-GR", { maximumFractionDigits: digits }));
export const mill = (n: number | null | undefined) => (n == null ? "—" : `${n.toLocaleString("el-GR", { maximumFractionDigits: 2 })} ‰`);
export const pct = (n: number) => `${n.toLocaleString("el-GR", { maximumFractionDigits: 1 })} %`;

export const monthLabel = (m: string) => {
  const d = new Date(`${m}-01T12:00:00`);
  const s = new Intl.DateTimeFormat("el-GR", { month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const dateLabel = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("el-GR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d)) : "—";
export const dateLong = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("el-GR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(d)) : "—";
export const timeLabel = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("el-GR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Athens" }).format(new Date(d)) : "—";
export const dateTimeLabel = (d: Date | string | null | undefined) => (d ? `${dateLabel(d)} ${timeLabel(d)}` : "—");

export const floorLabel = (f: number | null | undefined) => (f == null ? null : f === 0 ? "Ισόγειο" : f < 0 ? "Υπόγειο" : `${f}ος όροφος`);
export const UNIT_TYPE: Record<string, string> = { APARTMENT: "Διαμέρισμα", SHOP: "Κατάστημα", PARKING: "Θέση στάθμευσης", OFFICE: "Γραφείο", STORAGE: "Αποθήκη", OTHER: "Χώρος" };
export const unitTypeLabel = (t: string) => UNIT_TYPE[t] ?? t;

export const PAYMENT_METHOD: Record<string, string> = {
  CARD: "Κάρτα", CASH: "Μετρητά", VIVA: "Ηλεκτρονική πληρωμή (Viva)", BANK_TRANSFER: "Τραπεζική μεταφορά", CHECK: "Επιταγή", OTHER: "Άλλο",
};
export const methodLabel = (m: string | null | undefined) => (m ? PAYMENT_METHOD[m] ?? m : "—");

export const BASIS_LABEL: Record<string, string> = {
  GENERAL_MILLESIMES: "Χιλιοστά κοινοχρήστων", ELEVATOR_MILLESIMES: "Χιλιοστά ανελκυστήρα", HEATING_MILLESIMES: "Χιλιοστά θέρμανσης",
  EQUAL_PER_UNIT: "Ισόποσα ανά μονάδα", METERED_70_30: "Ενδείξεις θέρμανσης (70/30)",
};
export const basisLabel = (b: string) => BASIS_LABEL[b] ?? b;

/** Amount in words (Greek), for receipts: 1.234,56 → «χίλια διακόσια τριάντα τέσσερα ευρώ και πενήντα έξι λεπτά». */
export function amountInWordsEl(n: number): string {
  const ones = ["", "ένα", "δύο", "τρία", "τέσσερα", "πέντε", "έξι", "επτά", "οκτώ", "εννέα", "δέκα", "έντεκα", "δώδεκα", "δεκατρία", "δεκατέσσερα", "δεκαπέντε", "δεκαέξι", "δεκαεπτά", "δεκαοκτώ", "δεκαεννέα"];
  const tens = ["", "", "είκοσι", "τριάντα", "σαράντα", "πενήντα", "εξήντα", "εβδομήντα", "ογδόντα", "ενενήντα"];
  const hundreds = ["", "εκατό", "διακόσια", "τριακόσια", "τετρακόσια", "πεντακόσια", "εξακόσια", "επτακόσια", "οκτακόσια", "εννιακόσια"];
  const below1000 = (x: number): string => {
    const h = Math.floor(x / 100), r = x % 100;
    const parts: string[] = [];
    if (h) parts.push(h === 1 && r ? "εκατόν" : hundreds[h]);
    if (r < 20) { if (r) parts.push(ones[r]); }
    else { parts.push(tens[Math.floor(r / 10)]); if (r % 10) parts.push(ones[r % 10]); }
    return parts.join(" ");
  };
  const whole = Math.floor(n), cents = Math.round((n - whole) * 100);
  const parts: string[] = [];
  const th = Math.floor(whole / 1000), rest = whole % 1000;
  if (th) parts.push(th === 1 ? "χίλια" : `${below1000(th).replace(/α$/, "ες").replace(/^ένα$/, "")} χιλιάδες`.trim());
  if (rest) parts.push(below1000(rest));
  const eurWords = whole === 0 ? "μηδέν ευρώ" : `${parts.join(" ")} ευρώ`;
  return cents ? `${eurWords} και ${below1000(cents)} λεπτά` : eurWords;
}
