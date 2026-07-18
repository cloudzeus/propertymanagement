"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Modal, FormField, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { createManagedItem, updateManagedItem, deleteManagedItem, uploadManagedItemPhoto, deleteManagedItemPhoto } from "@/app/actions/managed-items";
import {
  RiAddLine, RiPencilLine, RiDeleteBinLine, RiCheckLine, RiLoaderLine,
  RiShieldCheckLine, RiMapPinLine, RiSubtractLine, RiStackLine, RiLightbulbLine,
  RiImageAddLine, RiCloseLine, RiExternalLinkLine,
} from "react-icons/ri";
import type { BuildingCaps } from "@/lib/building-caps";

export type ManagedItemRow = {
  id: string; itemTypeId: string; itemTypeName: string;
  location: string; floorLabel: string | null;
  quantity: number; photoUrl: string | null; notes: string | null;
};
export type ManagedItemTypeOption = { id: string; name: string; active: boolean };

// Common location suggestions (datalist — free text still allowed)
const LOCATION_SUGGESTIONS = ["Κοινόχρηστοι χώροι", "Κλιμακοστάσιο", "Είσοδος", "Ταράτσα", "Υπόγειο", "Πυλωτή", "Λεβητοστάσιο", "Αύλειος χώρος"];

export function ManagedItemsPanel({ buildingId, items, itemTypes, floorOptions, can }: { buildingId: string; items: ManagedItemRow[]; itemTypes: ManagedItemTypeOption[]; floorOptions: string[]; can: BuildingCaps }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ManagedItemRow | null | "new">(null);
  const [isPending, startTransition] = useTransition();

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const locations = new Set(items.map((i) => i.location)).size;
  const activeTypes = itemTypes.filter((t) => t.active);

  function remove(item: ManagedItemRow) {
    if (!confirm(`Διαγραφή «${item.itemTypeName} — ${item.location}»;`)) return;
    startTransition(async () => { await deleteManagedItem(item.id); router.refresh(); });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, color: "var(--muted-foreground)", flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RiShieldCheckLine style={{ color: "#15803d" }} /> {items.length} στοιχεία</span>
          {items.length > 0 && (
            <>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RiStackLine /> Σύνολο ποσότητας: <b style={{ color: "var(--foreground)" }}>{totalQty}</b></span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RiMapPinLine /> {locations} {locations === 1 ? "τοποθεσία" : "τοποθεσίες"}</span>
            </>
          )}
        </div>
        {can.manageManagedItems && <button onClick={() => setEditing("new")} disabled={activeTypes.length === 0} style={{ ...btn, ...btnPrimary, opacity: activeTypes.length === 0 ? 0.5 : 1 }}><RiAddLine /> Προσθήκη στοιχείου</button>}
      </div>

      {activeTypes.length === 0 && (
        <div style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #CA5D0040", background: "#CA5D0010", color: "#CA5D00", fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          Ο κατάλογος στοιχείων είναι κενός. Δημιούργησε πρώτα τη λίστα στα{" "}
          <Link href="/super-admin/managed-items" style={{ color: "#CA5D00", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>Στοιχεία Διαχείρισης <RiExternalLinkLine /></Link>
        </div>
      )}

      {items.length === 0 ? (
        <div onClick={() => can.manageManagedItems && activeTypes.length > 0 && setEditing("new")} style={{ border: "1.5px dashed var(--border-strong)", borderRadius: 8, padding: 36, textAlign: "center", color: "var(--muted-foreground)", cursor: can.manageManagedItems && activeTypes.length > 0 ? "pointer" : "default", background: "var(--bg-canvas)" }}>
          <RiLightbulbLine style={{ fontSize: 26, display: "block", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 3 }}>Δεν υπάρχουν διαχειριζόμενα στοιχεία</div>
          Επίλεξε από τον κατάλογο τι διαχειρίζεται η εταιρεία εδώ — π.χ. «Αλλαγή λαμπτήρων» στους κοινόχρηστους χώρους με αριθμό φωτιστικών.
        </div>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11 }}>
              <th style={th}>Φώτο</th><th style={th}>Στοιχείο</th><th style={th}>Τοποθεσία</th><th style={th}>Όροφος</th><th style={{ ...th, textAlign: "right" }}>Ποσότητα</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, width: 56 }}>
                    {i.photoUrl ? (
                      <a href={i.photoUrl} target="_blank" rel="noreferrer" title="Άνοιγμα φωτογραφίας">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={i.photoUrl} alt={i.itemTypeName} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)", display: "block" }} />
                      </a>
                    ) : (
                      <div aria-hidden style={{ width: 40, height: 40, borderRadius: 6, border: "1px dashed var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--border-strong)" }}><RiImageAddLine /></div>
                    )}
                  </td>
                  <td style={td}><b>{i.itemTypeName}</b>{i.notes && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{i.notes}</div>}</td>
                  <td style={td}><span style={chip}><RiMapPinLine style={{ fontSize: 12 }} /> {i.location}</span></td>
                  <td style={td}>{i.floorLabel ?? "—"}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{i.quantity}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    {can.manageManagedItems && (
                      <>
                        <button onClick={() => setEditing(i)} style={iconBtn} title="Επεξεργασία"><RiPencilLine /></button>
                        <button onClick={() => remove(i)} disabled={isPending} style={{ ...iconBtn, color: "#c50f1f" }} title="Διαγραφή"><RiDeleteBinLine /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <ManagedItemModal
          buildingId={buildingId}
          itemTypes={itemTypes}
          floorOptions={floorOptions}
          editing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function ManagedItemModal({ buildingId, itemTypes, floorOptions, editing, onClose, onDone }: { buildingId: string; itemTypes: ManagedItemTypeOption[]; floorOptions: string[]; editing: ManagedItemRow | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    itemTypeId: editing?.itemTypeId ?? "",
    location: editing?.location ?? "",
    floorLabel: editing?.floorLabel ?? "",
    quantity: editing?.quantity ?? 1,
    notes: editing?.notes ?? "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const setQty = (q: number) => setForm((p) => ({ ...p, quantity: Math.min(100000, Math.max(1, Math.round(q) || 1)) }));

  // Options: active types + (when editing) the currently selected type even if inactive
  const options = itemTypes
    .filter((t) => t.active || t.id === editing?.itemTypeId)
    .map((t) => ({ value: t.id, label: t.active ? t.name : `${t.name} (ανενεργό)` }));

  const currentPhoto = !photoRemoved && !photoFile ? editing?.photoUrl ?? null : null;

  function save() {
    setError(null);
    const payload = { itemTypeId: form.itemTypeId, location: form.location, floorLabel: form.floorLabel || null, quantity: form.quantity, notes: form.notes };
    startTransition(async () => {
      const res = editing ? await updateManagedItem(editing.id, payload) : await createManagedItem(buildingId, payload);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      const itemId = (res as { itemId?: string }).itemId;
      if (itemId && photoRemoved && editing?.photoUrl && !photoFile) {
        await deleteManagedItemPhoto(itemId);
      }
      if (itemId && photoFile) {
        const fd = new FormData();
        fd.set("itemId", itemId);
        fd.set("file", photoFile);
        const up = await uploadManagedItemPhoto(fd);
        if (up && "error" in up && up.error) { setError(`Το στοιχείο αποθηκεύτηκε, αλλά η φωτογραφία απέτυχε: ${up.error}`); return; }
      }
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Επεξεργασία στοιχείου" : "Προσθήκη διαχειριζόμενου στοιχείου"} width={520}
      footer={<>
        <button onClick={onClose} style={cancelBtn}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={saveBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button>
      </>}>
      {error && <div style={errBox} role="alert">{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormField label="Στοιχείο" required hint="Από τον κατάλογο «Στοιχεία Διαχείρισης»">
          <FieldSelect value={form.itemTypeId} onChange={(v) => setForm((p) => ({ ...p, itemTypeId: v }))} placeholder="— Επίλεξε στοιχείο —" options={options} />
        </FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Τοποθεσία" required>
            <>
              <input list="managed-item-locations" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} placeholder="π.χ. Κοινόχρηστοι χώροι" style={inputStyle} />
              <datalist id="managed-item-locations">{LOCATION_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
            </>
          </FormField>
          <FormField label="Όροφος">
            <FieldSelect value={form.floorLabel} onChange={(v) => setForm((p) => ({ ...p, floorLabel: v }))} placeholder="— Προαιρετικό —" options={floorOptions.map((o) => ({ value: o, label: o }))} />
          </FormField>
        </div>
        <FormField label="Ποσότητα" required hint="π.χ. αριθμός φωτιστικών">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button type="button" onClick={() => setQty(form.quantity - 1)} disabled={form.quantity <= 1} aria-label="Μείωση" style={stepBtn}><RiSubtractLine /></button>
            <input
              type="number" inputMode="numeric" min={1} value={form.quantity}
              onChange={(e) => setQty(Number(e.target.value))}
              style={{ ...inputStyle, width: 90, textAlign: "center", fontVariantNumeric: "tabular-nums" }}
            />
            <button type="button" onClick={() => setQty(form.quantity + 1)} aria-label="Αύξηση" style={stepBtn}><RiAddLine /></button>
          </div>
        </FormField>
        <FormField label="Φωτογραφία" hint="Προαιρετική — π.χ. τα φωτιστικά ή ο χώρος">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {(currentPhoto || photoFile) && (
              <div style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoFile ? URL.createObjectURL(photoFile) : currentPhoto!}
                  alt="Προεπισκόπηση"
                  style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)", display: "block" }}
                />
                <button type="button" aria-label="Αφαίρεση φωτογραφίας" onClick={() => { setPhotoFile(null); setPhotoRemoved(true); }}
                  style={{ position: "absolute", top: -7, right: -7, width: 20, height: 20, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--card)", color: "#c50f1f", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                  <RiCloseLine style={{ fontSize: 13 }} />
                </button>
              </div>
            )}
            <label style={{ ...btn, cursor: "pointer" }}>
              <RiImageAddLine /> {currentPhoto || photoFile ? "Αντικατάσταση" : "Επιλογή εικόνας"}
              <input type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0] ?? null; if (f) { setPhotoFile(f); setPhotoRemoved(false); } e.target.value = ""; }} />
            </label>
          </div>
        </FormField>
        <FormField label="Σημειώσεις"><FieldTextarea value={form.notes} onChange={(v) => setForm((p) => ({ ...p, notes: v }))} rows={2} placeholder="π.χ. λαμπτήρες LED E27" /></FormField>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", height: 36, padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--foreground)", background: "var(--card)", outline: "none", boxSizing: "border-box" };
const stepBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: 15 };
const th: React.CSSProperties = { padding: "10px 14px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "11px 14px", borderTop: "1px solid var(--border)", color: "var(--foreground)" };
const chip: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--color-blue-soft)", color: "var(--color-blue)" };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: 6, marginLeft: 6, cursor: "pointer" };
const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 12 };
