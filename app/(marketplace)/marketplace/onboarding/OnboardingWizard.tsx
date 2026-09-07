"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormField, FieldInput, FieldSelect } from "@/components/ui/modal";
import { HoursEditor } from "@/components/suppliers/HoursEditor";
import { completeSupplierOnboarding } from "@/app/actions/suppliers";
import {
  SUPPLIER_KINDS, SUPPLIER_KIND_LABELS, DEFAULT_WORKING_HOURS, isValidGreekAfm, normalizeAfm, formatHoursSummary,
  type SupplierDTO, type ServiceCatalogItemDTO, type SupplierKind, type WorkingHours,
} from "@/lib/suppliers-shared";
import { RiCheckLine, RiLoaderLine, RiArrowRightLine, RiArrowLeftLine, RiStoreLine, RiPriceTag3Line, RiTimeLine, RiFlagLine } from "react-icons/ri";

type Existing = { catalogItemId: string; price: number | null; unit: string | null; active: boolean };
type Pick = { price: string; unit: string };

const STEPS = [
  { key: "profile", label: "Η επιχείρησή σας", icon: RiStoreLine },
  { key: "services", label: "Υπηρεσίες που προσφέρετε", icon: RiPriceTag3Line },
  { key: "hours", label: "Ωράριο & διαθεσιμότητα", icon: RiTimeLine },
  { key: "done", label: "Έλεγχος & ολοκλήρωση", icon: RiFlagLine },
] as const;

