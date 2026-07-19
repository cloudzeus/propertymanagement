"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RiCheckLine, RiDownload2Line, RiFileTextLine, RiMoneyEuroCircleLine } from "react-icons/ri";
import type { OccupantData } from "@/lib/building/occupant-data";
import { ModalShell } from "./Modal";

type ExpenseItem = OccupantData["expenses"][number];

const eur = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("el-GR") : "—");
const monthLabel = (m: string) => {
  const d = new Date(`${m}-01T12:00:00`);
  const s = new Intl.DateTimeFormat("el-GR", { month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 600, fontSize: 12, textAlign: "left" };
const td: React.CSSProperties = { padding: "9px 10px", verticalAlign: "middle" };
const money: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const badge: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 8px", borderRadius: 999, border: "1px solid", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" };

/** Read-only expenses of the selected month; row click opens the entry + receipt modal. */
export function ExpensesSection({ expenses, months, selectedMonth }: {
  expenses: OccupantData["expenses"];
  months: OccupantData["months"];
  selectedMonth: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [sel, setSel] = useState<ExpenseItem | null>(null);

  const onMonth = (m: string) => {
    const q = new URLSearchParams(search.toString());
    q.set("s", "expenses");
    q.set("month", m);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}>
          <RiMoneyEuroCircleLine /> Έξοδα {monthLabel(selectedMonth)} · {expenses.length}
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => onMonth(e.target.value)}
          aria-label="Μήνας εξόδων"
          style={{
            border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)",
            borderRadius: 6, padding: "6px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          {!months.includes(selectedMonth) && <option value={selectedMonth}>{monthLabel(selectedMonth)}</option>}
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {expenses.length === 0 ? (
        <div style={{ padding: 28, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, border: "1px dashed var(--border-strong)", borderRadius: 8 }}>
          Δεν υπάρχουν έξοδα για τον μήνα «{monthLabel(selectedMonth)}».
          {months.length > 1 && <div style={{ marginTop: 6, fontSize: 12.5 }}>Επιλέξτε άλλον μήνα από την επιλογή πάνω δεξιά.</div>}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--muted-foreground)", borderBottom: "1px solid var(--border-strong)" }}>
                <th style={th}>Ημ/νία</th>
                <th style={th}>Κατηγορία</th>
                <th style={th}>Προμηθευτής</th>
                <th style={th}>Παραστατικό</th>
                <th style={{ ...th, ...money }}>Ποσό</th>
                <th style={th}>Πληρωμή</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSel(e)}
                  title="Προβολή εξόδου & παραστατικού"
                  style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                >
                  <td style={td}>{fmtDate(e.documentDate)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{e.categoryName ?? "—"}</td>
                  <td style={td}>{e.supplierName ?? "—"}</td>
                  <td style={td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      {e.receipt && <RiFileTextLine style={{ color: "var(--muted-foreground)" }} title="Με συνημμένο παραστατικό" />}
                      {e.documentNumber ?? "—"}
                    </span>
                  </td>
                  <td style={{ ...td, ...money, fontWeight: 700 }}>{eur(e.amount)}</td>
                  <td style={td}>
                    {e.paid
                      ? <span style={{ ...badge, color: "var(--color-success)", borderColor: "var(--color-success)" }}><RiCheckLine /> Πληρωμένο</span>
                      : <span style={{ ...badge, color: "var(--muted-foreground)", borderColor: "var(--border-strong)" }}>Απλήρωτο</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ExpenseModal expense={sel} onClose={() => setSel(null)} />
    </div>
  );
}

function ExpenseModal({ expense, onClose }: { expense: ExpenseItem | null; onClose: () => void }) {
  const e = expense;
  return (
    <ModalShell
      open={!!e}
      onClose={onClose}
      ariaLabel="Λεπτομέρειες εξόδου"
      maxWidth={860}
      title={e ? `${e.categoryName ?? "Έξοδο"}${e.documentNumber ? ` · ${e.documentNumber}` : ""}` : ""}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {e?.receipt && (
            <a
              href={e.receipt.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "9px 15px",
                border: "1px solid var(--border-strong)", background: "var(--card)", color: "var(--foreground)",
                fontSize: 13, fontWeight: 700, textDecoration: "none",
              }}
            >
              <RiDownload2Line /> Λήψη
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 8, padding: "9px 18px", border: "none", background: "var(--color-primary)",
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            Κλείσιμο
          </button>
        </div>
      }
    >
      {e && (
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {/* entry fields */}
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "13px 16px" }}>
              <Field label="Μήνας κοινοχρήστων" value={monthLabel(e.issuedMonth ?? e.month)} />
              <Field label="Ημ/νία παραστατικού" value={fmtDate(e.documentDate)} />
              <Field label="Προμηθευτής" value={e.supplierName ?? "—"} />
              <Field label="Αρ. παραστατικού" value={e.documentNumber ?? "—"} />
              <Field label="Καθαρή αξία" value={eur(e.netAmount)} />
              <Field label="ΦΠΑ" value={eur(e.vatAmount)} />
              <Field label="Σύνολο" value={eur(e.amount)} strong />
              <Field label="Επιμερισμός" value={`Ένοικος ${e.tenantPct}% · Ιδιοκτήτης ${e.ownerPct}%`} />
              <Field
                label="Η αναλογία μου"
                value={`${eur(e.myShare)}${e.myTenant > 0 && e.myOwner > 0 ? ` (ενοίκου ${eur(e.myTenant)} · ιδιοκτήτη ${eur(e.myOwner)})` : ""}`}
                strong
              />
              <Field label="Πληρωμή προμηθευτή" value={e.paid ? "Πληρωμένο" : "Απλήρωτο"} />
            </div>
            {e.description && (
              <div style={{ marginTop: 13 }}>
                <Field label="Περιγραφή" value={e.description} />
              </div>
            )}
          </div>

          {/* receipt pane */}
          <div style={{ flex: "1.2 1 300px", minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".02em", marginBottom: 6 }}>
              Παραστατικό
            </div>
            {!e.receipt ? (
              <div style={{ padding: "34px 16px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, border: "1px dashed var(--border-strong)", borderRadius: 8 }}>
                <RiFileTextLine style={{ fontSize: 26, opacity: 0.35, display: "block", margin: "0 auto 6px" }} />
                Δεν έχει επισυναφθεί παραστατικό.
              </div>
            ) : e.receipt.mimeType?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.receipt.url}
                alt={e.receipt.name}
                style={{ width: "100%", maxHeight: 520, objectFit: "contain", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-canvas)" }}
              />
            ) : e.receipt.mimeType === "application/pdf" ? (
              <iframe
                src={e.receipt.url}
                title={e.receipt.name}
                style={{ width: "100%", height: 480, border: "1px solid var(--border)", borderRadius: 8, background: "#fff" }}
              />
            ) : (
              <a
                href={e.receipt.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                  background: "var(--bg-canvas)", borderRadius: 8, textDecoration: "none",
                  color: "var(--foreground)", fontSize: 13, fontWeight: 600, border: "1px solid var(--border)",
                }}
              >
                <RiDownload2Line style={{ color: "var(--muted-foreground)" }} /> {e.receipt.name}
              </a>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".02em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: strong ? 700 : 500, fontVariantNumeric: "tabular-nums", color: "var(--foreground)", overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}
