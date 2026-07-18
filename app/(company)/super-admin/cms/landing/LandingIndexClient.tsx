"use client";
import { useState, useTransition } from "react";
import { SortableList } from "@/components/cms/SortableList";
import { reorderSections, toggleSection } from "@/app/actions/landing-cms";
import { SectionForm } from "./[type]/SectionForm";
import { LANDING_META, CHROME_TYPES } from "@/lib/cms/landing-meta";
import { RiArrowDownSLine } from "react-icons/ri";

type Row = { id: string; type: string; enabled: boolean; order: number; data: unknown };

export function LandingIndexClient({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [, start] = useTransition();

  function onReorder(ids: string[]) {
    const byId = new Map(rows.map((r) => [r.id, r]));
    setRows(ids.map((id) => byId.get(id)).filter(Boolean) as Row[]);
    start(() => {
      reorderSections(ids);
    });
  }
  function toggle(id: string) {
    setRows(rows.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
    start(() => {
      toggleSection(id);
    });
  }

  return (
    <SortableList
      items={rows}
      onReorder={onReorder}
      renderItem={(r) => {
        const meta = LANDING_META[r.type];
        const Icon = meta?.icon;
        const open = openId === r.id;
        const chrome = CHROME_TYPES.includes(r.type);
        return (
          <div
            style={{
              flex: 1,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              background: "var(--card)",
              overflow: "hidden",
              opacity: r.enabled || chrome ? 1 : 0.6,
            }}
          >
            {/* Header — click to expand */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setOpenId(open ? null : r.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(open ? null : r.id); } }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", cursor: "pointer", userSelect: "none" }}
            >
              {Icon && (
                <span
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 38, height: 38, borderRadius: 10, flex: "none",
                    background: "var(--paper)", border: "1px solid var(--border)", color: "var(--foreground)",
                  }}
                >
                  <Icon size={19} />
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, color: "var(--foreground)", fontSize: 14.5 }}>{meta?.label ?? r.type}</span>
                  <code style={{ fontSize: 10.5, color: "var(--muted-foreground)", background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 5, padding: "1px 6px" }}>{r.type}</code>
                  {chrome && (
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>· σε όλες τις σελίδες</span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {meta?.description ?? ""}
                </div>
              </div>
              <label
                onClick={(e) => e.stopPropagation()}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}
              >
                <input type="checkbox" checked={r.enabled} onChange={() => toggle(r.id)} /> Ενεργό
              </label>
              <RiArrowDownSLine
                size={18}
                style={{ color: "var(--muted-foreground)", flex: "none", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}
              />
            </div>

            {/* Inline editor */}
            {open && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "18px 16px 16px", background: "var(--background)" }}>
                <SectionForm section={{ id: r.id, type: r.type, data: r.data }} />
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
