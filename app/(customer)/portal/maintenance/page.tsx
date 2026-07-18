import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { SectionCard, EmptyState } from "@/components/dashboard";
import { RiToolsLine, RiCalendarCheckLine, RiFileTextLine } from "react-icons/ri";

export const metadata = { title: "Συντηρήσεις" };

const FREQ_LABEL: Record<string, string> = {
  WEEKLY: "Εβδομαδιαία",
  MONTHLY: "Μηνιαία",
  QUARTERLY: "Τριμηνιαία",
  SEMIANNUAL: "Εξαμηνιαία",
  ANNUAL: "Ετήσια",
  CUSTOM: "Μία φορά",
};

const fmtDate = (d: Date) => d.toLocaleDateString("el-GR", { day: "2-digit", month: "long", year: "numeric" });

/** Read-only resident view: upcoming recurring maintenance + completed history. No mutation UI. */
export default async function PortalMaintenancePage() {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");
  const userId = eff.user.id;

  const units = await db.unit.findMany({
    where: {
      OR: [
        { residentId: userId },
        { occupancies: { some: { userId, endDate: null } } },
      ],
    },
    select: { buildingId: true },
  });
  const buildingIds = [...new Set(units.map((u) => u.buildingId))];
  const multiBuilding = buildingIds.length > 1;

  const [tasks, history] = await Promise.all([
    db.recurringTask.findMany({
      where: { buildingId: { in: buildingIds }, active: true },
      orderBy: { nextDueDate: "asc" },
      select: {
        id: true, title: true, frequency: true, nextDueDate: true, vendor: true,
        building: { select: { name: true } },
      },
    }),
    db.maintenanceLog.findMany({
      where: { buildingId: { in: buildingIds } },
      orderBy: { performedAt: "desc" },
      take: 50,
      select: {
        id: true, performedAt: true, notes: true,
        recurringTask: { select: { title: true } },
        building: { select: { name: true } },
        documentFile: { select: { url: true, name: true } },
      },
    }),
  ]);

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Συντηρήσεις</h1>

      <SectionCard title="Επερχόμενες συντηρήσεις">
        {tasks.length === 0 ? (
          <EmptyState icon={RiToolsLine} label="Δεν υπάρχουν προγραμματισμένες συντηρήσεις." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tasks.map((t) => (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                padding: "10px 14px", background: "var(--bg-canvas)", borderRadius: 8, flexWrap: "wrap",
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    {FREQ_LABEL[t.frequency] ?? t.frequency}
                    {multiBuilding ? ` · ${t.building.name}` : ""}
                    {t.vendor ? ` · ${t.vendor}` : ""}
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap" }}>
                  {t.nextDueDate ? fmtDate(t.nextDueDate) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Ιστορικό συντηρήσεων">
        {history.length === 0 ? (
          <EmptyState icon={RiCalendarCheckLine} label="Δεν υπάρχει ιστορικό συντηρήσεων." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.map((h) => (
              <div key={h.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", background: "var(--bg-canvas)", borderRadius: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{h.recurringTask?.title ?? "—"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    {fmtDate(h.performedAt)}{multiBuilding ? ` · ${h.building.name}` : ""}{h.notes ? ` · ${h.notes}` : ""}
                  </div>
                </div>
                {h.documentFile && (
                  <a href={h.documentFile.url} target="_blank" rel="noreferrer" title="Πιστοποιητικό" style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34,
                    borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)",
                    color: "var(--foreground)", flexShrink: 0,
                  }}>
                    <RiFileTextLine />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
