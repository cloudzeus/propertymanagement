import Link from "next/link";

/** Greek 404 for every surface (App Router global not-found). */
export default function NotFound() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg-canvas, #F6F4EC)", fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <div style={{ fontSize: "var(--fs-48, 3rem)", fontWeight: 800, color: "#C0392B", lineHeight: 1 }}>404</div>
        <h1 style={{ fontSize: "var(--fs-22, 1.375rem)", fontWeight: 700, margin: "12px 0 8px", color: "#1b1c1a" }}>Η σελίδα δεν βρέθηκε</h1>
        <p style={{ fontSize: "var(--fs-14, .875rem)", color: "rgba(27,28,26,.65)", lineHeight: 1.6, margin: 0 }}>
          Ο σύνδεσμος μπορεί να έχει αλλάξει ή η σελίδα να μην υπάρχει πια. Επιστρέψτε στην αρχική ή χρησιμοποιήστε το μενού.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 20px", borderRadius: 999, background: "#15161a", color: "#fff", textDecoration: "none", fontWeight: 600, fontSize: "var(--fs-14, .875rem)" }}>Αρχική</Link>
          <Link href="/login" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 20px", borderRadius: 999, border: "1px solid rgba(27,28,26,.2)", color: "#1b1c1a", textDecoration: "none", fontWeight: 600, fontSize: "var(--fs-14, .875rem)" }}>Σύνδεση</Link>
        </div>
      </div>
    </div>
  );
}
