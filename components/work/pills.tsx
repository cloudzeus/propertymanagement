"use client";

import { SOURCE_COLORS, SOURCE_LABELS, STAGE_COLORS, STAGE_LABELS, type WorkSource, type WorkStage } from "@/lib/work/types";

const base: React.CSSProperties = {
  display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: "var(--fs-11-5)", fontWeight: 600, whiteSpace: "nowrap",
};

export function SourcePill({ source }: { source: WorkSource }) {
  const c = SOURCE_COLORS[source];
  return <span style={{ ...base, color: c, background: `color-mix(in srgb, ${c} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 25%, transparent)` }}>{SOURCE_LABELS[source]}</span>;
}

export function StagePill({ stage }: { stage: WorkStage }) {
  const c = STAGE_COLORS[stage];
  return <span style={{ ...base, color: c, background: `color-mix(in srgb, ${c} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 25%, transparent)` }}>{STAGE_LABELS[stage]}</span>;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Athens" });

/** Due date, red + «εκπρόθεσμο» when overdue. */
export function DuePill({ dueAt, overdue }: { dueAt: string | null; overdue: boolean }) {
  if (!dueAt) return <span style={{ color: "var(--muted-foreground)" }}>—</span>;
  return (
    <span style={{ color: overdue ? "var(--color-danger)" : "var(--foreground)", fontWeight: overdue ? 700 : 400, whiteSpace: "nowrap" }}>
      {fmt(dueAt)}{overdue ? " · εκπρόθεσμο" : ""}
    </span>
  );
}
