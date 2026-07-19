"use client";

import { RiSpeedUpLine } from "react-icons/ri";
import type { OccupantData } from "@/lib/building/occupant-data";
import { EmptyState } from "@/components/dashboard";

const METER_LABEL: Record<string, string> = {
  POWER: "Ρεύμα", WATER: "Νερό", GAS: "Φυσικό αέριο",
};
const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;
const period = (from: string | null, to: string | null) => {
  const f = shortDate(from), t = shortDate(to);
  if (f && t) return `${f} – ${t}`;
  return f ?? t ?? "—";
};
const reading = (n: number | null) => (n == null ? "—" : n.toLocaleString("el-GR", { maximumFractionDigits: 3 }));

const th: React.CSSProperties = {
  textAlign: "left", padding: "10px 12px", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: ".03em", color: "var(--muted-foreground)", whiteSpace: "nowrap", borderBottom: "1px solid var(--border)",
};
const td: React.CSSProperties = {
  padding: "11px 12px", fontSize: 13, color: "var(--foreground)", borderBottom: "1px solid var(--border)",
};
const tdNum: React.CSSProperties = { ...td, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", textAlign: "right" };

/** Read-only meter readings for the building (consumption per metering period). */
export function MetersSection({ meterReadings }: { meterReadings: OccupantData["meterReadings"] }) {
  if (meterReadings.length === 0) {
    return <EmptyState icon={RiSpeedUpLine} label="Δεν υπάρχουν καταχωρημένες μετρήσεις μετρητών." />;
  }
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead>
            <tr>
              <th style={th}>Μετρητής</th>
              <th style={th}>Τύπος</th>
              <th style={th}>Περίοδος</th>
              <th style={{ ...th, textAlign: "right" }}>Προηγ.</th>
              <th style={{ ...th, textAlign: "right" }}>Τρέχ.</th>
              <th style={{ ...th, textAlign: "right" }}>Κατανάλωση</th>
            </tr>
          </thead>
          <tbody>
            {meterReadings.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, fontWeight: 700 }}>{r.infraName ?? r.meterNumber ?? (METER_LABEL[r.meterType] ?? r.meterType)}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{METER_LABEL[r.meterType] ?? r.meterType}</td>
                <td style={{ ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{period(r.periodFrom, r.periodTo)}</td>
                <td style={tdNum}>{reading(r.previousReading)}</td>
                <td style={tdNum}>{reading(r.currentReading)}</td>
                <td style={{ ...tdNum, fontWeight: 700 }}>
                  {r.consumption == null ? "—" : `${r.consumption.toLocaleString("el-GR", { maximumFractionDigits: 3 })}${r.unit ? ` ${r.unit}` : ""}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
