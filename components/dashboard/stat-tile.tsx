import type { ReactNode } from "react";
import Link from "next/link";
import type { IconType } from "react-icons";

/**
 * Inspiration-matched stat card: small muted label top-left, big LIGHT-weight
 * number, black circular icon badge top-right. Monochrome by design — colour is
 * reserved for status text and the amber Gauge accent elsewhere.
 */
export function StatTile({
  label, value, sub, icon: Icon, href, valueColor = "var(--foreground)", children,
}: {
  label: string; value: ReactNode; sub?: string; icon: IconType; href?: string;
  valueColor?: string; children?: ReactNode;
}) {
  const inner = (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 18, boxShadow: "var(--shadow-card)", padding: "22px 24px",
      display: "flex", flexDirection: "column", gap: 16, height: "100%", minHeight: 132,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 500 }}>{label}</span>
        <span style={{
          width: 34, height: 34, borderRadius: 999, background: "var(--color-primary)",
          display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon style={{ fontSize: 16, color: "#fff" }} />
        </span>
      </div>
      <div style={{ marginTop: "auto" }}>
        <div style={{ fontSize: 36, fontWeight: 300, color: valueColor, lineHeight: 1.05, letterSpacing: "-0.02em" }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 8 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
  return href ? (
    <Link href={href} className="dash-tile" style={{ textDecoration: "none" }}>{inner}</Link>
  ) : <div className="dash-tile">{inner}</div>;
}
