"use client";
import { CmsField, CmsInput } from "@/components/cms/ui";
import { ItemsEditor } from "@/components/cms/ItemsEditor";
import { useSectionForm, FormChrome } from "./formShared";

type Item = { id: string; label: string; href: string };

export function NavForm({ section }: { section: { id: string; type: string; data: unknown } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  const links: Item[] = Array.isArray(c.links) ? c.links : [];
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="«Σύνδεση» — κείμενο"><CmsInput value={c.loginLabel ?? ""} onChange={(e) => f.patch({ loginLabel: e.target.value })} /></CmsField>
      <CmsField label="Κουμπί demo — κείμενο"><CmsInput value={c.demoLabel ?? ""} onChange={(e) => f.patch({ demoLabel: e.target.value })} /></CmsField>
      <CmsField label="Κουμπί demo — σύνδεσμος"><CmsInput value={c.demoHref ?? ""} onChange={(e) => f.patch({ demoHref: e.target.value })} /></CmsField>
      <CmsField label="«Ο χώρος μου» — κείμενο (συνδεδεμένοι)"><CmsInput value={c.mineLabel ?? ""} onChange={(e) => f.patch({ mineLabel: e.target.value })} /></CmsField>
      <ItemsEditor<Item>
        items={links}
        onChange={(next) => f.setItems("links", next)}
        newItem={() => ({ id: crypto.randomUUID(), label: "", href: "/" })}
        addLabel="Προσθήκη συνδέσμου"
        renderFields={(item, patch) => (
          <>
            <CmsField label="Κείμενο"><CmsInput value={item.label} onChange={(e) => patch({ label: e.target.value })} /></CmsField>
            <CmsField label="Σύνδεσμος"><CmsInput value={item.href} onChange={(e) => patch({ href: e.target.value })} /></CmsField>
          </>
        )}
      />
    </FormChrome>
  );
}
