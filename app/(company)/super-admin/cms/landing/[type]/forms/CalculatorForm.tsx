"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { useSectionForm, FormChrome, FormGroup } from "./formShared";

const PLANS = [
  { key: "essential", label: "Essential" },
  { key: "standard", label: "Standard" },
  { key: "pro", label: "Pro" },
];
const ADDONS = [
  { key: "payments", label: "Ηλεκτρονικές πληρωμές" },
  { key: "technician", label: "Εφαρμογή τεχνικού" },
  { key: "accounting", label: "Λογιστική εξαγωγή" },
];

/**
 * Rates and the annual multiplier are language-independent, so they are written
 * into both dictionaries at once (`setBoth`) — otherwise the Greek page could
 * quote a different price from the English one. Only names and unit lines are
 * per-language.
 */
export function CalculatorForm({ section }: { section: { id: string; type: string; data: unknown } }) {
  const f = useSectionForm(section);
  const c = f.cur;

  /** Merge one key into a shared record without dropping the others. */
  function setNumber(group: "rates" | "minimums" | "addonRates", key: string, raw: string) {
    const parsed = raw.trim() === "" ? undefined : Number(raw);
    const value = Number.isFinite(parsed as number) ? parsed : undefined;
    f.setBoth(group, { ...((c[group] as Record<string, unknown>) ?? {}), [key]: value });
  }
  function setText(group: "planNames" | "planUnits" | "addonNames", key: string, value: string) {
    f.patch({ [group]: { ...((c[group] as Record<string, unknown>) ?? {}), [key]: value } });
  }

  const rates = (c.rates ?? {}) as Record<string, number | undefined>;
  const minimums = (c.minimums ?? {}) as Record<string, number | undefined>;
  const addonRates = (c.addonRates ?? {}) as Record<string, number | undefined>;
  const planNames = (c.planNames ?? {}) as Record<string, string | undefined>;
  const planUnits = (c.planUnits ?? {}) as Record<string, string | undefined>;
  const addonNames = (c.addonNames ?? {}) as Record<string, string | undefined>;

  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <FormGroup title="Κείμενα ενότητας">
        <CmsField label="Kicker"><CmsInput value={c.kicker ?? ""} onChange={(e) => f.patch({ kicker: e.target.value })} /></CmsField>
        <CmsField label="Επικεφαλίδα"><CmsInput value={c.heading ?? ""} onChange={(e) => f.patch({ heading: e.target.value })} /></CmsField>
        <CmsField label="Εισαγωγή"><CmsTextarea value={c.lead ?? ""} onChange={(e) => f.patch({ lead: e.target.value })} /></CmsField>
        <CmsField label="Υποσημείωση" hint="Κάτω από τα κουμπιά της κάρτας αποτελέσματος — π.χ. «Μόνο εκτίμηση. Χωρίς ΦΠΑ.»">
          <CmsTextarea value={c.footnote ?? ""} onChange={(e) => f.patch({ footnote: e.target.value })} />
        </CmsField>
      </FormGroup>

      <FormGroup title="Κουμπιά κάρτας αποτελέσματος" cols={2}>
        <CmsField label="Κύριο — κείμενο">
          <CmsInput value={c.primaryCta?.label ?? ""} onChange={(e) => f.patch({ primaryCta: { ...(c.primaryCta ?? {}), label: e.target.value } })} />
        </CmsField>
        <CmsField label="Κύριο — σύνδεσμος">
          <CmsInput value={c.primaryCta?.href ?? ""} onChange={(e) => f.patch({ primaryCta: { ...(c.primaryCta ?? {}), href: e.target.value } })} />
        </CmsField>
        <CmsField label="Δευτερεύον — κείμενο">
          <CmsInput value={c.secondaryCta?.label ?? ""} onChange={(e) => f.patch({ secondaryCta: { ...(c.secondaryCta ?? {}), label: e.target.value } })} />
        </CmsField>
        <CmsField label="Δευτερεύον — σύνδεσμος">
          <CmsInput value={c.secondaryCta?.href ?? ""} onChange={(e) => f.patch({ secondaryCta: { ...(c.secondaryCta ?? {}), href: e.target.value } })} />
        </CmsField>
      </FormGroup>

      {PLANS.map((p) => (
        <FormGroup
          key={p.key}
          title={`Πακέτο — ${p.label}`}
          hint="Οι τιμές είναι € ανά διαμέρισμα / μήνα, χωρίς ΦΠΑ, και ισχύουν και στις δύο γλώσσες."
          cols={2}
        >
          <CmsField label="Όνομα"><CmsInput value={planNames[p.key] ?? ""} onChange={(e) => setText("planNames", p.key, e.target.value)} /></CmsField>
          <CmsField label="Γραμμή περιεχομένου" hint="π.χ. «+ αιτήματα, αρχεία, επικοινωνία»">
            <CmsInput value={planUnits[p.key] ?? ""} onChange={(e) => setText("planUnits", p.key, e.target.value)} />
          </CmsField>
          <CmsField label="Τιμή ανά διαμέρισμα (€)">
            <CmsInput type="number" step="0.01" min="0" value={rates[p.key] ?? ""} onChange={(e) => setNumber("rates", p.key, e.target.value)} />
          </CmsField>
          <CmsField label="Ελάχιστο ανά κτήριο (€)" hint="Ισχύει ανά κτήριο, όχι ανά χαρτοφυλάκιο.">
            <CmsInput type="number" step="1" min="0" value={minimums[p.key] ?? ""} onChange={(e) => setNumber("minimums", p.key, e.target.value)} />
          </CmsField>
        </FormGroup>
      ))}

      {ADDONS.map((a) => (
        <FormGroup key={a.key} title={`Πρόσθετο — ${a.label}`} cols={2}>
          <CmsField label="Όνομα"><CmsInput value={addonNames[a.key] ?? ""} onChange={(e) => setText("addonNames", a.key, e.target.value)} /></CmsField>
          <CmsField label="Τιμή ανά διαμέρισμα (€)">
            <CmsInput type="number" step="0.01" min="0" value={addonRates[a.key] ?? ""} onChange={(e) => setNumber("addonRates", a.key, e.target.value)} />
          </CmsField>
        </FormGroup>
      ))}

      <FormGroup title="Ετήσια χρέωση">
        <CmsField label="Πολλαπλασιαστής" hint="0.8 = έκπτωση 20%. Χρησιμοποιείται και στη σελίδα «Τιμές».">
          <CmsInput
            type="number" step="0.01" min="0.1" max="1"
            value={c.annualMultiplier ?? ""}
            onChange={(e) => {
              const parsed = e.target.value.trim() === "" ? undefined : Number(e.target.value);
              f.setBoth("annualMultiplier", Number.isFinite(parsed as number) ? parsed : undefined);
            }}
          />
        </CmsField>
      </FormGroup>
    </FormChrome>
  );
}
