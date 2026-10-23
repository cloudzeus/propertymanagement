"use client";

import { useMemo, useState } from "react";
import { RiScales3Line, RiFileTextLine, RiArrowUpDownLine, RiCloseCircleLine, RiFireLine, RiDropLine, RiEqualizerLine } from "react-icons/ri";
import { GuidedFlow, ChoiceCards, SummaryList } from "@/components/ui/guided-flow";
import { ExampleCard, ExampleTable, NumberField, parseNumber } from "@/components/ui/guided-flow-parts";
import { FormField, FieldSelect } from "@/components/ui/modal";
import { applyMillesimesSetup } from "@/app/actions/building-millesimes";
import { previewMillesimes, manualSumError, exampleForMillesimes, DEFAULT_EXAMPLE_EXPENSES, type MillesimesPlan, type ManualCell, type HeatingBasis, type PlanUnit } from "@/lib/wizards/examples/millesimes";
import { getWizard } from "@/lib/wizards/registry";
import { videoForWizard } from "@/lib/wizards/videos";
import { hubHrefForRole } from "@/lib/help/hub";

export type MillesimesWizardUnit = PlanUnit & { millesimes: number | null; millesimesElevator: number | null; millesimesHeating: number | null };

const REGULATION = [
  { value: "auto" as const, label: "Όχι — υπολογισμός βάσει νόμου", description: "Από τα τετραγωνικά και τους ορόφους. Η συνηθισμένη περίπτωση.", icon: RiScales3Line },
  { value: "manual" as const, label: "Ναι — θα δώσω τα χιλιοστά", description: "Η πολυκατοικία έχει κανονισμό (ή πίνακα χιλιοστών) που ισχύει.", icon: RiFileTextLine },
];
const ELEVATOR = [
  { value: "yes" as const, label: "Ναι, έχει ανελκυστήρα", description: "Οι ψηλότεροι όροφοι πληρώνουν περισσότερο· το ισόγειο συνήθως εξαιρείται.", icon: RiArrowUpDownLine },
  { value: "no" as const, label: "Όχι", description: "Δεν υπάρχουν χιλιοστά ανελκυστήρα.", icon: RiCloseCircleLine },
];
const HEATING: { value: HeatingBasis; label: string; description: string; icon: React.ElementType }[] = [
  { value: "HEATING_MILLESIMES", label: "Κεντρική, κατά χιλιοστά", description: "Κοινός λέβητας χωρίς μετρητές — το πετρέλαιο μοιράζεται με χιλιοστά θέρμανσης.", icon: RiFireLine },
  { value: "METERED_70_30", label: "Αυτονομία με μετρητές (70/30)", description: "70% με την κατανάλωση κάθε μονάδας, 30% με τα χιλιοστά θέρμανσης.", icon: RiDropLine },
  { value: "EQUAL_PER_UNIT", label: "Ίσα ανά μονάδα", description: "Σπάνιο — κάθε μονάδα πληρώνει το ίδιο.", icon: RiEqualizerLine },
  { value: "NONE", label: "Ατομική θέρμανση", description: "Αέριο ή χωρίς κοινή θέρμανση — τίποτα στα κοινόχρηστα.", icon: RiCloseCircleLine },
];

type Form = {
  regulation: "auto" | "manual" | null;
  general: Record<string, string>;
  elevator: "yes" | "no" | null; surcharge: string; exemptGround: "yes" | "no"; elevatorMode: "auto" | "manual"; elevatorCells: Record<string, string>;
  heating: HeatingBasis | null; heatingMode: "auto" | "manual"; heatingCells: Record<string, string>;
};

function initForm(units: MillesimesWizardUnit[], b: { hasElevator: boolean; elevatorSurchargePerFloor: number; elevatorExemptGroundFloor: boolean }, metered: boolean): Form {
  const cells = (k: "millesimes" | "millesimesElevator" | "millesimesHeating") => Object.fromEntries(units.map((u) => [u.id, u[k] == null ? "" : String(u[k]).replace(".", ",")]));
  return {
    regulation: null, general: cells("millesimes"),
    elevator: b.hasElevator ? "yes" : null, surcharge: String(Math.round(b.elevatorSurchargePerFloor * 100)), exemptGround: b.elevatorExemptGroundFloor ? "yes" : "no", elevatorMode: "auto", elevatorCells: cells("millesimesElevator"),
    heating: metered ? "METERED_70_30" : null, heatingMode: "auto", heatingCells: cells("millesimesHeating"),
  };
}

const cellsToManual = (units: PlanUnit[], cells: Record<string, string>): ManualCell[] => units.map((u) => ({ unitId: u.id, value: parseNumber(cells[u.id] ?? "") }));
const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString("el-GR", { maximumFractionDigits: 2 }));
const eur = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);

