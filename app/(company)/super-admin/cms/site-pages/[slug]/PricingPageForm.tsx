"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { usePageForm, FormChrome, FormGroup, HeaderFields, RowList } from "./pageFormShared";

export function PricingPageForm({ initial }: { initial: unknown }) {
  const f = usePageForm("pricing", initial);
  const c = f.cur;
  const comparison = c.comparison ?? {};
  const columns: string[] = comparison.columns ?? ["", "", ""];

  function setColumn(i: number, value: string) {
    const next = [...columns];
    next[i] = value;
    f.setGroup("comparison", { columns: next });
  }

  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <HeaderFields header={c.header ?? {}} onChange={(p) => f.setGroup("header", p)} />

      <FormGroup title="Διακόπτης χρέωσης & τιμές" cols={2}>
        <CmsField label="Ετικέτα «Μηνιαία»">
          <CmsInput value={c.billingMonthlyLabel ?? ""} onChange={(e) => f.patch({ billingMonthlyLabel: e.target.value })} />
        </CmsField>
        <CmsField label="Ετικέτα «Ετήσια»">
          <CmsInput value={c.billingAnnualLabel ?? ""} onChange={(e) => f.patch({ billingAnnualLabel: e.target.value })} />
        </CmsField>
        <CmsField label="Μονάδα τιμής" hint="Δίπλα στο ποσό — π.χ. «ανά διαμέρισμα / μήνα».">
          <CmsInput value={c.priceUnit ?? ""} onChange={(e) => f.patch({ priceUnit: e.target.value })} />
        </CmsField>
        <CmsField label="Γραμμή ελαχίστου" hint="Το {value} αντικαθίσταται από το ποσό.">
          <CmsInput value={c.minimumTemplate ?? ""} onChange={(e) => f.patch({ minimumTemplate: e.target.value })} />
        </CmsField>
      </FormGroup>

      <FormGroup title="Strip για μεγάλα χαρτοφυλάκια">
        <CmsField label="Τίτλος">
          <CmsInput value={c.enterprise?.heading ?? ""} onChange={(e) => f.setGroup("enterprise", { heading: e.target.value })} />
        </CmsField>
        <CmsField label="Κείμενο">
          <CmsTextarea value={c.enterprise?.body ?? ""} onChange={(e) => f.setGroup("enterprise", { body: e.target.value })} />
        </CmsField>
        <CmsField label="Κουμπί — κείμενο">
          <CmsInput value={c.enterprise?.cta?.label ?? ""} onChange={(e) => f.setGroup("enterprise", { cta: { ...(c.enterprise?.cta ?? {}), label: e.target.value } })} />
        </CmsField>
        <CmsField label="Κουμπί — σύνδεσμος">
          <CmsInput value={c.enterprise?.cta?.href ?? ""} onChange={(e) => f.setGroup("enterprise", { cta: { ...(c.enterprise?.cta ?? {}), href: e.target.value } })} />
        </CmsField>
      </FormGroup>

      <FormGroup title="«Όλα τα πακέτα περιλαμβάνουν»">
        <CmsField label="Kicker">
          <CmsInput value={c.includedKicker ?? ""} onChange={(e) => f.patch({ includedKicker: e.target.value })} />
        </CmsField>
        <RowList
          items={c.included ?? []}
          onChange={(next) => f.setList("included", next)}
          newItem={() => ({ title: "", body: "" })}
          addLabel="Προσθήκη πλακιδίου"
          renderFields={(item, patch) => (
            <>
              <CmsField label="Τίτλος"><CmsInput value={item.title ?? ""} onChange={(e) => patch({ title: e.target.value })} /></CmsField>
              <CmsField label="Περιγραφή"><CmsTextarea value={item.body ?? ""} onChange={(e) => patch({ body: e.target.value })} /></CmsField>
            </>
          )}
        />
      </FormGroup>

      <FormGroup title="Πίνακας σύγκρισης">
        <CmsField label="Kicker">
          <CmsInput value={comparison.kicker ?? ""} onChange={(e) => f.setGroup("comparison", { kicker: e.target.value })} />
        </CmsField>
        <CmsField label="Επικεφαλίδα">
          <CmsInput value={comparison.heading ?? ""} onChange={(e) => f.setGroup("comparison", { heading: e.target.value })} />
        </CmsField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <CmsField key={i} label={`Στήλη ${i + 1}`}>
              <CmsInput value={columns[i] ?? ""} onChange={(e) => setColumn(i, e.target.value)} />
            </CmsField>
          ))}
        </div>
        <RowList
          items={comparison.rows ?? []}
          onChange={(next) => f.setGroup("comparison", { rows: next })}
          newItem={() => ({ feature: "", essential: "—", standard: "—", pro: "—" })}
          addLabel="Προσθήκη γραμμής"
          renderFields={(item, patch) => (
            <>
              <CmsField label="Χαρακτηριστικό"><CmsInput value={item.feature ?? ""} onChange={(e) => patch({ feature: e.target.value })} /></CmsField>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <CmsField label={columns[0] || "Στήλη 1"} hint="✓, — ή ελεύθερο κείμενο.">
                  <CmsInput value={item.essential ?? ""} onChange={(e) => patch({ essential: e.target.value })} />
                </CmsField>
                <CmsField label={columns[1] || "Στήλη 2"}>
                  <CmsInput value={item.standard ?? ""} onChange={(e) => patch({ standard: e.target.value })} />
                </CmsField>
                <CmsField label={columns[2] || "Στήλη 3"}>
                  <CmsInput value={item.pro ?? ""} onChange={(e) => patch({ pro: e.target.value })} />
                </CmsField>
              </div>
            </>
          )}
        />
      </FormGroup>

      <FormGroup title="Strip κοστολογίου (σκούρο)">
        <CmsField label="Τίτλος">
          <CmsInput value={c.calculatorStrip?.heading ?? ""} onChange={(e) => f.setGroup("calculatorStrip", { heading: e.target.value })} />
        </CmsField>
        <CmsField label="Κείμενο">
          <CmsTextarea value={c.calculatorStrip?.body ?? ""} onChange={(e) => f.setGroup("calculatorStrip", { body: e.target.value })} />
        </CmsField>
        <CmsField label="Κουμπί — κείμενο">
          <CmsInput value={c.calculatorStrip?.cta?.label ?? ""} onChange={(e) => f.setGroup("calculatorStrip", { cta: { ...(c.calculatorStrip?.cta ?? {}), label: e.target.value } })} />
        </CmsField>
        <CmsField label="Κουμπί — σύνδεσμος">
          <CmsInput value={c.calculatorStrip?.cta?.href ?? ""} onChange={(e) => f.setGroup("calculatorStrip", { cta: { ...(c.calculatorStrip?.cta ?? {}), href: e.target.value } })} />
        </CmsField>
      </FormGroup>
    </FormChrome>
  );
}
