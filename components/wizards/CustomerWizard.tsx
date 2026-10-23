"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RiUserLine, RiBuilding4Line, RiLoginBoxLine, RiCloseCircleLine, RiSearchLine, RiLoaderLine } from "react-icons/ri";
import { GuidedFlow, ChoiceCards, SummaryList } from "@/components/ui/guided-flow";
import { ExampleCard } from "@/components/ui/guided-flow-parts";
import { FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { AddressAutocomplete, type ResolvedAddress } from "@/components/maps/AddressAutocomplete";
import { createCustomer, assignAccountManager, type CustomerInput } from "@/app/actions/customers";
import { exampleForCustomer } from "@/lib/wizards/examples/customer";
import { getWizard, nextWizard, wizardHref } from "@/lib/wizards/registry";
import { videoForWizard } from "@/lib/wizards/videos";
import { hubHrefForRole } from "@/lib/help/hub";
import { isValidGreekAfm, normalizeAfm } from "@/lib/suppliers-shared";

export type CreatedCustomer = { id: string; name: string; type: string; code: string | null; afm: string | null; email: string | null; phone: string | null; city: string | null; accountManagerId: string | null; accountManagerName: string | null };

const TYPES = [
  { value: "INDIVIDUAL" as const, label: "Ιδιώτης", description: "Ένα πρόσωπο — ιδιοκτήτης ή εκπρόσωπος της πολυκατοικίας.", icon: RiUserLine },
  { value: "COMPANY" as const, label: "Εταιρεία", description: "Με ΑΦΜ/ΔΟΥ — τα στοιχεία έρχονται από την ΑΑΔΕ.", icon: RiBuilding4Line },
];
const LOGIN = [
  { value: "yes" as const, label: "Να έχει λογαριασμό", description: "Θα συνδέεται και θα βλέπει ακίνητα, τιμολόγια και κοινόχρηστα.", icon: RiLoginBoxLine },
  { value: "no" as const, label: "Όχι τώρα", description: "Μπορείτε να τον προσκαλέσετε αργότερα από την καρτέλα του.", icon: RiCloseCircleLine },
];

function initForm() {
  return {
    type: "INDIVIDUAL" as "INDIVIDUAL" | "COMPANY", name: "", email: "", phone: "", phone2: "",
    afm: "", doy: "", address: "", city: "", district: "", postalCode: "", country: "Ελλάδα",
    login: null as "yes" | "no" | null, loginEmail: "", loginPassword: "", managerId: "", remarks: "",
  };
}
type Form = ReturnType<typeof initForm>;

/** Step-by-step customer creation (spec §4.1). Saves with the same `createCustomer` as the plain form. */
export function CustomerWizard({ managers, nextCode, onClose, onDone, onSimpleForm }: {
  managers: { id: string; name: string }[];
  nextCode: string;
  onClose: () => void;
  onDone: (c: CreatedCustomer) => void;
  onSimpleForm?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(initForm());
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [aade, setAade] = useState<{ loading: boolean; info: string | null; error: string | null }>({ loading: false, info: null, error: null });
  const f = (k: keyof Form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initForm()), [form]);
  const def = getWizard("customer-new");
  const next = nextWizard("customer-new");

  function onAddress(r: ResolvedAddress) {
    setForm((p) => ({ ...p, address: r.address || p.address, city: r.city || p.city, district: r.district || p.district, postalCode: r.postalCode || p.postalCode, country: r.country || p.country }));
    if (r.lat !== null && r.lng !== null) setGeo({ lat: r.lat, lng: r.lng });
  }

  async function aadeLookup() {
    const afm = normalizeAfm(form.afm);
    if (!afm || afm.length !== 9) { setAade({ loading: false, info: null, error: "Συμπληρώστε έγκυρο ΑΦΜ (9 ψηφία)" }); return; }
    setAade({ loading: true, info: null, error: null });
    try {
      const res = await fetch("/api/aade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ afm }) });
      const data: { data?: Record<string, string>; error?: string } = await res.json();
      if (!res.ok || !data.data) { setAade({ loading: false, info: null, error: data.error ?? "Δεν βρέθηκαν στοιχεία ΑΑΔΕ" }); return; }
      const d = data.data;
      setForm((p) => ({ ...p, name: d.name || p.name, doy: d.taxOffice || p.doy, address: d.address || p.address, city: d.city || p.city, postalCode: d.postalCode || p.postalCode, country: d.country || p.country }));
      setAade({ loading: false, info: "Συμπληρώθηκαν τα στοιχεία από την ΑΑΔΕ", error: null });
    } catch { setAade({ loading: false, info: null, error: "Σφάλμα αναζήτησης ΑΑΔΕ" }); }
  }

  const afmWarn = form.afm.trim() && normalizeAfm(form.afm)?.length === 9 && !isValidGreekAfm(form.afm);
  const loginEmail = (form.loginEmail || form.email).trim();
  const example = exampleForCustomer({ type: form.type, name: form.name || "ο νέος πελάτης", hasLogin: form.login === "yes", loginEmail: form.login === "yes" ? loginEmail : null, nextCode });
  const managerName = managers.find((m) => m.id === form.managerId)?.name ?? "";

  return (
    <GuidedFlow<Form>
      title={def.title} onClose={onClose} onSimpleForm={onSimpleForm} finishLabel="Δημιουργία πελάτη" width={760} dirty={dirty}
      draft={{ key: "customer-new", value: form, omit: ["loginPassword"], restore: (v) => setForm({ ...initForm(), ...v }) }}
      steps={[
        {
          key: "who", title: "Ποιος είναι ο πελάτης;",
          help: "Ο πελάτης είναι αυτός που πληρώνει την εταιρεία διαχείρισης και στον οποίο ανήκουν οι ιδιοκτησίες. Δεν είναι ο ένοικος — οι ένοικοι μπαίνουν αργότερα, στις μονάδες.",
          render: () => (
            <>
              <ChoiceCards options={TYPES} value={form.type} onChange={(v) => setForm((p) => ({ ...p, type: v }))} />
              <FormField label={form.type === "COMPANY" ? "Επωνυμία" : "Ονοματεπώνυμο"} required>
                <FieldInput value={form.name} onChange={f("name")} placeholder={form.type === "COMPANY" ? "π.χ. Ακίνητα Κέντρου ΑΕ" : "π.χ. Μαρία Παπαδοπούλου"} />
              </FormField>
              <FormField label="Κωδικός πελάτη" hint="Δίνεται αυτόματα, σειριακά. Ταιριάζει με τον κωδικό συναλλασσόμενου της SoftOne."><FieldInput value={nextCode} onChange={() => {}} disabled /></FormField>
            </>
          ),
          validate: () => (form.name.trim() ? null : "Γράψτε το όνομα ή την επωνυμία"),
        },
        {
          key: "contact", title: "Πώς επικοινωνούμε;",
          help: "Το email χρησιμεύει και ως email σύνδεσης αν δώσετε πρόσβαση στο επόμενο βήμα. Τα τηλέφωνα εμφανίζονται στην καρτέλα του πελάτη.",
          render: () => (
            <>
              <FormField label="Email"><FieldInput type="email" value={form.email} onChange={f("email")} placeholder="onoma@example.gr" /></FormField>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Τηλέφωνο"><FieldInput type="tel" value={form.phone} onChange={f("phone")} placeholder="210 0000000" /></FormField>
                <FormField label="Κινητό / 2ο τηλέφωνο"><FieldInput type="tel" value={form.phone2} onChange={f("phone2")} /></FormField>
              </div>
            </>
          ),
          validate: () => (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? "Το email δεν φαίνεται σωστό (π.χ. onoma@example.gr)" : null),
        },
        {
          key: "tax", title: "Φορολογικά στοιχεία & έδρα",
          help: form.type === "COMPANY" ? "Γράψτε το ΑΦΜ και πατήστε τον μεγεθυντικό φακό: επωνυμία, ΔΟΥ και διεύθυνση έρχονται από την ΑΑΔΕ." : "Προαιρετικά — χρειάζονται μόνο για τα τιμολόγια προς τον πελάτη.",
          render: () => (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="ΑΦΜ" hint={afmWarn ? "Το ΑΦΜ δεν περνά τον έλεγχο εγκυρότητας — ελέγξτε τα ψηφία." : undefined}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <FieldInput value={form.afm} onChange={f("afm")} placeholder="123456789" />
                    {form.type === "COMPANY" && (
                      <button type="button" onClick={aadeLookup} disabled={aade.loading} title="Άντληση στοιχείων από ΑΑΔΕ" aria-label="Άντληση στοιχείων από ΑΑΔΕ"
                        style={{ flexShrink: 0, width: 44, height: 36, borderRadius: 6, border: "1px solid var(--color-primary)", background: "var(--color-primary)", color: "var(--primary-foreground)", cursor: aade.loading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {aade.loading ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiSearchLine />}
                      </button>
                    )}
                  </div>
                </FormField>
                <FormField label="ΔΟΥ"><FieldInput value={form.doy} onChange={f("doy")} /></FormField>
              </div>
              {aade.info && <div style={{ fontSize: "var(--fs-12)", color: "var(--color-success)" }}>{aade.info}</div>}
              {aade.error && <div style={{ fontSize: "var(--fs-12)", color: "var(--color-danger)" }} role="alert">{aade.error}</div>}
              <AddressAutocomplete label="Διεύθυνση" value={form.address} onChange={f("address")} onResolved={onAddress} placeholder="Οδός και αριθμός" />
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                <FormField label="Πόλη"><FieldInput value={form.city} onChange={f("city")} /></FormField>
                <FormField label="Τ.Κ."><FieldInput value={form.postalCode} onChange={f("postalCode")} /></FormField>
                <FormField label="Χώρα"><FieldInput value={form.country} onChange={f("country")} /></FormField>
              </div>
            </>
          ),
          validate: () => (form.afm.trim() && (normalizeAfm(form.afm)?.length ?? 0) !== 9 ? "Το ΑΦΜ έχει 9 ψηφία" : null),
        },
        {
          key: "login", title: "Θα συνδέεται στην εφαρμογή;",
          help: "Με λογαριασμό, ο πελάτης βλέπει τα ακίνητά του, τα τιμολόγια της εταιρείας και τα κοινόχρηστα κάθε κτηρίου (ρόλος διαχειριστή ιδιοκτησίας).",
          render: () => (
            <>
              <ChoiceCards options={LOGIN} value={form.login} onChange={(v) => setForm((p) => ({ ...p, login: v }))} />
              {form.login === "yes" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField label="Email σύνδεσης" required hint={!form.loginEmail && form.email ? "Θα χρησιμοποιηθεί το email επικοινωνίας." : undefined}>
                    <FieldInput type="email" value={form.loginEmail} onChange={f("loginEmail")} placeholder={form.email || "login@example.gr"} />
                  </FormField>
                  <FormField label="Αρχικός κωδικός" required hint="Τουλάχιστον 6 χαρακτήρες — ο πελάτης τον αλλάζει μετά."><FieldInput type="password" value={form.loginPassword} onChange={f("loginPassword")} /></FormField>
                </div>
              )}
            </>
          ),
          validate: () => {
            if (!form.login) return "Επιλέξτε αν θα έχει λογαριασμό";
            if (form.login === "yes") {
              if (!loginEmail) return "Συμπληρώστε email σύνδεσης";
              if (form.loginPassword.length < 6) return "Ο κωδικός χρειάζεται τουλάχιστον 6 χαρακτήρες";
            }
            return null;
          },
        },
        {
          key: "manager", title: "Ποιος από την εταιρεία τον αναλαμβάνει;",
          help: "Ο υπεύθυνος manager λαμβάνει τις ειδοποιήσεις για βλάβες και αιτήματα στα ακίνητα του πελάτη. Μπορεί να οριστεί και αργότερα.",
          render: () => (
            <>
              <FormField label="Υπεύθυνος manager (προαιρετικά)">
                <FieldSelect value={form.managerId} onChange={f("managerId")} placeholder="— Χωρίς ανάθεση —" options={managers.map((m) => ({ value: m.id, label: m.name }))} />
              </FormField>
              {managers.length === 0 && <p style={{ margin: 0, fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>Δεν υπάρχουν ενεργοί χρήστες με ρόλο MANAGER — μπορείτε να προσθέσετε από «Χρήστες».</p>}
              <FormField label="Σημειώσεις (προαιρετικά)"><FieldTextarea value={form.remarks} onChange={f("remarks")} rows={2} placeholder="π.χ. Προτιμά επικοινωνία το πρωί" /></FormField>
            </>
          ),
        },
        {
          key: "check", title: "Έλεγχος",
          help: "Αν κάτι δεν είναι σωστό, πατήστε το βήμα στη ράγα ή «Πίσω».",
          render: () => (
            <SummaryList rows={[
              ["Τύπος", form.type === "COMPANY" ? "Εταιρεία" : "Ιδιώτης"], ["Όνομα", form.name], ["Κωδικός", nextCode],
              ["Email", form.email], ["Τηλέφωνα", [form.phone, form.phone2].filter(Boolean).join(" · ")],
              ["ΑΦΜ / ΔΟΥ", [form.afm, form.doy].filter(Boolean).join(" / ")],
              ["Διεύθυνση", [form.address, form.postalCode, form.city, form.country].filter(Boolean).join(", ")],
              ["Λογαριασμός", form.login === "yes" ? `Ναι — ${loginEmail}` : "Όχι"], ["Manager", managerName], ["Σημειώσεις", form.remarks],
            ]} />
          ),
        },
      ]}
      example={{
        video: videoForWizard("customer-new"),
        guideHref: `${hubHrefForRole("SUPER_ADMIN")}?a=${def.guideSlug}`,
        render: () => (
          <>
            <ExampleCard title={example.headline} tone="success">
              <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                {example.steps.map((s) => <li key={s.title}><b>{s.title}</b> — {s.body}</li>)}
              </ol>
            </ExampleCard>
            {example.loginLine && <ExampleCard title="Πρόσβαση" tone="info">{example.loginLine}</ExampleCard>}
            {!example.loginLine && <ExampleCard title="Χωρίς λογαριασμό" tone="warn">Ο πελάτης δεν θα συνδέεται· όλα τα στοιχεία τα βλέπει μόνο η εταιρεία. Πρόσκληση μπορεί να σταλεί αργότερα από την καρτέλα του.</ExampleCard>}
          </>
        ),
      }}
      onFinish={async () => {
        const payload: CustomerInput = {
          type: form.type, name: form.name.trim(), email: form.email || null, phone: form.phone || null, phone2: form.phone2 || null,
          afm: form.afm || null, doy: form.doy || null, address: form.address || null, city: form.city || null, district: form.district || null,
          postalCode: form.postalCode || null, country: form.country || null, remarks: form.remarks || null,
          lat: geo?.lat ?? null, lng: geo?.lng ?? null,
          loginEmail: form.login === "yes" ? loginEmail : null, loginPassword: form.login === "yes" ? form.loginPassword : null,
        };
        const res = await createCustomer(payload);
        if ("error" in res && res.error) return { error: res.error };
        const c = (res as { customer: { id: string; name: string; type: string; code: string | null; afm: string | null; email: string | null; phone: string | null; city: string | null } }).customer;
        let managerOk = false;
        if (form.managerId) {
          const r = await assignAccountManager(c.id, form.managerId);
          managerOk = !("error" in r && r.error);
        }
        onDone({ ...c, accountManagerId: managerOk ? form.managerId : null, accountManagerName: managerOk ? managerName : null });
        return {
          done: {
            title: `Ο πελάτης «${c.name}» δημιουργήθηκε`,
            lines: [`Κωδικός ${c.code ?? nextCode}`, ...(form.login === "yes" ? [`Λογαριασμός σύνδεσης: ${loginEmail}`] : []), ...(managerOk ? [`Υπεύθυνος: ${managerName}`] : [])],
            next: next ? [{ label: `${next.short} για «${c.name}»`, hint: "Το ακίνητο του πελάτη — εκεί ορίζεται και το πακέτο υπηρεσιών", icon: next.icon, onClick: () => { onClose(); router.push(wizardHref("/super-admin/customers", next.key, { customerId: c.id })); } }] : [],
          },
        };
      }}
    />
  );
}
