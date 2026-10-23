"use client";

import { useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import { RiStairsLine, RiDoorOpenLine, RiFireLine, RiHome8Line, RiPlantLine, RiParkingBoxLine, RiArchiveLine, RiMoreLine } from "react-icons/ri";
import { GuidedFlow, ChoiceCards, SummaryList } from "@/components/ui/guided-flow";
import { ExampleCard, ExampleTable, NumberField, parseNumber } from "@/components/ui/guided-flow-parts";
import { FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { createCommonArea } from "@/app/actions/buildings";
import { createManagedItem } from "@/app/actions/managed-items";
import { COMMON_AREA_TYPES, areaTypeLabel, exampleForCommonArea, suggestedItemTypeIds } from "@/lib/wizards/examples/common-area";
import { getWizard, nextWizard } from "@/lib/wizards/registry";
import { videoForWizard } from "@/lib/wizards/videos";
import { hubHrefForRole } from "@/lib/help/hub";

export type PerAreaService = { name: string; price: number; pricingModel: string; enabled: boolean };

const ICONS: Record<string, ElementType> = { RiStairsLine, RiDoorOpenLine, RiFireLine, RiHome8Line, RiPlantLine, RiParkingBoxLine, RiArchiveLine, RiMoreLine };
const TYPE_OPTIONS = COMMON_AREA_TYPES.map((t) => ({ value: t.value, label: t.label, description: t.description, icon: ICONS[t.icon] }));
const eur = (n: number) => `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

type Form = { type: string | null; name: string; floor: string; items: Record<string, string>; notes: string };
const initForm = (): Form => ({ type: null, name: "", floor: "", items: {}, notes: "" });

/** Step-by-step common area + the managed items it hosts (spec §4.5). Managed buildings only. */
export function CommonAreaWizard({ buildingId, itemTypes, floorOptions, services, currentCommonAreas, onClose, onDone, onSimpleForm }: {
  buildingId: string;
  itemTypes: { id: string; name: string; active: boolean }[];
  floorOptions: string[];
  services: PerAreaService[];
  currentCommonAreas: number;
  onClose: () => void;
  onDone: () => void;
  onSimpleForm?: () => void;
}) {
  const [form, setForm] = useState<Form>(initForm());
  // What a previous (partially failed) finish already created — a retry continues instead of duplicating.
  const createdArea = useRef<string | null>(null);
  const createdItems = useRef(new Set<string>());
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initForm()), [form]);
  const def = getWizard("common-area-new");
  const next = nextWizard("common-area-new");
  const activeTypes = itemTypes.filter((t) => t.active);
  const chosen = activeTypes.filter((t) => (parseNumber(form.items[t.id] ?? "") ?? 0) > 0).map((t) => ({ id: t.id, typeName: t.name, quantity: Math.max(1, Math.round(parseNumber(form.items[t.id] ?? "") ?? 0)) }));
  const example = exampleForCommonArea({ name: form.name, type: form.type ?? "other", items: chosen, services, currentCommonAreas });

  function pickType(v: string) {
    const t = COMMON_AREA_TYPES.find((x) => x.value === v)!;
    const suggested = suggestedItemTypeIds(v, activeTypes);
    setForm((p) => ({
      ...p, type: v,
      name: p.name.trim() && !COMMON_AREA_TYPES.some((x) => x.label === p.name) ? p.name : t.value === "other" ? "" : t.label,
      items: Object.keys(p.items).length ? p.items : Object.fromEntries(suggested.map((id) => [id, "1"])),
    }));
  }

  return (
    <GuidedFlow<Form>
      title={def.title} onClose={onClose} onSimpleForm={onSimpleForm} finishLabel="Δημιουργία χώρου" width={780} dirty={dirty}
      draft={{ key: "common-area-new", ctxId: buildingId, value: form, restore: (v) => setForm({ ...initForm(), ...v }) }}
      steps={[
        {
          key: "type", title: "Ποιος χώρος είναι;",
          help: "Οι κοινόχρηστοι χώροι είναι τα μέρη του κτηρίου που ανήκουν σε όλους: κλιμακοστάσιο, είσοδος, λεβητοστάσιο… Εδώ ορίζετε τι φροντίζει η εταιρεία σε καθέναν, και μετρούν στις υπηρεσίες «ανά κοινόχρηστο χώρο».",
          render: () => (
            <>
              <ChoiceCards options={TYPE_OPTIONS} value={form.type} onChange={pickType} columns={2} />
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <FormField label="Όνομα" required><FieldInput value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="π.χ. Κλιμακοστάσιο Α" /></FormField>
                <FormField label="Όροφος"><FieldSelect value={form.floor} onChange={(v) => setForm((p) => ({ ...p, floor: v }))} placeholder="—" options={floorOptions.map((f) => ({ value: f, label: f }))} /></FormField>
              </div>
            </>
          ),
          validate: () => (!form.type ? "Επιλέξτε είδος χώρου" : !form.name.trim() ? "Δώστε ένα όνομα στον χώρο" : null),
        },
        {
          key: "items", title: "Τι υπάρχει εκεί να φροντίζουμε;",
          help: "Τα «στοιχεία διαχείρισης» είναι ό,τι συντηρεί η εταιρεία: λαμπτήρες, πυροσβεστήρες, καυστήρας… Δώστε ποσότητα σε όσα υπάρχουν στον χώρο· τα υπόλοιπα αφήστε τα κενά. Μπορείτε να προσθέσετε κι άλλα αργότερα.",
          render: () => activeTypes.length === 0 ? (
            <ExampleCard tone="warn" title="Κενός κατάλογος">Δεν υπάρχουν ενεργά στοιχεία διαχείρισης στον κατάλογο («Στοιχεία Διαχείρισης» στο μενού). Μπορείτε να δημιουργήσετε τον χώρο χωρίς στοιχεία.</ExampleCard>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {activeTypes.map((t) => (
                <FormField key={t.id} label={t.name}><NumberField value={form.items[t.id] ?? ""} onChange={(v) => setForm((p) => ({ ...p, items: { ...p.items, [t.id]: v } }))} min={0} placeholder="πλήθος" ariaLabel={`Πλήθος: ${t.name}`} /></FormField>
              ))}
            </div>
          ),
        },
        {
          key: "check", title: "Έλεγχος",
          help: "Αν κάτι δεν είναι σωστό, πατήστε το βήμα στη ράγα ή «Πίσω».",
          render: () => (
            <>
              <SummaryList rows={[["Χώρος", form.name], ["Είδος", form.type ? areaTypeLabel(form.type) : ""], ["Όροφος", form.floor], ["Στοιχεία", chosen.length ? chosen.map((c) => `${c.quantity} × ${c.typeName}`).join(" · ") : "κανένα"]]} />
              <FormField label="Σημειώσεις για τα στοιχεία (προαιρετικά)"><FieldTextarea value={form.notes} onChange={(v) => setForm((p) => ({ ...p, notes: v }))} rows={2} placeholder="π.χ. Οι λαμπτήρες είναι LED E27" /></FormField>
            </>
          ),
        },
      ]}
      example={{
        video: videoForWizard("common-area-new"),
        guideHref: `${hubHrefForRole("SUPER_ADMIN")}?a=${def.guideSlug}`,
        render: () => (
          <>
            <ExampleCard title={example.headline} tone="success">
              {example.itemLines.length ? <>Θα φροντίζουμε εκεί: {example.itemLines.join(", ")}. Κάθε στοιχείο μπορεί μετά να πάρει πρόγραμμα συντήρησης από τα «Στοιχεία διαχείρισης» του κτηρίου.</> : <>Χωρίς στοιχεία διαχείρισης προς το παρόν — μπορείτε να προσθέσετε από την καρτέλα «Διαχ. στοιχεία».</>}
            </ExampleCard>
            {example.costLines.length > 0 ? (
              <>
                <ExampleCard title="Επίδραση στο πακέτο της ιδιοκτησίας" tone="warn">Οι υπηρεσίες που χρεώνονται «ανά κοινόχρηστο χώρο» θα αυξηθούν κατά {eur(example.costDelta)} τον μήνα.</ExampleCard>
                <ExampleTable columns={["Υπηρεσία", "Πριν / μήνα", "Μετά / μήνα"]} rows={example.costLines.map((l) => [l.service, eur(l.before), eur(l.after)])} />
              </>
            ) : (
              <ExampleCard title="Πακέτο" tone="info">Καμία ενεργή υπηρεσία «ανά κοινόχρηστο χώρο» σε αυτή την ιδιοκτησία — ο νέος χώρος δεν αλλάζει τη μηνιαία χρέωση.</ExampleCard>
            )}
          </>
        ),
      }}
      onFinish={async () => {
        const floorNum = (() => { const m = form.floor.match(/-?\d+/); if (/Ισόγειο/.test(form.floor)) return 0; if (/Υπόγειο/.test(form.floor) && m) return -Number(m[0]); return m ? Number(m[0]) : null; })();
        let areaId = createdArea.current;
        if (!areaId) {
          let res: Awaited<ReturnType<typeof createCommonArea>>;
          try {
            res = await createCommonArea(buildingId, { name: form.name.trim(), type: form.type && form.type !== "other" ? areaTypeLabel(form.type) : null, floor: floorNum });
          } catch (e) {
            if (e instanceof Error && /forbidden/i.test(e.message)) return { error: "Η δημιουργία κοινόχρηστου χώρου επιτρέπεται μόνο στον Super Admin. Ζητήστε το από την εταιρεία ή προσθέστε μόνο στοιχεία («Προτιμώ την απλή φόρμα»)." };
            return { error: "Η δημιουργία του χώρου απέτυχε. Ελέγξτε τη σύνδεση και πατήστε ξανά." };
          }
          if ("error" in res && res.error) return { error: res.error };
          areaId = (res as { area?: { id: string } }).area?.id ?? null;
          createdArea.current = areaId;
        }
        let created = createdItems.current.size;
        for (const c of chosen) {
          if (createdItems.current.has(c.id)) continue;
          const r = await createManagedItem(buildingId, { itemTypeId: c.id, location: form.name.trim(), floorLabel: form.floor || null, quantity: c.quantity, notes: form.notes || null, commonAreaId: areaId });
          if ("error" in r && r.error) return { error: `Ο χώρος δημιουργήθηκε, αλλά το στοιχείο «${c.typeName}» απέτυχε: ${r.error}. Πατήστε ξανά για να συνεχίσει από εκεί, ή προσθέστε τα υπόλοιπα από τα «Στοιχεία διαχείρισης».` };
          createdItems.current.add(c.id);
          created++;
        }
        onDone();
        return { done: { title: `Ο χώρος «${form.name.trim()}» δημιουργήθηκε`, lines: [`${created} στοιχεία διαχείρισης`], next: next && example.costLines.length ? [{ label: next.short, hint: "Δείτε τη νέα μηνιαία χρέωση της ιδιοκτησίας", icon: next.icon, onClick: onClose }] : [] } };
      }}
    />
  );
}
