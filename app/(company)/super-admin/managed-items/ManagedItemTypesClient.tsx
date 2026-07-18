"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormField, FieldInput, FieldTextarea } from "@/components/ui/modal";
import { createManagedItemType, updateManagedItemType, deleteManagedItemType } from "@/app/actions/managed-item-types";
import {
  RiAddLine, RiPencilLine, RiDeleteBinLine, RiCheckLine, RiLoaderLine,
  RiListCheck2, RiBuildingLine, RiEyeOffLine,
} from "react-icons/ri";

export type TypeRow = { id: string; name: string; notes: string | null; active: boolean; usage: number };

export function ManagedItemTypesClient({ types }: { types: TypeRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TypeRow | null | "new">(null);
  const [isPending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);

  function remove(t: TypeRow) {
    if (!confirm(`Διαγραφή «${t.name}» από τον κατάλογο;`)) return;
    setRowError(null);
    startTransition(async () => {
      const res = await deleteManagedItemType(t.id);
      if (res && "error" in res && res.error) { setRowError(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 800, margin: 0, color: "var(--foreground)" }}>
            <RiListCheck2 style={{ color: "var(--color-primary)" }} /> Στοιχεία Διαχείρισης
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
            Ο κατάλογος με ό,τι διαχειρίζεται η εταιρεία (π.χ. «Αλλαγή λαμπτήρων»). Στα managed κτήρια επιλέγεις από εδώ και ορίζεις τοποθεσία, αριθμό και φωτογραφία.
          </p>
        </div>
        <button onClick={() => setEditing("new")} style={{ ...btn, ...btnPrimary }}><RiAddLine /> Νέο στοιχείο</button>
      </div>

      {rowError && <div style={errBox} role="alert">{rowError}</div>}

      {types.length === 0 ? (
        <div onClick={() => setEditing("new")} style={{ border: "1.5px dashed var(--border-strong)", borderRadius: 8, padding: 40, textAlign: "center", color: "var(--muted-foreground)", cursor: "pointer", background: "var(--bg-canvas)", fontSize: 13 }}>
          <RiListCheck2 style={{ fontSize: 26, display: "block", margin: "0 auto 8px" }} />
          <div style={{ fontWeight: 600, color: "var(--foreground)", marginBottom: 3 }}>Ο κατάλογος είναι κενός</div>
          Πάτησε για να προσθέσεις το πρώτο στοιχείο — π.χ. «Αλλαγή λαμπτήρων», «Καθαρισμός κοινόχρηστων».
        </div>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11 }}>
              <th style={th}>Στοιχείο</th><th style={th}>Κατάσταση</th><th style={{ ...th, textAlign: "right" }}>Χρήση σε κτήρια</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid var(--border)", opacity: t.active ? 1 : 0.55 }}>
                  <td style={td}><b>{t.name}</b>{t.notes && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{t.notes}</div>}</td>
                  <td style={td}>
                    {t.active
                      ? <span style={{ ...chip, background: "#15803d18", color: "#15803d" }}>Ενεργό</span>
                      : <span style={{ ...chip, background: "var(--bg-canvas)", color: "var(--muted-foreground)" }}><RiEyeOffLine style={{ fontSize: 11 }} /> Ανενεργό</span>}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><RiBuildingLine style={{ color: "var(--muted-foreground)" }} /> {t.usage}</span>
                  </td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => setEditing(t)} style={iconBtn} title="Επεξεργασία"><RiPencilLine /></button>
                    <button onClick={() => remove(t)} disabled={isPending} style={{ ...iconBtn, color: "#c50f1f" }} title="Διαγραφή"><RiDeleteBinLine /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <TypeModal editing={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />
      )}
    </div>
  );
}

function TypeModal({ editing, onClose, onDone }: { editing: TypeRow | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: editing?.name ?? "", notes: editing?.notes ?? "", active: editing?.active ?? true });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = editing
        ? await updateManagedItemType(editing.id, form)
        : await createManagedItemType(form);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Επεξεργασία στοιχείου" : "Νέο στοιχείο καταλόγου"} width={460}
      footer={<>
        <button onClick={onClose} style={cancelBtn}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={saveBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button>
      </>}>
      {error && <div style={errBox} role="alert">{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormField label="Όνομα" required hint="Τι διαχειρίζεται η εταιρεία">
          <FieldInput value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="π.χ. Αλλαγή λαμπτήρων" />
        </FormField>
        <FormField label="Σημειώσεις">
          <FieldTextarea value={form.notes} onChange={(v) => setForm((p) => ({ ...p, notes: v }))} rows={2} placeholder="π.χ. περιλαμβάνει λαμπτήρες LED" />
        </FormField>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
          Ενεργό — διαθέσιμο για επιλογή στα κτήρια
        </label>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "11px 16px", color: "var(--foreground)" };
const chip: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999 };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: 6, marginLeft: 6, cursor: "pointer" };
const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 0 };
