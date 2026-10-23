"use client";

import { useMemo, useRef, useState } from "react";
import { RiCheckboxCircleFill, RiCheckboxBlankCircleLine, RiLockLine } from "react-icons/ri";
import { GuidedFlow, SummaryList } from "@/components/ui/guided-flow";
import { ExampleCard, ExampleTable, NumberField, parseNumber } from "@/components/ui/guided-flow-parts";
import { FormField } from "@/components/ui/modal";
import { setPropertyService, addPrepaidMinutes } from "@/app/actions/property-package";
import { packageLines } from "@/lib/wizards/examples/package";
import { getWizard } from "@/lib/wizards/registry";
import { videoForWizard } from "@/lib/wizards/videos";
import { hubHrefForRole } from "@/lib/help/hub";

/** Shape of listPropertyPackage() (app/actions/property-package). */
export type PackageView = {
  period: string;
  counts: { units: number; buildings: number; commonAreas: number; buildingZones: (string | null)[] };
  services: { id: string; name: string; code: string; isCore: boolean; pricingModel: string; price: number; zonePrices?: Record<string, number> | null; enabled: boolean }[];
  lines: { serviceId: string; qty: number; amount: number; detail: string | null }[];
  total: number;
  invoice: { status: string; paidAt: string | Date | null } | null;
};

