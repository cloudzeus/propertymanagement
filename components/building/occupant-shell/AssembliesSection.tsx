"use client";

import { useState } from "react";
import { RiFileList3Line, RiGroupLine } from "react-icons/ri";
import type { OccupantData } from "@/lib/building/occupant-data";
import { StatusChip } from "@/components/dashboard";
import { ModalShell } from "./Modal";

type Assembly = OccupantData["assemblies"][number];
type Tone = "success" | "warning" | "danger" | "neutral" | "accent" | "info";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  SCHEDULED: { label: "Προγραμματισμένη", tone: "info" },
  LIVE: { label: "Σε εξέλιξη", tone: "accent" },
  ENDED: { label: "Ολοκληρώθηκε", tone: "neutral" },
  TRANSCRIBING: { label: "Επεξεργασία πρακτικών", tone: "neutral" },
  DRAFT_READY: { label: "Πρακτικά υπό έγκριση", tone: "warning" },
  APPROVED: { label: "Πρακτικά εγκεκριμένα", tone: "success" },
  SENT: { label: "Πρακτικά απεσταλμένα", tone: "success" },
  CANCELLED: { label: "Ακυρώθηκε", tone: "danger" },
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 600, fontSize: 12, textAlign: "left" };
const td: React.CSSProperties = { padding: "10px 10px", verticalAlign: "middle" };

/** Assembly history with status badges; approved/sent minutes open in the decisions modal. */
export function AssembliesSection({ assemblies }: { assemblies: OccupantData["assemblies"] }) {
  const [sel, setSel] = useState<Assembly | null>(null);

  if (assemblies.length === 0) {
    return (
      <div style={{ background: "var(--card)", border: "1px dashed var(--border-strong)", borderRadius: 12, padding: "36px 20px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
        <RiGroupLine style={{ fontSize: 30, opacity: 0.35, display: "block", margin: "0 auto 8px" }} />
        Δεν έχουν προγραμματιστεί συνελεύσεις για το κτήριο.
        <div style={{ marginTop: 6, fontSize: 12.5 }}>Όταν οριστεί γενική συνέλευση, θα εμφανιστεί εδώ μαζί με τις αποφάσεις της.</div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <RiGroupLine /> Γενικές συνελεύσεις · {assemblies.length}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--muted-foreground)", borderBottom: "1px solid var(--border-strong)" }}>
              <th style={th}>Ημερομηνία</th>
              <th style={th}>Τίτλος</th>
              <th style={th}>Κατάσταση</th>
              <th style={{ ...th, textAlign: "right" }}>Αποφάσεις</th>
            </tr>
          </thead>
          <tbody>
            {assemblies.map((a) => {
              const st = STATUS[a.status] ?? { label: a.status, tone: "neutral" as Tone };
              return (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmtDateTime(a.scheduledAt)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{a.title}</td>
                  <td style={td}><StatusChip tone={st.tone}>{st.label}</StatusChip></td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {a.minutesFinal ? (
                      <button
                        type="button"
                        onClick={() => setSel(a)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 6, padding: "6px 12px",
                          border: "1px solid var(--border-strong)", background: "var(--card)", color: "var(--foreground)",
                          fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        <RiFileList3Line /> Αποφάσεις
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ModalShell
        open={!!sel}
        onClose={() => setSel(null)}
        ariaLabel="Αποφάσεις συνέλευσης"
        maxWidth={720}
        title={sel ? `Αποφάσεις · ${sel.title}` : ""}
      >
        {sel && (
          <>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>
              {fmtDateTime(sel.scheduledAt)}
              {sel.approvedAt && ` · Εγκρίθηκαν ${new Date(sel.approvedAt).toLocaleDateString("el-GR")}`}
            </div>
            <div
              style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--foreground)" }}
              dangerouslySetInnerHTML={{ __html: sel.minutesFinal ?? "" }}
            />
          </>
        )}
      </ModalShell>
    </div>
  );
}
