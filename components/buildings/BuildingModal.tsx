"use client";

/**
 * Create / edit a building's master data. Shared by the customer tree (super-admin
 * customers page) and the building page's «Στοιχεία κτηρίου» action.
 * `editing` carries only the form fields, so any richer building row fits.
 */
import { useState, useTransition } from "react";
import { Modal, FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { createBuilding, updateBuilding } from "@/app/actions/buildings";
import { RiCheckLine, RiLoaderLine, RiMapPin2Line } from "react-icons/ri";

export type BuildingFormValues = {
  id: string; name: string; address: string; city: string; postalCode: string; country: string;
  floors: number | null; basements: number | null; hasElevator: boolean; hasBoiler: boolean; hasFireSafety: boolean;
  technicalNotes: string | null; lat: number | null; lng: number | null;
};
export type PropertyAddress = { address: string | null; city: string | null; postalCode: string | null; country: string | null; lat: number | null; lng: number | null };

const yesNo = [{ value: "false", label: "Όχι" }, { value: "true", label: "Ναι" }];
const spin = <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>;
const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: "var(--fs-13)", color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "var(--danger-soft)", color: "var(--color-danger)", fontSize: "var(--fs-12)", border: "1px solid var(--danger-soft)", marginBottom: 14 };

export function BuildingModal({ propertyId, editing, propertyAddress, onClose, onDone }: { propertyId: string; editing: BuildingFormValues | null; propertyAddress?: PropertyAddress; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: editing?.name ?? "", address: editing?.address ?? "", city: editing?.city ?? "", postalCode: editing?.postalCode ?? "", country: editing?.country ?? "Ελλάδα", floors: editing?.floors != null ? String(editing.floors) : "", basements: editing?.basements != null ? String(editing.basements) : "", hasElevator: String(editing?.hasElevator ?? false), hasBoiler: String(editing?.hasBoiler ?? false), hasFireSafety: String(editing?.hasFireSafety ?? false), technicalNotes: editing?.technicalNotes ?? "" });
  const [lat, setLat] = useState<number | null>(editing?.lat ?? null);
  const [lng, setLng] = useState<number | null>(editing?.lng ?? null);
  const [sameAddress, setSameAddress] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function toggleSame(checked: boolean) {
    setSameAddress(checked);
    if (checked && propertyAddress) {
      setForm((p) => ({ ...p, address: propertyAddress.address ?? "", city: propertyAddress.city ?? "", postalCode: propertyAddress.postalCode ?? "", country: propertyAddress.country ?? "Ελλάδα" }));
      setLat(propertyAddress.lat); setLng(propertyAddress.lng);
    }
  }
  async function geocode() {
    const q = [form.address, form.city, form.postalCode, form.country].map((s) => s.trim()).filter(Boolean).join(", ");
    if (!form.address.trim()) { setError("Συμπληρώστε διεύθυνση"); return; }
    setGeoLoading(true); setError(null);
    try { const res = await fetch(`/api/geocode?address=${encodeURIComponent(q)}`); const d: { results?: { lat: number; lng: number; city?: string; postalCode?: string; country?: string }[] } = await res.json(); const r = d.results?.[0]; if (r) { setLat(r.lat); setLng(r.lng); setForm((p) => ({ ...p, city: r.city || p.city, postalCode: r.postalCode || p.postalCode, country: r.country || p.country })); } else setError("Δεν βρέθηκε στίγμα"); } catch { setError("Σφάλμα geocoding"); } finally { setGeoLoading(false); }
  }
  function save() {
    if (!form.name.trim()) { setError("Το όνομα είναι υποχρεωτικό"); return; }
    if (!form.address.trim()) { setError("Η διεύθυνση είναι υποχρεωτική"); return; }
    startTransition(async () => {
      const payload = { name: form.name, address: form.address, city: form.city, postalCode: form.postalCode, country: form.country, floors: form.floors ? parseInt(form.floors) : null, basements: form.basements ? parseInt(form.basements) : null, hasElevator: form.hasElevator === "true", hasBoiler: form.hasBoiler === "true", hasFireSafety: form.hasFireSafety === "true", technicalNotes: form.technicalNotes || null, lat, lng };
      const res = editing ? await updateBuilding(editing.id, payload) : await createBuilding(propertyId, payload);
      if ("error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }
  return (
    <Modal open onClose={onClose} title={editing ? `Επεξεργασία: ${editing.name}` : "Νέο Κτήριο"} width={560}
      footer={<><button onClick={onClose} style={cancelBtn}>Ακύρωση</button><button onClick={save} disabled={isPending} style={saveBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button></>}>
      {error && <div style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <FormField label="Όνομα κτηρίου" required><FieldInput value={form.name} onChange={f("name")} /></FormField>
          <FormField label="Όροφοι"><FieldInput type="number" value={form.floors} onChange={f("floors")} /></FormField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="Υπόγεια"><FieldInput type="number" value={form.basements} onChange={f("basements")} /></FormField>
          <div />
        </div>
        {!editing && propertyAddress && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-13)", color: "var(--foreground)", cursor: "pointer" }}>
            <input type="checkbox" checked={sameAddress} onChange={(e) => toggleSame(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--color-primary)" }} />
            Ίδια διεύθυνση με την ιδιοκτησία
          </label>
        )}
        <FormField label="Διεύθυνση" required>
          <div style={{ display: "flex", gap: 6 }}>
            <FieldInput value={form.address} onChange={f("address")} />
            <button type="button" onClick={geocode} disabled={geoLoading || !form.address} title="Geocoding" style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--foreground)" }}>{geoLoading ? <RiLoaderLine style={{ fontSize: "var(--fs-15)", animation: "spin 1s linear infinite" }} /> : <RiMapPin2Line style={{ fontSize: "var(--fs-15)" }} />}</button>
          </div>
        </FormField>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
          <FormField label="Πόλη"><FieldInput value={form.city} onChange={f("city")} /></FormField>
          <FormField label="Τ.Κ."><FieldInput value={form.postalCode} onChange={f("postalCode")} /></FormField>
          <FormField label="Χώρα"><FieldInput value={form.country} onChange={f("country")} /></FormField>
        </div>
        {lat != null && lng != null && <div style={{ fontSize: "var(--fs-11)", color: "var(--color-success)" }}><RiMapPin2Line style={{ fontSize: "var(--fs-12)" }} /> {lat.toFixed(6)}, {lng.toFixed(6)}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <FormField label="Ασανσέρ"><FieldSelect value={form.hasElevator} onChange={f("hasElevator")} options={yesNo} /></FormField>
          <FormField label="Καυστήρας"><FieldSelect value={form.hasBoiler} onChange={f("hasBoiler")} options={yesNo} /></FormField>
          <FormField label="Πυρασφάλεια"><FieldSelect value={form.hasFireSafety} onChange={f("hasFireSafety")} options={yesNo} /></FormField>
        </div>
        <FormField label="Τεχνικές σημειώσεις"><FieldTextarea value={form.technicalNotes} onChange={f("technicalNotes")} rows={2} /></FormField>
      </div>
      {spin}
    </Modal>
  );
}

