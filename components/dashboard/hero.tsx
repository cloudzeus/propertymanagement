import type { ReactNode } from "react";

export function Hero({ title, subtitle, aside }: { title: ReactNode; subtitle?: string; aside?: ReactNode }) {
  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--border)", boxShadow: "var(--shadow-card)",
      background: "var(--card)",
      padding: "24px 28px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20,
    }}>
      <div style={{ minWidth: 0, flex: "1 1 240px" }}>
        <h1 style={{ fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: "var(--fs-14)", color: "var(--muted-foreground)", marginTop: 6 }}>{subtitle}</p>}
      </div>
      {aside && <div style={{ flexShrink: 0 }}>{aside}</div>}
    </div>
  );
}
