import { stopImpersonation } from "@/app/actions/impersonation";

/** Distinct, palette-derived banner colour per impersonated role (white text on all). */
const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN:       "var(--color-primary)", // ink
  ADMIN:             "var(--color-purple)", // violet
  MANAGER:           "#0E7490", // cyan
  EMPLOYEE:          "var(--color-teal)", // teal
  PROPERTY_ADMIN:    "var(--color-success)", // green
  PROPERTY_OWNER:    "var(--color-purple)", // purple
  PROPERTY_RESIDENT: "#1D6FB8", // blue
  PROPERTY_VIEWER:   "var(--muted-foreground)", // grey
  COLLABORATOR:      "#B23A48", // rose
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Διαχειριστής εταιρείας",
  MANAGER: "Manager",
  EMPLOYEE: "Υπάλληλος",
  PROPERTY_ADMIN: "Διαχειριστής πολυκατοικίας",
  PROPERTY_OWNER: "Ιδιοκτήτης",
  PROPERTY_RESIDENT: "Ένοικος",
  PROPERTY_VIEWER: "Θεατής",
  COLLABORATOR: "Συνεργάτης",
};

export function ImpersonationBanner({ name, role }: { name: string; role: string }) {
  const bg = ROLE_COLOR[role] ?? "var(--color-primary)";
  const roleLabel = ROLE_LABEL[role] ?? role;
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 50, background: bg, color: "#fff",
      padding: "6px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
      fontSize: "var(--fs-13)", minWidth: 0,
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
        <span className="imp-label">Βλέπεις ως</span>
        <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{name}</strong>
        <span style={{
          fontSize: "var(--fs-11)", fontWeight: 600, padding: "2px 9px", borderRadius: 999,
          background: "rgba(255,255,255,.22)", color: "#fff", whiteSpace: "nowrap",
        }}>{roleLabel}</span>
      </span>
      <form action={stopImpersonation}>
        <button type="submit" style={{
          background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.35)",
          color: "#fff", fontSize: "var(--fs-12)", fontWeight: 600, padding: "4px 12px", borderRadius: 999,
          cursor: "pointer", whiteSpace: "nowrap",
        }}>Έξοδος</button>
      </form>
    </div>
  );
}
