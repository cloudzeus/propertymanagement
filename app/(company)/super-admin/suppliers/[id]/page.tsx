import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission, getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { getEffectiveSession } from "@/lib/auth-effective";
import { loadSupplierFull } from "@/lib/suppliers";
import { SupplierHeader } from "@/components/suppliers/SupplierHeader";
import { CatalogEditor } from "@/components/suppliers/CatalogEditor";
import { TeamEditor } from "@/components/suppliers/TeamEditor";
import { STATUS_LABELS, STATUS_COLORS, type FaultStatus } from "@/lib/maintenance-shared";
import { RiArrowLeftLine, RiToolsLine, RiCalendarTodoLine, RiMoneyEuroCircleLine } from "react-icons/ri";

export const metadata = { title: "Συνεργάτης" };

const fmt = (d: Date | null) => (d ? d.toLocaleDateString("el-GR") : "—");

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("suppliers", "view");
  const [resolved, eff, full] = await Promise.all([getEffectivePermissions(), getEffectiveSession(), loadSupplierFull(id)]);
  // Private (customer) rows are never reachable from the company surface.
  if (!full || full.supplier.scope === "private") notFound();
  const canEdit = can(resolved!.perms, "suppliers", "edit");
  const s = full.supplier;

  const [categories, requests, tasks, expenseAgg] = await Promise.all([
    db.maintenanceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.maintenanceRequest.findMany({
      where: { supplierId: id }, orderBy: { createdAt: "desc" }, take: 25,
      select: { id: true, title: true, status: true, createdAt: true, scheduledDate: true, completedAt: true, building: { select: { name: true } } },
    }),
    db.recurringTask.findMany({
      where: { supplierId: id }, orderBy: { nextDueDate: "asc" }, take: 25,
      select: { id: true, title: true, nextDueDate: true, active: true, buildingId: true, building: { select: { name: true } } },
    }),
    db.buildingExpense.aggregate({ where: { supplierId: id }, _count: { _all: true }, _sum: { amount: true } }),
  ]);

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1100 }}>
      <Link href="/super-admin/suppliers" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-13)", color: "var(--muted-foreground)", textDecoration: "none" }}>
        <RiArrowLeftLine /> Πίσω στο μητρώο
      </Link>

      <SupplierHeader supplier={s} categories={categories} canEdit={canEdit} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <Stat icon={RiToolsLine} label="Αναθέσεις βλαβών" value={String(requests.length)} />
        <Stat icon={RiCalendarTodoLine} label="Επαναλαμβανόμενες εργασίες" value={String(tasks.length)} />
        <Stat icon={RiMoneyEuroCircleLine} label="Παραστατικά εξόδων" value={`${expenseAgg._count._all} · ${Number(expenseAgg._sum.amount ?? 0).toLocaleString("el-GR", { minimumFractionDigits: 2 })} €`} />
      </div>

      <CatalogEditor supplierId={s.id} kind={s.kind} services={full.services} products={full.products} canEdit={canEdit} />

      {s.scope === "company" && (
        <TeamEditor supplierId={s.id} users={full.users} canEdit={canEdit} selfId={eff?.user.id ?? null} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <Panel title="Πρόσφατες αναθέσεις" empty={requests.length === 0 ? "Καμία ανάθεση ακόμη. Η ανάθεση γίνεται από τη σελίδα της βλάβης." : undefined}>
          {requests.map((r) => {
            const color = STATUS_COLORS[r.status as FaultStatus] ?? "#6b7280";
            return (
              <Link key={r.id} href={`/admin/maintenance/${r.id}`} style={row}>
                <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</b><span style={{ fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)" }}>{r.building.name} · {fmt(r.createdAt)}</span></span>
                <span style={{ fontSize: "var(--fs-11)", fontWeight: 600, color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 999, padding: "2px 8px", flexShrink: 0 }}>{STATUS_LABELS[r.status as FaultStatus] ?? r.status}</span>
              </Link>
            );
          })}
        </Panel>
        <Panel title="Επαναλαμβανόμενες εργασίες" empty={tasks.length === 0 ? "Δεν έχει οριστεί ως ανάδοχος σε εργασία κτηρίου." : undefined}>
          {tasks.map((t) => (
            <Link key={t.id} href={`/super-admin/buildings/${t.buildingId}`} style={{ ...row, opacity: t.active ? 1 : 0.55 }}>
              <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</b><span style={{ fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)" }}>{t.building.name}</span></span>
              <span style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)", flexShrink: 0 }}>{fmt(t.nextDueDate)}</span>
            </Link>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <Icon style={{ fontSize: "var(--fs-22)", color: "var(--color-primary)", opacity: 0.85 }} />
      <div><div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{label}</div><div style={{ fontSize: "var(--fs-18)", fontWeight: 700, color: "var(--foreground)" }}>{value}</div></div>
    </div>
  );
}

function Panel({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: "var(--fs-13)", fontWeight: 700 }}>{title}</div>
      {empty ? <div style={{ padding: 22, textAlign: "center", fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>{empty}</div> : <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>}
    </div>
  );
}

const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderTop: "1px solid var(--border)", textDecoration: "none", color: "var(--foreground)", fontSize: "var(--fs-13)" };
