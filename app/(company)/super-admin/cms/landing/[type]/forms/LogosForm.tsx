"use client";
import { CmsField, CmsInput } from "@/components/cms/ui";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { ItemsEditor } from "@/components/cms/ItemsEditor";
import { useSectionForm, FormChrome } from "./formShared";

type Item = { id: string; label: string; imageUrl?: string };

export function LogosForm({ section }: { section: { id: string; type: string; data: unknown } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  const items: Item[] = Array.isArray(c.items) ? c.items : [];
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Επικεφαλίδα"><CmsInput value={c.heading ?? ""} onChange={(e) => f.patch({ heading: e.target.value })} /></CmsField>
      <ItemsEditor<Item>
        items={items}
        onChange={(next) => f.setItems("items", next)}
        newItem={() => ({ id: crypto.randomUUID(), label: "" })}
        addLabel="Προσθήκη λογοτύπου"
        renderFields={(item, patch) => (
          <>
            <CmsField label="Όνομα"><CmsInput value={item.label} onChange={(e) => patch({ label: e.target.value })} /></CmsField>
            <CmsField label="Λογότυπο (προαιρετικό — κοινό για όλες τις γλώσσες)"><MediaPicker value={item.imageUrl ?? ""} onChange={(v) => f.patchMedia(`items.${items.findIndex((x) => x.id === item.id)}.imageUrl`, typeof v === "string" ? v : v[0] ?? "")} accept="image" /></CmsField>
          </>
        )}
      />
    </FormChrome>
  );
}
