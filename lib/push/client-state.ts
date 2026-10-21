/**
 * Λογική του διακόπτη «Ειδοποιήσεις στο κινητό» — καθαρή, χωρίς React/window,
 * ώστε να ελέγχεται με vitest. Το component (components/pwa/PushToggle.tsx)
 * μαζεύει τα δεδομένα από τον browser και καλεί decidePushState().
 */
export type PushState = "unsupported" | "unconfigured" | "ios-install" | "denied" | "off" | "on";

export type PushStateInput = {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  /** NEXT_PUBLIC_VAPID_PUBLIC_KEY υπάρχει στο build. */
  hasPublicKey: boolean;
  permission: NotificationPermission;
  /** registration.pushManager.getSubscription() !== null */
  subscribed: boolean;
  isIOS: boolean;
  /** display-mode: standalone ή navigator.standalone — στο iOS το push δουλεύει μόνο εγκατεστημένο. */
  standalone: boolean;
};

export function decidePushState(i: PushStateInput): PushState {
  if (!i.hasServiceWorker || !i.hasPushManager || !i.hasNotification) return "unsupported";
  if (!i.hasPublicKey) return "unconfigured";
  if (i.isIOS && !i.standalone) return "ios-install";
  if (i.permission === "denied") return "denied";
  return i.subscribed ? "on" : "off";
}

/** Το VAPID δημόσιο κλειδί (url-safe base64) → bytes για applicationServerKey. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Κείμενα ανά κατάσταση (ελληνικά), ένα σημείο για το component και το wiki. */
export const PUSH_STATE_TEXT: Record<Exclude<PushState, "unsupported" | "unconfigured">, string> = {
  "ios-install": "Προσθέστε την εφαρμογή στην αρχική οθόνη για να λαμβάνετε ειδοποιήσεις στο iPhone.",
  denied: "Απορρίφθηκαν από τον browser. Επιτρέψτε τις ειδοποιήσεις στις ρυθμίσεις του ιστότοπου.",
  off: "Λάβετε ειδοποίηση στη συσκευή σας όταν υπάρχει κάτι νέο.",
  on: "Ενεργές σε αυτή τη συσκευή.",
};
