"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { useSectionForm, FormChrome } from "./formShared";

export function HeroForm({ section }: { section: { id: string; type: string; data: unknown } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Eyebrow"><CmsInput value={c.eyebrow ?? ""} onChange={(e) => f.patch({ eyebrow: e.target.value })} /></CmsField>
      <CmsField label="Τίτλος (H1)"><CmsInput value={c.title ?? ""} onChange={(e) => f.patch({ title: e.target.value })} /></CmsField>
      <CmsField label="Υπότιτλος"><CmsTextarea value={c.subtitle ?? ""} onChange={(e) => f.patch({ subtitle: e.target.value })} /></CmsField>
      <CmsField label="Primary CTA — κείμενο"><CmsInput value={c.primaryCta?.label ?? ""} onChange={(e) => f.patch({ primaryCta: { ...(c.primaryCta ?? {}), label: e.target.value } })} /></CmsField>
      <CmsField label="Primary CTA — σύνδεσμος"><CmsInput value={c.primaryCta?.href ?? ""} onChange={(e) => f.patch({ primaryCta: { ...(c.primaryCta ?? {}), href: e.target.value } })} /></CmsField>
      <CmsField label="Secondary CTA — κείμενο"><CmsInput value={c.secondaryCta?.label ?? ""} onChange={(e) => f.patch({ secondaryCta: { ...(c.secondaryCta ?? {}), label: e.target.value } })} /></CmsField>
      <CmsField label="Secondary CTA — σύνδεσμος"><CmsInput value={c.secondaryCta?.href ?? ""} onChange={(e) => f.patch({ secondaryCta: { ...(c.secondaryCta ?? {}), href: e.target.value } })} /></CmsField>
      <CmsField label="Κεντρική εικόνα"><MediaPicker value={c.imageUrl ?? ""} onChange={(v) => f.patch({ imageUrl: typeof v === "string" ? v : v[0] ?? "" })} accept="image" /></CmsField>
      <CmsField label="Όνομα ακινήτου (κάρτα)"><CmsInput value={c.propertyName ?? ""} onChange={(e) => f.patch({ propertyName: e.target.value })} /></CmsField>
      <CmsField label="Διεύθυνση (κάρτα)"><CmsInput value={c.propertyAddress ?? ""} onChange={(e) => f.patch({ propertyAddress: e.target.value })} /></CmsField>
      <CmsField label="Πληρότητα % (κάρτα)"><CmsInput value={c.occupancy ?? ""} onChange={(e) => f.patch({ occupancy: e.target.value })} /></CmsField>
    </FormChrome>
  );
}
