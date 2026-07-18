"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { ItemsEditor } from "@/components/cms/ItemsEditor";
import { useSectionForm, FormChrome } from "./formShared";

type Item = { id: string; title: string; body: string };

export function HowForm({ section }: { section: { id: string; type: string; data: unknown } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  const steps: Item[] = Array.isArray(c.steps) ? c.steps : [];
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Kicker"><CmsInput value={c.kicker ?? ""} onChange={(e) => f.patch({ kicker: e.target.value })} /></CmsField>
      <CmsField label="Επικεφαλίδα"><CmsInput value={c.heading ?? ""} onChange={(e) => f.patch({ heading: e.target.value })} /></CmsField>
      <CmsField label="Υπότιτλος"><CmsTextarea value={c.subtitle ?? ""} onChange={(e) => f.patch({ subtitle: e.target.value })} /></CmsField>
      <ItemsEditor<Item>
        items={steps}
        onChange={(next) => f.setItems("steps", next)}
        newItem={() => ({ id: crypto.randomUUID(), title: "", body: "" })}
        addLabel="Προσθήκη βήματος"
        renderFields={(item, patch) => (
          <>
            <CmsField label="Τίτλος"><CmsInput value={item.title} onChange={(e) => patch({ title: e.target.value })} /></CmsField>
            <CmsField label="Περιγραφή"><CmsTextarea value={item.body} onChange={(e) => patch({ body: e.target.value })} /></CmsField>
          </>
        )}
      />
    </FormChrome>
  );
}
