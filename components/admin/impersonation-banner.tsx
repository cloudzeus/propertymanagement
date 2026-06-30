import { stopImpersonation } from "@/app/actions/impersonation";

export function ImpersonationBanner({ label }: { label: string }) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#b45309", color: "#fff", padding: "6px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span>Βλέπεις ως <strong>{label}</strong></span>
      <form action={stopImpersonation}>
        <button type="submit" style={{ textDecoration: "underline", color: "#fff" }}>Έξοδος</button>
      </form>
    </div>
  );
}
