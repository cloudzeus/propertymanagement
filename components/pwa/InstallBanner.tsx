"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { RiSmartphoneLine, RiShareBoxLine } from "react-icons/ri";
import { useMediaQuery, usePhone } from "@/lib/use-media-query";
import { decideBanner, isIOSUserAgent, markInstalled, readState, snooze, type BannerState } from "@/lib/pwa/install-banner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

const noSubscribe = () => () => {};
/** Σταθερή τιμή του browser (UA, navigator.standalone) χωρίς setState-in-effect· στον server = false. */
function useClientFlag(read: () => boolean): boolean {
  return useSyncExternalStore(noSubscribe, read, () => false);
}

/**
 * «Προσθέστε το Orithon στην αρχική οθόνη» — μόνο σε κινητό, μόνο όταν δεν τρέχει
 * ήδη εγκατεστημένο. Android/Chrome: native prompt. iOS/Safari: οδηγίες.
 * In-flow κάρτα (όχι fixed) ώστε να μη συγκρούεται με τα κουμπιά κάτω αριστερά/δεξιά.
 */
export function InstallBanner() {
  const isPhone = usePhone();
  const standaloneMedia = useMediaQuery("(display-mode: standalone)");
  const standaloneIOS = useClientFlag(() => (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const isIOS = useClientFlag(() => isIOSUserAgent(navigator.userAgent, navigator.maxTouchPoints));
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent); };
    const onInstalled = () => { markInstalled(storage()); setDismissed(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (dismissed) return null;
  const { installed, snoozedUntil } = readState(typeof window === "undefined" ? null : storage());
  const state: BannerState = decideBanner({
    isPhone, standalone: standaloneMedia || standaloneIOS, installed, snoozedUntil, now: new Date(), isIOS, hasNativePrompt: prompt !== null,
  });
  if (state === "hidden") return null;

  const onSnooze = () => { snooze(storage(), new Date()); setDismissed(true); };
  const onInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") markInstalled(storage()); else snooze(storage(), new Date());
    setDismissed(true);
  };

  return (
    <div role="region" aria-label="Εγκατάσταση στο κινητό" style={card}>
      <RiSmartphoneLine style={{ fontSize: "var(--fs-22)", color: "var(--primary)", flexShrink: 0 }} aria-hidden />
      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
        <div style={{ fontSize: "var(--fs-14)", fontWeight: 700, color: "var(--foreground)" }}>Προσθέστε το Orithon στην αρχική οθόνη</div>
        <div style={{ fontSize: "var(--fs-13)", color: "var(--muted-foreground)", lineHeight: 1.4 }}>
          {state === "native" ? (
            "Ανοίγει σαν εφαρμογή, με δικό της εικονίδιο."
          ) : (
            <>Πατήστε Κοινή χρήση <RiShareBoxLine style={{ verticalAlign: "-2px" }} aria-label="Κοινή χρήση" /> και μετά «Προσθήκη στην αρχική οθόνη».</>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {state === "native" ? (
          <>
            <button type="button" onClick={onInstall} style={{ ...btn, background: "var(--primary)", color: "var(--primary-foreground, #fff)", border: "none" }}>Εγκατάσταση</button>
            <button type="button" onClick={onSnooze} style={btn}>Όχι τώρα</button>
          </>
        ) : (
          <button type="button" onClick={onSnooze} style={btn}>Εντάξει</button>
        )}
      </div>
    </div>
  );
}

const card: CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", marginBottom: 14,
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
};
const btn: CSSProperties = {
  minHeight: 44, padding: "0 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
  background: "var(--card)", color: "var(--foreground)", fontSize: "var(--fs-13)", fontWeight: 600, cursor: "pointer",
};
