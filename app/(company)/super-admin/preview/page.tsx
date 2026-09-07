import Link from "next/link";
import { requirePermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { getBuildingDashboardData } from "@/lib/building/dashboard-data";
import { capsForManager } from "@/lib/building-caps";
import { BuildingManagerShell } from "@/components/building/manager-shell/BuildingManagerShell";
import { SuperAdminHome } from "@/components/dashboard/homes/SuperAdminHome";
import { AdminHome } from "@/components/dashboard/homes/AdminHome";
import { ManagerHome } from "@/components/dashboard/homes/ManagerHome";
import { StaffHome } from "@/components/dashboard/homes/StaffHome";
import { OwnerHome } from "@/components/dashboard/homes/OwnerHome";
import { ResidentHome } from "@/components/dashboard/homes/ResidentHome";
import { CollaboratorHome } from "@/components/dashboard/homes/CollaboratorHome";
import { RiEyeLine, RiInformationLine } from "react-icons/ri";

export const metadata = { title: "Προεπισκόπηση ρόλων — PropertyPro" };

type Scope = "none" | "company" | "building" | "staffUser" | "ownerUser" | "residentUser" | "supplier";

const ROLES: { key: string; label: string; scope: Scope; note: string }[] = [
  { key: "SUPER_ADMIN", label: "Super Admin", scope: "none", note: "Πλατφόρμα (όλες οι εταιρείες)" },
  { key: "ADMIN", label: "Διαχειριστής", scope: "company", note: "Λειτουργική εικόνα εταιρείας" },
  { key: "MANAGER", label: "Manager", scope: "company", note: "Διαχείριση ακινήτων εταιρείας" },
  { key: "EMPLOYEE", label: "Υπάλληλος", scope: "staffUser", note: "Οι εργασίες του υπαλλήλου" },
  { key: "PROPERTY_ADMIN", label: "Διαχ. Ακινήτου", scope: "building", note: "Κέντρο ελέγχου κτηρίου" },
  { key: "PROPERTY_OWNER", label: "Ιδιοκτήτης", scope: "ownerUser", note: "Χαρτοφυλάκιο ιδιοκτήτη" },
  { key: "PROPERTY_RESIDENT", label: "Ένοικος", scope: "residentUser", note: "Πύλη ενοίκου" },
  { key: "COLLABORATOR", label: "Συνεργάτης", scope: "supplier", note: "Dashboard εξωτερικού συνεργάτη" },
];

/** Representative options for the selected role's scope. */
async function optionsForScope(scope: Scope): Promise<{ id: string; label: string; sub?: string }[]> {
  switch (scope) {
    case "company": {
      const rows = await db.company.findMany({ select: { id: true, name: true, status: true }, orderBy: { name: "asc" }, take: 100 });
      return rows.map((c) => ({ id: c.id, label: c.name, sub: c.status }));
    }
    case "building": {
      const rows = await db.building.findMany({
        where: { property: { managed: true } },
        select: { id: true, name: true, company: { select: { name: true } } },
        orderBy: { name: "asc" }, take: 100,
      });
      return rows.map((b) => ({ id: b.id, label: b.name, sub: b.company?.name }));
    }
    case "staffUser":
    case "ownerUser":
    case "residentUser": {
      const role = scope === "staffUser" ? "EMPLOYEE" : scope === "ownerUser" ? "PROPERTY_OWNER" : "PROPERTY_RESIDENT";
      const rows = await db.user.findMany({ where: { role: role as any }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" }, take: 200 });
      return rows.map((u) => ({ id: u.id, label: u.name ?? u.email ?? u.id, sub: u.email ?? undefined }));
    }
    case "supplier": {
      const rows = await db.supplier.findMany({ where: { customerId: null, isPlatform: false }, select: { id: true, name: true, city: true }, orderBy: { name: "asc" }, take: 200 });
      return rows.map((s) => ({ id: s.id, label: s.name, sub: s.city ?? undefined }));
    }
    default:
      return [];
  }
}

/** Renders the selected role's home content, parameterized by the chosen id. No session reads. */
async function PreviewBody({ role, id }: { role: string; id?: string }) {
  switch (role) {
    case "SUPER_ADMIN":
      return <SuperAdminHome />;
    case "ADMIN":
      return <AdminHome companyId={id} />;
    case "MANAGER":
      return <ManagerHome companyId={id} />;
    case "EMPLOYEE": {
      if (!id) return <PickPrompt />;
      const u = await db.user.findUnique({ where: { id }, select: { companyId: true } });
      return <StaffHome userId={id} companyId={u?.companyId ?? undefined} />;
    }
    case "COLLABORATOR": {
      if (!id) return <PickPrompt />;
      const s = await db.supplier.findUnique({ where: { id }, select: { name: true } });
      return <CollaboratorHome supplierId={id} supplierName={s?.name ?? null} isSupplierAdmin previewMode />;
    }
    case "PROPERTY_OWNER": {
      if (!id) return <PickPrompt />;
      const u = await db.user.findUnique({ where: { id }, select: { name: true } });
      return <OwnerHome userId={id} userName={u?.name} previewMode />;
    }
    case "PROPERTY_RESIDENT": {
      if (!id) return <PickPrompt />;
      const u = await db.user.findUnique({ where: { id }, select: { name: true, companyId: true } });
      return <ResidentHome userId={id} companyId={u?.companyId ?? undefined} userName={u?.name} previewMode />;
    }
    case "PROPERTY_ADMIN": {
      if (!id) return <PickPrompt />;
      const building = await db.building.findUnique({ where: { id }, select: { property: { select: { managed: true } } } });
      const managed = building?.property?.managed ?? true;
      const data = await getBuildingDashboardData(id, {});
      if (!data) return <PickPrompt />;
      return <BuildingManagerShell {...data} can={capsForManager(managed)} viewer="manager" managed={managed} siblings={[]} providerConfigured={false} />;
    }
    default:
      return <PickPrompt />;
  }
}

function PickPrompt() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "60px 0", color: "var(--muted-foreground)" }}>
      <RiEyeLine style={{ fontSize: "var(--fs-32)", opacity: 0.4 }} />
      <span style={{ fontSize: "var(--fs-14)" }}>Διάλεξε αντιπροσωπευτικό δείγμα για προεπισκόπηση</span>
    </div>
  );
}

