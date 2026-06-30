import {
  RiShieldUserLine,
  RiCheckLine,
  RiCloseLine,
} from "react-icons/ri";

export const metadata = { title: "Ρόλοι — Super Admin" };

const ROLES = [
  {
    role: "SUPER_ADMIN",
    label: "Super Admin",
    color: "#A4262C",
    description: "Πλήρης πρόσβαση σε όλα τα επίπεδα συστήματος",
    permissions: {
      "Διαχείριση Εταιρειών": true,
      "Διαχείριση Χρηστών": true,
      "Ρυθμίσεις Συστήματος": true,
      "API Κόστη": true,
      "Brand Settings": true,
      "Ακίνητα": true,
      "Αιτήματα Συντήρησης": true,
      "Ανακοινώσεις": true,
    },
  },
  {
    role: "ADMIN",
    label: "Admin",
    color: "#0078D4",
    description: "Διαχειριστής εταιρείας — πλήρης πρόσβαση στην εταιρεία",
    permissions: {
      "Διαχείριση Εταιρειών": false,
      "Διαχείριση Χρηστών": true,
      "Ρυθμίσεις Συστήματος": false,
      "API Κόστη": false,
      "Brand Settings": false,
      "Ακίνητα": true,
      "Αιτήματα Συντήρησης": true,
      "Ανακοινώσεις": true,
    },
  },
  {
    role: "MANAGER",
    label: "Manager",
    color: "#8764B8",
    description: "Διαχείριση ακινήτων και εργασιών",
    permissions: {
      "Διαχείριση Εταιρειών": false,
      "Διαχείριση Χρηστών": false,
      "Ρυθμίσεις Συστήματος": false,
      "API Κόστη": false,
      "Brand Settings": false,
      "Ακίνητα": true,
      "Αιτήματα Συντήρησης": true,
      "Ανακοινώσεις": true,
    },
  },
  {
    role: "PROPERTY_ADMIN",
    label: "Property Admin",
    color: "#038387",
    description: "Διαχειριστής συγκεκριμένων ακινήτων",
    permissions: {
      "Διαχείριση Εταιρειών": false,
      "Διαχείριση Χρηστών": false,
      "Ρυθμίσεις Συστήματος": false,
      "API Κόστη": false,
      "Brand Settings": false,
      "Ακίνητα": true,
      "Αιτήματα Συντήρησης": true,
      "Ανακοινώσεις": true,
    },
  },
  {
    role: "EMPLOYEE",
    label: "Employee",
    color: "#CA5D00",
    description: "Υπάλληλος — εκτέλεση ανατεθειμένων εργασιών",
    permissions: {
      "Διαχείριση Εταιρειών": false,
      "Διαχείριση Χρηστών": false,
      "Ρυθμίσεις Συστήματος": false,
      "API Κόστη": false,
      "Brand Settings": false,
      "Ακίνητα": false,
      "Αιτήματα Συντήρησης": true,
      "Ανακοινώσεις": false,
    },
  },
  {
    role: "COLLABORATOR",
    label: "Collaborator",
    color: "#107C10",
    description: "Εξωτερικός συνεργάτης — περιορισμένη πρόσβαση",
    permissions: {
      "Διαχείριση Εταιρειών": false,
      "Διαχείριση Χρηστών": false,
      "Ρυθμίσεις Συστήματος": false,
      "API Κόστη": false,
      "Brand Settings": false,
      "Ακίνητα": false,
      "Αιτήματα Συντήρησης": true,
      "Ανακοινώσεις": false,
    },
  },
  {
    role: "PROPERTY_OWNER",
    label: "Property Owner",
    color: "#8764B8",
    description: "Ιδιοκτήτης ακινήτου — ανάγνωση ιδιοκτησιών",
    permissions: {
      "Διαχείριση Εταιρειών": false,
      "Διαχείριση Χρηστών": false,
      "Ρυθμίσεις Συστήματος": false,
      "API Κόστη": false,
      "Brand Settings": false,
      "Ακίνητα": true,
      "Αιτήματα Συντήρησης": false,
      "Ανακοινώσεις": false,
    },
  },
  {
    role: "PROPERTY_RESIDENT",
    label: "Property Resident",
    color: "#0078D4",
    description: "Ενοικιαστής — πύλη υπηρεσιών",
    permissions: {
      "Διαχείριση Εταιρειών": false,
      "Διαχείριση Χρηστών": false,
      "Ρυθμίσεις Συστήματος": false,
      "API Κόστη": false,
      "Brand Settings": false,
      "Ακίνητα": false,
      "Αιτήματα Συντήρησης": true,
      "Ανακοινώσεις": true,
    },
  },
  {
    role: "PROPERTY_VIEWER",
    label: "Property Viewer",
    color: "#707070",
    description: "Παρατηρητής — ανάγνωση μόνο",
    permissions: {
      "Διαχείριση Εταιρειών": false,
      "Διαχείριση Χρηστών": false,
      "Ρυθμίσεις Συστήματος": false,
      "API Κόστη": false,
      "Brand Settings": false,
      "Ακίνητα": false,
      "Αιτήματα Συντήρησης": false,
      "Ανακοινώσεις": true,
    },
  },
];

const ALL_PERMISSIONS = Object.keys(ROLES[0].permissions);

export default function RolesPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Ρόλοι & Δικαιώματα</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>Επισκόπηση όλων των ρόλων και δικαιωμάτων στο σύστημα</p>
      </div>

      {/* Role cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {ROLES.map((r) => (
          <div key={r.role} style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: 18,
            borderTop: `3px solid ${r.color}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${r.color}18`, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <RiShieldUserLine style={{ fontSize: 16, color: r.color }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{r.label}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: r.color, letterSpacing: "0.04em", textTransform: "uppercase" }}>{r.role}</div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>{r.description}</p>
          </div>
        ))}
      </div>

      {/* Permission matrix */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Πίνακας Δικαιωμάτων</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-canvas)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", minWidth: 200 }}>
                  Δικαίωμα
                </th>
                {ROLES.map((r) => (
                  <th key={r.role} style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, fontWeight: 600, color: r.color, whiteSpace: "nowrap" }}>
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_PERMISSIONS.map((perm, i) => (
                <tr key={perm} style={{ borderBottom: i < ALL_PERMISSIONS.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>{perm}</td>
                  {ROLES.map((r) => (
                    <td key={r.role} style={{ padding: "10px 12px", textAlign: "center" }}>
                      {r.permissions[perm as keyof typeof r.permissions]
                        ? <RiCheckLine style={{ fontSize: 16, color: "#107C10" }} />
                        : <RiCloseLine style={{ fontSize: 16, color: "#D3D3D3" }} />
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
