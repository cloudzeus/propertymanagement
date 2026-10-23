"use client";

import { RiAddLine, RiDeleteBinLine } from "react-icons/ri";
import { NumberField, parseNumber } from "@/components/ui/guided-flow-parts";
import { distributeWeights } from "@/lib/millesimes";
import type { UnitDraft } from "@/lib/wizards/units-generator";

const TYPE_LABEL: Record<UnitDraft["unitType"], string> = { APARTMENT: "Διαμέρισμα", SHOP: "Κατάστημα", PARKING: "Πάρκινγκ", OTHER: "Άλλο" };

export function floorLabel(f: number | null): string {
  if (f == null) return "—";
  if (f === 0) return "Ισόγειο";
  if (f < 0) return `Υπόγειο ${-f}`;
  return `${f}ος`;
}

/** Editable unit list with a live «Γενικά ‰» column (same distributeWeights as the server). */
export function UnitsGrid({ units, onChange, floors, basements }: { units: UnitDraft[]; onChange: (u: UnitDraft[]) => void; floors: number; basements: number }) {
  const shares = new Map(distributeWeights(units.map((u, i) => ({ id: String(i), weight: u.areaSqm ?? 0 }))).map((r) => [r.id, r.value]));
  const floorOptions: { value: string; label: string }[] = [];
  for (let b = basements; b >= 1; b--) floorOptions.push({ value: String(-b), label: `Υπόγειο ${b}` });
  floorOptions.push({ value: "0", label: "Ισόγειο" });
  for (let f = 1; f <= Math.max(floors, 0); f++) floorOptions.push({ value: String(f), label: `${f}ος όροφος` });
  const set = (i: number, patch: Partial<UnitDraft>) => onChange(units.map((u, j) => (j === i ? { ...u, ...patch } : u)));
  const remove = (i: number) => onChange(units.filter((_, j) => j !== i));
  const add = () => onChange([...units, { unitNumber: "", floor: units[units.length - 1]?.floor ?? 1, areaSqm: null, unitType: "APARTMENT" }]);
  const cell: React.CSSProperties = { padding: "4px 6px" };
  const input: React.CSSProperties = { width: "100%", height: 36, padding: "0 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-13)", color: "var(--foreground)", background: "var(--card)", boxSizing: "border-box" };
  const totalArea = units.reduce((s, u) => s + (u.areaSqm ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)", minWidth: 560 }}>
          <thead>
            <tr style={{ color: "var(--muted-foreground)", fontSize: "var(--fs-11)", textAlign: "left", background: "var(--paper)" }}>
              <th style={cell}>Αριθμός</th><th style={cell}>Όροφος</th><th style={cell}>Τύπος</th><th style={{ ...cell, textAlign: "right" }}>τ.μ.</th><th style={{ ...cell, textAlign: "right" }}>Γενικά ‰</th><th style={cell} />
            </tr>
          </thead>
          <tbody>
            {units.map((u, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...cell, width: 110 }}><input aria-label={`Αριθμός μονάδας ${i + 1}`} value={u.unitNumber} onChange={(e) => set(i, { unitNumber: e.target.value })} style={input} /></td>
                <td style={{ ...cell, width: 140 }}>
                  <select aria-label="Όροφος" value={u.floor == null ? "" : String(u.floor)} onChange={(e) => set(i, { floor: e.target.value === "" ? null : Number(e.target.value) })} style={input}>
                    <option value="">—</option>
                    {floorOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td style={{ ...cell, width: 140 }}>
                  <select aria-label="Τύπος" value={u.unitType} onChange={(e) => set(i, { unitType: e.target.value as UnitDraft["unitType"] })} style={input}>
                    {(Object.keys(TYPE_LABEL) as UnitDraft["unitType"][]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </select>
                </td>
                <td style={{ ...cell, width: 120 }}><NumberField ariaLabel="Τετραγωνικά" unit="τ.μ." value={u.areaSqm == null ? "" : String(u.areaSqm).replace(".", ",")} onChange={(v) => set(i, { areaSqm: parseNumber(v) })} /></td>
                <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums", color: shares.get(String(i)) == null ? "var(--muted-foreground)" : "var(--foreground)", fontWeight: 600 }}>{shares.get(String(i)) ?? "—"}</td>
                <td style={{ ...cell, width: 44 }}><button type="button" onClick={() => remove(i)} aria-label={`Διαγραφή μονάδας ${u.unitNumber || i + 1}`} style={{ width: 36, height: 36, borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--color-danger)", cursor: "pointer", display: "grid", placeItems: "center" }}><RiDeleteBinLine /></button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
              <td style={cell} colSpan={3}>{units.length} μονάδες</td>
              <td style={{ ...cell, textAlign: "right" }}>{totalArea ? `${totalArea} τ.μ.` : "—"}</td>
              <td style={{ ...cell, textAlign: "right" }}>{totalArea ? "1000" : "—"}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <button type="button" onClick={add} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "8px 14px", borderRadius: 8, border: "1px dashed var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: 600 }}><RiAddLine /> Προσθήκη μονάδας</button>
    </div>
  );
}
