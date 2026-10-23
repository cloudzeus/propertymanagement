"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { RiSmartphoneLine } from "react-icons/ri";
import { useMediaQuery } from "@/lib/use-media-query";
import { isIOSUserAgent } from "@/lib/pwa/install-banner";
import { decidePushState, urlBase64ToUint8Array, PUSH_STATE_TEXT, type PushState } from "@/lib/push/client-state";
import { subscribePush, unsubscribePush } from "@/app/actions/push";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

const noSubscribe = () => () => {};
/** Σταθερή τιμή του browser χωρίς setState-in-effect· στον server = false. */
function useClientFlag(read: () => boolean): boolean {
  return useSyncExternalStore(noSubscribe, read, () => false);
}

type Live = { permission: NotificationPermission; subscribed: boolean };

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

function serialize(sub: PushSubscription): { endpoint: string; keys: { p256dh: string; auth: string } } | null {
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) return null;
  return { endpoint: json.endpoint, keys: { p256dh, auth } };
}

/**
 * «Ειδοποιήσεις στο κινητό» — υποσέλιδο του καμπανακιού (components/maintenance/notifications-bell.tsx).
 * Ζητά άδεια, εγγράφει τη συσκευή με το VAPID δημόσιο κλειδί και την αποθηκεύει για τον
 * συνδεδεμένο χρήστη (app/actions/push.ts). Η απόφαση κατάστασης είναι στο lib/push/client-state.ts.
 */
export function PushToggle() {
  const hasServiceWorker = useClientFlag(() => "serviceWorker" in navigator);
  const hasPushManager = useClientFlag(() => "PushManager" in window);
  const hasNotification = useClientFlag(() => "Notification" in window);
  const isIOS = useClientFlag(() => isIOSUserAgent(navigator.userAgent, navigator.maxTouchPoints));
  const standaloneMedia = useMediaQuery("(display-mode: standalone)");
  const standaloneIOS = useClientFlag(() => (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const [live, setLive] = useState<Live | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported = hasServiceWorker && hasPushManager && hasNotification;

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    (async () => {
      try {
        const sub = await currentSubscription();
        const permission = Notification.permission;
        if (cancelled) return;
        setLive({ permission, subscribed: sub !== null });
        // Επανασυγχρονισμός: ο browser έχει συνδρομή → βεβαιώσου ότι η βάση τη δένει στον τρέχοντα χρήστη.
        if (sub && permission === "granted") {
          const s = serialize(sub);
          if (s) void subscribePush(s, navigator.userAgent).catch(() => {});
        }
      } catch {
        if (!cancelled) setLive({ permission: Notification.permission, subscribed: false });
      }
    })();
    return () => { cancelled = true; };
  }, [supported]);

  const state: PushState | null = live
    ? decidePushState({
        hasServiceWorker, hasPushManager, hasNotification, hasPublicKey: PUBLIC_KEY.length > 0,
        permission: live.permission, subscribed: live.subscribed, isIOS, standalone: standaloneMedia || standaloneIOS,
      })
    : null;

  if (!supported || !state || state === "unsupported" || state === "unconfigured") return null;

  async function turnOn() {
    setBusy(true); setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setLive({ permission, subscribed: false }); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY) as BufferSource,
      }));
      const s = serialize(sub);
      const res = s ? await subscribePush(s, navigator.userAgent) : ({ ok: false, reason: "invalid" } as const);
      if (!res.ok) {
        await sub.unsubscribe().catch(() => {});
        setError(res.reason === "impersonating" ? "Μη διαθέσιμο κατά την προβολή ως άλλος χρήστης." : "Δεν ήταν δυνατή η ενεργοποίηση.");
        setLive({ permission, subscribed: false });
        return;
      }
      setLive({ permission, subscribed: true });
    } catch {
      setError("Δεν ήταν δυνατή η ενεργοποίηση.");
      setLive({ permission: Notification.permission, subscribed: false });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true); setError(null);
    try {
      const sub = await currentSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
        await unsubscribePush(endpoint).catch(() => {});
      }
      setLive({ permission: Notification.permission, subscribed: false });
    } catch {
      setError("Δεν ήταν δυνατή η απενεργοποίηση.");
    } finally {
      setBusy(false);
    }
  }

  const on = state === "on";
  const disabled = busy || state === "ios-install" || state === "denied";
  const text = error ?? PUSH_STATE_TEXT[state];

  return (
    <div style={wrap}>
      <RiSmartphoneLine style={{ fontSize: "var(--fs-17)", color: "var(--muted-foreground)", flexShrink: 0 }} aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--foreground)" }}>Ειδοποιήσεις στο κινητό</div>
        <div style={{ fontSize: "var(--fs-12)", color: error ? "var(--destructive, var(--color-danger))" : "var(--muted-foreground)", marginTop: 2 }}>{text}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Ειδοποιήσεις στο κινητό"
        aria-busy={busy || undefined}
        disabled={disabled}
        onClick={() => (on ? turnOff() : turnOn())}
        style={{ ...track, background: on ? "var(--primary)" : "var(--border)", opacity: disabled ? 0.55 : 1, cursor: disabled ? "default" : "pointer" }}
      >
        <span style={{ ...knob, transform: on ? "translateX(18px)" : "translateX(0)" }} />
      </button>
    </div>
  );
}

const wrap: CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
  borderTop: "1px solid var(--border)", background: "var(--card)",
  position: "sticky", bottom: 0,
};
const track: CSSProperties = {
  position: "relative", width: 40, height: 22, minWidth: 40, borderRadius: 999, border: "none", padding: 2,
  transition: "background .15s ease",
};
const knob: CSSProperties = {
  display: "block", width: 18, height: 18, borderRadius: 999, background: "#fff",
  boxShadow: "0 1px 2px rgba(0,0,0,.25)", transition: "transform .15s ease",
};
