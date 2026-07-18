"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { ItemsEditor } from "@/components/cms/ItemsEditor";
import { useSectionForm, FormChrome } from "./formShared";

type Item = { id: string; title: string; body?: string };

export function ShowcaseForm({ section }: { section: { id: string; type: string; data: unknown } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  const points: Item[] = Array.isArray(c.points) ? c.points : [];
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Kicker"><CmsInput value={c.kicker ?? ""} onChange={(e) => f.patch({ kicker: e.target.value })} /></CmsField>
      <CmsField label="Επικεφαλίδα"><CmsInput value={c.heading ?? ""} onChange={(e) => f.patch({ heading: e.target.value })} /></CmsField>
      <CmsField label="Υπότιτλος"><CmsTextarea value={c.subtitle ?? ""} onChange={(e) => f.patch({ subtitle: e.target.value })} /></CmsField>
      <CmsField label="Εικόνα (κοινή για όλες τις γλώσσες)"><MediaPicker value={c.imageUrl ?? ""} onChange={(v) => f.patchMedia("imageUrl", typeof v === "string" ? v : v[0] ?? "")} accept="image" /></CmsField>
      <CmsField label="Stat 1 — τιμή"><CmsInput value={c.stat1?.value ?? ""} onChange={(e) => f.patch({ stat1: { ...(c.stat1 ?? {}), value: e.target.value } })} /></CmsField>
      <CmsField label="Stat 1 — ετικέτα"><CmsInput value={c.stat1?.label ?? ""} onChange={(e) => f.patch({ stat1: { ...(c.stat1 ?? {}), label: e.target.value } })} /></CmsField>
      <CmsField label="Stat 2 — τιμή"><CmsInput value={c.stat2?.value ?? ""} onChange={(e) => f.patch({ stat2: { ...(c.stat2 ?? {}), value: e.target.value } })} /></CmsField>
      <CmsField label="Stat 2 — ετικέτα"><CmsInput value={c.stat2?.label ?? ""} onChange={(e) => f.patch({ stat2: { ...(c.stat2 ?? {}), label: e.target.value } })} /></CmsField>
      <CmsField label="CTA — κείμενο"><CmsInput value={c.cta?.label ?? ""} onChange={(e) => f.patch({ cta: { ...(c.cta ?? {}), label: e.target.value } })} /></CmsField>
      <CmsField label="CTA — σύνδεσμος"><CmsInput value={c.cta?.href ?? ""} onChange={(e) => f.patch({ cta: { ...(c.cta ?? {}), href: e.target.value } })} /></CmsField>
      <ItemsEditor<Item>
        items={points}
        onChange={(next) => f.setItems("points", next)}
        newItem={() => ({ id: crypto.randomUUID(), title: "", body: "" })}
        addLabel="Προσθήκη σημείου"
        renderFields={(item, patch) => (
          <>
            <CmsField label="Τίτλος"><CmsInput value={item.title} onChange={(e) => patch({ title: e.target.value })} /></CmsField>
            <CmsField label="Περιγραφή"><CmsInput value={item.body ?? ""} onChange={(e) => patch({ body: e.target.value })} /></CmsField>
          </>
        )}
      />
    </FormChrome>
  );
}
