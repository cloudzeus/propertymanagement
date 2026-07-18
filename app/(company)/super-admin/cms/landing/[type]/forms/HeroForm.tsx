"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { useSectionForm, FormChrome, FormGroup } from "./formShared";

export function HeroForm({ section }: { section: { id: string; type: string; data: unknown } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <FormGroup title="Κείμενα" hint="Το βασικό μήνυμα της σελίδας.">
        <CmsField label="Eyebrow (μικρό badge πάνω από τον τίτλο)"><CmsInput value={c.eyebrow ?? ""} onChange={(e) => f.patch({ eyebrow: e.target.value })} /></CmsField>
        <CmsField label="Τίτλος (H1)"><CmsInput value={c.title ?? ""} onChange={(e) => f.patch({ title: e.target.value })} /></CmsField>
        <CmsField label="Υπότιτλος"><CmsTextarea value={c.subtitle ?? ""} onChange={(e) => f.patch({ subtitle: e.target.value })} /></CmsField>
        <CmsField label="Κείμενο εμπιστοσύνης (κάτω από τα κουμπιά)"><CmsInput value={c.trustText ?? ""} onChange={(e) => f.patch({ trustText: e.target.value })} /></CmsField>
      </FormGroup>

      <FormGroup title="Κουμπιά (CTA)" cols={2}>
        <CmsField label="Κύριο κουμπί — κείμενο"><CmsInput value={c.primaryCta?.label ?? ""} onChange={(e) => f.patch({ primaryCta: { ...(c.primaryCta ?? {}), label: e.target.value } })} /></CmsField>
        <CmsField label="Κύριο κουμπί — σύνδεσμος"><CmsInput value={c.primaryCta?.href ?? ""} onChange={(e) => f.patch({ primaryCta: { ...(c.primaryCta ?? {}), href: e.target.value } })} /></CmsField>
        <CmsField label="Δεύτερο κουμπί — κείμενο"><CmsInput value={c.secondaryCta?.label ?? ""} onChange={(e) => f.patch({ secondaryCta: { ...(c.secondaryCta ?? {}), label: e.target.value } })} /></CmsField>
        <CmsField label="Δεύτερο κουμπί — σύνδεσμος"><CmsInput value={c.secondaryCta?.href ?? ""} onChange={(e) => f.patch({ secondaryCta: { ...(c.secondaryCta ?? {}), href: e.target.value } })} /></CmsField>
      </FormGroup>

      <FormGroup title="Μέσα" hint="Κοινά για όλες τις γλώσσες. Αν οριστεί βίντεο, παίζει αυτό αντί της εικόνας (η εικόνα γίνεται poster).">
        <CmsField label="Εικόνα"><MediaPicker value={c.imageUrl ?? ""} onChange={(v) => f.patchMedia("imageUrl", typeof v === "string" ? v : v[0] ?? "")} accept="image" /></CmsField>
        <CmsField label="Βίντεο (προαιρετικό)"><MediaPicker value={c.videoUrl ?? ""} onChange={(v) => f.patchMedia("videoUrl", typeof v === "string" ? v : v[0] ?? "")} accept="video" /></CmsField>
      </FormGroup>

      <FormGroup title="Κάρτα ακινήτου" hint="Η λευκή ετικέτα πάνω στη φωτογραφία." cols={2}>
        <CmsField label="Όνομα ακινήτου"><CmsInput value={c.propertyName ?? ""} onChange={(e) => f.patch({ propertyName: e.target.value })} /></CmsField>
        <CmsField label="Διεύθυνση"><CmsInput value={c.propertyAddress ?? ""} onChange={(e) => f.patch({ propertyAddress: e.target.value })} /></CmsField>
        <CmsField label="Πληρότητα (π.χ. 96%)"><CmsInput value={c.occupancy ?? ""} onChange={(e) => f.patch({ occupancy: e.target.value })} /></CmsField>
        <CmsField label="Ετικέτα πληρότητας"><CmsInput value={c.occLabel ?? ""} onChange={(e) => f.patch({ occLabel: e.target.value })} /></CmsField>
      </FormGroup>

      <FormGroup title="Floating κάρτες" hint="Το toast «πληρωμής» και το mini dashboard που αιωρούνται πάνω στη φωτογραφία." cols={2}>
        <CmsField label="Toast — τίτλος"><CmsInput value={c.toastTitle ?? ""} onChange={(e) => f.patch({ toastTitle: e.target.value })} /></CmsField>
        <CmsField label="Toast — υπότιτλος"><CmsInput value={c.toastSub ?? ""} onChange={(e) => f.patch({ toastSub: e.target.value })} /></CmsField>
        <CmsField label="Live badge"><CmsInput value={c.liveBadge ?? ""} onChange={(e) => f.patch({ liveBadge: e.target.value })} /></CmsField>
        <CmsField label="Μήνας"><CmsInput value={c.monthLabel ?? ""} onChange={(e) => f.patch({ monthLabel: e.target.value })} /></CmsField>
        <CmsField label="KPI 1 — ετικέτα"><CmsInput value={c.kpi1Label ?? ""} onChange={(e) => f.patch({ kpi1Label: e.target.value })} /></CmsField>
        <CmsField label="KPI 1 — τιμή"><CmsInput value={c.kpi1Value ?? ""} onChange={(e) => f.patch({ kpi1Value: e.target.value })} /></CmsField>
        <CmsField label="KPI 2 — ετικέτα"><CmsInput value={c.kpi2Label ?? ""} onChange={(e) => f.patch({ kpi2Label: e.target.value })} /></CmsField>
        <CmsField label="KPI 2 — τιμή"><CmsInput value={c.kpi2Value ?? ""} onChange={(e) => f.patch({ kpi2Value: e.target.value })} /></CmsField>
        <CmsField label="Ετικέτα γραφήματος"><CmsInput value={c.chartLabel ?? ""} onChange={(e) => f.patch({ chartLabel: e.target.value })} /></CmsField>
      </FormGroup>
    </FormChrome>
  );
}
