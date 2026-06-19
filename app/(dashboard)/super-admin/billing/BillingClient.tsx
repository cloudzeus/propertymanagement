"use client";

import { DataTable, type ColDef } from "@/components/ui/data-table";
import { RiFileList3Line } from "react-icons/ri";

const STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Εκκρεμεί", color: "#CA5D00" },
  PAID: { label: "Εξοφλημένο", color: "#107C10" },
  OVERDUE: { label: "Ληξιπρόθεσμο", color: "#A4262C" },
  CANCELLED: { label: "Ακυρωμένο", color: "#707070" },
};

export type InvoiceRow = {
  id: string;
  customerName: string;
  period: string;
  amount: number;
  status: string;
  issuedAt: string;
  dueDate: string | null;
  paidAt: string | null;
};

export function BillingClient({ rows, stats }: {
  rows: InvoiceRow[];
  stats: { total: number; paid: number; pending: number; totalAmount: number; pendingAmount: number };
}) {
  const columns: ColDef<InvoiceRow>[] = [
    {
      id: "customer", header: "Πελάτης", sortKey: "customerName", width: 240,
      accessor: (r) => r.customerName,
      cell: (r) => <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{r.customerName}</span>,
    },
    {
      id: "period", header: "Περίοδος", sortKey: "period", width: 110,
      accessor: (r) => r.period,
      cell: (r) => <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{r.period}</span>,
    },
    {
      id: "amount", header: "Ποσό (€)", sortKey: "amount", width: 120,
      accessor: (r) => r.amount,
      cell: (r) => <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>€ {r.amount.toFixed(2)}</span>,
    },
    {
      id: "status", header: "Κατάσταση", sortKey: "status", width: 130,
      accessor: (r) => STATUS[r.status]?.label ?? r.status,
      cell: (r) => {
        const s = STATUS[r.status] ?? { label: r.status, color: "#707070" };
        return <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: `${s.color}18`, color: s.color }}>{s.label}</span>;
      },
    },
    {
      id: "issuedAt", header: "Έκδοση", sortKey: "issuedAt", width: 120,
      accessor: (r) => r.issuedAt,
      cell: (r) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{r.issuedAt ? new Date(r.issuedAt).toLocaleDateString("el-GR") : "—"}</span>,
    },
    {
      id: "dueDate", header: "Λήξη", sortKey: "dueDate", width: 120, defaultVisible: false,
      accessor: (r) => r.dueDate ?? "",
      cell: (r) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{r.dueDate ? new Date(r.dueDate).toLocaleDateString("el-GR") : "—"}</span>,
    },
  ];

  const cards = [
    { label: "Σύνολο τιμολογίων", value: String(stats.total), color: "#0078D4" },
    { label: "Εξοφλημένα", value: String(stats.paid), color: "#107C10" },
    { label: "Εκκρεμή", value: String(stats.pending), color: "#CA5D00" },
    { label: "Εκκρεμές ποσό", value: `€ ${stats.pendingAmount.toFixed(2)}`, color: "#A4262C" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Τιμολόγηση</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
          Μηνιαία τιμολόγια υπηρεσιών προς τους πελάτες
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "18px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500, marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "48px 24px", textAlign: "center", color: "var(--muted-foreground)" }}>
          <RiFileList3Line style={{ fontSize: 40, opacity: 0.4, display: "block", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: "0 0 6px" }}>Δεν υπάρχουν τιμολόγια ακόμη</p>
          <p style={{ fontSize: 13, margin: 0, maxWidth: 460, marginInline: "auto", lineHeight: 1.5 }}>
            Τα μηνιαία τιμολόγια θα παράγονται αυτόματα από το πακέτο υπηρεσιών κάθε ιδιοκτησίας
            (CORE + modules × αριθμός μονάδων/κτηρίων/κοιν. χώρων). Η αυτόματη παραγωγή θα ενεργοποιηθεί
            σε επόμενο βήμα.
          </p>
        </div>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          totalRows={rows.length}
          page={1}
          pageSize={25}
          clientSide
          storageKey="super-admin-billing"
          searchPlaceholder="Αναζήτηση πελάτη/περιόδου…"
        />
      )}
    </div>
  );
}
