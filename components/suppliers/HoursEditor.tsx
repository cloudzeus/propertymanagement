"use client";

import { WEEKDAYS, type WorkingHours, type HoursRange, DEFAULT_WORKING_HOURS } from "@/lib/suppliers-shared";
import { RiAddLine, RiCloseLine } from "react-icons/ri";

/** Weekly working-hours editor: per day, on/off + up to two ranges. */
export function HoursEditor({ value, onChange, compact }: { value: WorkingHours; onChange: (v: WorkingHours) => void; compact?: boolean }) {
  function setDay(key: string, ranges: HoursRange[] | null) {
    const next = { ...value };
    if (!ranges || ranges.length === 0) delete next[key];
    else next[key] = ranges;
    onChange(next);
  }
  function setRange(key: string, idx: number, pos: 0 | 1, v: string) {
    const ranges = [...(value[key] ?? [])];
    const r: HoursRange = [...(ranges[idx] ?? ["09:00", "17:00"])] as HoursRange;
    r[pos] = v;
    ranges[idx] = r;
    setDay(key, ranges);
  }
  const allEmpty = Object.keys(value).length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {allEmpty && (
        <button type="button" onClick={() => onChange({ ...DEFAULT_WORKING_HOURS })} style={linkBtn}>
          Συμπλήρωσε Δε–Πα 09:00–17:00
        </button>
      )}
      {WEEKDAYS.map((d) => {
        const ranges = value[d.key] ?? [];
        const on = ranges.length > 0;
        return (
          <div key={d.key} style={{ display: "grid", gridTemplateColumns: compact ? "88px 1fr" : "110px 1fr", alignItems: "center", gap: 8, minHeight: 32 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: on ? "var(--foreground)" : "var(--muted-foreground)", cursor: "pointer" }}>
              <input type="checkbox" checked={on} onChange={(e) => setDay(d.key, e.target.checked ? [["09:00", "17:00"]] : null)} />
              {compact ? d.short : d.label}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {on ? ranges.map((r, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <input type="time" value={r[0]} onChange={(e) => setRange(d.key, i, 0, e.target.value)} style={timeInput} />
                  <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>–</span>
                  <input type="time" value={r[1]} onChange={(e) => setRange(d.key, i, 1, e.target.value)} style={timeInput} />
                  {ranges.length > 1 && (
                    <button type="button" title="Αφαίρεση" onClick={() => setDay(d.key, ranges.filter((_, j) => j !== i))} style={iconBtn}><RiCloseLine /></button>
                  )}
                </span>
              )) : <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Κλειστά</span>}
              {on && ranges.length < 2 && (
                <button type="button" title="Δεύτερο διάστημα (π.χ. απόγευμα)" onClick={() => setDay(d.key, [...ranges, ["17:00", "20:00"]])} style={iconBtn}><RiAddLine /></button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const timeInput: React.CSSProperties = { height: 30, padding: "0 6px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12.5, color: "var(--foreground)", background: "var(--card)" };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", border: "1px solid var(--border)", background: "var(--card)", color: "var(--muted-foreground)", borderRadius: 4, padding: 4, cursor: "pointer" };
const linkBtn: React.CSSProperties = { alignSelf: "flex-start", background: "none", border: "none", color: "var(--color-primary)", fontSize: 12.5, cursor: "pointer", padding: 0, textDecoration: "underline" };
