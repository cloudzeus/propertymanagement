"use client";

import {
  RiBankCardLine, RiToolsLine, RiCalendarTodoLine, RiMegaphoneLine,
  RiAlarmWarningLine, RiMoneyEuroCircleLine, RiUploadCloud2Line, RiContactsBook3Line,
} from "react-icons/ri";
import { Gauge } from "@/components/dashboard";
import type { BuildingDashboardData } from "@/lib/building/dashboard-data";
import type { BuildingCaps } from "@/lib/building-caps";
import type { SectionKey } from "./sections";

type Building = BuildingDashboardData["building"];
type OverviewData = BuildingDashboardData["overview"];

const PRIORITY: Record<string, { label: string; color: string }> = {
  URGENT: { label: "Επείγον", color: "#c50f1f" }, HIGH: { label: "Υψηλή", color: "#CA5D00" },
  NORMAL: { label: "Κανονική", color: "#0078D4" }, LOW: { label: "Χαμηλή", color: "#707070" },
};
const REQ_STATUS: Record<string, string> = { OPEN: "Ανοιχτό", IN_PROGRESS: "Σε εξέλιξη" };

function eur(n: number): string {
  return n.toLocaleString("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}
function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("el-GR", { day: "2-digit", month: "short" });
}

export function ManagerOverview({ building, data, can, onNavigate }: {
  building: Building;
  data: OverviewData;
  can: BuildingCaps;
  onNavigate: (s: SectionKey, t?: string) => void;
}) {
  const total = data.paid + data.unpaid;
  const pct = total > 0 ? Math.round((data.paid / total) * 100) : 0;

  const quickActions: { label: string; icon: React.ElementType; show: boolean; go: [SectionKey, string] }[] = [
    { label: "Νέα ανακοίνωση", icon: RiMegaphoneLine, show: can.manageAnnouncements, go: ["communication", "ann"] },
    { label: "Αίτημα βλάβης", icon: RiAlarmWarningLine, show: can.createRequests, go: ["maintenance", "maint"] },
    { label: "Νέο έξοδο", icon: RiMoneyEuroCircleLine, show: can.manageExpenses, go: ["finance", "expenses"] },
    { label: "Ανέβασμα αρχείου", icon: RiUploadCloud2Line, show: can.manageFiles, go: ["communication", "files"] },
    { label: "Νέα επαφή", icon: RiContactsBook3Line, show: can.manageContacts, go: ["people", "contacts"] },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Collections */}
      <Card title="Εξοφλημένα / Ανεξόφλητα (κοινόχρηστα)">
        {total === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>Δεν υπάρχουν κατανομές κοινοχρήστων ακόμη.</p>
        ) : (
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <Gauge value={data.paid} max={total} big={`${pct}%`} unit="εισπράχθηκαν" />
            <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <Stat label="Εξοφλημένα" value={eur(data.paid)} color="#107C10" />
                <Stat label="Ανεξόφλητα" value={eur(data.unpaid)} color="#c50f1f" />
                <Stat label="Ποσοστό είσπραξης" value={`${pct}%`} color="#0078D4" />
              </div>
              <div style={{ height: 14, borderRadius: 9999, overflow: "hidden", display: "flex", background: "#c50f1f22" }}>
                <div style={{ width: `${pct}%`, background: "#107C10" }} />
                <div style={{ flex: 1, background: "#c50f1f" }} />
              </div>
              <div>
                <button onClick={() => onNavigate("finance", "koino")} style={{ ...btn, ...btnPrimary }}><RiBankCardLine /> Πληρωμές</button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Open maintenance requests */}
        <Card title={`Ανοιχτά αιτήματα συντήρησης${data.openCount ? ` (${data.openCount})` : ""}`}>
          {data.openRequests.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>Δεν υπάρχουν ανοιχτά αιτήματα.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.openRequests.map((r) => {
                const p = PRIORITY[r.priority] ?? PRIORITY.NORMAL;
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8 }}>
                    <RiToolsLine style={{ color: p.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{REQ_STATUS[r.status] ?? r.status} · {fmtDay(r.createdAt)}</div>
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: `${p.color}18`, color: p.color }}>{p.label}</span>
                  </div>
                );
              })}
              <button onClick={() => onNavigate("maintenance", "maint")} style={btn}><RiToolsLine /> Όλα τα αιτήματα</button>
            </div>
          )}
        </Card>

        {/* Upcoming maintenance */}
        <Card title="Επερχόμενες συντηρήσεις">
          {data.upcomingTasks.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>Δεν υπάρχουν προγραμματισμένες εργασίες.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.upcomingTasks.map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8 }}>
                  <RiCalendarTodoLine style={{ color: "var(--color-primary)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                  <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)" }}>{fmtDay(t.nextDueDate)}</span>
                </div>
              ))}
              <button onClick={() => onNavigate("maintenance", "calendar")} style={btn}><RiCalendarTodoLine /> Ημερολόγιο</button>
            </div>
          )}
        </Card>
      </div>

      {/* Quick actions */}
      {quickActions.some((a) => a.show) && (
        <Card title="Γρήγορες ενέργειες">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {quickActions.filter((a) => a.show).map((a) => {
              const Icon = a.icon;
              return (
                <button key={a.label} onClick={() => onNavigate(a.go[0], a.go[1])} style={btn}>
                  <Icon /> {a.label}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)" }}>
        Πελάτης: <b style={{ color: "var(--foreground)" }}>{building.customerName}</b> · Ιδιοκτησία:{" "}
        <b style={{ color: "var(--foreground)" }}>{building.propertyName}</b>
      </p>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{title}</div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

const btn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid var(--border)",
  background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: "7px 13px",
  fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none",
};
const btnPrimary: React.CSSProperties = { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
