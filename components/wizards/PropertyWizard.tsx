"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RiBuilding2Line, RiUserSettingsLine, RiMapPin2Line } from "react-icons/ri";
import { GuidedFlow, ChoiceCards, SummaryList } from "@/components/ui/guided-flow";
import { ExampleCard } from "@/components/ui/guided-flow-parts";
import { FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { AddressAutocomplete, type ResolvedAddress } from "@/components/maps/AddressAutocomplete";
import { createProperty } from "@/app/actions/properties";
import type { CreatedProperty } from "@/app/(company)/super-admin/properties/AddPropertyModal";
import { exampleForProperty } from "@/lib/wizards/examples/property";
import { getWizard, nextWizard, wizardHref } from "@/lib/wizards/registry";
import { videoForWizard } from "@/lib/wizards/videos";
import { hubHrefForRole } from "@/lib/help/hub";

export type CustomerOption = { id: string; name: string };

const MANAGED = [
  { value: "yes" as const, label: "Τη διαχειρίζεται η εταιρεία", description: "Διαχειριστής = υπάλληλος της εταιρείας. Στοιχεία διαχείρισης, συντηρήσεις, κοινόχρηστα — όλα από εμάς.", icon: RiBuilding2Line },
  { value: "no" as const, label: "Αυτοδιαχείριση", description: "Διαχειριστής = ιδιοκτήτης, ένοικος ή ο πελάτης. Η εταιρεία παρέχει μόνο τις υπηρεσίες του πακέτου.", icon: RiUserSettingsLine },
];
const SAME = [
  { value: "yes" as const, label: "Ίδια διεύθυνση", description: "Το πρώτο κτήριο παίρνει τη διεύθυνση και το στίγμα της ιδιοκτησίας.", icon: RiMapPin2Line },
  { value: "no" as const, label: "Άλλη διεύθυνση", description: "Θα ορίσετε τη διεύθυνσή του αργότερα (π.χ. συγκρότημα με πολλές εισόδους).", icon: RiBuilding2Line },
];

function initForm(customerId: string) {
  return { customerId, name: "", address: "", city: "", postalCode: "", country: "Ελλάδα", managed: null as "yes" | "no" | null, same: "yes" as "yes" | "no", buildingName: "", notes: "" };
}
type Form = ReturnType<typeof initForm>;

/** Step-by-step property creation (spec §4.2). `customer` null → first step asks which customer. */
export function PropertyWizard({ customer, customers = [], onClose, onDone, onSimpleForm }: {
  customer: CustomerOption | null;
  customers?: CustomerOption[];
  onClose: () => void;
  onDone: (p: CreatedProperty & { customerId: string }) => void;
  onSimpleForm?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(initForm(customer?.id ?? ""));
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const f = (k: keyof Form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initForm(customer?.id ?? "")), [form, customer?.id]);
  const def = getWizard("property-new");
  const next = nextWizard("property-new");
  const customerName = customer?.name ?? customers.find((c) => c.id === form.customerId)?.name ?? "";

  function onAddress(r: ResolvedAddress) {
    setForm((p) => ({ ...p, address: r.address || p.address, city: r.city || p.city, postalCode: r.postalCode || p.postalCode, country: r.country || p.country }));
    if (r.lat !== null && r.lng !== null) setGeo({ lat: r.lat, lng: r.lng });
  }

  const example = exampleForProperty({ customerName: customerName || "Πελάτης", name: form.name, address: [form.address, form.city].filter(Boolean).join(", ") || null, managed: form.managed !== "no", sameAddressBuilding: form.same === "yes", buildingName: form.buildingName || null });

  const steps = [
    ...(customer ? [] : [{
      key: "customer", title: "Για ποιον πελάτη;",
      help: "Κάθε ιδιοκτησία ανήκει σε έναν πελάτη — σε αυτόν πάει το μηνιαίο τιμολόγιο. Αν ο πελάτης δεν υπάρχει ακόμη, κλείστε και φτιάξτε τον πρώτα από «Πελάτες».",
      render: () => <FormField label="Πελάτης" required><FieldSelect value={form.customerId} onChange={f("customerId")} placeholder="— Επιλογή πελάτη —" options={customers.map((c) => ({ value: c.id, label: c.name }))} /></FormField>,
      validate: () => (form.customerId ? null : "Επιλέξτε πελάτη"),
    }]),
    {
      key: "where", title: "Πώς λέγεται και πού βρίσκεται;",
      help: "Η ιδιοκτησία είναι το ακίνητο ή το συγκρότημα — μπορεί να έχει ένα ή περισσότερα κτήρια. Συνήθως την ονομάζουμε από τη διεύθυνση.",
      render: () => (
        <>
          <FormField label="Όνομα ιδιοκτησίας" required><FieldInput value={form.name} onChange={f("name")} placeholder="π.χ. Σόλωνος 12 ή Συγκρότημα Κολωνακίου" /></FormField>
          <AddressAutocomplete label="Διεύθυνση" value={form.address} onChange={f("address")} onResolved={onAddress} placeholder="Οδός και αριθμός" />
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <FormField label="Πόλη"><FieldInput value={form.city} onChange={f("city")} /></FormField>
            <FormField label="Τ.Κ."><FieldInput value={form.postalCode} onChange={f("postalCode")} /></FormField>
            <FormField label="Χώρα"><FieldInput value={form.country} onChange={f("country")} /></FormField>
          </div>
          {geo && <div style={{ fontSize: "var(--fs-12)", color: "var(--color-success)", display: "flex", alignItems: "center", gap: 5 }}><RiMapPin2Line /> Στίγμα βρέθηκε — θα υπολογιστεί η απόσταση από τον σταθμό βάσης.</div>}
        </>
      ),
      validate: () => (form.name.trim() ? null : "Γράψτε ένα όνομα για την ιδιοκτησία"),
    },
    {
      key: "managed", title: "Ποιος τη διαχειρίζεται;",
      help: "Αυτό καθορίζει ποιος μπορεί να οριστεί διαχειριστής και αν ισχύουν τα στοιχεία διαχείρισης (λαμπτήρες, καθαρισμοί) και οι υποχρεώσεις συντήρησης της εταιρείας.",
      render: () => <ChoiceCards options={MANAGED} value={form.managed} onChange={(v) => setForm((p) => ({ ...p, managed: v }))} />,
      validate: () => (form.managed ? null : "Επιλέξτε τον τρόπο διαχείρισης"),
    },
    {
      key: "building", title: "Το πρώτο κτήριο",
      help: "Κάθε ιδιοκτησία ξεκινά με ένα κτήριο. Μετά θα του προσθέσετε τις μονάδες (διαμερίσματα, καταστήματα) — ο οδηγός «Κτήριο & μονάδες» είναι το επόμενο βήμα.",
      render: () => (
        <>
          <ChoiceCards options={SAME} value={form.same} onChange={(v) => setForm((p) => ({ ...p, same: v }))} />
          <FormField label="Όνομα κτηρίου (προαιρετικά)" hint={`Κενό = «${form.name.trim() || "όνομα ιδιοκτησίας"}»`}><FieldInput value={form.buildingName} onChange={f("buildingName")} placeholder="π.χ. Κτήριο Α" /></FormField>
          <FormField label="Σημειώσεις (προαιρετικά)"><FieldTextarea value={form.notes} onChange={f("notes")} rows={2} /></FormField>
        </>
      ),
    },
    {
      key: "check", title: "Έλεγχος",
      help: "Αν κάτι δεν είναι σωστό, πατήστε το βήμα στη ράγα ή «Πίσω».",
      render: () => (
        <SummaryList rows={[
          ["Πελάτης", customerName], ["Ιδιοκτησία", form.name],
          ["Διεύθυνση", [form.address, form.postalCode, form.city, form.country].filter(Boolean).join(", ")],
          ["Στίγμα", geo ? "Ναι" : "Όχι ακόμη"], ["Διαχείριση", form.managed === "no" ? "Αυτοδιαχείριση" : "Από την εταιρεία"],
          ["Πρώτο κτήριο", `${form.buildingName.trim() || form.name.trim()} · ${form.same === "yes" ? "ίδια διεύθυνση" : "διεύθυνση αργότερα"}`], ["Σημειώσεις", form.notes],
        ]} />
      ),
    },
  ];

  return (
    <GuidedFlow<Form>
      title={customer ? `${def.title} — ${customer.name}` : def.title} onClose={onClose} onSimpleForm={onSimpleForm} finishLabel="Δημιουργία ιδιοκτησίας" width={760} dirty={dirty}
      draft={{ key: "property-new", ctxId: customer?.id ?? null, value: form, restore: (v) => setForm({ ...initForm(customer?.id ?? ""), ...v }) }}
      steps={steps}
      example={{
        video: videoForWizard("property-new"),
        guideHref: `${hubHrefForRole("SUPER_ADMIN")}?a=${def.guideSlug}`,
        render: () => (
          <>
            <ExampleCard title="Τι δημιουργείται" tone="success">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {example.tree.map((n, i) => (
                  <div key={i} style={{ paddingLeft: n.depth * 22, display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ color: "var(--muted-foreground)" }}>{n.depth ? "└" : "●"}</span>
                    <span><b>{n.label}</b>{n.sub && <span style={{ color: "var(--muted-foreground)" }}> — {n.sub}</span>}</span>
                  </div>
                ))}
              </div>
            </ExampleCard>
            <ExampleCard title="Διαχείριση" tone="info">{example.managedLine}</ExampleCard>
            <ExampleCard title="Πακέτο & χρέωση" tone="warn">{example.packageLine}</ExampleCard>
          </>
        ),
      }}
      onFinish={async () => {
        const res = await createProperty({
          customerId: form.customerId, name: form.name.trim(), notes: form.notes || null,
          address: form.address || null, city: form.city || null, postalCode: form.postalCode || null, country: form.country || null,
          lat: geo?.lat ?? null, lng: geo?.lng ?? null, sameAddressBuilding: form.same === "yes", managed: form.managed !== "no", buildingName: form.buildingName || null,
        });
        if ("error" in res && res.error) return { error: res.error };
        const p = (res as { property: { id: string; name: string; city: string | null; customerId: string } }).property;
        onDone({ id: p.id, name: p.name, city: p.city ?? null, buildingCount: 1, unitCount: 0, customerId: p.customerId });
        return {
          done: {
            title: `Η ιδιοκτησία «${p.name}» δημιουργήθηκε`,
            lines: [`Πελάτης: ${customerName}`, "Ένα πρώτο κτήριο χωρίς μονάδες ακόμη"],
            next: next ? [{ label: `${next.short} με τις μονάδες του`, hint: "Όροφοι, διαμερίσματα, τετραγωνικά — και αμέσως τα χιλιοστά", icon: next.icon, onClick: () => { onClose(); router.push(wizardHref("/super-admin/properties", next.key, { propertyId: p.id })); } }] : [],
          },
        };
      }}
    />
  );
}
