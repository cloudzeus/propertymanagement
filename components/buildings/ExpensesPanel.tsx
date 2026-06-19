"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiMoneyEuroCircleLine, RiFileTextLine, RiDeleteBinLine } from "react-icons/ri";
import { ExpenseOcrUpload } from "./ExpenseOcrUpload";
import { type CategorySplit } from "./ExpenseReviewForm";
import { deleteBuildingExpense } from "@/app/actions/building-expenses";

export type ExpenseRow = {
  id: string;
  documentDate: string | null;
  supplierName: string | null;
  categoryName: string | null;
  netAmount: number | null;
  vatAmount: number | null;
  amount: number;
  status: string;
  receiptUrl: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Πρόχειρο",
  CONFIRMED: "Επιβεβαιωμένο",
  ALLOCATED: "Επιμερισμένο",
  BILLED: "Χρεωμένο",
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("el-GR");
  } catch {
    return "—";
  }
}
function eur(n: number | null) {
  return n == null ? "—" : `${Number(n).toFixed(2)} €`;
}

export function ExpensesPanel({
  buildingId, expenses, categories,
}: {
  buildingId: string;
  expenses: ExpenseRow[];
  categories: CategorySplit[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove(id: string) {
    if (!confirm("Διαγραφή εξόδου;")) return;
    startTransition(async () => {
      await deleteBuildingExpense(id);
      router.refresh();
    });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}>
          <RiMoneyEuroCircleLine /> Έξοδα · {expenses.length}
        </div>
        <ExpenseOcrUpload buildingId={buildingId} categories={categories} />
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Ημ/νία</th>
              <th style={th}>Προμηθευτής</th>
              <th style={th}>Κατηγορία</th>
              <th style={{ ...th, textAlign: "right" }}>Καθαρό</th>
              <th style={{ ...th, textAlign: "right" }}>ΦΠΑ</th>
              <th style={{ ...th, textAlign: "right" }}>Σύνολο</th>
              <th style={th}>Κατάσταση</th>
              <th style={th}>Παραστατικό</th>
              <th style={{ ...th, textAlign: "right" }}>Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ ...td, textAlign: "center", color: "var(--muted-foreground)" }}>
                  Δεν υπάρχουν έξοδα ακόμα
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id}>
                  <td style={td}>{fmtDate(e.documentDate)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{e.supplierName ?? "—"}</td>
                  <td style={td}>{e.categoryName ?? "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{eur(e.netAmount)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{eur(e.vatAmount)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{eur(e.amount)}</td>
                  <td style={td}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: "var(--bg-canvas)", color: "var(--muted-foreground)", border: "1px solid var(--border)",
                    }}>
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </td>
                  <td style={td}>
                    {e.receiptUrl ? (
                      <a href={e.receiptUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--color-primary)", textDecoration: "none", fontSize: 13 }}>
                        <RiFileTextLine /> Άνοιγμα
                      </a>
                    ) : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button
                      onClick={() => remove(e.id)}
                      disabled={isPending}
                      title="Διαγραφή"
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-canvas)", cursor: "pointer", color: "var(--color-danger)" }}
                    >
                      <RiDeleteBinLine style={{ fontSize: 15 }} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", padding: "10px 14px", borderBottom: "1px solid var(--border)" };
const td: React.CSSProperties = { fontSize: 13, color: "var(--foreground)", padding: "12px 14px", borderBottom: "1px solid var(--border)" };