/** Step-by-step millesimes setup for one building (spec §4.4): regulation? → general → elevator → heating → check → example. */
export function MillesimesWizard({ buildingId, units, building, usesMeteredHeating, onClose, onDone, onSimpleForm }: {
  buildingId: string;
  units: MillesimesWizardUnit[];
  building: { hasElevator: boolean; elevatorSurchargePerFloor: number; elevatorExemptGroundFloor: boolean };
  usesMeteredHeating: boolean;
  onClose: () => void;
  onDone: () => void;
  onSimpleForm?: () => void;
}) {
  const [form, setForm] = useState<Form>(() => initForm(units, building, usesMeteredHeating));
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initForm(units, building, usesMeteredHeating)), [form, units, building, usesMeteredHeating]);
  const def = getWizard("millesimes-setup");

  const plan: MillesimesPlan = {
    general: form.regulation === "manual" ? cellsToManual(units, form.general) : "AUTO",
    elevator: { enabled: form.elevator === "yes", surchargePerFloor: (parseNumber(form.surcharge) ?? 10) / 100, exemptGroundFloor: form.exemptGround === "yes", manual: form.regulation === "manual" && form.elevatorMode === "manual" ? cellsToManual(units, form.elevatorCells) : null },
    heating: { basis: form.heating ?? "NONE", manual: form.regulation === "manual" && form.heatingMode === "manual" && form.heating !== "NONE" ? cellsToManual(units, form.heatingCells) : null },
  };
  const preview = previewMillesimes(units, plan);
  const example = exampleForMillesimes(units, plan, DEFAULT_EXAMPLE_EXPENSES);

  const ManualGrid = ({ cells, onChange, column }: { cells: Record<string, string>; onChange: (c: Record<string, string>) => void; column: "general" | "elevator" | "heating" }) => {
    const err = manualSumError(cellsToManual(units, cells));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
          {units.map((u) => (
            <FormField key={u.id} label={`${u.unitNumber}${u.areaSqm ? ` · ${u.areaSqm} τ.μ.` : ""}`}>
              <NumberField unit="‰" value={cells[u.id] ?? ""} onChange={(v) => onChange({ ...cells, [u.id]: v })} placeholder={fmt(preview.rows.find((r) => r.unitId === u.id)?.[column] ?? null)} />
            </FormField>
          ))}
        </div>
        <div role="status" style={{ fontSize: "var(--fs-13)", fontWeight: 700, color: err ? "var(--color-warning)" : "var(--color-success)" }}>{err ?? "Σύνολο 1000‰ ✓"}</div>
      </div>
    );
  };

  return (
    <GuidedFlow<Form>
      title={def.title} onClose={onClose} onSimpleForm={onSimpleForm} finishLabel="Εφαρμογή χιλιοστών" width={860} dirty={dirty}
      draft={{ key: "millesimes-setup", ctxId: buildingId, value: form, restore: (v) => setForm({ ...initForm(units, building, usesMeteredHeating), ...v }) }}
      steps={[
        {
          key: "regulation", title: "Έχει η πολυκατοικία κανονισμό με χιλιοστά;",
          help: "Χωρίς κανονισμό, ο νόμος ορίζει πώς μοιράζονται τα κοινόχρηστα: αναλογικά με τα τετραγωνικά (και τους ορόφους για τον ανελκυστήρα). Με κανονισμό, ισχύουν τα χιλιοστά που αναγράφει.",
          render: () => <ChoiceCards options={REGULATION} value={form.regulation} onChange={(v) => setForm((p) => ({ ...p, regulation: v }))} />,
          validate: () => (form.regulation ? null : "Επιλέξτε αν υπάρχει κανονισμός"),
        },
        {
          key: "general", title: "Γενικά χιλιοστά",
          help: form.regulation === "manual" ? "Γράψτε τα χιλιοστά κάθε μονάδας από τον κανονισμό. Πρέπει να αθροίζουν 1000." : "Υπολογίζονται από τα τετραγωνικά κάθε μονάδας. Μονάδες χωρίς τ.μ. δεν παίρνουν χιλιοστά.",
          render: () => form.regulation === "manual"
            ? <ManualGrid cells={form.general} onChange={(general) => setForm((p) => ({ ...p, general }))} column="general" />
            : (
              <>
                <ExampleTable columns={["Μονάδα", "τ.μ.", "Γενικά ‰"]} rows={preview.rows.map((r) => { const u = units.find((x) => x.id === r.unitId)!; return [r.unitNumber, fmt(u.areaSqm), fmt(r.general)]; })} footer={["Σύνολο", fmt(units.reduce((s, u) => s + (u.areaSqm ?? 0), 0)), fmt(preview.totals.general)]} />
                {preview.missingArea.length > 0 && <ExampleCard tone="warn" title="Χωρίς τετραγωνικά">{preview.missingArea.join(", ")} — συμπληρώστε τα τ.μ. από τις μονάδες του κτηρίου για να πάρουν χιλιοστά.</ExampleCard>}
              </>
            ),
          validate: () => (form.regulation === "manual" ? manualSumError(cellsToManual(units, form.general)) : preview.totals.general === 0 ? "Καμία μονάδα δεν έχει τετραγωνικά" : null),
        },
        {
          key: "elevator", title: "Ανελκυστήρας",
          help: "Με ανελκυστήρα, κάθε όροφος μετρά τα τετραγωνικά του με προσαύξηση (συνήθως 10% ανά όροφο). Το ισόγειο συνήθως δεν πληρώνει.",
          render: () => (
            <>
              <ChoiceCards options={ELEVATOR} value={form.elevator} onChange={(v) => setForm((p) => ({ ...p, elevator: v }))} />
              {form.elevator === "yes" && (
                <>
                  {form.regulation === "manual" && (
                    <FormField label="Χιλιοστά ανελκυστήρα"><FieldSelect value={form.elevatorMode} onChange={(v) => setForm((p) => ({ ...p, elevatorMode: v as "auto" | "manual" }))} options={[{ value: "auto", label: "Υπολογισμός βάσει νόμου (τ.μ. × όροφος)" }, { value: "manual", label: "Από τον κανονισμό — θα τα γράψω" }]} /></FormField>
                  )}
                  {form.regulation === "manual" && form.elevatorMode === "manual"
                    ? <ManualGrid cells={form.elevatorCells} onChange={(elevatorCells) => setForm((p) => ({ ...p, elevatorCells }))} column="elevator" />
                    : (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <FormField label="Προσαύξηση ανά όροφο" hint="10% = ο 3ος όροφος μετρά 1,3× τα τ.μ. του"><NumberField unit="%" value={form.surcharge} onChange={(v) => setForm((p) => ({ ...p, surcharge: v }))} min={0} /></FormField>
                          <FormField label="Το ισόγειο εξαιρείται;"><FieldSelect value={form.exemptGround} onChange={(v) => setForm((p) => ({ ...p, exemptGround: v as "yes" | "no" }))} options={[{ value: "yes", label: "Ναι — 0‰ ανελκυστήρα" }, { value: "no", label: "Όχι — πληρώνει κι αυτό" }]} /></FormField>
                        </div>
                        <ExampleTable columns={["Μονάδα", "Όροφος", "Ανελκυστήρα ‰"]} rows={preview.rows.map((r) => { const u = units.find((x) => x.id === r.unitId)!; return [r.unitNumber, u.floor == null ? "—" : u.floor === 0 ? "Ισόγειο" : u.floor < 0 ? `Υπόγειο ${-u.floor}` : `${u.floor}ος`, fmt(r.elevator)]; })} footer={["Σύνολο", "", fmt(preview.totals.elevator)]} />
                      </>
                    )}
                </>
              )}
            </>
          ),
          validate: () => (!form.elevator ? "Έχει ανελκυστήρα;" : form.elevator === "yes" && form.regulation === "manual" && form.elevatorMode === "manual" ? manualSumError(cellsToManual(units, form.elevatorCells)) : null),
        },
        {
          key: "heating", title: "Θέρμανση",
          help: "Πώς μοιράζονται τα έξοδα θέρμανσης; Με μετρητές, το 70% πάει με την κατανάλωση και το 30% με τα χιλιοστά θέρμανσης — χρειάζονται ενδείξεις κάθε περίοδο.",
          render: () => (
            <>
              <ChoiceCards options={HEATING} value={form.heating} onChange={(v) => setForm((p) => ({ ...p, heating: v }))} />
              {form.heating && form.heating !== "NONE" && form.regulation === "manual" && (
                <FormField label="Χιλιοστά θέρμανσης"><FieldSelect value={form.heatingMode} onChange={(v) => setForm((p) => ({ ...p, heatingMode: v as "auto" | "manual" }))} options={[{ value: "auto", label: "Υπολογισμός βάσει νόμου (τ.μ.)" }, { value: "manual", label: "Από τον κανονισμό — θα τα γράψω" }]} /></FormField>
              )}
              {form.heating && form.heating !== "NONE" && form.regulation === "manual" && form.heatingMode === "manual" && <ManualGrid cells={form.heatingCells} onChange={(heatingCells) => setForm((p) => ({ ...p, heatingCells }))} column="heating" />}
              {form.heating && form.heating !== "NONE" && !(form.regulation === "manual" && form.heatingMode === "manual") && (
                <ExampleTable columns={["Μονάδα", "τ.μ.", "Θέρμανσης ‰"]} rows={preview.rows.map((r) => { const u = units.find((x) => x.id === r.unitId)!; return [r.unitNumber, fmt(u.areaSqm), fmt(r.heating)]; })} footer={["Σύνολο", "", fmt(preview.totals.heating)]} />
              )}
            </>
          ),
          validate: () => (!form.heating ? "Επιλέξτε πώς μοιράζεται η θέρμανση" : form.heating !== "NONE" && form.regulation === "manual" && form.heatingMode === "manual" ? manualSumError(cellsToManual(units, form.heatingCells)) : null),
        },
        {
          key: "check", title: "Έλεγχος",
          help: "Τα τρία σετ που θα αποθηκευτούν. Κάθε σετ αθροίζει 1000‰.",
          render: () => (
            <>
              <SummaryList rows={[
                ["Κανονισμός", form.regulation === "manual" ? "Ναι — χειροκίνητα χιλιοστά" : "Όχι — βάσει νόμου"],
                ["Ανελκυστήρας", form.elevator === "yes" ? `Ναι · +${form.surcharge}%/όροφο${form.exemptGround === "yes" ? " · ισόγειο εξαιρείται" : ""}` : "Όχι"],
                ["Θέρμανση", HEATING.find((h) => h.value === form.heating)?.label],
              ]} />
              <ExampleTable
                columns={["Μονάδα", "Γενικά ‰", "Ανελκυστήρα ‰", "Θέρμανσης ‰"]}
                rows={preview.rows.map((r) => [r.unitNumber, fmt(r.general), plan.elevator.enabled ? fmt(r.elevator) : "—", plan.heating.basis !== "NONE" ? fmt(r.heating) : "—"])}
                footer={["Σύνολο", fmt(preview.totals.general), plan.elevator.enabled ? fmt(preview.totals.elevator) : "—", plan.heating.basis !== "NONE" ? fmt(preview.totals.heating) : "—"]}
              />
            </>
          ),
        },
      ]}
      example={{
        video: videoForWizard("millesimes-setup"),
        guideHref: `${hubHrefForRole("SUPER_ADMIN")}?a=${def.guideSlug}`,
        render: () => (
          <>
            <ExampleCard title="Τρεις δαπάνες, τρία σετ χιλιοστών" tone="success">
              Έτσι θα μοιραστούν με τα χιλιοστά που ορίσατε: {example.expenses.map((e) => `${e.label} ${eur(e.amount)}`).join(" · ")}.
            </ExampleCard>
            <ExampleTable
              columns={["Μονάδα", "Γενικά ‰", "Καθαρισμός", "Ανελκ. ‰", "Ανελκυστήρας", "Θέρμ. ‰", "Πετρέλαιο"]}
              rows={example.perUnit.map((u) => { const r = preview.rows.find((x) => x.unitId === u.unitId)!; return [u.unitNumber, fmt(r.general), eur(u.amounts[0]), fmt(r.elevator), eur(u.amounts[1]), fmt(r.heating), eur(u.amounts[2])]; })}
              footer={["Σύνολο", fmt(preview.totals.general), eur(example.expenses[0].amount), fmt(preview.totals.elevator), plan.elevator.enabled ? eur(example.expenses[1].amount) : "—", fmt(preview.totals.heating), plan.heating.basis !== "NONE" ? eur(example.expenses[2].amount) : "—"]}
            />
            <ExampleCard title="Νομική βάση" tone="info">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li><b>Γενικά:</b> {example.legal.general}</li>
                <li><b>Ανελκυστήρα:</b> {example.legal.elevator}</li>
                <li><b>Θέρμανσης:</b> {example.legal.heating}</li>
              </ul>
            </ExampleCard>
            {example.missingArea.length > 0 && <ExampleCard title="Χωρίς τετραγωνικά" tone="warn">{example.missingArea.join(", ")} — δεν συμμετέχουν στο μοίρασμα μέχρι να συμπληρωθούν.</ExampleCard>}
          </>
        ),
      }}
      onFinish={async () => {
        const res = await applyMillesimesSetup(buildingId, plan);
        if ("error" in res) return { error: res.error };
        onDone();
        return { done: { title: "Τα χιλιοστά εφαρμόστηκαν", lines: [`${res.updated} μονάδες ενημερώθηκαν`, "Τα ειδοποιητήρια κοινοχρήστων θα χρησιμοποιούν τα νέα σετ"], next: [] } };
      }}
    />
  );
}