const PRICING_LABEL: Record<string, string> = { PER_UNIT: "ανά μονάδα", PER_BUILDING: "ανά κτήριο", PER_COMMON_AREA: "ανά κοιν. χώρο", FLAT: "σταθερή", METERED_PREPAID: "με μέτρηση", PER_ZONE: "ανά ζώνη απόστασης" };
const eur = (n: number) => `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const periodLabel = (p: string) => { const [y, m] = p.split("-").map(Number); return new Date(y, (m || 1) - 1, 1).toLocaleDateString("el-GR", { month: "long", year: "numeric" }); };

type Form = { enabled: Record<string, boolean>; prepaidHours: Record<string, string> };

/** Step-by-step property package (spec §4.7): pick services with live monthly cost → prepaid minutes → check → example (first invoice). */
export function PackageWizard({ propertyId, propertyName, view, onClose, onDone }: {
  propertyId: string;
  propertyName?: string;
  view: PackageView;
  onClose: () => void;
  onDone: (enabledIds: string[]) => void;
}) {
  const initial = useMemo<Form>(() => ({ enabled: Object.fromEntries(view.services.map((s) => [s.id, s.isCore || s.enabled])), prepaidHours: {} }), [view]);
  const [form, setForm] = useState<Form>(initial);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const def = getWizard("package-setup");
  const services = view.services.map((s) => ({ ...s, enabled: !!form.enabled[s.id] }));
  const pkg = packageLines(services, view.counts, view.counts.buildingZones);
  const metered = services.filter((s) => s.pricingModel === "METERED_PREPAID" && (s.isCore || form.enabled[s.id]));
  const prepaidDone = useRef(new Set<string>()); // a retry after a partial failure must not add the minutes twice
  const toggle = (id: string) => setForm((p) => ({ ...p, enabled: { ...p.enabled, [id]: !p.enabled[id] } }));

  return (
    <GuidedFlow<Form>
      title={propertyName ? `${def.title} — ${propertyName}` : def.title} onClose={onClose} finishLabel="Αποθήκευση πακέτου" width={820} dirty={dirty}
      draft={{ key: "package-setup", ctxId: propertyId, value: form, restore: (v) => setForm({ ...initial, ...v }) }}
      steps={[
        {
          key: "services", title: "Τι περιλαμβάνει το πακέτο;",
          help: `Το πακέτο είναι οι υπηρεσίες που επιλέγει ο πελάτης για αυτή την ιδιοκτησία — από αυτές βγαίνει το μηνιαίο τιμολόγιο. Μετρά ${view.counts.units} μονάδες, ${view.counts.buildings} κτήρια, ${view.counts.commonAreas} κοινόχρηστους χώρους. Η βασική υπηρεσία είναι πάντα μέσα.`,
          render: () => (
            <div role="group" aria-label="Υπηρεσίες" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pkg.lines.length === 0 && (
                <ExampleCard tone="warn" title="Ο κατάλογος υπηρεσιών είναι κενός">
                  Δεν υπάρχουν ενεργές υπηρεσίες στον κατάλογο της εταιρείας. Δημιουργήστε πρώτα μία από «Υπηρεσίες» (ο οδηγός «Νέα υπηρεσία καταλόγου» εξηγεί τα μοντέλα τιμολόγησης) και επιστρέψτε εδώ.
                </ExampleCard>
              )}
              {pkg.lines.map((l) => {
                const s = services.find((x) => x.id === l.id)!;
                const on = l.counted;
                return (
                  <button key={l.id} type="button" role="checkbox" aria-checked={on} disabled={l.isCore} onClick={() => !l.isCore && toggle(l.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", minHeight: 56, padding: "10px 14px", borderRadius: 10, cursor: l.isCore ? "default" : "pointer", border: `2px solid ${on ? "var(--color-primary)" : "var(--border)"}`, background: on ? "color-mix(in srgb, var(--color-primary) 6%, var(--card))" : "var(--card)", color: "var(--foreground)" }}>
                    {l.isCore ? <RiLockLine style={{ fontSize: "var(--fs-20)", color: "var(--color-primary)", flexShrink: 0 }} /> : on ? <RiCheckboxCircleFill style={{ fontSize: "var(--fs-22)", color: "var(--color-primary)", flexShrink: 0 }} /> : <RiCheckboxBlankCircleLine style={{ fontSize: "var(--fs-22)", color: "var(--muted-foreground)", flexShrink: 0 }} />}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: "var(--fs-14)", fontWeight: 700 }}>{l.name} {l.isCore && <small style={{ fontWeight: 600, color: "var(--muted-foreground)" }}>· βασική</small>}</span>
                      <span style={{ display: "block", fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{eur(s.price)} {PRICING_LABEL[s.pricingModel] ?? s.pricingModel}{l.qty != null && !l.metered ? ` × ${l.qty}` : ""}{l.detail ? ` · ${l.detail}` : ""}</span>
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: "var(--fs-14)", whiteSpace: "nowrap" }}>{l.metered ? "με χρήση" : eur(l.amount)}</span>
                  </button>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", fontWeight: 800, fontSize: "var(--fs-15)" }}><span>Μηνιαίο σύνολο</span><span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-primary)" }}>{eur(pkg.total)} / μήνα</span></div>
            </div>
          ),
          validate: () => (pkg.lines.length === 0 ? "Ο κατάλογος υπηρεσιών είναι κενός — δημιουργήστε πρώτα μια υπηρεσία" : pkg.lines.some((l) => l.counted) ? null : "Επιλέξτε τουλάχιστον μία υπηρεσία"),
        },
        ...(metered.length ? [{
          key: "prepaid", title: "Συνελεύσεις: προαγορά ωρών",
          help: "Οι συνελεύσεις χρεώνονται με μέτρηση: διάρκεια × συμμετέχοντες, σε ώρες-ατόμου. Ο πελάτης προαγοράζει ένα υπόλοιπο που καταναλώνεται σε κάθε συνέλευση. Μπορείτε να το αφήσετε κενό και να προσθέσετε αργότερα.",
          render: () => (
            <>
              {metered.map((s) => (
                <FormField key={s.id} label={`${s.name} — ώρες-ατόμου προς προαγορά`} hint={`${eur(s.price)} ανά λεπτό συμμετοχής · 1 ώρα × 10 άτομα = 10 ώρες-ατόμου = ${eur(s.price * 600)}`}>
                  <NumberField value={form.prepaidHours[s.id] ?? ""} onChange={(v) => setForm((p) => ({ ...p, prepaidHours: { ...p.prepaidHours, [s.id]: v } }))} min={0} placeholder="π.χ. 10" />
                </FormField>
              ))}
            </>
          ),
        }] : []),
        {
          key: "check", title: "Έλεγχος",
          help: "Αν κάτι δεν είναι σωστό, πατήστε το βήμα στη ράγα ή «Πίσω».",
          render: () => (
            <SummaryList rows={[
              ["Ιδιοκτησία", propertyName ?? propertyId],
              ["Υπηρεσίες", pkg.lines.filter((l) => l.counted).map((l) => l.name).join(" · ")],
              ["Εκτός πακέτου", pkg.lines.filter((l) => !l.counted).map((l) => l.name).join(" · ") || "—"],
              ...metered.map((s) => [`Προαγορά — ${s.name}`, (parseNumber(form.prepaidHours[s.id] ?? "") ?? 0) > 0 ? `${form.prepaidHours[s.id]} ώρες-ατόμου` : "καμία τώρα"] as [string, string]),
              ["Μηνιαίο σύνολο", `${eur(pkg.total)} / μήνα`],
            ]} />
          ),
        },
      ]}
      example={{
        video: videoForWizard("package-setup"),
        guideHref: `${hubHrefForRole("SUPER_ADMIN")}?a=${def.guideSlug}`,
        render: () => (
          <>
            <ExampleCard title={`Το μηνιαίο τιμολόγιο της ιδιοκτησίας: ${eur(pkg.total)}`} tone="success">
              Περίοδος {periodLabel(view.period)}{view.invoice ? ` — το τιμολόγιο αυτής της περιόδου είναι ήδη ${view.invoice.status === "PAID" ? "εξοφλημένο" : "εκδομένο"}· οι αλλαγές ισχύουν από την επόμενη` : " — θα εκδοθεί με αυτά τα ποσά"}. Οι ποσότητες μετρούνται ζωντανά: αν προστεθούν μονάδες ή κοινόχρηστοι χώροι, το ποσό ακολουθεί.
            </ExampleCard>
            <ExampleTable
              columns={["Υπηρεσία", "Χρέωση", "Ποσότητα", "€ / μήνα"]}
              rows={pkg.lines.filter((l) => l.counted).map((l) => { const s = services.find((x) => x.id === l.id)!; return [l.name, `${eur(s.price)} ${PRICING_LABEL[s.pricingModel] ?? ""}`, l.metered ? "με χρήση" : l.qty == null ? "—" : String(l.qty), l.metered ? "0,00 € + προαγορά" : eur(l.amount)]; })}
              footer={["Σύνολο", "", "", eur(pkg.total)]}
            />
            {metered.length > 0 && <ExampleCard tone="info" title="Συνελεύσεις">Μια συνέλευση 90′ με 12 συμμετέχοντες καταναλώνει 18 ώρες-ατόμου από το προπληρωμένο υπόλοιπο. Όταν τελειώσει, η επόμενη προαγορά γίνεται από εδώ ή από την καρτέλα της ιδιοκτησίας.</ExampleCard>}
          </>
        ),
      }}
      onFinish={async () => {
        try {
          for (const s of services) {
            const was = view.services.find((x) => x.id === s.id)?.enabled ?? false;
            // Core services are billed only when active on the property (the invoice counts PropertyService rows), so they are activated here.
            const want = s.isCore ? true : s.enabled;
            if (was !== want) await setPropertyService(propertyId, s.id, want);
          }
          for (const s of metered) {
            const hours = parseNumber(form.prepaidHours[s.id] ?? "") ?? 0;
            if (hours > 0 && !prepaidDone.current.has(s.id)) {
              const r = await addPrepaidMinutes(propertyId, s.id, Math.round(hours * 60));
              if ("error" in r && r.error) return { error: r.error };
              prepaidDone.current.add(s.id);
            }
          }
        } catch (e) {
          return { error: e instanceof Error && e.message === "Forbidden" ? "Δεν έχετε δικαίωμα αλλαγής του πακέτου αυτής της ιδιοκτησίας." : "Η αποθήκευση απέτυχε. Δοκιμάστε ξανά." };
        }
        const enabledIds = services.filter((s) => s.isCore || s.enabled).map((s) => s.id);
        onDone(enabledIds);
        return { done: { title: "Το πακέτο αποθηκεύτηκε", lines: [`${enabledIds.length} υπηρεσίες · ${eur(pkg.total)} / μήνα`, "Το επόμενο τιμολόγιο θα εκδοθεί με αυτά τα ποσά"], next: [] } };
      }}
    />
  );
}
