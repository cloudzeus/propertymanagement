import { PrintButton } from "./PrintButton";

/** Printable contract page body: frozen HTML when the side has been accepted, otherwise the live render. */
export function ContractView({ title, html, frozen, backHref, backLabel }: { title: string; html: string; frozen: boolean; backHref: string; backLabel: string }) {
  return (
    <div className="dash-page" style={{ maxWidth: 860 }}>
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <a href={backHref} style={{ fontSize: "var(--fs-13)", color: "var(--muted-foreground)", textDecoration: "none" }}>← {backLabel}</a>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: "var(--fs-12)", color: frozen ? "#15803d" : "var(--muted-foreground)" }}>{frozen ? "Οριστικό αντίγραφο (κλειδωμένο κατά την αποδοχή)" : "Προσχέδιο — οριστικοποιείται με την αποδοχή"}</span>
        <PrintButton />
      </div>
      <article className="contract-doc" style={{ background: "#fff", color: "#111", border: "1px solid var(--border)", borderRadius: 12, padding: "40px 48px", fontSize: "var(--fs-14)", lineHeight: 1.65 }}>
        <h1 style={{ fontSize: "var(--fs-22)", margin: "0 0 18px" }}>{title}</h1>
        <div className="contract-body" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
      <style>{`
        .contract-body h1 { font-size: var(--fs-20); margin: 0 0 14px; }
        .contract-body h2 { font-size: var(--fs-15); margin: 22px 0 6px; }
        .contract-body h3 { font-size: var(--fs-14); margin: 16px 0 4px; }
        .contract-body p { margin: 0 0 10px; }
        .contract-body ul { margin: 0 0 10px 18px; }
        @media print { .no-print { display: none !important; } .contract-doc { border: none !important; border-radius: 0 !important; padding: 0 !important; } body { background: #fff !important; } }
      `}</style>
    </div>
  );
}
