"use client";

import { useState, useTransition } from "react";
import { Modal, FormField, FieldInput, FieldTextarea } from "@/components/ui/modal";
import { createProperty } from "@/app/actions/properties";
import { AddressAutocomplete, type ResolvedAddress } from "@/components/maps/AddressAutocomplete";
import { RiCheckLine, RiLoaderLine, RiMapPin2Line } from "react-icons/ri";

export type CreatedProperty = {
  id: string; name: string; city: string | null; buildingCount: number; unitCount: number;
};

/** Reusable "add property for a customer" modal. */
export function AddPropertyModal({ customerId, customerName, onClose, onCreated }: {
  customerId: string;
  customerName: string;
  onClose: () => void;
  onCreated: (p: CreatedProperty) => void;
}) {
  const [form, setForm] = useState({ name: "", address: "", city: "", postalCode: "", country: "Ελλάδα", notes: "" });
  const [sameAddress, setSameAddress] = useState(true);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function onAddressResolved(r: ResolvedAddress) {
    setForm((p) => ({
      ...p,
      address: r.address || p.address,
      city: r.city || p.city,
      postalCode: r.postalCode || p.postalCode,
      country: r.country || p.country,
    }));
    if (r.lat !== null && r.lng !== null) { setLat(r.lat); setLng(r.lng); }
    setError(null);
  }

  async function geocode() {
    const q = [form.address, form.city, form.postalCode, form.country || "Ελλάδα"].map((s) => s.trim()).filter(Boolean).join(", ");
    if (!form.address.trim()) { setError("Συμπληρώστε πρώτα τη διεύθυνση"); return; }
    setGeoLoading(true); setError(null);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(q)}`);
      const data: { results?: { lat: number; lng: number; city?: string; postalCode?: string; country?: string }[] } = await res.json();
      const r = data.results?.[0];
      if (r) {
        setLat(r.lat); setLng(r.lng);
        setForm((p) => ({ ...p, city: r.city || p.city, postalCode: r.postalCode || p.postalCode, country: r.country || p.country }));
      } else setError("Δεν βρέθηκε στίγμα");
    } catch { setError("Σφάλμα geocoding"); } finally { setGeoLoading(false); }
  }

  function save() {
    if (!form.name.trim()) { setError("Το όνομα ιδιοκτησίας είναι υποχρεωτικό"); return; }
    startTransition(async () => {
      const res = await createProperty({
        customerId, name: form.name, notes: form.notes || null,
        address: form.address || null, city: form.city || null, postalCode: form.postalCode || null, country: form.country || null,
        lat, lng, sameAddressBuilding: sameAddress,
      });
      if ("error" in res && res.error) { setError(res.error); return; }
      const p = (res as any).property;
      onCreated({ id: p.id, name: p.name, city: p.city ?? null, buildingCount: 1, unitCount: 0 });
      onClose();
    });
  }

  return (
    <Modal open onClose={onClose} title={`Νέα Ιδιοκτησία — ${customerName}`} width={520}
      footer={<>
        <button onClick={onClose} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" }}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: isPending ? "wait" : "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          {isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση
        </button>
      </>}>
      {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 14 }}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FormField label="Όνομα ιδιοκτησίας" required>
          <FieldInput value={form.name} onChange={f("name")} placeholder="π.χ. Συγκρότημα Κολωνακίου" />
        </FormField>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <AddressAutocomplete
              label="Διεύθυνση"
              value={form.address}
              onChange={f("address")}
              onResolved={onAddressResolved}
              placeholder="π.χ. Σόλωνος 5"
            />
          </div>
          <button type="button" onClick={geocode} disabled={geoLoading || !form.address} title="Εύρεση στίγματος"
            style={{ flexShrink: 0, width: 36, height: 34, borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: geoLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {geoLoading ? <RiLoaderLine style={{ fontSize: 15, animation: "spin 1s linear infinite" }} /> : <RiMapPin2Line style={{ fontSize: 15 }} />}
          </button>
        </div>
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
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
          <input type="checkbox" checked={sameAddress} onChange={(e) => setSameAddress(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--color-primary)" }} />
          Το κτήριο έχει την ίδια διεύθυνση με την ιδιοκτησία
        </label>
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "-6px 0 0" }}>
          Κάθε ιδιοκτησία ξεκινά με ένα κτήριο. {sameAddress ? "Θα πάρει τη διεύθυνση της ιδιοκτησίας." : "Θα ορίσετε τη διεύθυνσή του στη διαχείριση."}
        </p>
        <FormField label="Σημειώσεις"><FieldTextarea value={form.notes} onChange={f("notes")} rows={2} /></FormField>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}
