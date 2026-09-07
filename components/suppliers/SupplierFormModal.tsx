"use client";

import { useState, useTransition } from "react";
import { Modal, FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { createSupplier, updateSupplier } from "@/app/actions/suppliers";
import { HoursEditor } from "./HoursEditor";
import {
  SUPPLIER_KINDS, SUPPLIER_KIND_LABELS, isValidGreekAfm, normalizeAfm,
  type SupplierDTO, type SupplierFormInput, type SupplierKind, type WorkingHours,
} from "@/lib/suppliers-shared";
import { RiCheckLine, RiLoaderLine } from "react-icons/ri";

export type CategoryOption = { id: string; name: string };

type Section = "basic" | "contact" | "address" | "specialties" | "payment" | "hours";

/**
 * Create/edit form shared by the company registry (/super-admin/suppliers),
 * the manager's private list (/building/suppliers) and the supplier's own
 * profile (/marketplace/profile). `scope` decides where a NEW row lands.
 */
export function SupplierFormModal({ editing, scope, categories, onClose, onDone, hide = [] }: {
  editing: SupplierDTO | null;
  scope: "company" | "private";
  categories: CategoryOption[];
  onClose: () => void;
  onDone: () => void;
  /** sections not relevant for this caller (e.g. payment for private cards) */
  hide?: Section[];
}) {
  const [form, setForm] = useState({
    kind: (editing?.kind ?? "SERVICES") as SupplierKind,
    code: editing?.code ?? "", name: editing?.name ?? "", afm: editing?.afm ?? "", doy: editing?.doy ?? "",
    email: editing?.email ?? "", phone: editing?.phone ?? "", phone2: editing?.phone2 ?? "", webpage: editing?.webpage ?? "",
    address: editing?.address ?? "", city: editing?.city ?? "", district: editing?.district ?? "", postalCode: editing?.postalCode ?? "", country: editing?.country ?? "",
    contactName: editing?.contactName ?? "", contactPhone: editing?.contactPhone ?? "", contactEmail: editing?.contactEmail ?? "",
    iban: editing?.iban ?? "", bank: editing?.bank ?? "", paymentTermsDays: editing?.paymentTermsDays != null ? String(editing.paymentTermsDays) : "",
    siteSurveyFee: editing?.siteSurveyFee != null ? String(editing.siteSurveyFee) : "",
    remarks: editing?.remarks ?? "",
  });
  const [surveyWaived, setSurveyWaived] = useState(editing?.siteSurveyFeeWaived ?? true);
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [emergency24h, setEmergency24h] = useState(editing?.emergency24h ?? false);
  const [hours, setHours] = useState<WorkingHours>(editing?.workingHours ?? {});
  const [categoryIds, setCategoryIds] = useState<string[]>(editing?.categoryIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const show = (s: Section) => !hide.includes(s);

  const afmWarn = form.afm.trim() && normalizeAfm(form.afm)?.length === 9 && !isValidGreekAfm(form.afm);

  function save() {
    setError(null);
    const payload: SupplierFormInput = {
      ...form, isActive, emergency24h, workingHours: hours, categoryIds,
      paymentTermsDays: form.paymentTermsDays.trim() ? Number(form.paymentTermsDays) : null,
      siteSurveyFee: form.siteSurveyFee.trim() ? Number(form.siteSurveyFee.replace(",", ".")) : null,
      siteSurveyFeeWaived: surveyWaived,
    };
    startTransition(async () => {
      const res = editing ? await updateSupplier(editing.id, payload) : await createSupplier(payload, scope);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} width={760}
      title={editing ? `Επεξεργασία: ${editing.name}` : scope === "private" ? "Νέος προμηθευτής (δικός μου)" : "Νέος συνεργάτης / προμηθευτής"}
      footer={<>
        <button onClick={onClose} style={cancelBtn}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={saveBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button>
      </>}>
      {error && <div style={errBox} role="alert">{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {show("basic") && (
          <Section title="Βασικά στοιχεία">
            <div style={grid3}>
              <FormField label="Είδος"><FieldSelect value={form.kind} onChange={(v) => setForm((p) => ({ ...p, kind: v as SupplierKind }))} options={SUPPLIER_KINDS.map((k) => ({ value: k, label: SUPPLIER_KIND_LABELS[k] }))} /></FormField>
              <div style={{ gridColumn: "span 2" }}><FormField label="Επωνυμία" required><FieldInput value={form.name} onChange={f("name")} placeholder="π.χ. Ηλεκτρολογικές Εργασίες Παπαδόπουλος" /></FormField></div>
              <FormField label="ΑΦΜ" hint={afmWarn ? "Το checksum δεν επαληθεύεται — ελέγξτε το" : undefined}><FieldInput value={form.afm} onChange={f("afm")} placeholder="9 ψηφία" /></FormField>
              <FormField label="ΔΟΥ"><FieldInput value={form.doy} onChange={f("doy")} /></FormField>
              {scope === "company" && <FormField label="Κωδικός (ERP)"><FieldInput value={form.code} onChange={f("code")} placeholder="προαιρετικά" /></FormField>}
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 4 }}>
              <label style={chk}><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Ενεργός</label>
              <label style={chk}><input type="checkbox" checked={emergency24h} onChange={(e) => setEmergency24h(e.target.checked)} /> Έκτακτα 24/7</label>
            </div>
          </Section>
        )}

        {show("specialties") && categories.length > 0 && (
          <Section title="Ειδικότητες" hint="Σε ποιες κατηγορίες βλαβών/εργασιών ανταποκρίνεται">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {categories.map((c) => {
                const on = categoryIds.includes(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => setCategoryIds((p) => on ? p.filter((x) => x !== c.id) : [...p, c.id])}
                    style={{ ...chip, ...(on ? chipOn : {}) }}>{c.name}</button>
                );
              })}
            </div>
          </Section>
        )}

        {show("contact") && (
          <Section title="Επικοινωνία">
            <div style={grid3}>
              <FormField label="Email"><FieldInput type="email" value={form.email} onChange={f("email")} /></FormField>
              <FormField label="Τηλέφωνο"><FieldInput value={form.phone} onChange={f("phone")} /></FormField>
              <FormField label="Τηλέφωνο 2"><FieldInput value={form.phone2} onChange={f("phone2")} /></FormField>
              <FormField label="Υπεύθυνος επικοινωνίας"><FieldInput value={form.contactName} onChange={f("contactName")} /></FormField>
              <FormField label="Κινητό υπευθύνου"><FieldInput value={form.contactPhone} onChange={f("contactPhone")} /></FormField>
              <FormField label="Email υπευθύνου"><FieldInput type="email" value={form.contactEmail} onChange={f("contactEmail")} /></FormField>
              <div style={{ gridColumn: "span 3" }}><FormField label="Ιστοσελίδα"><FieldInput value={form.webpage} onChange={f("webpage")} placeholder="https://" /></FormField></div>
            </div>
          </Section>
        )}

        {show("address") && (
          <Section title="Διεύθυνση">
            <div style={grid3}>
              <div style={{ gridColumn: "span 2" }}><FormField label="Οδός & αριθμός"><FieldInput value={form.address} onChange={f("address")} /></FormField></div>
              <FormField label="Τ.Κ."><FieldInput value={form.postalCode} onChange={f("postalCode")} /></FormField>
              <FormField label="Πόλη"><FieldInput value={form.city} onChange={f("city")} /></FormField>
              <FormField label="Περιοχή"><FieldInput value={form.district} onChange={f("district")} /></FormField>
              <FormField label="Χώρα"><FieldInput value={form.country} onChange={f("country")} placeholder="GR" /></FormField>
            </div>
          </Section>
        )}

        {show("payment") && (
          <Section title="Πληρωμές">
            <div style={grid3}>
              <div style={{ gridColumn: "span 2" }}><FormField label="IBAN"><FieldInput value={form.iban} onChange={f("iban")} placeholder="GR.." /></FormField></div>
              <FormField label="Τράπεζα"><FieldInput value={form.bank} onChange={f("bank")} /></FormField>
              <FormField label="Πίστωση (ημέρες)"><FieldInput type="number" value={form.paymentTermsDays} onChange={f("paymentTermsDays")} placeholder="π.χ. 30" /></FormField>
              <FormField label="Χρέωση αυτοψίας (€ καθ.)" hint="κενό = δωρεάν"><FieldInput type="number" value={form.siteSurveyFee} onChange={f("siteSurveyFee")} placeholder="π.χ. 30" /></FormField>
              <div style={{ gridColumn: "span 2", display: "flex", alignItems: "flex-end" }}>
                <label style={chk}><input type="checkbox" checked={surveyWaived} onChange={(e) => setSurveyWaived(e.target.checked)} /> Η αυτοψία συμψηφίζεται αν ανατεθεί η εργασία</label>
              </div>
            </div>
          </Section>
        )}

        {show("hours") && (
          <Section title="Ωράριο λειτουργίας">
            <HoursEditor value={hours} onChange={setHours} compact />
          </Section>
        )}

        <FormField label="Παρατηρήσεις"><FieldTextarea value={form.remarks} onChange={f("remarks")} rows={2} /></FormField>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
        {title}{hint && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 8 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const grid3: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 };
const chk: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" };
const chip: React.CSSProperties = { border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 9999, padding: "4px 11px", fontSize: 12.5, cursor: "pointer" };
const chipOn: React.CSSProperties = { background: "var(--color-primary)", borderColor: "var(--color-primary)", color: "#fff", fontWeight: 600 };
const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 12 };
