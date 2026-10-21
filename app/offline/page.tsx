import Link from "next/link";
import { RiWifiOffLine } from "react-icons/ri";
import { OfflineRetry } from "@/components/pwa/OfflineRetry";

export const metadata = { title: "Χωρίς σύνδεση" };

/**
 * Η σελίδα που εξυπηρετεί ο service worker όταν μια πλοήγηση αποτύχει χωρίς δίκτυο.
 * Δημόσια (proxy.ts authPublicPaths) και χωρίς δεδομένα — αποθηκεύεται στο install του SW.
 */
export default function OfflinePage() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg-canvas)", fontFamily: "var(--font-sans)" }}>
      <div style={{ maxWidth: 360, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <RiWifiOffLine style={{ fontSize: "var(--fs-40)", color: "var(--muted-foreground)" }} aria-hidden />
        <h1 style={{ margin: 0, fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)" }}>Χωρίς σύνδεση</h1>
        <p style={{ margin: 0, fontSize: "var(--fs-14)", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
          Ελέγξτε το δίκτυο και δοκιμάστε ξανά. Τα δεδομένα σας δεν αποθηκεύονται στη συσκευή.
        </p>
        <OfflineRetry />
        <Link href="/home" style={{ fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Αρχική</Link>
      </div>
    </div>
  );
}
