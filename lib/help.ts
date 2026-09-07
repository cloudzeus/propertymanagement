import "server-only";
import { promises as fs } from "fs";
import path from "path";

/**
 * In-app manuals. Source of truth is docs/wiki (plain Markdown, editable by
 * anyone); this module maps roles → manuals and reads them at request time.
 */
export type ManualKey = "property-admin" | "owner" | "resident" | "collaborator" | "staff" | "super-admin" | "suppliers-flow";

export const MANUALS: Record<ManualKey, { file: string; title: string; audience: string }> = {
  "property-admin": { file: "roles/property-admin.md", title: "Διαχειριστής πολυκατοικίας", audience: "PROPERTY_ADMIN" },
  owner: { file: "roles/owner.md", title: "Ιδιοκτήτης", audience: "PROPERTY_OWNER" },
  resident: { file: "roles/resident.md", title: "Ένοικος", audience: "PROPERTY_RESIDENT" },
  collaborator: { file: "roles/collaborator.md", title: "Συνεργάτης / Προμηθευτής", audience: "COLLABORATOR" },
  staff: { file: "roles/staff.md", title: "Στελέχη εταιρείας διαχείρισης", audience: "ADMIN · MANAGER · EMPLOYEE" },
  "super-admin": { file: "roles/super-admin.md", title: "Super Admin", audience: "SUPER_ADMIN" },
  "suppliers-flow": { file: "flows/suppliers.md", title: "Ροή βλάβης → συνεργάτης → τιμολόγιο", audience: "Όλοι" },
};

/** The manual a role opens by default. */
export function manualForRole(role: string): ManualKey {
  switch (role) {
    case "PROPERTY_ADMIN": return "property-admin";
    case "PROPERTY_OWNER": return "owner";
    case "PROPERTY_RESIDENT": case "PROPERTY_VIEWER": return "resident";
    case "COLLABORATOR": return "collaborator";
    case "SUPER_ADMIN": return "super-admin";
    default: return "staff";
  }
}

/** Manuals a role may browse: customers/suppliers see their own + the flow; staff see everything. */
export function manualsForRole(role: string): ManualKey[] {
  if (["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"].includes(role)) return ["staff", "super-admin", "property-admin", "owner", "resident", "collaborator", "suppliers-flow"];
  if (role === "PROPERTY_ADMIN") return ["property-admin", "owner", "resident", "suppliers-flow"];
  if (role === "COLLABORATOR") return ["collaborator", "suppliers-flow"];
  return [manualForRole(role), "suppliers-flow"];
}

export async function loadManual(key: ManualKey): Promise<string> {
  const file = path.join(process.cwd(), "docs", "wiki", MANUALS[key].file);
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return `# ${MANUALS[key].title}\n\nΤο εγχειρίδιο δεν βρέθηκε (${MANUALS[key].file}).`;
  }
}
