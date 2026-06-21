"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiSave3Line, RiAlertLine, RiLoaderLine, RiFireLine } from "react-icons/ri";
import {
  saveHeatingReading,
  bulkSaveHeatingReadings,
  saveHeatingMeterUnit,
  type HeatingReadingDTO,
} from "@/app/actions/heating-readings";

type Props = {
  buildingId: string;
  period: string;
  periods: string[];
  rows: HeatingReadingDTO[];
  heatingMeterUnit: string | null;
};

export function HeatingReadingsPanel({ buildingId, period, periods, rows, heatingMeterUnit }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, string>>(
    () => Object.fromEntries(rows.map((r) => [r.unitId, r.currentReading?.toString() ?? ""])),
  );

  const consumptionOf = (r: HeatingReadingDTO): number | null => {
    const v = draft[r.unitId];
    if (v === "" || v == null) return null;
    const cur = Number(v);
    if (Number.isNaN(cur)) return null;
    return cur - (r.previousReading ?? 0);
  };
  const total = rows.reduce((s, r) => {
    const c = consumptionOf(r);
    return s + (c && c > 0 ? c : 0);
  }, 0);

  function changePeriod(p: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("heatingPeriod", p);
    router.push(url.pathname + url.search);
  }
  function saveAll() {
    startTransition(async () => {
      await bulkSaveHeatingReadings(
        buildingId,
        period,
        rows.map((r) => ({
          unitId: r.unitId,
          currentReading: draft[r.unitId] === "" ? null : Number(draft[r.unitId]),
        })),
      );
      router.refresh();
    });
  }
  function saveLabel(label: string) {
    startTransition(async () => {
      await saveHeatingMeterUnit(buildingId, label || null);
      router.refresh();
    });
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
      {/* header: period + meter unit */}
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
          <RiFireLine style={{ color: "#dc2626" }} /> Ενδείξεις θέρμανσης
        </span>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)" }}>
          Περίοδος
          <select value={period} onChange={(e) => changePeriod(e.target.value)} style={inputStyle}>
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)" }}>
          Μονάδα μέτρησης
          <input
            defaultValue={heatingMeterUnit ?? ""}
            placeholder="π.χ. μονάδες"
            onBlur={(e) => { if ((e.target.value || null) !== (heatingMeterUnit ?? null)) saveLabel(e.target.value); }}
            style={{ width: 110, ...inputStyle }}
          />
        </label>
        {isPending && <RiLoaderLine style={{ animation: "spin 1s linear infinite", color: "var(--muted-foreground)" }} />}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11 }}>
            <th style={th}>Μονάδα</th>
            <th style={{ ...th, textAlign: "right" }}>Προηγ.</th>
            <th style={{ ...th, textAlign: "right" }}>Τρέχουσα</th>
            <th style={{ ...th, textAlign: "right" }}>Κατανάλωση</th>
            <th style={{ ...th, textAlign: "right" }}>Μερίδιο 70%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = consumptionOf(r);
            const negative = c != null && c < 0;
            const pct = total > 0 && c != null && c > 0 ? (c / total) * 100 : 0;
            return (
              <tr key={r.unitId} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td}>{r.unitNumber}</td>
                <td style={{ ...td, textAlign: "right", color: "var(--muted-foreground)" }}>{r.previousReading ?? "—"}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  <input
                    style={{ width: 80, textAlign: "right", ...inputStyle }}
                    value={draft[r.unitId] ?? ""}
                    inputMode="decimal"
                    onChange={(e) => setDraft((d) => ({ ...d, [r.unitId]: e.target.value }))}
                    onBlur={(e) => startTransition(async () => {
                      await saveHeatingReading(buildingId, r.unitId, period, e.target.value === "" ? null : Number(e.target.value));
                      router.refresh();
                    })}
                  />
                </td>
                <td style={{ ...td, textAlign: "right", fontWeight: 600, color: negative ? "#dc2626" : "var(--foreground)" }}>
                  {c == null ? "—" : negative ? (
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                      <RiAlertLine /> {c}
                    </span>
                  ) : c}
                </td>
                <td style={{ ...td, textAlign: "right", color: "var(--muted-foreground)" }}>{pct ? pct.toFixed(1) + "%" : "—"}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
            <td style={td} colSpan={3}>Σύνολο</td>
            <td style={{ ...td, textAlign: "right" }}>{total}</td>
            <td style={{ ...td, textAlign: "right" }}>{total > 0 ? "100%" : "—"}</td>
          </tr>
        </tfoot>
      </table>

      <div style={{ display: "flex", gap: 8, padding: "13px 16px", borderTop: "1px solid var(--border)" }}>
        <button onClick={saveAll} disabled={isPending} style={btn}>
          <RiSave3Line /> Αποθήκευση όλων
        </button>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 12px" };
const td: React.CSSProperties = { padding: "6px 12px", color: "var(--foreground)" };
const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", fontSize: 13, background: "var(--card)", color: "var(--foreground)" };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 6, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
