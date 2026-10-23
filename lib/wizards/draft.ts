/**
 * Draft persistence for guided wizards (localStorage on the client; this
 * module is pure so the component can be thin and the rules testable).
 * A draft keeps the form values + the step the user reached; it expires
 * after DRAFT_TTL_MS and never stores the keys listed in `omit` (passwords).
 */
export const DRAFT_TTL_MS = 7 * 24 * 3600 * 1000;

export type Draft<T> = { value: T; savedAt: number; step: number };

export function draftStorageKey(wizardKey: string, ctxId?: string | null): string {
  return `wizard-draft:${wizardKey}:${ctxId ?? "-"}`;
}

export function serializeDraft<T extends object>(value: T, step: number, omit: (keyof T)[], now: number = Date.now()): string {
  const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const k of omit) delete copy[k as string];
  const d: Draft<Record<string, unknown>> = { value: copy, savedAt: now, step };
  return JSON.stringify(d);
}

/** Parse a stored draft: null when missing, malformed, not an object or older than the TTL.
 *  The value is `defaults` overlaid with the stored KNOWN keys only, so a draft from an
 *  older form shape never leaves a controlled input `undefined`. */
export function parseDraft<T extends object>(raw: string | null, defaults: T, now: number = Date.now()): Draft<T> | null {
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== "object") return null;
  const d = parsed as Partial<Draft<unknown>>;
  if (typeof d.savedAt !== "number" || now - d.savedAt > DRAFT_TTL_MS) return null;
  if (!d.value || typeof d.value !== "object" || Array.isArray(d.value)) return null;
  const stored = d.value as Record<string, unknown>;
  const value = { ...defaults } as Record<string, unknown>;
  for (const k of Object.keys(defaults)) if (k in stored) value[k] = stored[k];
  return { value: value as T, savedAt: d.savedAt, step: typeof d.step === "number" && d.step >= 0 ? Math.floor(d.step) : 0 };
}

/** «μόλις τώρα», «πριν από 5 λεπτά», «πριν από 3 ώρες», «χθες», «πριν από 3 ημέρες». */
export function formatDraftAge(savedAt: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - savedAt) / 1000));
  if (s < 60) return "μόλις τώρα";
  const m = Math.floor(s / 60);
  if (m < 60) return m === 1 ? "πριν από 1 λεπτό" : `πριν από ${m} λεπτά`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? "πριν από 1 ώρα" : `πριν από ${h} ώρες`;
  const d = Math.floor(h / 24);
  if (d === 1) return "χθες";
  return `πριν από ${d} ημέρες`;
}
