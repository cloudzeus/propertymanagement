"use client";

import { RiFlashlightLine, RiDropLine, RiFireLine, RiImageLine } from "react-icons/ri";

export type MeterReadingDTO = {
  id: string;
  meterType: "POWER" | "WATER" | "GAS";
  meterNumber: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  previousReading: number | null;
  currentReading: number | null;
  consumption: number | null;
  unit: string | null;
  createdAt: string;
  source: string | null;
  photoUrl: string | null;
};

const META: Record<MeterReadingDTO["meterType"], { label: string; color: string; icon: React.ElementType }> = {
  POWER: { label: "ΔΕΗ / Ρεύμα", color: "#CA5D00", icon: RiFlashlightLine },
  WATER: { label: "Νερό", color: "#0078D4", icon: RiDropLine },
  GAS: { label: "Αέριο", color: "#8764B8", icon: RiFireLine },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtNum(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("el-GR", { maximumFractionDigits: 3 });
}

export function MeterReadingsPanel({ rows }: { rows: MeterReadingDTO[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 40, textAlign: "center", color: "var(--muted-foreground)", fontSize: 14 }}>
        Δεν υπάρχουν ενδείξεις μετρητών. Καταχωρούνται αυτόματα κατά την αναγνώριση λογαριασμών ΔΕΗ/νερού (OCR) στα Έξοδα.
      </div>
    );
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 820 }}>
          <thead>
            <tr style={{ background: "var(--bg-canvas)", textAlign: "left", color: "var(--muted-foreground)" }}>
              <Th>Τύπος</Th>
              <Th>Αρ. μετρητή</Th>
              <Th>Περίοδος</Th>
              <Th right>Προηγ.</Th>
              <Th right>Τρέχουσα</Th>
              <Th right>Κατανάλωση</Th>
              <Th>Μον.</Th>
              <Th>Καταχ.</Th>
              <Th>Πηγή</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = META[r.meterType];
              const Icon = m.icon;
              return (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <Td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: m.color }}>
                      <Icon /> {m.label}
                    </span>
                  </Td>
                  <Td>{r.meterNumber || "—"}</Td>
                  <Td>{r.periodFrom || r.periodTo ? `${fmtDate(r.periodFrom)} – ${fmtDate(r.periodTo)}` : "—"}</Td>
                  <Td right>{fmtNum(r.previousReading)}</Td>
                  <Td right style={{ fontWeight: 600, color: "var(--foreground)" }}>{fmtNum(r.currentReading)}</Td>
                  <Td right style={{ fontWeight: 700, color: m.color }}>{fmtNum(r.consumption)}</Td>
                  <Td>{r.unit || "—"}</Td>
                  <Td>{fmtDate(r.createdAt)}</Td>
                  <Td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted-foreground)" }}>
                      {r.photoUrl && (
                        <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" title="Άνοιγμα παραστατικού" style={{ color: "var(--color-primary)", display: "inline-flex" }}>
                          <RiImageLine />
                        </a>
                      )}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{r.source || "—"}</span>
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: right ? "right" : "left", whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children, right, style }: { children: React.ReactNode; right?: boolean; style?: React.CSSProperties }) {
  return <td style={{ padding: "10px 12px", color: "var(--foreground)", textAlign: right ? "right" : "left", whiteSpace: "nowrap", ...style }}>{children}</td>;
}
