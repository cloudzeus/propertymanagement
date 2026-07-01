"use client";

import { ReactNode } from "react";
import { SortableList } from "@/components/cms/SortableList";
import { CmsButton } from "@/components/cms/ui";
import { RiAddLine, RiDeleteBinLine } from "react-icons/ri";

export type Item = { id: string } & Record<string, unknown>;

type Props<T extends Item> = {
  items: T[];
  onChange: (items: T[]) => void;
  newItem: () => T;
  addLabel: string;
  renderFields: (item: T, patch: (p: Partial<T>) => void) => ReactNode;
};

export function ItemsEditor<T extends Item>({ items, onChange, newItem, addLabel, renderFields }: Props<T>) {
  function patch(id: string, p: Partial<T>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }
  function remove(id: string) {
    onChange(items.filter((it) => it.id !== id));
  }
  function reorder(ids: string[]) {
    const byId = new Map(items.map((it) => [it.id, it]));
    onChange(ids.map((id) => byId.get(id)).filter(Boolean) as T[]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SortableList
        items={items}
        onReorder={reorder}
        renderItem={(item) => (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              background: "var(--card)",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label="Remove"
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--destructive)" }}
              >
                <RiDeleteBinLine size={16} />
              </button>
            </div>
            {renderFields(item, (p) => patch(item.id, p))}
          </div>
        )}
      />
      <div>
        <CmsButton variant="secondary" onClick={() => onChange([...items, newItem()])} icon={<RiAddLine size={16} />}>
          {addLabel}
        </CmsButton>
      </div>
    </div>
  );
}
