import Link from "next/link";
import { requireCollaborator } from "@/lib/marketplace";
import { UnlinkedNotice } from "@/components/marketplace/UnlinkedNotice";
import { listSupplierWorkOrders } from "@/lib/rfq";
import { WO_STATUS_LABELS, WO_STATUS_COLORS, eur } from "@/lib/rfq-shared";
import { RiFileListLine, RiArrowRightSLine } from "react-icons/ri";

export const metadata = { title: "Συμβάσεις έργου" };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—");

export default async function SupplierWorkOrdersPage() {
  const ctx = await requireCollaborator("mkt-work-orders");
  if (!ctx.supplierId) return <UnlinkedNotice />;
  const items = await listSupplierWorkOrders(ctx.supplierId);
  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 900 }}>
      <div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)", margin: 0 }}><RiFileListLine style={{ color: "var(--color-primary)" }} /> Συμβάσεις έργου</h1>
        <p style={{ margin: "4px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Οι αναθέσεις που προέκυψαν από προσφορές σας. Αποδεχθείτε, ορίστε ραντεβού, καταθέστε απόδειξη επισκευής.</p>
      </div>
      {items.length === 0 ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 32, textAlign: "center", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Καμία σύμβαση έργου ακόμη.</div>
      ) : items.map((w) => {
        const c = WO_STATUS_COLORS[w.status] ?? "#6b7280";
        const needs = w.status === "ACCEPTED" && !w.supplierAcceptedAt ? "Αποδεχθείτε την ανάθεση" : w.status === "ACCEPTED" ? "Ορίστε ραντεβού" : w.status === "SCHEDULED" ? "Ραντεβού " + fmt(w.scheduledAt) : w.status === "IN_PROGRESS" ? "Καταθέστε απόδειξη επισκευής" : w.status === "DISPUTED" ? "Αμφισβήτηση — δείτε το σχόλιο" : null;
        return (
          <Link key={w.id} href={`/marketplace/work-orders/${w.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", textDecoration: "none", background: "var(--card)", border: `1px solid ${needs ? c + "66" : "var(--border)"}`, borderRadius: "var(--radius-lg)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--foreground)" }}>{w.number} · {w.title}</div>
              <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{w.building} · {eur(w.supplierPrice)} + ΦΠΑ{needs ? ` · ${needs}` : ""}</div>
            </div>
            <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: "var(--fs-11-5)", fontWeight: 600, color: c, background: `${c}18`, border: `1px solid ${c}40`, whiteSpace: "nowrap" }}>{WO_STATUS_LABELS[w.status] ?? w.status}</span>
            <RiArrowRightSLine style={{ color: "var(--muted-foreground)" }} />
          </Link>
        );
      })}
    </div>
  );
}
