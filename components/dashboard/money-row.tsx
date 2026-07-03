import { formatEuro } from "@/lib/dashboard/aggregations";
import { StatusChip } from "./status-chip";

export function MoneyRow({
  title, subtitle, amount, paid,
}: { title: string; subtitle?: string; amount: number; paid: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 14px", background: "var(--bg-canvas)", borderRadius: 8,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{subtitle}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{formatEuro(amount)}</span>
        <StatusChip tone={paid ? "success" : "warning"}>{paid ? "Πληρωμένο" : "Οφειλή"}</StatusChip>
      </div>
    </div>
  );
}
