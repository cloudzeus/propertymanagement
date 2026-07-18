"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { ItemsEditor } from "@/components/cms/ItemsEditor";
import { useSectionForm, FormChrome } from "./formShared";

type Column = { id: string; heading: string; links: { label: string; href: string }[] };

/** Links are edited as one "Κείμενο | /σύνδεσμος" pair per line. */
function linksToText(links: Column["links"]): string {
  return (links ?? []).map((l) => `${l.label} | ${l.href}`).join("\n");
}
function textToLinks(text: string): Column["links"] {
  return text
    .split("\n")
    .map((line) => {
      const [label, href] = line.split("|").map((s) => s.trim());
      return { label: label ?? "", href: href ?? "" };
    })
    .filter((l) => l.label);
}

export function FooterForm({ section }: { section: { id: string; type: string; data: unknown } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  const columns: Column[] = Array.isArray(c.columns) ? c.columns : [];
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Tagline (κάτω από το λογότυπο)"><CmsTextarea value={c.tagline ?? ""} onChange={(e) => f.patch({ tagline: e.target.value })} /></CmsField>
      <CmsField label="Copyright"><CmsInput value={c.copyright ?? ""} onChange={(e) => f.patch({ copyright: e.target.value })} placeholder="© 2026 Orithon · Athens · Greece" /></CmsField>
      <ItemsEditor<Column>
        items={columns}
        onChange={(next) => f.setItems("columns", next)}
        newItem={() => ({ id: crypto.randomUUID(), heading: "", links: [] })}
        addLabel="Προσθήκη στήλης"
        renderFields={(item, patch) => (
          <>
            <CmsField label="Τίτλος στήλης"><CmsInput value={item.heading} onChange={(e) => patch({ heading: e.target.value })} /></CmsField>
            <CmsField label="Σύνδεσμοι (ένας ανά γραμμή: Κείμενο | /σύνδεσμος)">
              <CmsTextarea rows={4} defaultValue={linksToText(item.links)} onBlur={(e) => patch({ links: textToLinks(e.target.value) })} />
            </CmsField>
          </>
        )}
      />
    </FormChrome>
  );
}
