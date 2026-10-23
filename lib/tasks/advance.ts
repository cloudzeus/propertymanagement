/** The one rule for a recurring task's next due date (server action + wizard example share it). */
export type AdvanceFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "CUSTOM";

const MONTHS: Partial<Record<AdvanceFrequency, number>> = { MONTHLY: 1, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12 };

/** Adds the period, keeping the day of month and clamping to the last day of a shorter month (31 Jan → 28 Feb). */
export function advanceDue(date: Date, freq: AdvanceFrequency): Date {
  const d = new Date(date);
  if (freq === "CUSTOM") return d;
  if (freq === "WEEKLY") { d.setUTCDate(d.getUTCDate() + 7); return d; }
  const months = MONTHS[freq] ?? 1;
  const total = d.getUTCMonth() + months;
  const y = d.getUTCFullYear() + Math.floor(total / 12), m = total % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  d.setUTCFullYear(y, m, Math.min(d.getUTCDate(), last));
  return d;
}
