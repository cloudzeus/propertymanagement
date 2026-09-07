import { db } from "@/lib/db";
import Link from "next/link";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, type FaultStatus } from "@/lib/maintenance-shared";
import {
  RiToolsLine, RiTimeLine, RiCheckboxCircleLine, RiArrowRightLine, RiStoreLine, RiPriceTag3Line, RiGroupLine, RiAlertLine,
} from "react-icons/ri";

const OPEN = ["OPEN", "ACKNOWLEDGED", "SCHEDULED", "IN_PROGRESS", "ON_HOLD"];

async function loadStats(supplierId: string) {
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [open, inProgress, doneMonth, supplier] = await Promise.all([
    db.maintenanceRequest.count({ where: { supplierId, status: { in: OPEN } } }),
    db.maintenanceRequest.count({ where: { supplierId, status: "IN_PROGRESS" } }),
    db.maintenanceRequest.count({ where: { supplierId, status: "COMPLETED", completedAt: { gte: monthStart } } }),
    db.supplier.findUnique({ where: { id: supplierId }, select: { workingHours: true, _count: { select: { services: true, products: true, users: true, categories: true } } } }),
  ]);
  return { open, inProgress, doneMonth, supplier };
}

/**
 * Collaborator (supplier) dashboard: assigned work + profile completeness.
 * Rendered by /marketplace and by the super-admin role preview.
 */
export async function CollaboratorHome({ supplierId, supplierName, isSupplierAdmin, previewMode }: {
  supplierId: string; supplierName: string | null; isSupplierAdmin: boolean; previewMode?: boolean;
}) {
  const [stats, tasks] = await Promise.all([
    loadStats(supplierId),
    db.maintenanceRequest.findMany({
      where: { supplierId, status: { in: OPEN } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 8,
      select: { id: true, title: true, status: true, priority: true, scheduledDate: true, building: { select: { name: true, city: true } } },
    }),
  ]);
  const s = stats.supplier;
  const hasHours = !!s?.workingHours && Object.keys(s.workingHours as object).length > 0;
  const todo: { label: string; href: string; icon: React.ElementType }[] = [];
  if (s && s._count.services + s._count.products === 0) todo.push({ label: "Δηλώστε τις υπηρεσίες/προϊόντα σας με τιμές", href: "/marketplace/catalog", icon: RiPriceTag3Line });
  if (!hasHours) todo.push({ label: "Ορίστε ωράριο λειτουργίας & διαθεσιμότητα", href: "/marketplace/profile", icon: RiStoreLine });
  if (s && s._count.categories === 0) todo.push({ label: "Επιλέξτε ειδικότητες για να λαμβάνετε σχετικά αιτήματα", href: "/marketplace/profile", icon: RiToolsLine });
  if (s && s._count.users < 2 && isSupplierAdmin) todo.push({ label: "Προσθέστε τους τεχνικούς σας ως λογαριασμούς", href: "/marketplace/team", icon: RiGroupLine });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{supplierName ?? "Συνεργάτης"}</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>Αναθέσεις από την εταιρεία διαχείρισης και η επιχείρησή σας</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[
          { label: "Ανοιχτές αναθέσεις", value: stats.open, sub: "Αναμένουν ενέργεια", icon: RiToolsLine, href: "/marketplace/requests", color: "#0078D4" },
          { label: "Σε εξέλιξη", value: stats.inProgress, sub: "Εκτελούνται τώρα", icon: RiTimeLine, href: "/marketplace/requests", color: "#CA5D00" },
          { label: "Ολοκληρωμένες (μήνας)", value: stats.doneMonth, sub: "Τρέχων μήνας", icon: RiCheckboxCircleLine, href: "/marketplace/requests", color: "#107C10" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={previewMode ? "#" : card.href} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 8, textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 500 }}>{card.label}</span>
                <Icon style={{ fontSize: 20, color: card.color, opacity: 0.8 }} />
              </div>
              <span style={{ fontSize: 28, fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}>{card.value}</span>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{card.sub}</span>
            </Link>
          );
        })}
      </div>

      {todo.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>Ολοκληρώστε το προφίλ σας</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {todo.map((t) => {
              const Icon = t.icon;
              return (
                <Link key={t.label} href={previewMode ? "#" : t.href} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--foreground)", textDecoration: "none", padding: "8px 12px", background: "var(--bg-canvas)", borderRadius: 6 }}>
                  <Icon style={{ color: "var(--color-primary)" }} /> <span style={{ flex: 1 }}>{t.label}</span> <RiArrowRightLine style={{ color: "var(--muted-foreground)" }} />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Ανοιχτές αναθέσεις</h2>
          <Link href={previewMode ? "#" : "/marketplace/requests"} style={{ fontSize: 12, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
            Όλες <RiArrowRightLine />
          </Link>
        </div>
        {tasks.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
            <RiCheckboxCircleLine style={{ fontSize: 32, opacity: 0.4, display: "block", margin: "0 auto 8px", color: "var(--color-success)" }} />
            Δεν υπάρχουν ανοιχτές αναθέσεις
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tasks.map((t) => {
              const color = STATUS_COLORS[t.status as FaultStatus] ?? "#6b7280";
              return (
                <Link key={t.id} href={previewMode ? "#" : `/marketplace/requests/${t.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-canvas)", borderRadius: 6, textDecoration: "none" }}>
                  <RiAlertLine style={{ fontSize: 18, color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                      {t.building.name}{t.building.city ? ` · ${t.building.city}` : ""} · {STATUS_LABELS[t.status as FaultStatus] ?? t.status}
                      {t.scheduledDate ? ` · Ραντεβού ${t.scheduledDate.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" })}` : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, flexShrink: 0, background: `${color}18`, color }}>
                    {PRIORITY_LABELS[t.priority as keyof typeof PRIORITY_LABELS] ?? t.priority}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
