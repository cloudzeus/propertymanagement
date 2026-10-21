/**
 * Λογική του banner «Προσθήκη στην αρχική οθόνη» — καθαρή, χωρίς React/window,
 * ώστε να ελέγχεται με vitest. Το component (components/pwa/InstallBanner.tsx)
 * μαζεύει τα δεδομένα από τον browser και καλεί decideBanner().
 */
export type BannerState = "hidden" | "native" | "ios";

export const SNOOZE_DAYS = 30;
export const STORAGE_KEYS = {
  snoozedUntil: "orithon.pwa.snoozedUntil",
  installed: "orithon.pwa.installed",
} as const;

export type BannerInput = {
  isPhone: boolean;
  standalone: boolean;
  installed: boolean;
  snoozedUntil: Date | null;
  now: Date;
  isIOS: boolean;
  hasNativePrompt: boolean;
};

export function decideBanner(i: BannerInput): BannerState {
  if (!i.isPhone || i.standalone || i.installed) return "hidden";
  if (i.snoozedUntil && i.snoozedUntil.getTime() > i.now.getTime()) return "hidden";
  if (i.hasNativePrompt) return "native";
  if (i.isIOS) return "ios";
  return "hidden";
}

/** iPhone/iPad (και iPadOS 13+, που δηλώνει Macintosh αλλά έχει οθόνη αφής). */
export function isIOSUserAgent(ua: string, maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && maxTouchPoints > 1;
}

type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "setItem">;

export function readState(storage: Reader | null): { installed: boolean; snoozedUntil: Date | null } {
  try {
    if (!storage) return { installed: false, snoozedUntil: null };
    const installed = storage.getItem(STORAGE_KEYS.installed) === "1";
    const raw = storage.getItem(STORAGE_KEYS.snoozedUntil);
    const parsed = raw ? new Date(raw) : null;
    const snoozedUntil = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
    return { installed, snoozedUntil };
  } catch {
    return { installed: false, snoozedUntil: null };
  }
}

/** Σιωπή SNOOZE_DAYS ημερών· επιστρέφει το «μέχρι» ακόμη κι αν το storage αποτύχει (private mode). */
export function snooze(storage: Writer | null, now: Date): Date {
  const until = new Date(now.getTime() + SNOOZE_DAYS * 24 * 3600 * 1000);
  try { storage?.setItem(STORAGE_KEYS.snoozedUntil, until.toISOString()); } catch { /* private mode */ }
  return until;
}

export function markInstalled(storage: Writer | null): void {
  try { storage?.setItem(STORAGE_KEYS.installed, "1"); } catch { /* private mode */ }
}
