"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { ItemsEditor } from "@/components/cms/ItemsEditor";
import { useSectionForm, FormChrome } from "./formShared";

type Item = { id: string; quote: string; author: string; role?: string; avatarUrl?: string };

export function TestimonialsForm({ section }: { section: { id: string; type: string; data: unknown } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  const items: Item[] = Array.isArray(c.items) ? c.items : [];
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Επικεφαλίδα"><CmsInput value={c.heading ?? ""} onChange={(e) => f.patch({ heading: e.target.value })} /></CmsField>
      <ItemsEditor<Item>
        items={items}
        onChange={(next) => f.setItems("items", next)}
        newItem={() => ({ id: crypto.randomUUID(), quote: "", author: "", role: "" })}
        addLabel="Προσθήκη μαρτυρίας"
        renderFields={(item, patch) => (
          <>
            <CmsField label="Απόσπασμα"><CmsTextarea value={item.quote} onChange={(e) => patch({ quote: e.target.value })} /></CmsField>
            <CmsField label="Όνομα"><CmsInput value={item.author} onChange={(e) => patch({ author: e.target.value })} /></CmsField>
            <CmsField label="Ρόλος"><CmsInput value={item.role ?? ""} onChange={(e) => patch({ role: e.target.value })} /></CmsField>
            <CmsField label="Avatar (κοινό για όλες τις γλώσσες)"><MediaPicker value={item.avatarUrl ?? ""} onChange={(v) => f.patchMedia(`items.${items.findIndex((x) => x.id === item.id)}.avatarUrl`, typeof v === "string" ? v : v[0] ?? "")} accept="image" /></CmsField>
          </>
        )}
      />
    </FormChrome>
  );
}