export default async function RolePreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("view-as", "view");
  const sp = await searchParams;
  const role = (typeof sp.role === "string" ? sp.role : "SUPER_ADMIN");
  const active = ROLES.find((r) => r.key === role) ?? ROLES[0];
  const options = await optionsForScope(active.scope);
  // Auto-select the first representative sample so the preview is populated immediately.
  const id = typeof sp.id === "string" ? sp.id : options[0]?.id;
  const body = await PreviewBody({ role: active.key, id });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Προεπισκόπηση ρόλων</h1>
        <p style={{ fontSize: "var(--fs-13)", color: "var(--muted-foreground)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <RiInformationLine /> Βλέπεις τι βλέπει ο κάθε ρόλος — read-only, χωρίς αλλαγή της ταυτότητάς σου (παραμένεις Super Admin).
        </p>
      </div>

      {/* Role tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ROLES.map((r) => {
          const activeTab = r.key === active.key;
          return (
            <Link
              key={r.key}
              href={`/super-admin/preview?role=${r.key}`}
              style={{
                padding: "8px 14px", borderRadius: 999, fontSize: "var(--fs-13)", fontWeight: 600, textDecoration: "none",
                border: `1px solid ${activeTab ? "var(--color-primary)" : "var(--border)"}`,
                background: activeTab ? "var(--color-primary)" : "var(--card)",
                color: activeTab ? "#fff" : "var(--foreground)",
              }}
            >
              {r.label}
            </Link>
          );
        })}
      </div>

      {/* Representative picker */}
      {active.scope !== "none" && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)", marginBottom: 10 }}>
            Αντιπροσωπευτικό δείγμα ({active.note}):
          </div>
          {options.length === 0 ? (
            <div style={{ fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Δεν υπάρχουν διαθέσιμα δείγματα για αυτόν τον ρόλο.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 120, overflowY: "auto" }}>
              {options.map((o) => {
                const sel = o.id === id;
                return (
                  <Link
                    key={o.id}
                    href={`/super-admin/preview?role=${active.key}&id=${o.id}`}
                    title={o.sub}
                    style={{
                      padding: "6px 12px", borderRadius: 8, fontSize: "var(--fs-12-5)", fontWeight: 600, textDecoration: "none",
                      border: `1px solid ${sel ? "var(--color-primary)" : "var(--border)"}`,
                      background: sel ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "var(--bg-canvas)",
                      color: sel ? "var(--color-primary)" : "var(--foreground)",
                    }}
                  >
                    {o.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Read-only preview viewport */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--bg-canvas)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
          <RiEyeLine style={{ color: "var(--color-primary)" }} />
          <span style={{ fontSize: "var(--fs-13)", fontWeight: 700, color: "var(--foreground)" }}>Προεπισκόπηση: {active.label}</span>
          <span style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>· read-only · οι ενέργειες είναι ανενεργές</span>
        </div>
        {/* Scroll lives on the OUTER (interactive) container so wheel + scrollbar work;
            `inert` sits on the inner wrapper to make the content non-interactive (no clicks/focus/navigation). */}
        <div style={{ maxHeight: "72vh", overflowY: "auto", overscrollBehavior: "contain" }}>
          <div inert style={{ padding: 24 }}>
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}
