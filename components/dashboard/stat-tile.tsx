import type { ReactNode } from "react";
import Link from "next/link";
import type { IconType } from "react-icons";

export function StatTile({
  label, value, sub, icon: Icon, href, tone = "var(--color-accent)", trend, children,
}: {
  label: string; value: ReactNode; sub?: string; icon: IconType; href?: string;
  tone?: string; trend?: { dir: "up" | "down"; pct: number }; children?: ReactNode;
}) {
  const inner = (
    <div style={{
      position: "relative", background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: "20px 22px",
      display: "flex", flexDirection: "column", gap: 8, overflow: "hidden", height: "100%",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: tone }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 500 }}>{label}</span>
        <Icon style={{ fontSize: 20, color: tone }} />
      </div>
      <span style={{ fontSize: 30, fontWeight: 700, color: "var(--foreground)", lineHeight: 1,
        fontFamily: "var(--font-display)" }}>{value}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {sub && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{sub}</span>}
        {trend && (
          <span style={{ fontSize: 11, fontWeight: 600,
            color: trend.dir === "up" ? "var(--color-success)" : "var(--color-danger)" }}>
            {trend.dir === "up" ? "▲" : "▼"} {trend.pct}%
          </span>
        )}
      </div>
      {children}
    </div>
  );
  return href ? (
    <Link href={href} className="dash-tile" style={{ textDecoration: "none" }}>{inner}</Link>
  ) : <div className="dash-tile">{inner}</div>;
}
