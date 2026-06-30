"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput, FieldSelect } from "@/components/ui/modal";
import { createCustomer, updateCustomer, deleteCustomer } from "@/app/actions/customers";
import { AddPropertyModal } from "@/app/(company)/super-admin/properties/AddPropertyModal";
import { CustomerTree, type TProperty } from "./CustomerTree";
import { RiCheckLine, RiLoaderLine, RiPencilLine, RiDeleteBinLine, RiSearchLine, RiMapPin2Line, RiEyeLine, RiAddLine, RiRobot2Line } from "react-icons/ri";

type Customer = {
  id: string;
  type: string;
  name: string;
  code: string | null;
  afm: string | null;
  doy: string | null;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  fax: string | null;
  webpage: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  postalCode: string | null;
  country: string | null;
  remarks: string | null;
  lat: number | null;
  lng: number | null;
  propertyCount: number;
  properties: TProperty[];
};

const TYPE_LABEL: Record<string, string> = { INDIVIDUAL: "Ιδιώτης", COMPANY: "Εταιρεία" };

function initForm() {
  return {
    type: "INDIVIDUAL", name: "", afm: "", doy: "", email: "", phone: "", phone2: "", fax: "", webpage: "",
    address: "", city: "", district: "", postalCode: "", country: "", remarks: "",
    loginEmail: "", loginPassword: "",
  };
}

