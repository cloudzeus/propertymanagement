/** Pure rules of the «Νέα τακτική συντήρηση» example: upcoming dates, reminders, package line. */
export type TaskFrequencyKey = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "CUSTOM";

const MONTHS: Partial<Record<TaskFrequencyKey, number>> = { MONTHLY: 1, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12 };
const iso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const parse = (s: string) => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return { y, m, d }; };
const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/** First `n` due dates from `from` (inclusive), anchored to the original day of month (31 → 28/30 when shorter). */
export function nextOccurrences(frequency: TaskFrequencyKey, from: string | null, n = 3): string[] {
  if (!from) return [];
  const { y, m, d } = parse(from);
  if (frequency === "CUSTOM") return [iso(new Date(Date.UTC(y, m - 1, d)))];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    if (frequency === "WEEKLY") { out.push(iso(new Date(Date.UTC(y, m - 1, d + 7 * i)))); continue; }
    const months = MONTHS[frequency] ?? 1;
    const total = (m - 1) + months * i;
    const yy = y + Math.floor(total / 12), mm = total % 12;
    out.push(iso(new Date(Date.UTC(yy, mm, Math.min(d, daysInMonth(yy, mm))))));
  }
  return out;
}

export function reminderDate(due: string, daysBefore: number): string {
  const { y, m, d } = parse(due);
  return iso(new Date(Date.UTC(y, m - 1, d - daysBefore)));
}

export type TaskExampleInput = { title: string; frequency: TaskFrequencyKey; nextDueDate: string | null; reminderDaysBefore: number; inPackage: boolean; vendor: string | null };
export type TaskExample = { rows: { due: string; reminder: string }[]; dateLine: string; packageLine: string; whoLine: string };

export function exampleForTask(i: TaskExampleInput): TaskExample {
  const dues = nextOccurrences(i.frequency, i.nextDueDate);
  return {
    rows: dues.map((due) => ({ due, reminder: reminderDate(due, i.reminderDaysBefore) })),
    dateLine: i.nextDueDate ? `Η πρώτη φορά είναι ${fmt(i.nextDueDate)}· μετά από κάθε «Ολοκλήρωση» το ημερολόγιο υπολογίζει μόνο του την επόμενη.` : "Δεν ορίσατε ημερομηνία — θα την ορίσετε αργότερα από το ημερολόγιο· μέχρι τότε δεν στέλνονται υπενθυμίσεις.",
    packageLine: i.inPackage ? "Είναι εντός πακέτου: την αναλαμβάνει η εταιρεία διαχείρισης χωρίς επιπλέον χρέωση στον πελάτη." : "Είναι εκτός πακέτου: χρεώνεται ξεχωριστά ή την κάνει δικό σας συνεργείο — η δαπάνη καταχωρίζεται στα έξοδα του κτηρίου.",
    whoLine: i.vendor?.trim() ? `Ανάδοχος: ${i.vendor.trim()} — θα εμφανίζεται στην υπενθύμιση και στο ιστορικό συντηρήσεων.` : "Χωρίς ανάδοχο ακόμη — μπορείτε να ορίσετε συνεργάτη αργότερα από το ημερολόγιο.",
  };
}

export const fmt = (isoDate: string) => { const { y, m, d } = parse(isoDate); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("el-GR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }); };
