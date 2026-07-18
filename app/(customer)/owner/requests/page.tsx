import Link from "next/link";
import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { getOwnerRequests, getOwnerUnits } from "@/lib/dashboard/owner-queries";
import { NewRequestButton } from "@/components/maintenance/new-request-form";
import { EmptyState } from "@/components/dashboard";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, type FaultStatus, type FaultPriority } from "@/lib/maintenance-shared";
import { RiToolsLine } from "react-icons/ri";

export const metadata = { title: "Αιτήματα βλαβών" };

const fmt = (d: Date) => d.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" });

export default async function OwnerRequestsPage() {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");
  const userId = eff.user.id;

  const [requests, units, categories] = await Promise.all([
    getOwnerRequests(userId),
    getOwnerUnits(userId),
    db.maintenanceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  // Κτήρια/μονάδες του ιδιοκτήτη (για τη φόρμα δήλωσης)
  const buildingsMap = new Map<string, { id: string; name: string; units: { id: string; label: string }[] }>();
  for (const u of units) {
    const b = buildingsMap.get(u.building.id) ?? { id: u.building.id, name: u.building.name, units: [] };
    b.units.push({ id: u.id, label: `Μονάδα ${u.unitNumber}` });
    buildingsMap.set(u.building.id, b);
  }
  const buildings = [...buildingsMap.values()];

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0, flex: 1 }}>Αιτήματα βλαβών</h1>
        {buildings.length > 0 && <NewRequestButton buildings={buildings} categories={categories} detailBase="/portal/requests" />}
      </div>

      {requests.length === 0 ? (
        <EmptyState icon={RiToolsLine} label="Δεν υπάρχουν αιτήματα βλαβών στις μονάδες σας." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {requests.map((r) => {
            const color = STATUS_COLORS[r.status as FaultStatus] ?? "#6b7280";
            const pr = r.priority as FaultPriority;
            const prColor = pr === "URGENT" ? "#9f1239" : pr === "HIGH" ? "#b45309" : "var(--muted-foreground)";
            return (
              <Link key={r.id} href={`/portal/requests/${r.id}`} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", textDecoration: "none",
                background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    {r.building.name}{r.unit ? ` · Μονάδα ${r.unit.unitNumber}` : ""} · {r.categoryRef?.name ?? "—"} · {fmt(r.createdAt)}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: prColor, whiteSpace: "nowrap" }}>
                  {PRIORITY_LABELS[pr] ?? r.priority}
                </span>
                <span style={{
                  padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, color,
                  background: `${color}18`, border: `1px solid ${color}40`, whiteSpace: "nowrap",
                }}>
                  {STATUS_LABELS[r.status as FaultStatus] ?? r.status}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
