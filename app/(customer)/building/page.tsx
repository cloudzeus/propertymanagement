import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  RiBuildingLine, RiMapPinLine, RiHome4Line, RiToolsLine,
  RiMoneyEuroCircleLine, RiArrowRightSLine, RiCommunityLine,
} from "react-icons/ri";
import { managerBuildingIds } from "@/lib/building-access";
import { ManagedBadge } from "@/components/ui/managed-badge";
import { formatEuro } from "@/lib/dashboard/aggregations";

export const metadata = { title: "Τα κτήριά μου" };

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function ManagerBuildingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id as string;

  const ids = await managerBuildingIds(userId);

  if (ids.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "40px 48px", textAlign: "center", maxWidth: 480 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, margin: "0 auto 14px", background: "var(--color-primary)18", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RiCommunityLine style={{ fontSize: 30 }} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--foreground)" }}>Δεν σας έχει ανατεθεί κάποιο κτήριο ακόμη.</div>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
            Επικοινωνήστε με την εταιρεία διαχείρισης για να συνδεθεί το κτήριό σας με τον λογαριασμό σας.
          </p>
        </div>
      </div>
    );
  }

  if (ids.length === 1) redirect(`/building/${ids[0]}`);

  const month = currentMonth();
  const [buildings, allocations, openGroups] = await Promise.all([
    db.building.findMany({
      where: { id: { in: ids } },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, address: true, city: true,
        property: { select: { managed: true } },
        _count: { select: { units: true } },
      },
    }),
    db.expenseAllocation.findMany({
      where: { unit: { buildingId: { in: ids } }, expense: { month } },
      select: {
        tenantAmount: true, tenantPaid: true, ownerAmount: true, ownerPaid: true,
        unit: { select: { buildingId: true } },
      },
    }),
    db.maintenanceRequest.groupBy({
      by: ["buildingId"],
      where: { buildingId: { in: ids }, status: { in: ["OPEN", "IN_PROGRESS"] } },
      _count: { _all: true },
    }),
  ]);

  const stats = new Map<string, { total: number; paid: number; unpaid: number }>();
  for (const a of allocations) {
    const s = stats.get(a.unit.buildingId) ?? { total: 0, paid: 0, unpaid: 0 };
    const t = Number(a.tenantAmount), o = Number(a.ownerAmount);
    s.total += t + o;
    s.paid += (a.tenantPaid ? t : 0) + (a.ownerPaid ? o : 0);
    s.unpaid += (a.tenantPaid ? 0 : t) + (a.ownerPaid ? 0 : o);
    stats.set(a.unit.buildingId, s);
  }
  const openCounts = new Map(openGroups.map((g) => [g.buildingId, g._count._all]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--foreground)" }}>Τα κτήριά μου</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
          Επιλέξτε κτήριο για να δείτε τον πλήρη πίνακα διαχείρισης.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {buildings.map((b) => {
          const s = stats.get(b.id) ?? { total: 0, paid: 0, unpaid: 0 };
          const pct = s.total > 0 ? Math.round((s.paid / s.total) * 100) : 0;
          const open = openCounts.get(b.id) ?? 0;
          return (
            <Link key={b.id} href={`/building/${b.id}`} style={{
              display: "block", textDecoration: "none",
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
              padding: "16px 18px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, background: "var(--color-primary)18", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <RiBuildingLine style={{ fontSize: 24 }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                    <ManagedBadge managed={b.property.managed} size="sm" />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <RiMapPinLine style={{ flexShrink: 0 }} /> {[b.address, b.city].filter(Boolean).join(", ") || "—"}
                  </div>
                </div>
                <RiArrowRightSLine style={{ color: "var(--muted-foreground)", flexShrink: 0, fontSize: 20 }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
                <CardStat icon={RiHome4Line} label="Μονάδες" value={String(b._count.units)} />
                <CardStat icon={RiMoneyEuroCircleLine} label="Ανεξόφλητα" value={formatEuro(s.unpaid)} color={s.unpaid > 0 ? "#c50f1f" : undefined} />
                <CardStat icon={RiToolsLine} label="Ανοιχτά αιτήματα" value={String(open)} color={open > 0 ? "#CA5D00" : undefined} />
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                  <span>Είσπραξη μήνα</span>
                  <span>{s.total > 0 ? `${pct}%` : "—"}</span>
                </div>
                <div style={{ height: 8, borderRadius: 9999, overflow: "hidden", display: "flex", background: s.total > 0 ? "#c50f1f22" : "var(--bg-canvas)" }}>
                  {s.total > 0 && <div style={{ width: `${pct}%`, background: "#107C10" }} />}
                  {s.total > 0 && <div style={{ flex: 1, background: "#c50f1f" }} />}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function CardStat({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color?: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "var(--bg-canvas)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--muted-foreground)", fontWeight: 600 }}>
        <Icon style={{ fontSize: 13 }} /> {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, color: color ?? "var(--foreground)", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}