/** First-login wizard for the supplier admin — see design §7. */
export function OnboardingWizard({ supplier, catalog, categories, existing, userName }: {
  supplier: SupplierDTO;
  catalog: ServiceCatalogItemDTO[];
  categories: { id: string; name: string }[];
  existing: Existing[];
  userName: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    kind: supplier.kind as SupplierKind, name: supplier.name, afm: supplier.afm ?? "", doy: supplier.doy ?? "",
    address: supplier.address ?? "", postalCode: supplier.postalCode ?? "", city: supplier.city ?? "",
    phone: supplier.phone ?? "", email: supplier.email ?? "", webpage: supplier.webpage ?? "",
    contactName: supplier.contactName ?? "", contactPhone: supplier.contactPhone ?? "", contactEmail: supplier.contactEmail ?? "",
    iban: supplier.iban ?? "", bank: supplier.bank ?? "", remarks: supplier.remarks ?? "",
    siteSurveyFee: supplier.siteSurveyFee != null ? String(supplier.siteSurveyFee) : "",
  });
  const [surveyWaived, setSurveyWaived] = useState(supplier.siteSurveyFeeWaived ?? true);
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const [picks, setPicks] = useState<Record<string, Pick>>(() => {
    const init: Record<string, Pick> = {};
    for (const e of existing) if (e.active) init[e.catalogItemId] = { price: e.price != null ? String(e.price) : "", unit: e.unit ?? "" };
    return init;
  });
  const [hours, setHours] = useState<WorkingHours>(supplier.workingHours && Object.keys(supplier.workingHours).length ? supplier.workingHours : { ...DEFAULT_WORKING_HOURS });
  const [emergency24h, setEmergency24h] = useState(supplier.emergency24h);

  const grouped = useMemo(() => {
    const m = new Map<string, ServiceCatalogItemDTO[]>();
    for (const c of catalog) {
      const k = c.categoryName ?? "Γενικές υπηρεσίες";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return [...m.entries()];
  }, [catalog]);

  const pickedCount = Object.keys(picks).length;
  const afmWarn = form.afm.trim() && normalizeAfm(form.afm)?.length === 9 && !isValidGreekAfm(form.afm);

  function validateStep(): string | null {
    if (step === 0) {
      if (!form.name.trim()) return "Η επωνυμία είναι υποχρεωτική";
      if (!normalizeAfm(form.afm)) return "Το ΑΦΜ είναι υποχρεωτικό";
      if (!form.phone.trim() && !form.email.trim()) return "Δώστε τουλάχιστον τηλέφωνο ή email";
    }
    if (step === 1 && form.kind !== "PRODUCTS" && pickedCount === 0 && catalog.length > 0) return "Επιλέξτε τουλάχιστον μία υπηρεσία";
    return null;
  }
  function next() { const e = validateStep(); if (e) { setError(e); return; } setError(null); setStep((s) => Math.min(s + 1, STEPS.length - 1)); }
  function back() { setError(null); setStep((s) => Math.max(s - 1, 0)); }

  function finish() {
    setError(null);
    // Specialties = categories of the picked catalog services ∪ whatever was already set by the company.
    const pickedCats = new Set(supplier.categoryIds);
    for (const id of Object.keys(picks)) { const c = catalog.find((x) => x.id === id); if (c?.categoryId) pickedCats.add(c.categoryId); }
    startTransition(async () => {
      const res = await completeSupplierOnboarding(supplier.id, {
        profile: {
          ...form, isActive: true, emergency24h, workingHours: hours, categoryIds: [...pickedCats],
          siteSurveyFee: form.siteSurveyFee.trim() ? Number(form.siteSurveyFee.replace(",", ".")) : null, siteSurveyFeeWaived: surveyWaived,
        },
        services: Object.entries(picks).map(([catalogItemId, p]) => ({ catalogItemId, price: p.price.trim() ? Number(p.price.replace(",", ".")) : null, unit: p.unit || null })),
      });
      if (res && "error" in res && res.error) { setError(res.error); return; }
      router.push("/marketplace");
      router.refresh();
    });
  }

  return (
    <div className="dash-page" style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--muted-foreground)" }}>Πρώτη σύνδεση</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 0", color: "var(--foreground)" }}>Καλώς ήρθατε{userName ? `, ${userName}` : ""}</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--muted-foreground)", maxWidth: 620 }}>
          Σε τέσσερα βήματα δηλώνετε τα στοιχεία της επιχείρησής σας, τις υπηρεσίες που προσφέρετε από τον κατάλογο της εταιρείας διαχείρισης και το ωράριό σας. Μετά, θα λαμβάνετε αναθέσεις και αιτήματα προσφοράς.
        </p>
      </div>

      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const state = i < step ? "done" : i === step ? "active" : "todo";
          return (
            <li key={s.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
              background: state === "active" ? "var(--color-primary)" : "var(--card)", color: state === "active" ? "#fff" : state === "done" ? "var(--foreground)" : "var(--muted-foreground)",
              border: "1px solid var(--border)" }}>
              <span style={{ width: 22, height: 22, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: state === "done" ? "#15803d" : "transparent", color: state === "done" ? "#fff" : "inherit", border: state === "done" ? "none" : "1px solid currentColor", fontSize: 11 }}>
                {state === "done" ? <RiCheckLine /> : i + 1}
              </span>
              <Icon style={{ flexShrink: 0 }} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
            </li>
          );
        })}
      </ol>

      {error && <div style={errBox} role="alert">{error}</div>}

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 20 }}>
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={grid3}>
              <FormField label="Είδος"><FieldSelect value={form.kind} onChange={(v) => setForm((p) => ({ ...p, kind: v as SupplierKind }))} options={SUPPLIER_KINDS.map((k) => ({ value: k, label: SUPPLIER_KIND_LABELS[k] }))} /></FormField>
              <div style={{ gridColumn: "span 2" }}><FormField label="Επωνυμία" required><FieldInput value={form.name} onChange={f("name")} /></FormField></div>
              <FormField label="ΑΦΜ" required hint={afmWarn ? "Το checksum δεν επαληθεύεται — ελέγξτε το" : undefined}><FieldInput value={form.afm} onChange={f("afm")} placeholder="9 ψηφία" /></FormField>
              <FormField label="ΔΟΥ"><FieldInput value={form.doy} onChange={f("doy")} /></FormField>
              <FormField label="Ιστοσελίδα"><FieldInput value={form.webpage} onChange={f("webpage")} placeholder="https://" /></FormField>
              <div style={{ gridColumn: "span 2" }}><FormField label="Διεύθυνση έδρας" hint="Χρησιμοποιείται για την απόσταση από τα κτήρια"><FieldInput value={form.address} onChange={f("address")} placeholder="Οδός & αριθμός" /></FormField></div>
              <FormField label="Τ.Κ."><FieldInput value={form.postalCode} onChange={f("postalCode")} /></FormField>
              <FormField label="Πόλη"><FieldInput value={form.city} onChange={f("city")} /></FormField>
              <FormField label="Τηλέφωνο"><FieldInput value={form.phone} onChange={f("phone")} /></FormField>
              <FormField label="Email"><FieldInput type="email" value={form.email} onChange={f("email")} /></FormField>
              <FormField label="Υπεύθυνος επικοινωνίας"><FieldInput value={form.contactName} onChange={f("contactName")} /></FormField>
              <FormField label="Κινητό υπευθύνου"><FieldInput value={form.contactPhone} onChange={f("contactPhone")} /></FormField>
              <FormField label="Email υπευθύνου"><FieldInput type="email" value={form.contactEmail} onChange={f("contactEmail")} /></FormField>
              <div style={{ gridColumn: "span 2" }}><FormField label="IBAN" hint="Για τις πληρωμές της εταιρείας διαχείρισης προς εσάς"><FieldInput value={form.iban} onChange={f("iban")} placeholder="GR.." /></FormField></div>
              <FormField label="Τράπεζα"><FieldInput value={form.bank} onChange={f("bank")} /></FormField>
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
              Επιλέξτε τις υπηρεσίες που προσφέρετε από τον κατάλογο της εταιρείας διαχείρισης και δηλώστε την καθαρή τιμή σας ανά μονάδα (προαιρετικά — μπορείτε να την ορίσετε και σε κάθε προσφορά). Επιπλέον υπηρεσίες και προϊόντα προσθέτετε αργότερα από τον κατάλογό σας.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, alignItems: "end", padding: "10px 12px", borderRadius: 8, background: "var(--paper)" }}>
              <FormField label="Χρέωση αυτοψίας (€ καθ.)" hint="Επίσκεψη εκτίμησης πριν την προσφορά · κενό = δωρεάν">
                <FieldInput type="number" value={form.siteSurveyFee} onChange={f("siteSurveyFee")} placeholder="π.χ. 30" />
              </FormField>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer", paddingBottom: 8 }}>
                <input type="checkbox" checked={surveyWaived} onChange={(e) => setSurveyWaived(e.target.checked)} /> Συμψηφίζεται αν μου ανατεθεί η εργασία
              </label>
            </div>
            {catalog.length === 0 && <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Η εταιρεία διαχείρισης δεν έχει ανοίξει ακόμη υπηρεσίες — προχωρήστε στο επόμενο βήμα.</div>}
            {grouped.map(([cat, items]) => (
              <div key={cat}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{cat}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {items.map((c) => {
                    const on = !!picks[c.id];
                    return (
                      <div key={c.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 120px 120px", gap: 8, alignItems: "center", padding: "8px 10px", borderRadius: 8, border: `1px solid ${on ? "var(--color-primary)" : "var(--border)"}`, background: on ? "var(--color-primary)08" : "var(--paper)" }}>
                        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", minWidth: 0 }}>
                          <input type="checkbox" checked={on} onChange={(e) => setPicks((p) => { const n = { ...p }; if (e.target.checked) n[c.id] = { price: "", unit: c.unit ?? "" }; else delete n[c.id]; return n; })} style={{ marginTop: 3 }} />
                          <span style={{ minWidth: 0 }}><b style={{ fontSize: 13.5 }}>{c.name}</b>{c.description && <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{c.description}</div>}</span>
                        </label>
                        <input disabled={!on} value={picks[c.id]?.price ?? ""} onChange={(e) => setPicks((p) => ({ ...p, [c.id]: { ...p[c.id], price: e.target.value } }))} placeholder="Τιμή €" inputMode="decimal" style={smallInput} />
                        <input disabled={!on} value={picks[c.id]?.unit ?? ""} onChange={(e) => setPicks((p) => ({ ...p, [c.id]: { ...p[c.id], unit: e.target.value } }))} placeholder={c.unit ?? "μονάδα"} style={smallInput} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>Πότε δέχεστε εργασίες; Το ωράριο εμφανίζεται στην εταιρεία διαχείρισης όταν επιλέγει συνεργάτη.</p>
            <HoursEditor value={hours} onChange={setHours} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
              <input type="checkbox" checked={emergency24h} onChange={(e) => setEmergency24h(e.target.checked)} />
              Αναλαμβάνω έκτακτα περιστατικά 24/7 (προτείνομαι πρώτος σε επείγουσες βλάβες)
            </label>
            <FormField label="Περιοχή εξυπηρέτησης / παρατηρήσεις"><FieldInput value={form.remarks} onChange={f("remarks")} placeholder="π.χ. Αττική, εντός 40 km από την έδρα" /></FormField>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13.5 }}>
            <Summary title="Επιχείρηση" rows={[["Επωνυμία", form.name], ["ΑΦΜ / ΔΟΥ", [form.afm, form.doy].filter(Boolean).join(" / ")], ["Έδρα", [form.address, form.postalCode, form.city].filter(Boolean).join(", ")], ["Επικοινωνία", [form.phone, form.email].filter(Boolean).join(" · ")], ["Υπεύθυνος", [form.contactName, form.contactPhone].filter(Boolean).join(" · ")]]} />
            <Summary title="Υπηρεσίες" rows={[
              ["Αυτοψία", form.siteSurveyFee.trim() ? `${form.siteSurveyFee} € ${surveyWaived ? "(συμψηφίζεται)" : "(χρεώνεται πάντα)"}` : "δωρεάν"],
              ...(Object.keys(picks).length ? Object.entries(picks).map(([id, p]) => { const c = catalog.find((x) => x.id === id); return [c?.name ?? id, p.price ? `${p.price} € / ${p.unit || c?.unit || "μονάδα"}` : "τιμή ανά προσφορά"] as [string, string]; }) : [["—", "καμία από τον κατάλογο"] as [string, string]]),
            ]} />
            <Summary title="Ωράριο" rows={[["Λειτουργία", formatHoursSummary(hours)], ["Έκτακτα", emergency24h ? "24/7" : "όχι"], ["Ειδικότητες", categories.filter((c) => supplier.categoryIds.includes(c.id) || Object.keys(picks).some((id) => catalog.find((x) => x.id === id)?.categoryId === c.id)).map((c) => c.name).join(", ") || "—"]]} />
            <div style={{ background: "var(--paper)", borderRadius: 8, padding: 14, fontSize: 12.5, color: "var(--muted-foreground)" }}>
              Με την ολοκλήρωση, το προφίλ σας ενεργοποιείται στο μητρώο της εταιρείας διαχείρισης. Μπορείτε να προσθέσετε τεχνικούς από την «Ομάδα» και να αλλάξετε οτιδήποτε από το «Προφίλ».
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <button onClick={back} disabled={step === 0 || isPending} style={ghostBtn}><RiArrowLeftLine /> Πίσω</button>
        {step < STEPS.length - 1
          ? <button onClick={next} style={primaryBtn}>Συνέχεια <RiArrowRightLine /></button>
          : <button onClick={finish} disabled={isPending} style={primaryBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Ολοκλήρωση</button>}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Summary({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{title}</div>
      {rows.map(([k, v]) => <div key={k} style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8, padding: "3px 0" }}><span style={{ color: "var(--muted-foreground)" }}>{k}</span><span style={{ color: "var(--foreground)", overflowWrap: "anywhere" }}>{v || "—"}</span></div>)}
    </div>
  );
}

const grid3: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 };
const smallInput: React.CSSProperties = { height: 32, padding: "0 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12.5, color: "var(--foreground)", background: "var(--card)", width: "100%", boxSizing: "border-box" };
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530" };
