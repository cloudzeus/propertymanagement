"use client";

import { useState } from "react";
import { RiDashboardLine, RiMapPin2Line } from "react-icons/ri";

/**
 * Wraps a dashboard: the existing content (children) becomes the "Επισκόπηση" tab,
 * and `map` is shown under a "Χάρτης" tab. The map mounts only when its tab is
 * active (MapLibre needs a sized container).
 */
export function DashboardTabs({ map, children }: { map: React.ReactNode; children: React.ReactNode }) {
  const [tab, setTab] = useState<"overview" | "map">("overview");

  const tabBtn = (active: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
    fontSize: 13, fontWeight: 600, cursor: "pointer", background: "transparent", border: "none",
    color: active ? "var(--foreground)" : "var(--muted-foreground)",
    borderBottom: active ? "2px solid var(--color-primary)" : "2px solid transparent",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => setTab("overview")} style={tabBtn(tab === "overview")}>
          <RiDashboardLine /> Επισκόπηση
        </button>
        <button onClick={() => setTab("map")} style={tabBtn(tab === "map")}>
          <RiMapPin2Line /> Χάρτης
        </button>
      </div>

      <div style={{ display: tab === "overview" ? "block" : "none" }}>{children}</div>
      {tab === "map" && <div>{map}</div>}
    </div>
  );
}
