"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMillesimeCell, saveElevatorParams } from "@/app/actions/building-millesimes";
import { recalculateMillesimes } from "@/app/actions/buildings";
import { RiLockLine, RiRefreshLine, RiCheckLine, RiCalculatorLine, RiLoaderLine } from "react-icons/ri";

type Set = "general" | "elevator" | "heating";

export type MillesimeUnit = {
  id: string;
  unitNumber: string;
  floor: number | null;
  areaSqm: number | null;
  millesimes: number | null;
  millesimesElevator: number | null;
  millesimesHeating: number | null;
  millesimesSource: string;
  millesimesElevatorSource: string;
  millesimesHeatingSource: string;
};

const SETS: { key: Set; header: string; valueField: keyof MillesimeUnit; sourceField: keyof MillesimeUnit }[] = [
  { key: "general", header: "Γενικά ‰", valueField: "millesimes", sourceField: "millesimesSource" },
  { key: "elevator", header: "Ανελκ. ‰", valueField: "millesimesElevator", sourceField: "millesimesElevatorSource" },
  { key: "heating", header: "Θέρμ. ‰", valueField: "millesimesHeating", sourceField: "millesimesHeatingSource" },
];

export function MillesimeGrid({
  buildingId,
  units,
  elevatorSurchargePerFloor,
  elevatorExemptGroundFloor,
}: {
  buildingId: string;
  units: MillesimeUnit[];
  elevatorSurchargePerFloor: number;
  elevatorExemptGroundFloor: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pct, setPct] = useState(String(Math.round(elevatorSurchargePerFloor * 100)));
  const [exempt, setExempt] = useState(elevatorExemptGroundFloor);

  const run = (fn: () => Promise<{ error?: string } | { ok?: boolean } | { updated?: number } | void>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) { setError(res.error); return; }
      router.refresh();
    });
  };

  function saveElevator(nextPct: number, nextExempt: boolean) {
    run(async () => {
      await saveElevatorParams(buildingId, nextPct / 100, nextExempt);
      return recalculateMillesimes(buildingId);
    });
  }

  function saveCell(unit: MillesimeUnit, set: Set, raw: string, current: number | null) {
    const value = raw.trim() === "" ? null : Number(raw);
    if (Number.isNaN(value as number)) return;
    if (value === current) return;
    run(() => saveMillesimeCell(buildingId, unit.id, set, value));
  }

  function resetCell(unitId: string, set: Set) {
    run(async () => {
      await saveMillesimeCell(buildingId, unitId, set, null, true);
      return recalculateMillesimes(buildingId);
    });
  }

  function recalcAuto() {
    run(() => recalculateMillesimes(buildingId));
  }

  function resetAllLocked() {
    run(async () => {
      for (const u of units) {
        for (const s of SETS) {
          if (u[s.sourceField] === "MANUAL") {
            await saveMillesimeCell(buildingId, u.id, s.key, null, true);
          }
        }
      }
      return recalculateMillesimes(buildingId);
    });
  }

  const totals = SETS.map((s) => units.reduce((sum, u) => sum + ((u[s.valueField] as number | null) ?? 0), 0));

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
      {/* elevator params header */}
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)" }}>
          Επιβάρυνση ανελκυστήρα/όροφο (%)
          <input
            type="number"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            onBlur={() => {
              const next = Number(pct);
              if (Number.isNaN(next) || next / 100 === elevatorSurchargePerFloor) return;
              saveElevator(next, exempt);
            }}
            style={{ width: 70, ...inputStyle }}
          />
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={exempt}
            onChange={(e) => { setExempt(e.target.checked); saveElevator(Number(pct), e.target.checked); }}
          />
          Εξαίρεση ισογείου
        </label>
        {isPending && <RiLoaderLine style={{ animation: "spin 1s linear infinite", color: "var(--muted-foreground)" }} />}
      </div>

      {error && <div style={{ margin: 12, padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12 }}>{error}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11 }}>
            <th style={th}>Μονάδα</th>
            <th style={{ ...th, textAlign: "right" }}>Όροφος</th>
            <th style={{ ...th, textAlign: "right" }}>τ.μ.</th>
            {SETS.map((s) => <th key={s.key} style={{ ...th, textAlign: "right" }}>{s.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {units.map((u) => (
            <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={td}>{u.unitNumber}</td>
              <td style={{ ...td, textAlign: "right" }}>{u.floor ?? "—"}</td>
              <td style={{ ...td, textAlign: "right" }}>{u.areaSqm ?? "—"}</td>
              {SETS.map((s) => {
                const value = u[s.valueField] as number | null;
                const manual = u[s.sourceField] === "MANUAL";
                return (
                  <td key={s.key} style={{ ...td, textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                      {manual && <RiLockLine style={{ color: "#b45309", fontSize: 13 }} title="Κλειδωμένο (χειροκίνητο)" />}
                      <input
                        type="number"
                        defaultValue={value ?? ""}
                        key={`${s.key}-${value ?? ""}-${u[s.sourceField]}`}
                        onBlur={(e) => saveCell(u, s.key, e.target.value, value)}
                        style={{ width: 72, textAlign: "right", ...inputStyle, ...(manual ? { background: "#fffbeb", borderColor: "#f59e0b", color: "#92400e" } : {}) }}
                      />
                      {manual && (
                        <button onClick={() => resetCell(u.id, s.key)} title="Επαναφορά σε αυτόματο" style={iconBtn}>
                          <RiRefreshLine />
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
            <td style={td} colSpan={3}>Σύνολο</td>
            {totals.map((t, i) => {
              const ok = Math.round(t) === 1000;
              return (
                <td key={i} style={{ ...td, textAlign: "right" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 4, color: ok ? "var(--color-green)" : "#dc2626" }}>
                    {ok && <RiCheckLine />}{Math.round(t * 100) / 100}
                  </span>
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>

      <div style={{ display: "flex", gap: 8, padding: "13px 16px", borderTop: "1px solid var(--border)" }}>
        <button onClick={recalcAuto} disabled={isPending} style={btn}><RiCalculatorLine /> Επανυπολογισμός αυτομάτων</button>
        <button onClick={resetAllLocked} disabled={isPending} style={btn}><RiRefreshLine /> Επαναφορά κλειδωμένων</button>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 12px" };
const td: React.CSSProperties = { padding: "6px 12px", color: "var(--foreground)" };
const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", fontSize: 13, background: "var(--card)", color: "var(--foreground)" };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: "#b45309", cursor: "pointer", padding: 2 };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 6, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