export function CustomersClient({ initial }: { initial: Customer[] }) {
  const router = useRouter();
  const [data, setData] = useState<Customer[]>(initial);
  // Keep in sync with fresh server data after router.refresh() (tree mutations).
  useEffect(() => { setData(initial); }, [initial]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(initForm());
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [aadeLoading, setAadeLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [addPropFor, setAddPropFor] = useState<Customer | null>(null);
  const [isPending, startTransition] = useTransition();

  const f = (k: keyof ReturnType<typeof initForm>) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function openAdd() { setEditing(null); setForm(initForm()); setLat(null); setLng(null); setError(null); setInfo(null); setOpen(true); }
  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      type: c.type, name: c.name, afm: c.afm ?? "", doy: c.doy ?? "", email: c.email ?? "",
      phone: c.phone ?? "", phone2: c.phone2 ?? "", fax: c.fax ?? "", webpage: c.webpage ?? "",
      address: c.address ?? "", city: c.city ?? "", district: c.district ?? "", postalCode: c.postalCode ?? "", country: c.country ?? "", remarks: c.remarks ?? "",
      loginEmail: "", loginPassword: "",
    });
    setLat(c.lat); setLng(c.lng);
    setError(null); setInfo(null); setOpen(true);
  }

  // Άντληση στοιχείων εταιρείας από ΑΑΔΕ (μόνο για εταιρείες)
  async function handleAadeLookup() {
    const afm = form.afm.replace(/\D/g, "");
    if (afm.length !== 9) { setError("Συμπληρώστε έγκυρο ΑΦΜ (9 ψηφία)"); return; }
    setAadeLoading(true); setError(null); setInfo(null);
    try {
      const res = await fetch("/api/aade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ afm }) });
      const data: { data?: Record<string, string>; error?: string } = await res.json();
      if (!res.ok || !data.data) { setError(data.error ?? "Δεν βρέθηκαν στοιχεία ΑΑΔΕ"); return; }
      const d = data.data;
      setForm((p) => ({
        ...p,
        name: d.name || p.name,
        doy: d.taxOffice || p.doy,
        address: d.address || p.address,
        city: d.city || p.city,
        postalCode: d.postalCode || p.postalCode,
        country: d.country || p.country,
      }));
      setInfo("Συμπληρώθηκαν τα στοιχεία από την ΑΑΔΕ");
    } catch { setError("Σφάλμα αναζήτησης ΑΑΔΕ"); }
    finally { setAadeLoading(false); }
  }

  // Geocoding διεύθυνσης → lat/lng
  async function handleGeocode() {
    const query = [form.address, form.city, form.postalCode, form.country || "Ελλάδα"].map((s) => s.trim()).filter(Boolean).join(", ");
    if (!form.address.trim()) { setError("Συμπληρώστε πρώτα τη διεύθυνση"); return; }
    setGeoLoading(true); setError(null); setInfo(null);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(query)}`);
      const data: { results?: { lat: number; lng: number; displayName: string; city?: string; postalCode?: string; country?: string }[] } = await res.json();
      const r = data.results?.[0];
      if (!r) { setError("Δεν βρέθηκε στίγμα για τη διεύθυνση"); return; }
      setLat(r.lat); setLng(r.lng);
      setForm((p) => ({
        ...p,
        city: r.city || p.city,
        postalCode: r.postalCode || p.postalCode,
        country: r.country || p.country,
      }));
      setInfo(`Στίγμα: ${r.displayName}`);
    } catch { setError("Σφάλμα geocoding"); }
    finally { setGeoLoading(false); }
  }

  function handleSave() {
    if (!form.name.trim()) { setError("Το όνομα/επωνυμία είναι υποχρεωτικό"); return; }
    startTransition(async () => {
      const payload = {
        type: form.type as "INDIVIDUAL" | "COMPANY", name: form.name,
        afm: form.afm || null, doy: form.doy || null, email: form.email || null,
        phone: form.phone || null, phone2: form.phone2 || null, fax: form.fax || null, webpage: form.webpage || null,
        address: form.address || null, city: form.city || null, district: form.district || null,
        postalCode: form.postalCode || null, country: form.country || null, remarks: form.remarks || null,
        lat, lng,
        ...(editing ? {} : { loginEmail: form.loginEmail || null, loginPassword: form.loginPassword || null }),
      };
      const res = editing ? await updateCustomer(editing.id, payload) : await createCustomer(payload);
      if ("error" in res && res.error) { setError(res.error); return; }
      const saved = (res as { customer: Omit<Customer, "properties"> }).customer;
      setData((prev) => editing
        ? prev.map((x) => x.id === saved.id ? { ...x, ...saved, properties: x.properties } : x)
        : [{ ...saved, properties: [] }, ...prev]);
      setOpen(false);
    });
  }

  function handleDelete(c: Customer) {
    if (!confirm(`Διαγραφή πελάτη «${c.name}»;`)) return;
    startTransition(async () => {
      const res = await deleteCustomer(c.id);
      if ("error" in res && res.error) { alert(res.error); return; }
      setData((prev) => prev.filter((x) => x.id !== c.id));
    });
  }

  const columns: ColDef<Customer>[] = [
    {
      id: "name", header: "Πελάτης", sortKey: "name", width: 240,
      accessor: (c) => `${c.name} ${c.afm ?? ""} ${c.email ?? ""}`,
      cell: (c) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{c.name}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{c.afm ? `ΑΦΜ ${c.afm}` : c.email ?? "—"}</div>
        </div>
      ),
    },
    {
      id: "type", header: "Τύπος", sortKey: "type", width: 110,
      accessor: (c) => TYPE_LABEL[c.type] ?? c.type,
      cell: (c) => (
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
          background: c.type === "COMPANY" ? "#8764B818" : "#0078D418", color: c.type === "COMPANY" ? "#8764B8" : "#0078D4",
        }}>{TYPE_LABEL[c.type] ?? c.type}</span>
      ),
    },
    {
      id: "contact", header: "Επικοινωνία", width: 200, defaultVisible: false,
      accessor: (c) => `${c.email ?? ""} ${c.phone ?? ""}`,
      cell: (c) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{c.phone ?? c.email ?? "—"}</span>,
    },
    {
      id: "city", header: "Πόλη", sortKey: "city", width: 130,
      accessor: (c) => c.city ?? "",
      cell: (c) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{c.city ?? "—"}</span>,
    },
    {
      id: "code", header: "Κωδικός", sortKey: "code", width: 100, defaultVisible: false,
      accessor: (c) => c.code ?? "",
      cell: (c) => <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{c.code ?? "—"}</span>,
    },
    {
      id: "properties", header: "Ιδιοκτησίες", sortKey: "propertyCount", width: 110,
      accessor: (c) => c.propertyCount,
      cell: (c) => <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{c.propertyCount}</span>,
    },
  ];

  const getRowActions = (_c: Customer): RowAction<Customer>[] => [
    { label: "Προβολή", icon: <RiEyeLine />, onClick: (c) => router.push(`/super-admin/customers/${c.id}`) },
    { label: "Προσθήκη Ιδιοκτησίας", icon: <RiAddLine />, onClick: (c) => setAddPropFor(c) },
    { label: "Νέα πολυκατοικία με AI", icon: <RiRobot2Line />, onClick: (c) => router.push(`/super-admin/customers/${c.id}/onboarding`) },
    { label: "Επεξεργασία", icon: <RiPencilLine />, onClick: openEdit },
    { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: handleDelete },
  ];

  function expandedContent(c: Customer) {
    return (
      <div style={{ padding: "10px 12px", background: "var(--bg-canvas)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, paddingInline: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Ιδιοκτησίες ({c.properties.length})
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setAddPropFor(c)} style={{ fontSize: 12, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              <RiAddLine /> Ιδιοκτησία
            </button>
            <Link href={`/super-admin/customers/${c.id}`} style={{ fontSize: 12, color: "var(--color-primary)", textDecoration: "none", fontWeight: 600 }}>
              Αναλυτικά →
            </Link>
          </div>
        </div>
        <CustomerTree properties={c.properties} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Πελάτες</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>{data.length} πελάτες</p>
      </div>

      <DataTable
        data={data}
        columns={columns}
        totalRows={data.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="super-admin-customers"
        searchPlaceholder="Αναζήτηση πελάτη…"
        getRowActions={getRowActions}
        expandedContent={expandedContent}
        onAddNew={openAdd}
        addNewLabel="Νέος Πελάτης"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Επεξεργασία: ${editing.name}` : "Νέος Πελάτης"}
        width={600}
        footer={
          <>
            <button onClick={() => setOpen(false)} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" }}>Ακύρωση</button>
            <button onClick={handleSave} disabled={isPending} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: isPending ? "wait" : "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              {isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />}
              Αποθήκευση
            </button>
          </>
        }
      >
        {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 14 }}>{error}</div>}
        {info && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#dcfce718", color: "#16a34a", fontSize: 12, border: "1px solid #86efac30", marginBottom: 14 }}>{info}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 12 }}>
            <FormField label="Τύπος" required>
              <FieldSelect value={form.type} onChange={f("type")} options={[{ value: "INDIVIDUAL", label: "Ιδιώτης" }, { value: "COMPANY", label: "Εταιρεία" }]} />
            </FormField>
            <FormField label={form.type === "COMPANY" ? "Επωνυμία" : "Ονοματεπώνυμο"} required>
              <FieldInput value={form.name} onChange={f("name")} placeholder={form.type === "COMPANY" ? "Εταιρεία ΕΠΕ" : "Γιάννης Παπαδόπουλος"} />
            </FormField>
            <FormField label="Κωδικός (S1)">
              <FieldInput value={editing?.code ?? "— αυτόματος —"} onChange={() => {}} disabled />
            </FormField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="ΑΦΜ">
              <div style={{ display: "flex", gap: 6 }}>
                <FieldInput value={form.afm} onChange={f("afm")} placeholder="123456789" />
                {form.type === "COMPANY" && (
                  <button type="button" onClick={handleAadeLookup} disabled={aadeLoading} title="Άντληση στοιχείων από ΑΑΔΕ"
                    style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 6, border: "1px solid var(--color-primary)", background: "var(--color-primary)", color: "#fff", cursor: aadeLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {aadeLoading ? <RiLoaderLine style={{ fontSize: 15, animation: "spin 1s linear infinite" }} /> : <RiSearchLine style={{ fontSize: 15 }} />}
                  </button>
                )}
              </div>
            </FormField>
            <FormField label="ΔΟΥ"><FieldInput value={form.doy} onChange={f("doy")} /></FormField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <FormField label="Email"><FieldInput type="email" value={form.email} onChange={f("email")} /></FormField>
            <FormField label="Τηλ. 1"><FieldInput value={form.phone} onChange={f("phone")} /></FormField>
            <FormField label="Τηλ. 2"><FieldInput value={form.phone2} onChange={f("phone2")} /></FormField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Fax"><FieldInput value={form.fax} onChange={f("fax")} /></FormField>
            <FormField label="Ιστοσελίδα"><FieldInput value={form.webpage} onChange={f("webpage")} placeholder="https://…" /></FormField>
          </div>
          <FormField label="Διεύθυνση">
            <div style={{ display: "flex", gap: 6 }}>
              <FieldInput value={form.address} onChange={f("address")} />
              <button type="button" onClick={handleGeocode} disabled={geoLoading || !form.address} title="Εύρεση στίγματος (geocoding)"
                style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: geoLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {geoLoading ? <RiLoaderLine style={{ fontSize: 15, animation: "spin 1s linear infinite" }} /> : <RiMapPin2Line style={{ fontSize: 15 }} />}
              </button>
            </div>
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
            <FormField label="Πόλη"><FieldInput value={form.city} onChange={f("city")} /></FormField>
            <FormField label="Περιοχή"><FieldInput value={form.district} onChange={f("district")} /></FormField>
            <FormField label="Τ.Κ."><FieldInput value={form.postalCode} onChange={f("postalCode")} /></FormField>
            <FormField label="Χώρα"><FieldInput value={form.country} onChange={f("country")} /></FormField>
          </div>
          {lat !== null && lng !== null && (
            <div style={{ fontSize: 11, color: "#16a34a", display: "flex", alignItems: "center", gap: 5 }}>
              <RiMapPin2Line style={{ fontSize: 13 }} /> Στίγμα: {lat.toFixed(6)}, {lng.toFixed(6)}
            </div>
          )}

          {!editing && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                Λογαριασμός εισόδου (προαιρετικό)
              </div>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
                Δημιουργεί κωδικό εισόδου ώστε ο πελάτης να συνδέεται και να διαχειρίζεται τις ιδιοκτησίες του.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Email εισόδου"><FieldInput type="email" value={form.loginEmail} onChange={f("loginEmail")} placeholder={form.email || "login@example.com"} /></FormField>
                <FormField label="Κωδικός"><FieldInput type="password" value={form.loginPassword} onChange={f("loginPassword")} placeholder="Τουλάχιστον 6 χαρακτήρες" /></FormField>
              </div>
            </div>
          )}
        </div>

        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </Modal>

      {addPropFor && (
        <AddPropertyModal
          customerId={addPropFor.id}
          customerName={addPropFor.name}
          onClose={() => setAddPropFor(null)}
          onCreated={() => router.refresh()}
        />
      )}
    </div>
  );
}
