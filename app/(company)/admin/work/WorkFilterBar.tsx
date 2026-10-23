"use client";

import { RiCloseLine } from "react-icons/ri";
import type { WorkFilters } from "@/lib/work/kpis";
import { SOURCE_COLORS, SOURCE_LABELS, STAGE_COLORS, STAGE_LABELS, WORK_SOURCES, WORK_STAGES, type WorkPriority, type WorkSource, type WorkStage } from "@/lib/work/types";
import { PRIORITY_LABELS } from "@/lib/maintenance-shared";

type Props = {
  filters: WorkFilters;
  onChange: (next: WorkFilters) => void;
  buildings: { id: string; name: string }[];
  employees: { id: string; name: string }[];
  showMine: boolean;
};

const selectStyle: React.CSSProperties = {
  height: 32, padding: "0 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
  fontSize: "var(--fs-12-5)", color: "var(--foreground)", background: "var(--card)", outline: "none", maxWidth: 220,
};

function Chip({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} style={{
      height: 28, padding: "0 10px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
      fontSize: "var(--fs-12)", fontWeight: 600, whiteSpace: "nowrap",
      color: active ? "#fff" : color, background: active ? color : `color-mix(in srgb, ${color} 7%, transparent)`, border: `1px solid ${active ? color : `color-mix(in srgb, ${color} 25%, transparent)`}`,
    }}>{label}</button>
  );
}

function toggle<T extends string>(list: T[] | undefined, v: T): T[] | undefined {
  const next = list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v];
  return next.length ? next : undefined;
}

export function WorkFilterBar({ filters, onChange, buildings, employees, showMine }: Props) {
  const set = (patch: Partial<WorkFilters>) => onChange({ ...filters, ...patch });
  const active = Object.entries(filters).some(([k, v]) => k !== "mine" && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 14px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: "var(--fs-11)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted-foreground)", marginRight: 4 }}>Πηγή</span>
        {WORK_SOURCES.map((s: WorkSource) => (
          <Chip key={s} label={SOURCE_LABELS[s]} color={SOURCE_COLORS[s]} active={!!filters.source?.includes(s)} onClick={() => set({ source: toggle(filters.source, s) })} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: "var(--fs-11)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted-foreground)", marginRight: 4 }}>Στάδιο</span>
        {WORK_STAGES.map((s: WorkStage) => (
          <Chip key={s} label={STAGE_LABELS[s]} color={STAGE_COLORS[s]} active={!!filters.stage?.includes(s)} onClick={() => set({ stage: toggle(filters.stage, s) })} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <select aria-label="Κτήριο" value={filters.building ?? ""} onChange={(e) => set({ building: e.target.value || undefined })} style={selectStyle}>
          <option value="">Όλα τα κτήρια</option>
          {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {employees.length > 0 && (
          <select aria-label="Ανάθεση" value={filters.assignee ?? ""} onChange={(e) => set({ assignee: e.target.value || undefined })} style={selectStyle}>
            <option value="">Κάθε ανάθεση</option>
            <option value="none">Χωρίς ανάθεση</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
        <select aria-label="Προτεραιότητα" value={filters.priority?.[0] ?? ""} onChange={(e) => set({ priority: e.target.value ? [e.target.value as WorkPriority] : undefined })} style={selectStyle}>
          <option value="">Κάθε προτεραιότητα</option>
          {(Object.keys(PRIORITY_LABELS) as WorkPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </select>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>
          Από <input type="date" aria-label="Από" value={filters.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} style={{ ...selectStyle, padding: "0 6px" }} />
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>
          Έως <input type="date" aria-label="Έως" value={filters.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} style={{ ...selectStyle, padding: "0 6px" }} />
        </label>
        {showMine && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-12-5)", fontWeight: 600, color: "var(--foreground)", cursor: "pointer", marginLeft: 4 }}>
            <input type="checkbox" checked={!!filters.mine} onChange={(e) => set({ mine: e.target.checked })} /> Οι εργασίες μου
          </label>
        )}
        {active && (
          <button type="button" onClick={() => onChange({ mine: filters.mine })} style={{
            marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, height: 30, padding: "0 10px", cursor: "pointer",
            border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--card)", fontSize: "var(--fs-12)", color: "var(--foreground)", fontFamily: "inherit",
          }}><RiCloseLine /> Καθαρισμός</button>
        )}
      </div>
    </div>
  );
}
