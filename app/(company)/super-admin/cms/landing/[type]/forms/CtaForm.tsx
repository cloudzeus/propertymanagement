"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { useSectionForm, FormChrome } from "./formShared";

export function CtaForm({ section }: { section: { id: string; type: string; data: unknown } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Επικεφαλίδα"><CmsInput value={c.heading ?? ""} onChange={(e) => f.patch({ heading: e.target.value })} /></CmsField>
      <CmsField label="Κείμενο"><CmsTextarea value={c.body ?? ""} onChange={(e) => f.patch({ body: e.target.value })} /></CmsField>
      <CmsField label="CTA — κείμενο"><CmsInput value={c.cta?.label ?? ""} onChange={(e) => f.patch({ cta: { ...(c.cta ?? {}), label: e.target.value } })} /></CmsField>
      <CmsField label="CTA — σύνδεσμος"><CmsInput value={c.cta?.href ?? ""} onChange={(e) => f.patch({ cta: { ...(c.cta ?? {}), href: e.target.value } })} /></CmsField>
      <CmsField label="Δεύτερο CTA — κείμενο"><CmsInput value={c.secondaryCta?.label ?? ""} onChange={(e) => f.patch({ secondaryCta: { ...(c.secondaryCta ?? {}), label: e.target.value } })} /></CmsField>
      <CmsField label="Δεύτερο CTA — σύνδεσμος"><CmsInput value={c.secondaryCta?.href ?? ""} onChange={(e) => f.patch({ secondaryCta: { ...(c.secondaryCta ?? {}), href: e.target.value } })} /></CmsField>
      <CmsField label="Εικόνα φόντου (κοινή για όλες τις γλώσσες)"><MediaPicker value={c.imageUrl ?? ""} onChange={(v) => f.patchMedia("imageUrl", typeof v === "string" ? v : v[0] ?? "")} accept="image" /></CmsField>
    </FormChrome>
  );
}
