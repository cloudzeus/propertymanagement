"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { SortableList } from "@/components/cms/SortableList";
import { reorderSections, toggleSection } from "@/app/actions/landing-cms";
import { CmsButton } from "@/components/cms/ui";
import { RiEditLine } from "react-icons/ri";

type Row = { id: string; type: string; enabled: boolean; order: number };

export function LandingIndexClient({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
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
      renderItem={(r) => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--card)", padding: "12px 14px" }}>
          <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{r.type}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted-foreground)" }}>
              <input type="checkbox" checked={r.enabled} onChange={() => toggle(r.id)} /> Ενεργό
            </label>
            <Link href={`/super-admin/cms/landing/${r.type}`}>
              <CmsButton variant="secondary" icon={<RiEditLine size={15} />}>Επεξεργασία</CmsButton>
            </Link>
          </div>
        </div>
      )}
    />
  );
}
