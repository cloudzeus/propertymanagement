"use client";

import { RiCalendarTodoLine, RiFileTextLine, RiHistoryLine } from "react-icons/ri";
import type { OccupantData } from "@/lib/building/occupant-data";
import { StatusChip } from "@/components/dashboard";

const FREQ_LABEL: Record<string, string> = {
  WEEKLY: "Εβδομαδιαία", MONTHLY: "Μηνιαία", QUARTERLY: "Τριμηνιαία",
  SEMIANNUAL: "Εξαμηνιαία", ANNUAL: "Ετήσια", CUSTOM: "Προσαρμοσμένη",
};
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("el-GR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

const card: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: 18,
};
const blockHead: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800, color: "var(--foreground)", marginBottom: 12,
};
const rowBox: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
  padding: "11px 13px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-canvas)", flexWrap: "wrap",
};
const emptyInline: React.CSSProperties = { fontSize: 13, color: "var(--muted-foreground)", padding: "6px 2px" };

/** Read-only maintenance: upcoming recurring tasks + the completed-work history. */
export function MaintenanceSection({ tasks, maintenanceHistory }: {
  tasks: OccupantData["tasks"];
  maintenanceHistory: OccupantData["maintenanceHistory"];
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
      {/* upcoming */}
      <div style={card}>
        <div style={blockHead}><RiCalendarTodoLine style={{ color: "var(--color-primary)" }} /> Επερχόμενες συντηρήσεις</div>
        {tasks.length === 0 ? (
          <div style={emptyInline}>Δεν υπάρχουν προγραμματισμένες συντηρήσεις.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tasks.map((t) => (
              <div key={t.id} style={rowBox}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--foreground)" }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                    {[FREQ_LABEL[t.frequency] ?? t.frequency, t.vendor].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtDate(t.nextDueDate)}</span>
                  <StatusChip tone="info">{FREQ_LABEL[t.frequency] ?? t.frequency}</StatusChip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* history */}
      <div style={card}>
        <div style={blockHead}><RiHistoryLine style={{ color: "var(--color-primary)" }} /> Ιστορικό συντηρήσεων</div>
        {maintenanceHistory.length === 0 ? (
          <div style={emptyInline}>Δεν υπάρχει καταγεγραμμένο ιστορικό συντηρήσεων ακόμη.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {maintenanceHistory.map((l) => (
              <div key={l.id} style={{ ...rowBox, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--foreground)" }}>{l.taskTitle}</div>
                  {l.notes && <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 3, lineHeight: 1.5 }}>{l.notes}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
                  <span style={{ fontSize: 12.5, color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtDate(l.performedAt)}</span>
                  {l.certificateUrl && (
                    <a href={l.certificateUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: "var(--color-primary)", textDecoration: "none", whiteSpace: "nowrap" }}>
                      <RiFileTextLine /> Πιστοποιητικό
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
