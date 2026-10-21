"use client";

/** «Δοκιμή ξανά» στη σελίδα /offline — απλή επαναφόρτωση. */
export function OfflineRetry() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      style={{
        minHeight: 44, padding: "0 18px", border: "none", borderRadius: "var(--radius-sm)",
        background: "var(--primary)", color: "var(--primary-foreground, #fff)",
        fontSize: "var(--fs-14)", fontWeight: 600, cursor: "pointer",
      }}
    >
      Δοκιμή ξανά
    </button>
  );
}
