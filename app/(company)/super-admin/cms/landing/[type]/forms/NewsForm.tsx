"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { useSectionForm, FormChrome } from "./formShared";

export function NewsForm({ section }: { section: { id: string; type: string; data: unknown } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Επικεφαλίδα"><CmsInput value={c.heading ?? ""} onChange={(e) => f.patch({ heading: e.target.value })} /></CmsField>
      <CmsField label="Εισαγωγή"><CmsTextarea value={c.intro ?? ""} onChange={(e) => f.patch({ intro: e.target.value })} /></CmsField>
      <CmsField label="Πλήθος άρθρων"><CmsInput type="number" min={1} max={9} value={c.count ?? 3} onChange={(e) => f.patch({ count: Number(e.target.value) })} /></CmsField>
    </FormChrome>
  );
}
