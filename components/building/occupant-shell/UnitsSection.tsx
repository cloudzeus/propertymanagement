"use client";

import { RiHome3Line } from "react-icons/ri";
import type { OccupantData } from "@/lib/building/occupant-data";
import { EmptyState } from "@/components/dashboard";

const UNIT_TYPE: Record<string, string> = {
  APARTMENT: "Διαμέρισμα", SHOP: "Κατάστημα", PARKING: "Θέση στάθμευσης", OTHER: "Χώρος",
};
const floorLabel = (f: number | null) => (f == null ? "—" : f === 0 ? "Ισόγειο" : f < 0 ? "Υπόγειο" : `${f}ος`);
const num = (n: number | null, suffix = "") =>
  n == null ? "—" : `${n.toLocaleString("el-GR", { maximumFractionDigits: 2 })}${suffix}`;

const th: React.CSSProperties = {
  textAlign: "left", padding: "10px 12px", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: ".03em", color: "var(--muted-foreground)", whiteSpace: "nowrap", borderBottom: "1px solid var(--border)",
};
const td: React.CSSProperties = {
  padding: "11px 12px", fontSize: 13, color: "var(--foreground)", borderBottom: "1px solid var(--border)", verticalAlign: "middle",
};
const tdNum: React.CSSProperties = { ...td, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

/** Read-only directory of every unit in the building; the viewer's own units are highlighted. */
export function UnitsSection({ units, myUnitIds }: {
  units: OccupantData["units"];
  myUnitIds: string[];
}) {
  if (units.length === 0) {
    return <EmptyState icon={RiHome3Line} label="Δεν έχουν καταχωρηθεί μονάδες για το κτήριο." />;
  }
  const mine = new Set(myUnitIds);

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr>
              <th style={th}>Διαμέρισμα</th>
              <th style={th}>Όροφος</th>
              <th style={{ ...th, textAlign: "right" }}>Τ.μ.</th>
              <th style={{ ...th, textAlign: "right" }}>Χιλιοστά</th>
              <th style={th}>Ιδιοκτήτης</th>
              <th style={th}>Ένοικος</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => {
              const isMine = mine.has(u.id);
              return (
                <tr key={u.id} style={isMine ? { background: "color-mix(in srgb, var(--color-primary) 6%, transparent)" } : undefined}>
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700 }}>{u.unitNumber}</span>
                      <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{UNIT_TYPE[u.unitType] ?? u.unitType}</span>
                      {isMine && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "color-mix(in srgb, var(--color-primary) 14%, transparent)", color: "var(--color-primary)", whiteSpace: "nowrap" }}>
                          Η μονάδα μου
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{floorLabel(u.floor)}</td>
                  <td style={{ ...tdNum, textAlign: "right" }}>{num(u.areaSqm, " μ²")}</td>
                  <td style={{ ...tdNum, textAlign: "right" }}>{u.millesimes == null ? "—" : `${u.millesimes.toLocaleString("el-GR", { maximumFractionDigits: 2 })}‰`}</td>
                  <td style={{ ...td, color: u.ownerName ? "var(--foreground)" : "var(--muted-foreground)" }}>{u.ownerName ?? "—"}</td>
                  <td style={{ ...td, color: u.residentName ? "var(--foreground)" : "var(--muted-foreground)" }}>{u.residentName ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
