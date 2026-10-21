import Link from "next/link";
import { RiWifiOffLine } from "react-icons/ri";

export const metadata = { title: "Χωρίς σύνδεση" };

/**
 * Η σελίδα που εξυπηρετεί ο service worker όταν μια πλοήγηση αποτύχει χωρίς δίκτυο.
 * Δημόσια (proxy.ts authPublicPaths), χωρίς δεδομένα, αποθηκεύεται στο install του SW
 * και μπορεί να ζήσει πολλά deploys: τα hashed chunks (globals.css, React) που αναφέρει
 * ίσως δεν υπάρχουν πια. Γι' αυτό δουλεύει ΧΩΡΙΣ JS (απλοί σύνδεσμοι) και κάθε token
 * έχει literal fallback. Το href="" = η διεύθυνση που ζητήθηκε → «Δοκιμή ξανά».
 */
export default function OfflinePage() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg-canvas, #F6F4EC)", fontFamily: "var(--font-sans, system-ui, sans-serif)", color: "var(--foreground, #15161a)" }}>
      <div style={{ maxWidth: 360, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <RiWifiOffLine style={{ fontSize: "var(--fs-40, 2.5rem)", color: "var(--muted-foreground, #6b6b66)" }} aria-hidden />
        <h1 style={{ margin: 0, fontSize: "var(--fs-22, 1.375rem)", fontWeight: 700 }}>Χωρίς σύνδεση</h1>
        <p style={{ margin: 0, fontSize: "var(--fs-14, 0.9375rem)", color: "var(--muted-foreground, #6b6b66)", lineHeight: 1.5 }}>
          Ελέγξτε το δίκτυο και δοκιμάστε ξανά. Τα δεδομένα σας δεν αποθηκεύονται στη συσκευή.
        </p>
        <a
          href=""
          style={{
            display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 18px", borderRadius: "var(--radius-sm, 8px)",
            background: "var(--primary, #15161a)", color: "var(--primary-foreground, #fff)", fontSize: "var(--fs-14, 0.9375rem)",
            fontWeight: 600, textDecoration: "none",
          }}
        >Δοκιμή ξανά</a>
        {/* Link = απλό <a href> στο SSR· δουλεύει και χωρίς hydration. */}
        <Link href="/home" style={{ fontSize: "var(--fs-13, 0.875rem)", color: "var(--muted-foreground, #6b6b66)" }}>Αρχική</Link>
      </div>
    </div>
  );
}
