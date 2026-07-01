"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SortableList } from "@/components/cms/SortableList";
import { CmsCard } from "@/components/cms/ui";

type Row = { id: string; label: string };

/**
 * Drag-to-reorder card. Persists the new order via `onReorder(orderedIds)` and
 * refreshes the route so the sibling DataTable reflects it.
 */
export function ReorderPanel({
  title,
  items,
  onReorder,
}: {
  title: string;
  items: Row[];
  onReorder: (orderedIds: string[]) => Promise<void>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(items);
  const [, start] = useTransition();

  if (rows.length < 2) return null;

  function reorder(ids: string[]) {
    const byId = new Map(rows.map((r) => [r.id, r]));
    setRows(ids.map((id) => byId.get(id)).filter(Boolean) as Row[]);
    start(async () => {
      await onReorder(ids);
      router.refresh();
    });
  }

  return (
    <CmsCard title={title}>
      <SortableList
        items={rows}
        onReorder={reorder}
        renderItem={(r) => (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              background: "var(--card)",
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--foreground)",
            }}
          >
            {r.label || "—"}
          </div>
        )}
      />
    </CmsCard>
  );
}
