"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { ItemsEditor } from "@/components/cms/ItemsEditor";
import { useSectionForm, FormChrome } from "./formShared";

type Item = { id: string; initial: string; name: string; tag: string; points: string[] };

export function RolesForm({ section }: { section: { id: string; type: string; data: unknown } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  const roles: Item[] = Array.isArray(c.roles) ? c.roles : [];
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Kicker"><CmsInput value={c.kicker ?? ""} onChange={(e) => f.patch({ kicker: e.target.value })} /></CmsField>
      <CmsField label="Επικεφαλίδα"><CmsInput value={c.heading ?? ""} onChange={(e) => f.patch({ heading: e.target.value })} /></CmsField>
      <CmsField label="Υπότιτλος"><CmsTextarea value={c.subtitle ?? ""} onChange={(e) => f.patch({ subtitle: e.target.value })} /></CmsField>
      <ItemsEditor<Item>
        items={roles}
        onChange={(next) => f.setItems("roles", next)}
        newItem={() => ({ id: crypto.randomUUID(), initial: "", name: "", tag: "", points: [] })}
        addLabel="Προσθήκη ρόλου"
        renderFields={(item, patch) => (
          <>
            <CmsField label="Αρχικό (badge)"><CmsInput value={item.initial} maxLength={2} onChange={(e) => patch({ initial: e.target.value })} /></CmsField>
            <CmsField label="Όνομα ρόλου"><CmsInput value={item.name} onChange={(e) => patch({ name: e.target.value })} /></CmsField>
            <CmsField label="Ετικέτα"><CmsInput value={item.tag} onChange={(e) => patch({ tag: e.target.value })} /></CmsField>
            <CmsField label="Σημεία (ένα ανά γραμμή)">
              <CmsTextarea
                rows={4}
                value={(item.points ?? []).join("\n")}
                onChange={(e) => patch({ points: e.target.value.split("\n") })}
                onBlur={(e) => patch({ points: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              />
            </CmsField>
          </>
        )}
      />
    </FormChrome>
  );
}
