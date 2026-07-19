"use client";

import { useState } from "react";
import { RiArrowDownSLine, RiArrowRightSLine, RiDownload2Line, RiFileTextLine, RiMoneyEuroCircleLine } from "react-icons/ri";
import type { OccupantData } from "@/lib/building/occupant-data";
import { StatusChip } from "@/components/dashboard";
import { ModalShell } from "./Modal";

type ExpenseMonth = OccupantData["expensesByMonth"][number];
type ExpenseItem = ExpenseMonth["items"][number];

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

/** Read-only building-expenses ledger: every month is an expandable row (with its
 * total) that opens to that month's detail rows; row click opens the receipt modal. */
export function ExpensesSection({ expensesByMonth }: {
  expensesByMonth: OccupantData["expensesByMonth"];
}) {
  const [sel, setSel] = useState<ExpenseItem | null>(null);
  // First (latest) month open by default.
  const [open, setOpen] = useState<Set<string>>(() => new Set(expensesByMonth.slice(0, 1).map((m) => m.month)));

  const totalCount = expensesByMonth.reduce((s, m) => s + m.count, 0);
  const toggle = (m: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <RiMoneyEuroCircleLine /> Έξοδα κτηρίου · {totalCount}
      </div>

      {expensesByMonth.length === 0 ? (
        <div style={{ padding: 28, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, border: "1px dashed var(--border-strong)", borderRadius: 8 }}>
          Δεν έχουν καταχωρηθεί έξοδα.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {expensesByMonth.map((block) => {
            const isOpen = open.has(block.month);
            return (
              <div key={block.month} style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => toggle(block.month)}
                  aria-expanded={isOpen}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 48,
                    padding: "12px 14px", border: "none", cursor: "pointer", textAlign: "left",
                    background: isOpen ? "var(--bg-canvas)" : "var(--card)", color: "var(--foreground)",
                  }}
                >
                  {isOpen ? <RiArrowDownSLine style={{ fontSize: 18, color: "var(--muted-foreground)", flexShrink: 0 }} /> : <RiArrowRightSLine style={{ fontSize: 18, color: "var(--muted-foreground)", flexShrink: 0 }} />}
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{monthLabel(block.month)}</span>
                  <span style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
                    {block.count} {block.count === 1 ? "έξοδο" : "έξοδα"}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {eur(block.total)}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ overflowX: "auto", borderTop: "1px solid var(--border)" }}>
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
                        {block.items.map((e) => (
                          <tr
                            key={e.id}
                            className="occ-expense-row"
                            role="button"
                            tabIndex={0}
                            onClick={() => setSel(e)}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setSel(e); }
                            }}
                            aria-label={`Προβολή εξόδου${e.categoryName ? `: ${e.categoryName}` : ""} ${eur(e.amount)}`}
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
                              <StatusChip tone={e.paid ? "success" : "neutral"}>{e.paid ? "Πληρωμένο" : "Απλήρωτο"}</StatusChip>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
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
