"use client";
import { CmsField, CmsInput } from "@/components/cms/ui";
import { ItemsEditor } from "@/components/cms/ItemsEditor";
import { useSectionForm, FormChrome } from "./formShared";

type Item = { id: string; value: string; label: string };

export function StatsForm({ section }: { section: { id: string; type: string; data: unknown } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  const items: Item[] = Array.isArray(c.items) ? c.items : [];
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <ItemsEditor<Item>
        items={items}
        onChange={(next) => f.setItems("items", next)}
        newItem={() => ({ id: crypto.randomUUID(), value: "", label: "" })}
        addLabel="Προσθήκη στατιστικού"
        renderFields={(item, patch) => (
          <>
            <CmsField label="Τιμή (π.χ. 200+)"><CmsInput value={item.value} onChange={(e) => patch({ value: e.target.value })} /></CmsField>
            <CmsField label="Ετικέτα"><CmsInput value={item.label} onChange={(e) => patch({ label: e.target.value })} /></CmsField>
          </>
        )}
      />
    </FormChrome>
  );
}
