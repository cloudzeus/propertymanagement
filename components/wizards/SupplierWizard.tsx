"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RiToolsLine, RiShoppingBag3Line, RiStackLine, RiAlarmWarningLine, RiCloseCircleLine, RiCheckLine, RiMoneyEuroCircleLine } from "react-icons/ri";
import { GuidedFlow, ChoiceCards, SummaryList } from "@/components/ui/guided-flow";
import { ExampleCard, ExampleTable, NumberField, parseNumber } from "@/components/ui/guided-flow-parts";
import { FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { AddressAutocomplete, type ResolvedAddress } from "@/components/maps/AddressAutocomplete";
import { createSupplier } from "@/app/actions/suppliers";
import type { DistanceZone } from "@/lib/distance/zones";
import { isValidGreekAfm, normalizeAfm, type SupplierFormInput, type SupplierKind } from "@/lib/suppliers-shared";
import { exampleForSupplier } from "@/lib/wizards/examples/supplier";
import { getWizard } from "@/lib/wizards/registry";
import { videoForWizard } from "@/lib/wizards/videos";
import { hubHrefForRole } from "@/lib/help/hub";

export type CategoryOption = { id: string; name: string };

const KINDS = [
  { value: "SERVICES" as SupplierKind, label: "Συνεργείο / υπηρεσίες", description: "Ηλεκτρολόγοι, υδραυλικοί, καθαρισμοί, ανελκυστήρες…", icon: RiToolsLine },
  { value: "PRODUCTS" as SupplierKind, label: "Προμηθευτής προϊόντων", description: "Υλικά, ανταλλακτικά, εξοπλισμός.", icon: RiShoppingBag3Line },
  { value: "BOTH" as SupplierKind, label: "Και τα δύο", description: "Προϊόντα με εγκατάσταση.", icon: RiStackLine },
];
const EMERGENCY = [
  { value: "yes" as const, label: "Ναι, έκτακτα 24/7", description: "Προτείνεται πρώτος σε επείγουσες βλάβες.", icon: RiAlarmWarningLine },
  { value: "no" as const, label: "Όχι", description: "Μόνο στο ωράριό του.", icon: RiCloseCircleLine },
];
const SURVEY = [
  { value: "free" as const, label: "Δωρεάν αυτοψία", description: "Η προσφορά δεν περιλαμβάνει χρέωση αυτοψίας.", icon: RiCheckLine },
  { value: "paid" as const, label: "Χρεώνει αυτοψία", description: "Βασικό ποσό + προαιρετική προσαύξηση ανά ζώνη απόστασης.", icon: RiMoneyEuroCircleLine },
];
const eur = (n: number) => `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

type Form = {
  kind: SupplierKind | null; categoryIds: string[]; emergency: "yes" | "no" | null;
  name: string; afm: string; doy: string; email: string; phone: string; contactName: string; contactPhone: string;
  address: string; city: string; postalCode: string; country: string;
  survey: "free" | "paid" | null; siteSurveyFee: string; surveyWaived: "yes" | "no"; zoneFees: Record<string, string>; paymentTermsDays: string; remarks: string;
};
const initForm = (): Form => ({ kind: null, categoryIds: [], emergency: null, name: "", afm: "", doy: "", email: "", phone: "", contactName: "", contactPhone: "", address: "", city: "", postalCode: "", country: "Ελλάδα", survey: null, siteSurveyFee: "", surveyWaived: "yes", zoneFees: {}, paymentTermsDays: "", remarks: "" });

/** Step-by-step supplier registration (spec §4.8): what → who → where/survey → check → example (RFQ → contract). */
export function SupplierWizard({ categories, zones, scope, onClose, onDone, onSimpleForm }: {
  categories: CategoryOption[];
  zones: DistanceZone[];
  scope: "company" | "private";
  onClose: () => void;
  onDone: (s: { id: string; name: string }) => void;
  onSimpleForm?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(initForm());
  const f = (k: keyof Form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initForm()), [form]);
  const def = getWizard("supplier-new");
  const afmWarn = form.afm.trim() && normalizeAfm(form.afm)?.length === 9 && !isValidGreekAfm(form.afm);
  const categoryNames = categories.filter((c) => form.categoryIds.includes(c.id)).map((c) => c.name);
  const fee = form.survey === "paid" ? parseNumber(form.siteSurveyFee) : null;
  const zoneFees = Object.fromEntries(zones.map((z) => [z.code, parseNumber(form.zoneFees[z.code] ?? "") ?? 0]));
  const example = exampleForSupplier({ name: form.name, categories: categoryNames, zones, siteSurveyFee: fee, surveyZoneFees: zoneFees, surveyWaived: form.surveyWaived === "yes", emergency24h: form.emergency === "yes" });

  function onAddress(r: ResolvedAddress) {
    setForm((p) => ({ ...p, address: r.address || p.address, city: r.city || p.city, postalCode: r.postalCode || p.postalCode, country: r.country || p.country }));
  }

  return (
    <GuidedFlow<Form>
      title={scope === "private" ? "Νέος προμηθευτής (δικός μου) βήμα-βήμα" : def.title} onClose={onClose} onSimpleForm={onSimpleForm} finishLabel="Καταχώριση συνεργάτη" width={800} dirty={dirty}
      draft={{ key: "supplier-new", ctxId: scope, value: form, restore: (v) => setForm({ ...initForm(), ...v }) }}
      steps={[
        {
          key: "what", title: "Τι κάνει;",
          help: "Οι συνεργάτες παίρνουν αιτήματα προσφοράς για βλάβες της ειδικότητάς τους και υπογράφουν συμβάσεις έργου. Διαλέξτε είδος και ειδικότητες — έτσι προτείνονται αυτόματα στις σωστές βλάβες.",
          render: () => (
            <>
              <ChoiceCards options={KINDS} value={form.kind} onChange={(v) => setForm((p) => ({ ...p, kind: v }))} columns={3} />
              {categories.length > 0 && (
                <FormField label="Ειδικότητες (σε ποιες κατηγορίες βλαβών ανταποκρίνεται)">
                  <div role="group" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {categories.map((c) => { const on = form.categoryIds.includes(c.id); return (
                      <button key={c.id} type="button" role="checkbox" aria-checked={on} onClick={() => setForm((p) => ({ ...p, categoryIds: on ? p.categoryIds.filter((x) => x !== c.id) : [...p.categoryIds, c.id] }))}
                        style={{ minHeight: 40, border: `1px solid ${on ? "var(--color-primary)" : "var(--border)"}`, background: on ? "var(--color-primary)" : "var(--card)", color: on ? "var(--primary-foreground)" : "var(--foreground)", borderRadius: 9999, padding: "6px 14px", fontSize: "var(--fs-13)", fontWeight: on ? 700 : 500, cursor: "pointer" }}>{c.name}</button>
                    ); })}
                  </div>
                </FormField>
              )}
              <FormField label="Έκτακτα περιστατικά"><ChoiceCards options={EMERGENCY} value={form.emergency} onChange={(v) => setForm((p) => ({ ...p, emergency: v }))} /></FormField>
            </>
          ),
          validate: () => (!form.kind ? "Επιλέξτε είδος συνεργάτη" : !form.emergency ? "Αναλαμβάνει έκτακτα;" : null),
        },
        {
          key: "who", title: "Ποιος είναι;",
          help: "Επωνυμία και ΑΦΜ για τις συμβάσεις και τα τιμολόγια· ένα τηλέφωνο και email για τα αιτήματα προσφοράς.",
          render: () => (
            <>
              <FormField label="Επωνυμία" required><FieldInput value={form.name} onChange={f("name")} placeholder="π.χ. Ηλεκτρολογικές Εργασίες Παπαδόπουλος" /></FormField>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="ΑΦΜ" hint={afmWarn ? "Το ΑΦΜ δεν περνά τον έλεγχο — ελέγξτε τα ψηφία." : undefined}><FieldInput value={form.afm} onChange={f("afm")} placeholder="9 ψηφία" /></FormField>
                <FormField label="ΔΟΥ"><FieldInput value={form.doy} onChange={f("doy")} /></FormField>
                <FormField label="Email"><FieldInput type="email" value={form.email} onChange={f("email")} /></FormField>
                <FormField label="Τηλέφωνο"><FieldInput type="tel" value={form.phone} onChange={f("phone")} /></FormField>
                <FormField label="Υπεύθυνος επικοινωνίας"><FieldInput value={form.contactName} onChange={f("contactName")} /></FormField>
                <FormField label="Κινητό υπευθύνου"><FieldInput type="tel" value={form.contactPhone} onChange={f("contactPhone")} /></FormField>
              </div>
            </>
          ),
          validate: () => (!form.name.trim() ? "Γράψτε την επωνυμία" : form.afm.trim() && (normalizeAfm(form.afm)?.length ?? 0) !== 9 ? "Το ΑΦΜ έχει 9 ψηφία" : form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? "Το email δεν φαίνεται σωστό" : null),
        },
        {
          key: "where", title: "Από πού ξεκινά και τι χρεώνει για αυτοψία;",
          help: "Η έδρα χρησιμεύει για την απόσταση ως το κτήριο: οι ζώνες απόστασης της εταιρείας δίνουν προσαύξηση αυτοψίας που προσυμπληρώνεται στις προσφορές.",
          render: () => (
            <>
              <AddressAutocomplete label="Έδρα (διεύθυνση)" value={form.address} onChange={f("address")} onResolved={onAddress} placeholder="Οδός και αριθμός" />
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                <FormField label="Πόλη"><FieldInput value={form.city} onChange={f("city")} /></FormField>
                <FormField label="Τ.Κ."><FieldInput value={form.postalCode} onChange={f("postalCode")} /></FormField>
                <FormField label="Χώρα"><FieldInput value={form.country} onChange={f("country")} /></FormField>
              </div>
              <FormField label="Αυτοψία" required><ChoiceCards options={SURVEY} value={form.survey} onChange={(v) => setForm((p) => ({ ...p, survey: v }))} /></FormField>
              {form.survey === "paid" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <FormField label="Βασική χρέωση αυτοψίας (καθαρά)" required><NumberField unit="€" value={form.siteSurveyFee} onChange={f("siteSurveyFee")} min={0} placeholder="π.χ. 30" /></FormField>
                    <FormField label="Συμψηφίζεται αν ανατεθεί η εργασία;"><FieldSelect value={form.surveyWaived} onChange={(v) => setForm((p) => ({ ...p, surveyWaived: v as "yes" | "no" }))} options={[{ value: "yes", label: "Ναι — δωρεάν αν προχωρήσει" }, { value: "no", label: "Όχι — χρεώνεται πάντα" }]} /></FormField>
                  </div>
                  {zones.length > 0 && (
                    <FormField label="Προσαύξηση ανά ζώνη απόστασης (προαιρετικά)" hint="Κενό = 0. Ζώνες της εταιρείας, από την έδρα του συνεργάτη ως το κτήριο.">
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                        {zones.map((z) => <FormField key={z.code} label={`${z.label}${z.maxKm != null ? ` (έως ${z.maxKm} km)` : " (και άνω)"}`}><NumberField unit="€" value={form.zoneFees[z.code] ?? ""} onChange={(v) => setForm((p) => ({ ...p, zoneFees: { ...p.zoneFees, [z.code]: v } }))} min={0} placeholder="0" /></FormField>)}
                      </div>
                    </FormField>
                  )}
                </>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <FormField label="Πίστωση (ημέρες)"><NumberField value={form.paymentTermsDays} onChange={f("paymentTermsDays")} min={0} placeholder="π.χ. 30" /></FormField>
                <FormField label="Παρατηρήσεις"><FieldTextarea value={form.remarks} onChange={f("remarks")} rows={1} /></FormField>
              </div>
            </>
          ),
          validate: () => (!form.survey ? "Χρεώνει αυτοψία;" : form.survey === "paid" && !(parseNumber(form.siteSurveyFee) ?? 0) ? "Δώστε το ποσό αυτοψίας" : null),
        },
        {
          key: "check", title: "Έλεγχος",
          help: "Αν κάτι δεν είναι σωστό, πατήστε το βήμα στη ράγα ή «Πίσω».",
          render: () => (
            <SummaryList rows={[
              ["Είδος", KINDS.find((k) => k.value === form.kind)?.label], ["Ειδικότητες", categoryNames.join(" · ")], ["Έκτακτα 24/7", form.emergency === "yes" ? "Ναι" : "Όχι"],
              ["Επωνυμία", form.name], ["ΑΦΜ / ΔΟΥ", [form.afm, form.doy].filter(Boolean).join(" / ")], ["Επικοινωνία", [form.email, form.phone, form.contactName].filter(Boolean).join(" · ")],
              ["Έδρα", [form.address, form.postalCode, form.city].filter(Boolean).join(", ")],
              ["Αυτοψία", form.survey === "paid" ? `${eur(fee ?? 0)}${form.surveyWaived === "yes" ? " · συμψηφίζεται" : ""}` : "Δωρεάν"], ["Πίστωση", form.paymentTermsDays ? `${form.paymentTermsDays} ημέρες` : "—"],
            ]} />
          ),
        },
      ]}
      example={{
        video: videoForWizard("supplier-new"),
        guideHref: `${hubHrefForRole("SUPER_ADMIN")}?a=${def.guideSlug}`,
        render: () => (
          <>
            <ExampleCard title="Από τη βλάβη στη σύμβαση" tone="success">
              <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                {example.timeline.map((t) => <li key={t.title}><b>{t.title}</b> — {t.body}</li>)}
              </ol>
            </ExampleCard>
            {example.badges.length > 0 && <ExampleCard tone="info" title="Θα προτείνεται για">{example.badges.join(" · ")}</ExampleCard>}
            {example.surveyLines.length > 0
              ? <><ExampleTable columns={["Αυτοψία σε κτήριο στη…", "Χρέωση"]} rows={example.surveyLines.map((l) => [l.zone, eur(l.amount)])} /><ExampleCard tone="warn" title="Αυτοψία">{example.surveyNote}</ExampleCard></>
              : <ExampleCard tone="info" title="Αυτοψία">{example.surveyNote}</ExampleCard>}
          </>
        ),
      }}
      onFinish={async () => {
        const payload: SupplierFormInput = {
          kind: form.kind ?? "SERVICES", name: form.name.trim(), afm: form.afm || null, doy: form.doy || null, email: form.email || null, phone: form.phone || null,
          contactName: form.contactName || null, contactPhone: form.contactPhone || null, address: form.address || null, city: form.city || null, postalCode: form.postalCode || null, country: form.country || null,
          isActive: true, emergency24h: form.emergency === "yes", categoryIds: form.categoryIds, remarks: form.remarks || null,
          paymentTermsDays: form.paymentTermsDays ? Number(form.paymentTermsDays) : null,
          siteSurveyFee: form.survey === "paid" ? fee : null, siteSurveyFeeWaived: form.surveyWaived === "yes",
          ...(zones.length && form.survey === "paid" ? { surveyZoneFees: zoneFees } : {}),
        };
        const res = await createSupplier(payload, scope);
        if ("error" in res && res.error) return { error: res.error };
        const id = (res as { id: string }).id;
        onDone({ id, name: form.name.trim() });
        return {
          done: {
            title: `Ο συνεργάτης «${form.name.trim()}» καταχωρίστηκε`,
            lines: [categoryNames.length ? `Ειδικότητες: ${categoryNames.join(", ")}` : "Χωρίς ειδικότητες ακόμη", form.survey === "paid" ? `Αυτοψία ${eur(fee ?? 0)}` : "Δωρεάν αυτοψία"],
            next: scope === "company" ? [{ label: "Άνοιγμα καρτέλας & πρόσκληση χρήστη", hint: "Επαφές, κατάλογος τιμών, πρόσβαση στο marketplace", icon: "RiTeamLine", onClick: () => { onClose(); router.push(`/super-admin/suppliers/${id}`); } }] : [],
          },
        };
      }}
    />
  );
}
