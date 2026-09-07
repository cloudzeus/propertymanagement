"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { usePageForm, FormChrome, FormGroup, HeaderFields, RowList } from "./pageFormShared";

export function FaqPageForm({ initial }: { initial: unknown }) {
  const f = usePageForm("faq", initial);
  const c = f.cur;

  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <HeaderFields header={c.header ?? {}} onChange={(p) => f.setGroup("header", p)} />

      <FormGroup
        title="Κατηγορίες πλαϊνής στήλης"
        hint="Το «slug» πρέπει να ταιριάζει με το πεδίο «κατηγορία» των ερωτήσεων. Η σειρά εδώ είναι η σειρά στη σελίδα· κατηγορίες με ερωτήσεις που δεν ορίζονται εδώ εμφανίζονται στο τέλος."
      >
        <RowList
          items={c.categories ?? []}
          onChange={(next) => f.setList("categories", next)}
          newItem={() => ({ slug: "", label: "" })}
          addLabel="Προσθήκη κατηγορίας"
          renderFields={(item, patch) => (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <CmsField label="Slug"><CmsInput value={item.slug ?? ""} onChange={(e) => patch({ slug: e.target.value })} /></CmsField>
              <CmsField label="Ετικέτα"><CmsInput value={item.label ?? ""} onChange={(e) => patch({ label: e.target.value })} /></CmsField>
            </div>
          )}
        />
      </FormGroup>

      <FormGroup title="Κάρτα βοήθειας">
        <CmsField label="Τίτλος"><CmsInput value={c.help?.heading ?? ""} onChange={(e) => f.setGroup("help", { heading: e.target.value })} /></CmsField>
        <CmsField label="Κείμενο"><CmsTextarea value={c.help?.body ?? ""} onChange={(e) => f.setGroup("help", { body: e.target.value })} /></CmsField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <CmsField label="Κουμπί — κείμενο">
            <CmsInput value={c.help?.cta?.label ?? ""} onChange={(e) => f.setGroup("help", { cta: { ...(c.help?.cta ?? {}), label: e.target.value } })} />
          </CmsField>
          <CmsField label="Κουμπί — σύνδεσμος">
            <CmsInput value={c.help?.cta?.href ?? ""} onChange={(e) => f.setGroup("help", { cta: { ...(c.help?.cta ?? {}), href: e.target.value } })} />
          </CmsField>
        </div>
      </FormGroup>
    </FormChrome>
  );
}
