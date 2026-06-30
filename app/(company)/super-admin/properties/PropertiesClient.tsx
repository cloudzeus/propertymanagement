"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { createProperty, updateProperty, deleteProperty } from "@/app/actions/properties";
import { BuildingsTree, type TBuilding } from "../customers/CustomerTree";
import { RiCheckLine, RiLoaderLine, RiPencilLine, RiDeleteBinLine, RiSettings3Line, RiMapPin2Line } from "react-icons/ri";

type Property = {
  id: string;
  name: string;
  notes: string | null;
  customerId: string;
  customerName: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  vivaEnabled: boolean;
  vivaMerchantId: string | null;
  vivaSourceCode: string | null;
  buildingCount: number;
  unitCount: number;
  serviceCount: number;
  buildings: TBuilding[];
};
type CustomerOption = { id: string; name: string };

function initForm() {
  return {
    customerId: "", name: "", notes: "",
    address: "", city: "", postalCode: "", country: "Ελλάδα",
    vivaEnabled: "false", vivaMerchantId: "", vivaSourceCode: "",
  };
}

export function PropertiesClient({ initial, customers }: { initial: Property[]; customers: CustomerOption[] }) {
  const router = useRouter();
  const [data, setData] = useState<Property[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [form, setForm] = useState(initForm());
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [sameAddress, setSameAddress] = useState(true);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const f = (k: keyof ReturnType<typeof initForm>) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function openAdd() {
    setEditing(null);
    setForm({ ...initForm(), customerId: customers[0]?.id ?? "" });
    setLat(null); setLng(null); setSameAddress(true); setError(null); setOpen(true);
  }
  function openEdit(p: Property) {
    setEditing(p);
    setForm({
      customerId: p.customerId, name: p.name, notes: p.notes ?? "",
      address: p.address ?? "", city: p.city ?? "", postalCode: p.postalCode ?? "", country: p.country ?? "Ελλάδα",
      vivaEnabled: String(p.vivaEnabled), vivaMerchantId: p.vivaMerchantId ?? "", vivaSourceCode: p.vivaSourceCode ?? "",
    });
    setLat(p.lat); setLng(p.lng); setError(null); setOpen(true);
  }

  async function handleGeocode() {
    const query = [form.address, form.city, form.postalCode, form.country || "Ελλάδα"].map((s) => s.trim()).filter(Boolean).join(", ");
    if (!form.address.trim()) { setError("Συμπληρώστε πρώτα τη διεύθυνση"); return; }
    setGeoLoading(true); setError(null);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(query)}`);
      const data: { results?: { lat: number; lng: number; city?: string; postalCode?: string; country?: string }[] } = await res.json();
      const r = data.results?.[0];
      if (r) {
        setLat(r.lat); setLng(r.lng);
        setForm((p) => ({ ...p, city: r.city || p.city, postalCode: r.postalCode || p.postalCode, country: r.country || p.country }));
      } else setError("Δεν βρέθηκε στίγμα");
    } catch { setError("Σφάλμα geocoding"); } finally { setGeoLoading(false); }
  }

  function handleSave() {
    if (!form.customerId) { setError("Επιλέξτε πελάτη"); return; }
    if (!form.name.trim()) { setError("Το όνομα είναι υποχρεωτικό"); return; }
    startTransition(async () => {
      const payload = {
        customerId: form.customerId, name: form.name, notes: form.notes || null,
        address: form.address || null, city: form.city || null, postalCode: form.postalCode || null, country: form.country || null,
        lat, lng,
        vivaEnabled: form.vivaEnabled === "true", vivaMerchantId: form.vivaMerchantId || null, vivaSourceCode: form.vivaSourceCode || null,
        ...(editing ? {} : { sameAddressBuilding: sameAddress }),
      };
      const res = editing ? await updateProperty(editing.id, payload) : await createProperty(payload);
      if ("error" in res && res.error) { setError(res.error); return; }
      const saved = (res as { property: Property }).property;
      setData((prev) => editing ? prev.map((x) => x.id === saved.id ? saved : x) : [saved, ...prev]);
      setOpen(false);
    });
  }

  function handleDelete(p: Property) {
    if (!confirm(`Διαγραφή ιδιοκτησίας «${p.name}»;`)) return;
    startTransition(async () => {
      const res = await deleteProperty(p.id);
      if ("error" in res && res.error) { alert(res.error); return; }
      setData((prev) => prev.filter((x) => x.id !== p.id));
    });
  }

  const columns: ColDef<Property>[] = [
    {
      id: "name", header: "Ιδιοκτησία", sortKey: "name", width: 220,
      accessor: (p) => p.name,
      cell: (p) => <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{p.name}</span>,
    },
    {
      id: "customer", header: "Πελάτης", sortKey: "customerName", width: 200,
      accessor: (p) => p.customerName,
      cell: (p) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{p.customerName}</span>,
    },
    {
      id: "buildings", header: "Κτήρια", sortKey: "buildingCount", width: 100,
      accessor: (p) => p.buildingCount,
      cell: (p) => <span style={{ fontSize: 13, color: "var(--foreground)" }}>{p.buildingCount}</span>,
    },
    {
      id: "units", header: "Μονάδες", sortKey: "unitCount", width: 100,
      accessor: (p) => p.unitCount,
      cell: (p) => <span style={{ fontSize: 13, color: "var(--foreground)" }}>{p.unitCount}</span>,
    },
    {
      id: "services", header: "Υπηρεσίες", sortKey: "serviceCount", width: 110,
      accessor: (p) => p.serviceCount,
      cell: (p) => <span style={{ fontSize: 13, color: "var(--foreground)" }}>{p.serviceCount}</span>,
    },
  ];

  const getRowActions = (_p: Property): RowAction<Property>[] => [
    { label: "Διαχείριση", icon: <RiSettings3Line />, onClick: (p) => router.push(`/super-admin/properties/${p.id}`) },
    { label: "Επεξεργασία", icon: <RiPencilLine />, onClick: openEdit },
    { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: handleDelete },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Ιδιοκτησίες</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>{data.length} ιδιοκτησίες</p>
      </div>

      <DataTable
        data={data}
        columns={columns}
        totalRows={data.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="super-admin-properties"
        searchPlaceholder="Αναζήτηση ιδιοκτησίας…"
        getRowActions={getRowActions}
        onAddNew={openAdd}
        addNewLabel="Νέα Ιδιοκτησία"
        expandedContent={(p) => (
          <BuildingsTree
            propertyId={p.id}
            buildings={p.buildings}
            depthBase={0}
            propertyAddress={{ address: p.address, city: p.city, postalCode: p.postalCode, country: p.country, lat: p.lat, lng: p.lng }}
          />
        )}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Επεξεργασία: ${editing.name}` : "Νέα Ιδιοκτησία"}
        width={520}
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

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormField label="Πελάτης" required>
            <FieldSelect value={form.customerId} onChange={f("customerId")} options={customers.map((c) => ({ value: c.id, label: c.name }))} placeholder="— Επιλογή πελάτη —" />
          </FormField>
          <FormField label="Όνομα ιδιοκτησίας" required>
            <FieldInput value={form.name} onChange={f("name")} placeholder="π.χ. Συγκρότημα Κολωνακίου" />
          </FormField>
          <FormField label="Διεύθυνση">
            <div style={{ display: "flex", gap: 6 }}>
              <FieldInput value={form.address} onChange={f("address")} />
              <button type="button" onClick={handleGeocode} disabled={geoLoading || !form.address} title="Εύρεση στίγματος (geocoding)"
                style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: geoLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {geoLoading ? <RiLoaderLine style={{ fontSize: 15, animation: "spin 1s linear infinite" }} /> : <RiMapPin2Line style={{ fontSize: 15 }} />}
              </button>
            </div>
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <FormField label="Πόλη"><FieldInput value={form.city} onChange={f("city")} /></FormField>
            <FormField label="Τ.Κ."><FieldInput value={form.postalCode} onChange={f("postalCode")} /></FormField>
            <FormField label="Χώρα"><FieldInput value={form.country} onChange={f("country")} /></FormField>
          </div>
          {lat !== null && lng !== null && (
            <div style={{ fontSize: 11, color: "#16a34a", display: "flex", alignItems: "center", gap: 5 }}>
              <RiMapPin2Line style={{ fontSize: 13 }} /> Στίγμα: {lat.toFixed(6)}, {lng.toFixed(6)}
            </div>
          )}
          {!editing && (
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
                <input type="checkbox" checked={sameAddress} onChange={(e) => setSameAddress(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--color-primary)" }} />
                Το κτήριο έχει την ίδια διεύθυνση με την ιδιοκτησία
              </label>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "4px 0 0" }}>
                Κάθε ιδιοκτησία ξεκινά με ένα κτήριο. {sameAddress ? "Θα πάρει τη διεύθυνση της ιδιοκτησίας." : "Θα ορίσετε τη διεύθυνσή του στη διαχείριση."}
              </p>
            </div>
          )}
          <FormField label="Σημειώσεις"><FieldTextarea value={form.notes} onChange={f("notes")} rows={2} /></FormField>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              Viva κοινοχρήστων (προαιρετικό)
            </div>
            <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
              Ανεξάρτητος λογαριασμός Viva ανά ιδιοκτησία — οι ένοικοι πληρώνουν κοινόχρηστα σε αυτόν.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <FormField label="Ενεργό">
                <FieldSelect value={form.vivaEnabled} onChange={f("vivaEnabled")} options={[{ value: "false", label: "Όχι" }, { value: "true", label: "Ναι" }]} />
              </FormField>
              <FormField label="Merchant ID"><FieldInput value={form.vivaMerchantId} onChange={f("vivaMerchantId")} /></FormField>
              <FormField label="Source Code"><FieldInput value={form.vivaSourceCode} onChange={f("vivaSourceCode")} /></FormField>
            </div>
          </div>
        </div>

        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </Modal>
    </div>
  );
}
