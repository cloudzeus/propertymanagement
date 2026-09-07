"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { usePageForm, FormChrome, FormGroup, HeaderFields, RowList } from "./pageFormShared";

export function NewsPageForm({ initial }: { initial: unknown }) {
  const f = usePageForm("news", initial);
  const c = f.cur;

  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <HeaderFields header={c.header ?? {}} onChange={(p) => f.setGroup("header", p)} />

      <FormGroup
        title="Κατηγορίες"
        hint="Το «slug» πρέπει να ταιριάζει με ετικέτα (tag) άρθρου. Αφήστε το κενό για το chip «Όλα». Ετικέτες που δεν ορίζονται εδώ εμφανίζονται αυτόματα στο τέλος."
      >
        <RowList
          items={c.categories ?? []}
          onChange={(next) => f.setList("categories", next)}
          newItem={() => ({ slug: "", label: "" })}
          addLabel="Προσθήκη κατηγορίας"
          renderFields={(item, patch) => (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <CmsField label="Slug (tag)"><CmsInput value={item.slug ?? ""} onChange={(e) => patch({ slug: e.target.value })} /></CmsField>
              <CmsField label="Ετικέτα"><CmsInput value={item.label ?? ""} onChange={(e) => patch({ label: e.target.value })} /></CmsField>
            </div>
          )}
        />
      </FormGroup>

      <FormGroup title="Λίστα άρθρων" cols={2}>
        <CmsField label="Κουμπί προβεβλημένου άρθρου">
          <CmsInput value={c.featuredCtaLabel ?? ""} onChange={(e) => f.patch({ featuredCtaLabel: e.target.value })} />
        </CmsField>
        <CmsField label="Κουμπί «Περισσότερα»">
          <CmsInput value={c.loadMoreLabel ?? ""} onChange={(e) => f.patch({ loadMoreLabel: e.target.value })} />
        </CmsField>
        <CmsField label="Χρόνος ανάγνωσης" hint="Το {minutes} αντικαθίσταται από τα λεπτά.">
          <CmsInput value={c.readTimeTemplate ?? ""} onChange={(e) => f.patch({ readTimeTemplate: e.target.value })} />
        </CmsField>
      </FormGroup>

      <FormGroup title="Newsletter strip">
        <CmsField label="Τίτλος"><CmsInput value={c.newsletter?.heading ?? ""} onChange={(e) => f.setGroup("newsletter", { heading: e.target.value })} /></CmsField>
        <CmsField label="Κείμενο"><CmsTextarea value={c.newsletter?.body ?? ""} onChange={(e) => f.setGroup("newsletter", { body: e.target.value })} /></CmsField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <CmsField label="Placeholder πεδίου"><CmsInput value={c.newsletter?.placeholder ?? ""} onChange={(e) => f.setGroup("newsletter", { placeholder: e.target.value })} /></CmsField>
          <CmsField label="Κουμπί"><CmsInput value={c.newsletter?.submitLabel ?? ""} onChange={(e) => f.setGroup("newsletter", { submitLabel: e.target.value })} /></CmsField>
        </div>
        <CmsField label="Μήνυμα επιτυχίας"><CmsInput value={c.newsletter?.successMessage ?? ""} onChange={(e) => f.setGroup("newsletter", { successMessage: e.target.value })} /></CmsField>
        <CmsField label="Μήνυμα σφάλματος"><CmsInput value={c.newsletter?.errorMessage ?? ""} onChange={(e) => f.setGroup("newsletter", { errorMessage: e.target.value })} /></CmsField>
      </FormGroup>

      <FormGroup title="Σελίδα άρθρου" cols={2}>
        <CmsField label="Breadcrumb — ρίζα"><CmsInput value={c.article?.breadcrumbRoot ?? ""} onChange={(e) => f.setGroup("article", { breadcrumbRoot: e.target.value })} /></CmsField>
        <CmsField label="Ετικέτα κοινοποίησης"><CmsInput value={c.article?.shareLabel ?? ""} onChange={(e) => f.setGroup("article", { shareLabel: e.target.value })} /></CmsField>
        <CmsField label="Ετικέτα «Βασικά σημεία»"><CmsInput value={c.article?.takeawaysLabel ?? ""} onChange={(e) => f.setGroup("article", { takeawaysLabel: e.target.value })} /></CmsField>
        <CmsField label="Kicker σχετικών"><CmsInput value={c.article?.relatedKicker ?? ""} onChange={(e) => f.setGroup("article", { relatedKicker: e.target.value })} /></CmsField>
        <CmsField label="Επικεφαλίδα σχετικών"><CmsInput value={c.article?.relatedHeading ?? ""} onChange={(e) => f.setGroup("article", { relatedHeading: e.target.value })} /></CmsField>
        <CmsField label="Κουμπί «Όλα τα άρθρα»"><CmsInput value={c.article?.relatedCtaLabel ?? ""} onChange={(e) => f.setGroup("article", { relatedCtaLabel: e.target.value })} /></CmsField>
      </FormGroup>
    </FormChrome>
  );
}
