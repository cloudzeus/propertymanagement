"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { usePageForm, FormChrome, FormGroup, HeaderFields, RowList, ListTextarea } from "./pageFormShared";

const ICON_OPTIONS = [
  { value: "phone", label: "Τηλέφωνο" },
  { value: "mail", label: "Email" },
  { value: "flag", label: "Σημαία" },
];

export function ContactPageForm({ initial }: { initial: unknown }) {
  const f = usePageForm("contact", initial);
  const c = f.cur;
  const form = c.form ?? {};

  /** Merge into a nested object of `form`. */
  function setForm(key: string, p: Record<string, unknown>) {
    f.setGroup("form", { [key]: { ...(form[key] ?? {}), ...p } });
  }

  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <HeaderFields header={c.header ?? {}} onChange={(p) => f.setGroup("header", p)} />

      <FormGroup title="Φόρμα — εισαγωγή">
        <CmsField label="Τίτλος"><CmsInput value={form.heading ?? ""} onChange={(e) => f.setGroup("form", { heading: e.target.value })} /></CmsField>
        <CmsField label="Κείμενο"><CmsTextarea value={form.body ?? ""} onChange={(e) => f.setGroup("form", { body: e.target.value })} /></CmsField>
      </FormGroup>

      <FormGroup title="Φόρμα — ετικέτες πεδίων" cols={2}>
        {([
          ["name", "Ονοματεπώνυμο"], ["company", "Εταιρία"], ["email", "Email"], ["phone", "Τηλέφωνο"],
          ["buildings", "Κτήρια"], ["topic", "Θέμα"], ["message", "Μήνυμα"],
        ] as const).map(([key, label]) => (
          <CmsField key={key} label={label}>
            <CmsInput value={form.labels?.[key] ?? ""} onChange={(e) => setForm("labels", { [key]: e.target.value })} />
          </CmsField>
        ))}
      </FormGroup>

      <FormGroup title="Φόρμα — placeholders" cols={2}>
        {([
          ["name", "Ονοματεπώνυμο"], ["company", "Εταιρία"], ["email", "Email"], ["phone", "Τηλέφωνο"],
        ] as const).map(([key, label]) => (
          <CmsField key={key} label={label}>
            <CmsInput value={form.placeholders?.[key] ?? ""} onChange={(e) => setForm("placeholders", { [key]: e.target.value })} />
          </CmsField>
        ))}
        <CmsField label="Μήνυμα">
          <CmsTextarea value={form.placeholders?.message ?? ""} onChange={(e) => setForm("placeholders", { message: e.target.value })} />
        </CmsField>
      </FormGroup>

      <FormGroup title="Φόρμα — επιλογές λιστών">
        <ListTextarea
          label="Κτήρια που διαχειρίζεστε"
          value={form.buildingOptions ?? []}
          onChange={(next) => f.setGroup("form", { buildingOptions: next })}
        />
        <ListTextarea
          label="Θέματα"
          value={form.topicOptions ?? []}
          onChange={(next) => f.setGroup("form", { topicOptions: next })}
        />
      </FormGroup>

      <FormGroup title="Φόρμα — συγκατάθεση & αποστολή">
        <CmsField label="Κείμενο συγκατάθεσης" hint="Ο σύνδεσμος προστίθεται στο τέλος της πρότασης.">
          <CmsTextarea value={form.consent ?? ""} onChange={(e) => f.setGroup("form", { consent: e.target.value })} />
        </CmsField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <CmsField label="Κείμενο συνδέσμου"><CmsInput value={form.consentLinkLabel ?? ""} onChange={(e) => f.setGroup("form", { consentLinkLabel: e.target.value })} /></CmsField>
          <CmsField label="Σύνδεσμος"><CmsInput value={form.consentLinkHref ?? ""} onChange={(e) => f.setGroup("form", { consentLinkHref: e.target.value })} /></CmsField>
          <CmsField label="Κουμπί αποστολής"><CmsInput value={form.submitLabel ?? ""} onChange={(e) => f.setGroup("form", { submitLabel: e.target.value })} /></CmsField>
          <CmsField label="Κουμπί κατά την αποστολή"><CmsInput value={form.submittingLabel ?? ""} onChange={(e) => f.setGroup("form", { submittingLabel: e.target.value })} /></CmsField>
        </div>
        <CmsField label="Υποσημείωση"><CmsInput value={form.footnote ?? ""} onChange={(e) => f.setGroup("form", { footnote: e.target.value })} /></CmsField>
        <CmsField label="Μήνυμα σφάλματος"><CmsInput value={form.errorMessage ?? ""} onChange={(e) => f.setGroup("form", { errorMessage: e.target.value })} /></CmsField>
      </FormGroup>

      <FormGroup title="Φόρμα — οθόνη επιτυχίας">
        <CmsField label="Τίτλος"><CmsInput value={form.success?.heading ?? ""} onChange={(e) => setForm("success", { heading: e.target.value })} /></CmsField>
        <CmsField label="Κείμενο"><CmsTextarea value={form.success?.body ?? ""} onChange={(e) => setForm("success", { body: e.target.value })} /></CmsField>
        <CmsField label="Κουμπί επιστροφής"><CmsInput value={form.success?.againLabel ?? ""} onChange={(e) => setForm("success", { againLabel: e.target.value })} /></CmsField>
      </FormGroup>

      <FormGroup title="Κάρτες επικοινωνίας">
        <RowList
          items={c.cards ?? []}
          onChange={(next) => f.setList("cards", next)}
          newItem={() => ({ icon: "mail", title: "", body: "", value: "", href: "" })}
          addLabel="Προσθήκη κάρτας"
          renderFields={(item, patch) => (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <CmsField label="Εικονίδιο">
                  <select
                    value={item.icon ?? "mail"}
                    onChange={(e) => patch({ icon: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, fontSize: "var(--fs-13)", background: "var(--bg-canvas)", color: "var(--foreground)" }}
                  >
                    {ICON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </CmsField>
                <CmsField label="Τίτλος"><CmsInput value={item.title ?? ""} onChange={(e) => patch({ title: e.target.value })} /></CmsField>
              </div>
              <CmsField label="Περιγραφή"><CmsInput value={item.body ?? ""} onChange={(e) => patch({ body: e.target.value })} /></CmsField>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <CmsField label="Τιμή" hint="Ό,τι βλέπει ο επισκέπτης."><CmsInput value={item.value ?? ""} onChange={(e) => patch({ value: e.target.value })} /></CmsField>
                <CmsField label="Σύνδεσμος" hint="tel:… ή mailto:…"><CmsInput value={item.href ?? ""} onChange={(e) => patch({ href: e.target.value })} /></CmsField>
              </div>
            </>
          )}
        />
      </FormGroup>

      <FormGroup title="Ώρες υποστήριξης">
        <CmsField label="Τίτλος"><CmsInput value={c.hours?.heading ?? ""} onChange={(e) => f.setGroup("hours", { heading: e.target.value })} /></CmsField>
        <RowList
          items={c.hours?.rows ?? []}
          onChange={(next) => f.setGroup("hours", { rows: next })}
          newItem={() => ({ day: "", hours: "" })}
          addLabel="Προσθήκη γραμμής"
          renderFields={(item, patch) => (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <CmsField label="Ημέρα"><CmsInput value={item.day ?? ""} onChange={(e) => patch({ day: e.target.value })} /></CmsField>
              <CmsField label="Ώρες"><CmsInput value={item.hours ?? ""} onChange={(e) => patch({ hours: e.target.value })} /></CmsField>
            </div>
          )}
        />
      </FormGroup>

      <FormGroup title="Γραφεία">
        <RowList
          items={c.offices ?? []}
          onChange={(next) => f.setList("offices", next)}
          newItem={() => ({ city: "", address: "", imageUrl: "" })}
          addLabel="Προσθήκη γραφείου"
          renderFields={(item, patch) => (
            <>
              <CmsField label="Πόλη"><CmsInput value={item.city ?? ""} onChange={(e) => patch({ city: e.target.value })} /></CmsField>
              <CmsField label="Διεύθυνση"><CmsTextarea value={item.address ?? ""} onChange={(e) => patch({ address: e.target.value })} /></CmsField>
              <CmsField label="Φωτογραφία">
                {/* MediaPicker's onChange is typed for its multiple mode too — this
                    picker is single, so the array branch never fires. */}
                <MediaPicker
                  value={item.imageUrl ?? ""}
                  onChange={(v) => patch({ imageUrl: Array.isArray(v) ? (v[0] ?? "") : v })}
                />
              </CmsField>
            </>
          )}
        />
      </FormGroup>
    </FormChrome>
  );
}
