"use client";

import { useMemo, useState } from "react";
import type { ElementType } from "react";
import { RiHome4Line, RiBuilding2Line, RiDoorOpenLine, RiPriceTag3Line, RiTimerLine, RiRoadMapLine, RiStarLine, RiPuzzleLine } from "react-icons/ri";
import { GuidedFlow, ChoiceCards, SummaryList } from "@/components/ui/guided-flow";
import { ExampleCard, ExampleTable, NumberField, parseNumber } from "@/components/ui/guided-flow-parts";
import { FormField, FieldInput, FieldTextarea } from "@/components/ui/modal";
import { createService } from "@/app/actions/services";
import type { DistanceZone } from "@/lib/distance/zones";
import { PRICING_MODELS, suggestServiceCode, exampleForService, type ServicePricingModel } from "@/lib/wizards/examples/service";
import { getWizard } from "@/lib/wizards/registry";
import { videoForWizard } from "@/lib/wizards/videos";
import { hubHrefForRole } from "@/lib/help/hub";

export type CreatedService = { id: string; name: string; code: string; description: string | null; isCore: boolean; pricingModel: string; price: number; active: boolean; zonePrices: Record<string, number> | null };

const ICONS: Record<string, ElementType> = { RiHome4Line, RiBuilding2Line, RiDoorOpenLine, RiPriceTag3Line, RiTimerLine, RiRoadMapLine };
const MODEL_OPTIONS = PRICING_MODELS.map((p) => ({ value: p.value, label: p.label, description: p.description, icon: ICONS[p.icon] }));
const KIND = [
  { value: "module" as const, label: "Πρόσθετη υπηρεσία (module)", description: "Ο πελάτης την επιλέγει ανά ιδιοκτησία — π.χ. καθαρισμός, συνελεύσεις.", icon: RiPuzzleLine },
  { value: "core" as const, label: "Βασική (CORE)", description: "Πάντα ενεργή σε κάθε ιδιοκτησία — η βασική διαχείριση και τα κοινόχρηστα.", icon: RiStarLine },
];
const eur = (n: number) => `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

type Form = { name: string; code: string; codeTouched: boolean; description: string; kind: "module" | "core" | null; pricingModel: ServicePricingModel | null; price: string; zonePrices: Record<string, string> };
const initForm = (): Form => ({ name: "", code: "", codeTouched: false, description: "", kind: null, pricingModel: null, price: "", zonePrices: {} });

/** Step-by-step catalog service (spec §4.6): what → how it is charged → check → example on two properties. */
export function ServiceWizard({ zones, takenCodes, onClose, onDone, onSimpleForm }: {
  zones: DistanceZone[];
  takenCodes: string[];
  onClose: () => void;
  onDone: (s: CreatedService) => void;
  onSimpleForm?: () => void;
}) {
  const [form, setForm] = useState<Form>(initForm());
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initForm()), [form]);
  const def = getWizard("service-new");
  const price = parseNumber(form.price) ?? 0;
  const model = PRICING_MODELS.find((p) => p.value === form.pricingModel) ?? null;
  const zonePrices = Object.fromEntries(zones.map((z) => [z.code, parseNumber(form.zonePrices[z.code] ?? "") ?? 0]));
  const example = exampleForService({ pricingModel: form.pricingModel ?? "PER_UNIT", price, zonePrices }, zones);

  return (
    <GuidedFlow<Form>
      title={def.title} onClose={onClose} onSimpleForm={onSimpleForm} finishLabel="Δημιουργία υπηρεσίας" width={780} dirty={dirty}
      draft={{ key: "service-new", value: form, restore: (v) => setForm({ ...initForm(), ...v }) }}
      steps={[
        {
          key: "what", title: "Τι υπηρεσία είναι;",
          help: "Ο κατάλογος υπηρεσιών είναι ό,τι πουλά η εταιρεία στους πελάτες της. Κάθε ιδιοκτησία επιλέγει υπηρεσίες από εδώ και αυτές γίνονται το μηνιαίο της τιμολόγιο.",
          render: () => (
            <>
              <FormField label="Όνομα" required><FieldInput value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v, code: p.codeTouched ? p.code : suggestServiceCode(v, takenCodes) }))} placeholder="π.χ. Καθαρισμός κοινοχρήστων" /></FormField>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <FormField label="Κωδικός" required hint="Προτείνεται από το όνομα· μοναδικός, λατινικά κεφαλαία."><FieldInput value={form.code} onChange={(v) => setForm((p) => ({ ...p, code: v.toUpperCase(), codeTouched: true }))} /></FormField>
                <FormField label="Περιγραφή (προαιρετικά)"><FieldTextarea value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} rows={2} placeholder="Τι περιλαμβάνει — φαίνεται στον πελάτη" /></FormField>
              </div>
              <FormField label="Είδος" required><ChoiceCards options={KIND} value={form.kind} onChange={(v) => setForm((p) => ({ ...p, kind: v }))} /></FormField>
            </>
          ),
          validate: () => (!form.name.trim() ? "Γράψτε το όνομα της υπηρεσίας" : !form.code.trim() ? "Χρειάζεται κωδικός" : takenCodes.map((c) => c.toUpperCase()).includes(form.code.trim().toUpperCase()) ? "Ο κωδικός υπάρχει ήδη" : !form.kind ? "Επιλέξτε είδος" : null),
        },
        {
          key: "pricing", title: "Πώς χρεώνεται;",
          help: "Το μοντέλο τιμολόγησης λέει ΤΙ μετράμε κάθε μήνα: μονάδες, κτήρια, κοινόχρηστους χώρους, ένα σταθερό ποσό, προπληρωμένα λεπτά ή ζώνες απόστασης.",
          render: () => (
            <>
              <ChoiceCards options={MODEL_OPTIONS} value={form.pricingModel} onChange={(v) => setForm((p) => ({ ...p, pricingModel: v }))} columns={2} />
              {model && (
                <FormField label={model.priceLabel} required><NumberField unit="€" value={form.price} onChange={(v) => setForm((p) => ({ ...p, price: v }))} min={0} placeholder="0,00" /></FormField>
              )}
              {form.pricingModel === "PER_ZONE" && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: "var(--fs-12)", fontWeight: 700 }}>Ποσό ανά ζώνη (€ / κτήριο / μήνα)</div>
                  <div style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)" }}>Μηνιαίο = βασική τιμή + το ποσό της ζώνης κάθε κτηρίου. Οι ζώνες ορίζονται στις Ρυθμίσεις → Σταθμός βάσης & ζώνες.</div>
                  {zones.length === 0 ? <div style={{ fontSize: "var(--fs-12)", color: "var(--color-warning)" }}>Δεν έχουν οριστεί ζώνες ακόμη.</div> : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                      {zones.map((z) => <FormField key={z.code} label={`${z.label}${z.maxKm != null ? ` (έως ${z.maxKm} km)` : " (και άνω)"}`}><NumberField unit="€" value={form.zonePrices[z.code] ?? ""} onChange={(v) => setForm((p) => ({ ...p, zonePrices: { ...p.zonePrices, [z.code]: v } }))} min={0} placeholder="0,00" /></FormField>)}
                    </div>
                  )}
                </div>
              )}
            </>
          ),
          validate: () => (!form.pricingModel ? "Επιλέξτε τρόπο χρέωσης" : parseNumber(form.price) == null || price < 0 ? "Δώστε τιμή (0 επιτρέπεται)" : null),
        },
        {
          key: "check", title: "Έλεγχος",
          help: "Αν κάτι δεν είναι σωστό, πατήστε το βήμα στη ράγα ή «Πίσω».",
          render: () => (
            <SummaryList rows={[["Υπηρεσία", form.name], ["Κωδικός", form.code], ["Είδος", form.kind === "core" ? "Βασική (CORE)" : "Πρόσθετη (module)"], ["Χρέωση", model?.label], ["Τιμή", `${eur(price)} ${model?.priceLabel ?? ""}`], ...(form.pricingModel === "PER_ZONE" ? [["Ζώνες", zones.map((z) => `${z.label} ${eur(zonePrices[z.code] ?? 0)}`).join(" · ")] as [string, string]] : []), ["Περιγραφή", form.description]]} />
          ),
        },
      ]}
      example={{
        video: videoForWizard("service-new"),
        guideHref: `${hubHrefForRole("SUPER_ADMIN")}?a=${def.guideSlug}`,
        render: () => (
          <>
            <ExampleCard title={`Τι θα χρεώσει η «${form.name.trim() || "υπηρεσία"}» σε δύο ενδεικτικές ιδιοκτησίες`} tone="success">
              {model?.description}
            </ExampleCard>
            <ExampleTable
              columns={["Ιδιοκτησία", "Μονάδες", "Κτήρια", "Κοιν. χώροι", "Ποσότητα", "€ / μήνα"]}
              rows={example.scenarios.map((s) => [s.label + (form.pricingModel === "PER_ZONE" ? ` (${s.zones.join(", ")})` : ""), String(s.counts.units), String(s.counts.buildings), String(s.counts.commonAreas), s.line.qty == null ? "—" : String(s.line.qty), eur(s.line.amount)])}
            />
            {example.scenarios[0].line.detail && <ExampleCard tone="info" title="Λεπτομέρεια">{example.scenarios.map((s) => `${s.label}: ${s.line.detail}`).join(" · ")}</ExampleCard>}
            {form.pricingModel === "METERED_PREPAID" && <ExampleCard tone="info" title="Προαγορά">Η υπηρεσία δεν έχει μηνιαίο ποσό: ο πελάτης προαγοράζει λεπτά (π.χ. 600 λεπτά × {eur(price)} = {eur(price * 600)}) και μια συνέλευση 60′ με 10 συμμετέχοντες καταναλώνει 600 λεπτά.</ExampleCard>}
            {form.kind === "core" && <ExampleCard tone="warn" title="Βασική υπηρεσία">Προεπιλεγμένη σε κάθε πακέτο: το «Πακέτο υπηρεσιών βήμα-βήμα» την ενεργοποιεί στην ιδιοκτησία και δεν μπορεί να αφαιρεθεί από εκεί.</ExampleCard>}
          </>
        ),
      }}
      onFinish={async () => {
        const res = await createService({ name: form.name.trim(), code: form.code.trim(), description: form.description || null, isCore: form.kind === "core", pricingModel: form.pricingModel!, price, active: true, zonePrices: form.pricingModel === "PER_ZONE" ? zonePrices : null });
        if ("error" in res && res.error) return { error: res.error };
        const s = (res as { service: CreatedService }).service;
        onDone(s);
        return { done: { title: `Η υπηρεσία «${s.name}» προστέθηκε στον κατάλογο`, lines: [`${model?.label} · ${eur(price)}`, "Οι ιδιοκτησίες μπορούν τώρα να την επιλέξουν στο πακέτο τους"], next: [] } };
      }}
    />
  );
}
