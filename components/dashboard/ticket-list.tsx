import { RiToolsLine } from "react-icons/ri";
import { StatusChip } from "./status-chip";
import { EmptyState } from "./empty-state";

export interface TicketItem {
  id: string; title: string; status: string; priority: string; createdAt: Date;
}
const PRIORITY_TONE: Record<string, "danger" | "warning" | "accent" | "neutral"> = {
  URGENT: "danger", HIGH: "warning", NORMAL: "accent", LOW: "neutral",
};
function ageLabel(d: Date): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return "σήμερα";
  if (days === 1) return "χθες";
  return `πριν ${days} μέρες`;
}

export function TicketList({ tickets }: { tickets: TicketItem[] }) {
  if (tickets.length === 0) return <EmptyState icon={RiToolsLine} label="Δεν υπάρχουν ανοιχτά αιτήματα" />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {tickets.map((t) => (
        <div key={t.id} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", background: "var(--bg-canvas)", borderRadius: 8,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {t.status === "IN_PROGRESS" ? "Σε εξέλιξη" : "Ανοιχτό"} · {ageLabel(t.createdAt)}
            </div>
          </div>
          <StatusChip tone={PRIORITY_TONE[t.priority] ?? "neutral"}>{t.priority}</StatusChip>
        </div>
      ))}
    </div>
  );
}
