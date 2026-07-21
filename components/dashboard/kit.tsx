import Link from "next/link";
import type { IconType } from "react-icons";
import {
  RiArrowUpLine,
  RiArrowDownLine,
  RiToolsLine,
  RiAlarmWarningLine,
  RiUserStarLine,
  RiUserLine,
} from "react-icons/ri";
import { formatEuro, type TrendPoint } from "@/lib/dashboard/aggregations";
import type { ManagedFaultsSummary } from "@/lib/dashboard/platform";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS } from "@/lib/maintenance-shared";

const MONTH_SHORT = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μαϊ", "Ιουν", "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ"];

function monthLabel(key: string): string {
  const m = Number(key.split("-")[1]);
  return MONTH_SHORT[m - 1] ?? key;
}

/** A single KPI card. Optionally a link, an accent color, and a delta badge. */
export function KpiCard({
  label,
  value,
  sub,
  subColor,
  icon: Icon,
  href,
  accent = "var(--color-primary)",
  delta,
}: {
  label: string;
  value: string | number;
  sub?: string;
  subColor?: string;
  icon: IconType;
  href?: string;
  accent?: string;
  delta?: number | null;
}) {
  const body = (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 500 }}>{label}</span>
        <Icon style={{ fontSize: 20, color: accent, opacity: 0.85 }} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}>{value}</span>
        {delta !== undefined && delta !== null && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              fontSize: 12,
              fontWeight: 700,
              color: delta >= 0 ? "var(--color-success)" : "var(--color-warning)",
            }}
          >
            {delta >= 0 ? <RiArrowUpLine /> : <RiArrowDownLine />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {sub && <span style={{ fontSize: 12, color: subColor || "var(--muted-foreground)" }}>{sub}</span>}
    </>
  );

  const style: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    borderTop: `2px solid ${accent}`,
    padding: "18px 22px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    textDecoration: "none",
  };

  return href ? (
    <Link href={href} style={style}>
      {body}
    </Link>
  ) : (
    <div style={style}>{body}</div>
  );
}

/** Panel wrapper with a header + optional "view all" link. */
export function Panel({
  title,
  href,
  hrefLabel = "Όλα",
  children,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{title}</h2>
        {href && (
          <Link href={href} style={{ fontSize: 12, color: "var(--color-primary)", textDecoration: "none" }}>
            {hrefLabel} →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

/** Simple CSS bar chart for a monthly revenue trend. */
export function RevenueBars({ trend, accent = "var(--color-primary)" }: { trend: TrendPoint[]; accent?: string }) {
  const max = Math.max(1, ...trend.map((t) => t.value));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 140, paddingTop: 8 }}>
      {trend.map((t) => {
        const h = Math.round((t.value / max) * 100);
        return (
          <div key={t.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%" }}>
            <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              <div
                title={formatEuro(t.value)}
                style={{
                  width: "70%",
                  minWidth: 18,
                  height: `${Math.max(h, 2)}%`,
                  background: `linear-gradient(180deg, ${accent}, ${accent}99)`,
                  borderRadius: "4px 4px 0 0",
                }}
              />
            </div>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{monthLabel(t.month)}</span>
            <span style={{ fontSize: 10, color: "var(--muted-foreground)", opacity: 0.7 }}>
              {t.value >= 1000 ? `€${(t.value / 1000).toFixed(1)}k` : `€${Math.round(t.value)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  background: "var(--bg-canvas)",
  borderRadius: 6,
};

/** Small labelled stat tile used inside panels. */
export function MiniStat({ label, value, icon: Icon, color }: { label: string; value: number; icon: IconType; color: string }) {
  return (
    <div style={{ background: "var(--bg-canvas)", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{label}</span>
        <Icon style={{ fontSize: 16, color, opacity: 0.9 }} />
      </div>
      <span style={{ fontSize: 22, fontWeight: 700, color: value > 0 ? color : "var(--foreground)", lineHeight: 1 }}>{value}</span>
    </div>
  );
}

/** Centered empty-state block. */
export function EmptyState({ icon: Icon, text }: { icon: IconType; text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 0", color: "var(--muted-foreground)", gap: 8 }}>
      <Icon style={{ fontSize: 30, opacity: 0.4 }} />
      <span style={{ fontSize: 13 }}>{text}</span>
    </div>
  );
}

/**
 * Shared panel for maintenance faults on managed buildings, with a 5-tile
 * summary (split by reporter role) and a recent-faults list.
 */
export function ManagedFaultsPanel({
  summary,
  detailBase = "/admin/maintenance",
  allHref = "/admin/maintenance",
  title = "Βλάβες σε managed ακίνητα",
}: {
  summary: ManagedFaultsSummary;
  detailBase?: string;
  allHref?: string;
  title?: string;
}) {
  return (
    <Panel title={title} href={allHref} hrefLabel="Όλες οι βλάβες">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
        <MiniStat label="Ενεργές" value={summary.open} icon={RiToolsLine} color="var(--color-primary)" />
        <MiniStat label="Επείγουσες" value={summary.urgent} icon={RiAlarmWarningLine} color="var(--color-warning)" />
        <MiniStat label="Σε καθυστέρηση SLA" value={summary.slaBreached} icon={RiAlarmWarningLine} color="#d13438" />
        <MiniStat label="Από διαχειριστές" value={summary.byManager} icon={RiUserStarLine} color="#0078D4" />
        <MiniStat label="Από ενοίκους" value={summary.byOccupant} icon={RiUserLine} color="#8764B8" />
      </div>
      {summary.recent.length === 0 ? (
        <EmptyState icon={RiToolsLine} text="Δεν υπάρχουν ενεργές βλάβες σε managed ακίνητα" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {summary.recent.map((f) => (
            <Link key={f.id} href={`${detailBase}/${f.id}`} style={{ ...rowStyle, textDecoration: "none" }}>
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  {f.buildingName}
                  {f.reporterName ? ` · ${f.reporterName}` : ""} ·{" "}
                  <span style={{ color: f.reporterSide === "manager" ? "#0078D4" : "#8764B8" }}>
                    {f.reporterSide === "manager" ? "διαχειριστής" : "ένοικος"}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                {f.slaBreached && <Pill label="SLA" color="#d13438" />}
                {(f.priority === "URGENT" || f.priority === "HIGH") && (
                  <Pill label={PRIORITY_LABELS[f.priority as "HIGH" | "URGENT"]} color="var(--color-warning)" />
                )}
                <Pill
                  label={STATUS_LABELS[f.status as keyof typeof STATUS_LABELS] ?? f.status}
                  color={STATUS_COLORS[f.status as keyof typeof STATUS_COLORS] ?? "var(--muted-foreground)"}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** A colored pill/badge. */
export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 9999,
        background: `${color}18`,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
