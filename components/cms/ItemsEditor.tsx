"use client";

import { SortableList } from "./SortableList";
import { CmsButton } from "./ui";
import { RiAddLine, RiDeleteBinLine } from "react-icons/ri";

export interface ItemField {
  key: string;
  label: string;
  type?: "text" | "textarea" | "url";
  placeholder?: string;
}

interface ItemsEditorProps<T extends { id: string }> {
  items: T[];
  onChange: (items: T[]) => void;
  fields: ItemField[];
  createItem: () => T;
  maxItems?: number;
}

export function ItemsEditor<T extends { id: string }>({
  items,
  onChange,
  fields,
  createItem,
  maxItems,
}: ItemsEditorProps<T>) {
  function handleReorder(ids: string[]) {
    const map = new Map(items.map((i) => [i.id, i]));
    onChange(ids.map((id) => map.get(id)!).filter(Boolean));
  }

  function handleChange(id: string, key: string, value: string) {
    onChange(items.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  }

  function handleAdd() {
    if (maxItems && items.length >= maxItems) return;
    onChange([...items, createItem()]);
  }

  function handleRemove(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <SortableList
        items={items}
        onReorder={handleReorder}
        renderItem={(item) => (
          <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {field.label}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={3}
                    placeholder={field.placeholder}
                    value={(item as Record<string, string>)[field.key] ?? ""}
                    onChange={(e) => handleChange(item.id, field.key, e.target.value)}
                  />
                ) : (
                  <input
                    type={field.type ?? "text"}
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder={field.placeholder}
                    value={(item as Record<string, string>)[field.key] ?? ""}
                    onChange={(e) => handleChange(item.id, field.key, e.target.value)}
                  />
                )}
              </div>
            ))}
            <div className="flex justify-end">
              <CmsButton
                variant="danger"
                type="button"
                onClick={() => handleRemove(item.id)}
                icon={<RiDeleteBinLine className="h-3.5 w-3.5" />}
              >
                Αφαίρεση
              </CmsButton>
            </div>
          </div>
        )}
      />
      {(!maxItems || items.length < maxItems) && (
        <CmsButton
          variant="secondary"
          type="button"
          onClick={handleAdd}
          icon={<RiAddLine className="h-4 w-4" />}
        >
          Προσθήκη
        </CmsButton>
      )}
    </div>
  );
}
