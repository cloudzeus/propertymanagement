import { stopImpersonation } from "@/app/actions/impersonation";

/** Distinct, palette-derived banner colour per impersonated role (white text on all). */
const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN:       "#15161a", // ink
  ADMIN:             "#6D28D9", // violet
  MANAGER:           "#0E7490", // cyan
  EMPLOYEE:          "#038387", // teal
  PROPERTY_ADMIN:    "#2E7D5B", // green
  PROPERTY_OWNER:    "#8764B8", // purple
  PROPERTY_RESIDENT: "#1D6FB8", // blue
  PROPERTY_VIEWER:   "#5b5c58", // grey
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
  const bg = ROLE_COLOR[role] ?? "#15161a";
  const roleLabel = ROLE_LABEL[role] ?? role;
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 50, background: bg, color: "#fff",
      padding: "7px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
      fontSize: 13,
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        Βλέπεις ως <strong>{name}</strong>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 999,
          background: "rgba(255,255,255,.22)", color: "#fff", whiteSpace: "nowrap",
        }}>{roleLabel}</span>
      </span>
      <form action={stopImpersonation}>
        <button type="submit" style={{
          background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.35)",
          color: "#fff", fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 999,
          cursor: "pointer",
        }}>Έξοδος</button>
      </form>
    </div>
  );
}
