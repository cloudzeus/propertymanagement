"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RiRobot2Line, RiArrowUpDownLine, RiFireLine, RiShieldFlashLine, RiDropLine, RiCloseCircleLine, RiMapPin2Line } from "react-icons/ri";
import { GuidedFlow, ChoiceCards, SummaryList } from "@/components/ui/guided-flow";
import { ExampleCard, ExampleTable, NumberField, parseNumber } from "@/components/ui/guided-flow-parts";
import { FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { AddressAutocomplete, type ResolvedAddress } from "@/components/maps/AddressAutocomplete";
import { createBuildingWithUnits } from "@/app/actions/buildings";
import { buildingActionHref } from "@/lib/building-actions";
import { generateUnits, duplicateUnitNumbers, type UnitDraft } from "@/lib/wizards/units-generator";
import { exampleForBuilding } from "@/lib/wizards/examples/building";
import { getWizard, nextWizard } from "@/lib/wizards/registry";
import { videoForWizard } from "@/lib/wizards/videos";
import { hubHrefForRole } from "@/lib/help/hub";
import { UnitsGrid, floorLabel } from "./UnitsGrid";

export type PropertyForBuilding = { id: string; name: string; address: string | null; city: string | null; postalCode: string | null; country: string | null; lat: number | null; lng: number | null; customerId: string };
export type PropertyOption = { id: string; name: string };

const HEATING = [
  { value: "CENTRAL" as const, label: "Κεντρική θέρμανση", description: "Κοινός λέβητας, χωρίς μετρητές — μοιράζεται με χιλιοστά θέρμανσης.", icon: RiFireLine },
  { value: "AUTONOMOUS" as const, label: "Αυτονομία με μετρητές", description: "Κοινός λέβητας με ωρομετρητές/θερμιδομετρητές — 70% κατανάλωση, 30% χιλιοστά.", icon: RiDropLine },
  { value: "GAS" as const, label: "Ατομική (αέριο / χωρίς)", description: "Κάθε διαμέρισμα πληρώνει μόνο του — η θέρμανση δεν μπαίνει στα κοινόχρηστα.", icon: RiCloseCircleLine },
];
const YESNO = (yes: string, no: string) => [{ value: "yes" as const, label: "Ναι", description: yes }, { value: "no" as const, label: "Όχι", description: no }];

function initForm(p: PropertyForBuilding | null) {
  return {
    propertyId: p?.id ?? "", name: "", address: p?.address ?? "", city: p?.city ?? "", postalCode: p?.postalCode ?? "", country: p?.country ?? "Ελλάδα",
    floors: "", basements: "0", elevator: null as "yes" | "no" | null, surcharge: "10", exemptGround: "yes" as "yes" | "no", boiler: null as "yes" | "no" | null, fire: "no" as "yes" | "no",
    heating: null as "CENTRAL" | "AUTONOMOUS" | "GAS" | null, apartmentsPerFloor: "2", groundFloorShops: "0", groundFloorApartments: "0", parkingPerBasement: "0", defaultArea: "", numbering: "floor-letter" as "floor-letter" | "sequential",
    units: [] as UnitDraft[], technicalNotes: "",
  };
}
type Form = ReturnType<typeof initForm>;

/** Step-by-step building + units creation (spec §4.3). `property` null → first step picks the property. */
export function BuildingWizard({ property, properties = [], onClose, onDone, onSimpleForm }: {
  property: PropertyForBuilding | null;
  properties?: PropertyOption[];
  onClose: () => void;
  onDone: (b: { id: string }) => void;
  onSimpleForm?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(initForm(property));
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(property?.lat != null && property?.lng != null ? { lat: property.lat, lng: property.lng } : null);
  const f = (k: keyof Form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initForm(property)), [form, property]);
  const def = getWizard("building-new");
  const next = nextWizard("building-new");
  const customerId = property?.customerId ?? null;
  const floors = parseInt(form.floors) || 0, basements = parseInt(form.basements) || 0;
  const surcharge = (parseNumber(form.surcharge) ?? 10) / 100;
  const heatingShared = form.heating !== "GAS";

  function onAddress(r: ResolvedAddress) {
    setForm((p) => ({ ...p, address: r.address || p.address, city: r.city || p.city, postalCode: r.postalCode || p.postalCode, country: r.country || p.country }));
    if (r.lat !== null && r.lng !== null) setGeo({ lat: r.lat, lng: r.lng });
  }
  function regenerate() {
    setForm((p) => ({ ...p, units: generateUnits({ floors, basements, apartmentsPerFloor: parseInt(p.apartmentsPerFloor) || 0, groundFloorShops: parseInt(p.groundFloorShops) || 0, groundFloorApartments: parseInt(p.groundFloorApartments) || 0, parkingPerBasement: parseInt(p.parkingPerBasement) || 0, defaultAreaSqm: parseNumber(p.defaultArea), numbering: p.numbering }) }));
  }

  const example = exampleForBuilding({ units: form.units, hasElevator: form.elevator === "yes", elevatorSurchargePerFloor: surcharge, elevatorExemptGroundFloor: form.exemptGround === "yes", heatingShared });
  const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString("el-GR", { maximumFractionDigits: 2 }));

  const steps = [
    ...(property ? [] : [{
      key: "property", title: "Σε ποια ιδιοκτησία;",
      help: "Το κτήριο ανήκει σε μια ιδιοκτησία (και άρα σε έναν πελάτη). Αν δεν υπάρχει, κλείστε και φτιάξτε την πρώτα από «Ιδιοκτησίες».",
      render: () => <FormField label="Ιδιοκτησία" required><FieldSelect value={form.propertyId} onChange={f("propertyId")} placeholder="— Επιλογή ιδιοκτησίας —" options={properties.map((p) => ({ value: p.id, label: p.name }))} /></FormField>,
      validate: () => (form.propertyId ? null : "Επιλέξτε ιδιοκτησία"),
    }]),
    {
      key: "basics", title: "Το κτήριο",
      help: "Όνομα, διεύθυνση και πόσοι όροφοι. Αν προτιμάτε, περιγράψτε το κτήριο στον βοηθό AI με απλά λόγια — θα γεμίσει μόνος του τον πίνακα μονάδων.",
      render: () => (
        <>
          {customerId && (
            <button type="button" onClick={() => { onClose(); router.push(`/super-admin/customers/${customerId}/onboarding`); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start", minHeight: 44, padding: "8px 14px", borderRadius: 10, border: "1px solid var(--color-primary)", background: "var(--card)", color: "var(--color-primary)", cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: 700 }}>
              <RiRobot2Line style={{ fontSize: "var(--fs-18)" }} /> Περιγράψτε το στον βοηθό (AI)
            </button>
          )}
          <FormField label="Όνομα κτηρίου" required><FieldInput value={form.name} onChange={f("name")} placeholder={property ? `π.χ. ${property.name} ή Κτήριο Α` : "π.χ. Κτήριο Α"} /></FormField>
          <AddressAutocomplete label="Διεύθυνση" value={form.address} onChange={f("address")} onResolved={onAddress} placeholder="Οδός και αριθμός" />
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <FormField label="Πόλη"><FieldInput value={form.city} onChange={f("city")} /></FormField>
            <FormField label="Τ.Κ."><FieldInput value={form.postalCode} onChange={f("postalCode")} /></FormField>
            <FormField label="Χώρα"><FieldInput value={form.country} onChange={f("country")} /></FormField>
          </div>
          {geo && <div style={{ fontSize: "var(--fs-12)", color: "#16a34a", display: "flex", alignItems: "center", gap: 5 }}><RiMapPin2Line /> Στίγμα υπάρχει — η απόσταση από τον σταθμό βάσης θα υπολογιστεί αυτόματα.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Όροφοι (πάνω από το ισόγειο)" required><NumberField value={form.floors} onChange={f("floors")} min={0} placeholder="π.χ. 4" /></FormField>
            <FormField label="Υπόγεια"><NumberField value={form.basements} onChange={f("basements")} min={0} /></FormField>
          </div>
        </>
      ),
      validate: () => (!form.name.trim() ? "Γράψτε το όνομα του κτηρίου" : !form.address.trim() ? "Συμπληρώστε τη διεύθυνση" : form.floors.trim() === "" ? "Πόσους ορόφους έχει;" : null),
    },
    {
      key: "equipment", title: "Εξοπλισμός & θέρμανση",
      help: "Ανελκυστήρας και θέρμανση καθορίζουν ΠΟΙΑ χιλιοστά υπάρχουν: με ασανσέρ οι ψηλότεροι όροφοι πληρώνουν περισσότερο, με κοινό λέβητα η θέρμανση μοιράζεται.",
      render: () => (
        <>
          <FormField label="Ανελκυστήρας" required>
            <ChoiceCards options={YESNO("Οι ψηλότεροι όροφοι επιβαρύνονται περισσότερο (ΚΥΑ 20.8.1997).", "Χωρίς χιλιοστά ανελκυστήρα.").map((o, i) => ({ ...o, icon: i === 0 ? RiArrowUpDownLine : RiCloseCircleLine }))} value={form.elevator} onChange={(v) => setForm((p) => ({ ...p, elevator: v }))} />
          </FormField>
          {form.elevator === "yes" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Προσαύξηση ανά όροφο" hint="Συνήθως 10%: ο 3ος όροφος μετρά 1,3× τα τετραγωνικά του."><NumberField value={form.surcharge} onChange={f("surcharge")} unit="%" min={0} /></FormField>
              <FormField label="Το ισόγειο εξαιρείται;"><FieldSelect value={form.exemptGround} onChange={(v) => setForm((p) => ({ ...p, exemptGround: v as "yes" | "no" }))} options={[{ value: "yes", label: "Ναι — δεν πληρώνει ανελκυστήρα" }, { value: "no", label: "Όχι — πληρώνει κι αυτό" }]} /></FormField>
            </div>
          )}
          <FormField label="Θέρμανση" required><ChoiceCards options={HEATING} value={form.heating} onChange={(v) => setForm((p) => ({ ...p, heating: v, boiler: v === "GAS" ? "no" : "yes" }))} columns={3} /></FormField>
          <FormField label="Πυρασφάλεια (πυροσβεστήρες, φωτισμός ασφαλείας)"><ChoiceCards options={YESNO("Θα προταθεί ετήσιος έλεγχος.", "Μπορεί να προστεθεί αργότερα.").map((o, i) => ({ ...o, icon: i === 0 ? RiShieldFlashLine : RiCloseCircleLine }))} value={form.fire} onChange={(v) => setForm((p) => ({ ...p, fire: v }))} /></FormField>
        </>
      ),
      validate: () => (!form.elevator ? "Έχει ανελκυστήρα;" : !form.heating ? "Επιλέξτε είδος θέρμανσης" : null),
    },
    {
      key: "units", title: "Οι μονάδες",
      help: "Δώστε τα βασικά και πατήστε «Δημιουργία λίστας» — μετά διορθώστε ό,τι θέλετε στον πίνακα. Τα τετραγωνικά είναι η βάση των χιλιοστών· όσες μονάδες τα έχουν κενά δεν θα πάρουν χιλιοστά.",
      render: () => (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <FormField label="Διαμερίσματα ανά όροφο"><NumberField value={form.apartmentsPerFloor} onChange={f("apartmentsPerFloor")} min={0} /></FormField>
            <FormField label="Καταστήματα στο ισόγειο"><NumberField value={form.groundFloorShops} onChange={f("groundFloorShops")} min={0} /></FormField>
            <FormField label="Διαμερίσματα στο ισόγειο"><NumberField value={form.groundFloorApartments} onChange={f("groundFloorApartments")} min={0} /></FormField>
            {basements > 0 && <FormField label="Θέσεις πάρκινγκ ανά υπόγειο"><NumberField value={form.parkingPerBasement} onChange={f("parkingPerBasement")} min={0} /></FormField>}
            <FormField label="Τ.μ. ανά μονάδα (προεπιλογή)"><NumberField value={form.defaultArea} onChange={f("defaultArea")} unit="τ.μ." min={0} placeholder="κενό = αργότερα" /></FormField>
            <FormField label="Αρίθμηση"><FieldSelect value={form.numbering} onChange={(v) => setForm((p) => ({ ...p, numbering: v as Form["numbering"] }))} options={[{ value: "floor-letter", label: "1Α, 1Β, 2Α… (Κ1 καταστήματα)" }, { value: "sequential", label: "1, 2, 3…" }]} /></FormField>
          </div>
          <button type="button" onClick={regenerate} style={{ alignSelf: "flex-start", minHeight: 44, padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: 700 }}>
            {form.units.length ? "Δημιουργία λίστας ξανά (αντικαθιστά τον πίνακα)" : "Δημιουργία λίστας μονάδων"}
          </button>
          {form.units.length > 0 && <UnitsGrid units={form.units} onChange={(units) => setForm((p) => ({ ...p, units }))} floors={floors} basements={basements} />}
        </>
      ),
      validate: () => {
        const u = form.units.filter((x) => x.unitNumber.trim());
        if (u.length === 0) return "Δημιουργήστε ή προσθέστε τουλάχιστον μία μονάδα";
        const dup = duplicateUnitNumbers(u);
        return dup.length ? `Διπλοί αριθμοί μονάδων: ${dup.join(", ")}` : null;
      },
    },
    {
      key: "check", title: "Έλεγχος",
      help: "Αν κάτι δεν είναι σωστό, πατήστε το βήμα στη ράγα ή «Πίσω».",
      render: () => (
        <>
          <SummaryList rows={[
            ["Κτήριο", form.name], ["Διεύθυνση", [form.address, form.postalCode, form.city].filter(Boolean).join(", ")],
            ["Όροφοι / υπόγεια", `${floors} / ${basements}`], ["Ανελκυστήρας", form.elevator === "yes" ? `Ναι · +${form.surcharge}%/όροφο${form.exemptGround === "yes" ? " · ισόγειο εξαιρείται" : ""}` : "Όχι"],
            ["Θέρμανση", HEATING.find((h) => h.value === form.heating)?.label], ["Πυρασφάλεια", form.fire === "yes" ? "Ναι" : "Όχι"],
            ["Μονάδες", `${form.units.length} (${form.units.filter((u) => u.unitType === "APARTMENT").length} διαμ., ${form.units.filter((u) => u.unitType === "SHOP").length} κατ., ${form.units.filter((u) => u.unitType === "PARKING").length} πάρκ.)`],
          ]} />
          <FormField label="Τεχνικές σημειώσεις (προαιρετικά)"><FieldTextarea value={form.technicalNotes} onChange={f("technicalNotes")} rows={2} placeholder="π.χ. Λεβητοστάσιο στο υπόγειο, κλειδί στον διαχειριστή" /></FormField>
        </>
      ),
    },
  ];

  return (
    <GuidedFlow<Form>
      title={property ? `${def.title} — ${property.name}` : def.title} onClose={onClose} onSimpleForm={onSimpleForm} finishLabel="Δημιουργία κτηρίου & μονάδων" width={860} dirty={dirty}
      draft={{ key: "building-new", ctxId: property?.id ?? null, value: form, restore: (v) => setForm({ ...initForm(property), ...v }) }}
      steps={steps}
      example={{
        video: videoForWizard("building-new"),
        guideHref: `${hubHrefForRole("SUPER_ADMIN")}?a=${def.guideSlug}`,
        render: () => (
          <>
            <ExampleCard title="Τα χιλιοστά που θα πάρουν οι μονάδες" tone="success">
              Από τα τετραγωνικά {form.elevator === "yes" ? "και τους ορόφους " : ""}υπολογίζονται αυτόματα, βάσει νόμου. Κάθε σετ αθροίζει 1000‰. Μπορείτε να τα αλλάξετε αργότερα («Χιλιοστά βήμα-βήμα») αν η πολυκατοικία έχει κανονισμό.
            </ExampleCard>
            <ExampleTable
              columns={["Μονάδα", "Όροφος", "τ.μ.", "Γενικά ‰", "Ανελκυστήρα ‰", "Θέρμανσης ‰"]}
              align={["left", "left", "right", "right", "right", "right"]}
              rows={example.rows.map((r) => [r.unitNumber, floorLabel(r.floor), fmt(r.areaSqm), fmt(r.general), form.elevator === "yes" ? fmt(r.elevator) : "—", heatingShared ? fmt(r.heating) : "—"])}
              footer={["Σύνολο", "", fmt(example.rows.reduce((s, r) => s + (r.areaSqm ?? 0), 0)), fmt(example.totals.general), form.elevator === "yes" ? fmt(example.totals.elevator) : "—", heatingShared ? fmt(example.totals.heating) : "—"]}
            />
            {example.missingArea.length > 0 && <ExampleCard title="Χωρίς τετραγωνικά" tone="warn">Οι μονάδες {example.missingArea.join(", ")} δεν έχουν τ.μ. και δεν θα πάρουν χιλιοστά — συμπληρώστε τα τώρα ή αργότερα από την καρτέλα του κτηρίου.</ExampleCard>}
            {!heatingShared && <ExampleCard title="Θέρμανση" tone="info">Ατομική θέρμανση: δεν δημιουργούνται χιλιοστά θέρμανσης — κάθε μονάδα πληρώνει τον δικό της λογαριασμό.</ExampleCard>}
            {form.heating === "AUTONOMOUS" && <ExampleCard title="Μετρητές" tone="info">Με μετρητές, τα έξοδα θέρμανσης θα μοιράζονται 70% με την κατανάλωση και 30% με τα χιλιοστά θέρμανσης — ορίζεται στο επόμενο βήμα («Χιλιοστά»).</ExampleCard>}
          </>
        ),
      }}
      onFinish={async () => {
        const res = await createBuildingWithUnits(form.propertyId, {
          name: form.name.trim(), address: form.address, city: form.city, postalCode: form.postalCode, country: form.country,
          floors, basements, hasElevator: form.elevator === "yes", hasBoiler: form.boiler === "yes", hasFireSafety: form.fire === "yes",
          technicalNotes: form.technicalNotes || null, lat: geo?.lat ?? null, lng: geo?.lng ?? null,
          elevatorSurchargePerFloor: surcharge, elevatorExemptGroundFloor: form.exemptGround === "yes", heatingShared,
        }, form.units.filter((u) => u.unitNumber.trim()));
        if ("error" in res) return { error: res.error };
        onDone({ id: res.buildingId });
        const base = `/super-admin/buildings/${res.buildingId}`;
        return {
          done: {
            title: `Το κτήριο «${form.name.trim()}» δημιουργήθηκε`,
            lines: [`${form.units.length} μονάδες με χιλιοστά βάσει νόμου`, ...(form.heating === "AUTONOMOUS" ? ["Θυμηθείτε: βάση θέρμανσης 70/30 στο βήμα «Χιλιοστά»"] : [])],
            next: next ? [{ label: next.short, hint: "Έλεγχος ή κανονισμός — γενικά, ανελκυστήρα, θέρμανσης", icon: next.icon, onClick: () => { onClose(); router.push(buildingActionHref(base, "millesimes-calc")); } }, { label: "Άνοιγμα καρτέλας κτηρίου", icon: "RiBuilding2Line", onClick: () => { onClose(); router.push(base); } }] : [],
          },
        };
      }}
    />
  );
}
