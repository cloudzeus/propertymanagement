/** Pure helpers for the appointment dialog. */

/** "2026-10-22" + "09:30" → ISO string for that local wall-clock time; null when either part is empty/invalid. */
export function combineLocal(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Nearest 30 minutes (minimum 30); NaN / ≤ 0 / null / undefined → fallback. */
export function roundTo30(minutes: number | null | undefined, fallback: number): number {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return fallback;
  return Math.max(30, Math.round(minutes / 30) * 30);
}

/** "06:00" … "21:30" in 30′ steps. */
export const TIME_OPTIONS: string[] = Array.from({ length: 32 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
