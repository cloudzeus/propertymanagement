"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { saveServiceCatalogItem, deleteServiceCatalogItem } from "@/app/actions/suppliers";
import type { ServiceCatalogItemDTO } from "@/lib/suppliers-shared";
import { RiAddLine, RiPencilLine, RiDeleteBinLine, RiCheckLine, RiLoaderLine, RiPriceTag3Line, RiEyeOffLine, RiTeamLine } from "react-icons/ri";

type Row = ServiceCatalogItemDTO & { suppliers: number };

/** Master catalog of services the company "opens" to suppliers (wizard step 2). */
export function CatalogAdminClient({ items, categories, canEdit, canDelete }: {
  items: Row[]; categories: { id: string; name: string }[]; canEdit: boolean; canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Row | null | "new">(null);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function remove(r: Row) {
    if (!confirm(`Διαγραφή «${r.name}» από τον κατάλογο;`)) return;
    setErr(null);
    startTransition(async () => {
      const res = await deleteServiceCatalogItem(r.id);
      if (res && "error" in res && res.error) { setErr(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-22)", fontWeight: 800, margin: 0, color: "var(--foreground)" }}>
            <RiPriceTag3Line style={{ color: "var(--color-primary)" }} /> Κατάλογος υπηρεσιών
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>
            Οι υπηρεσίες που «ανοίγει» η εταιρεία στους συνεργάτες. Στην πρώτη σύνδεση κάθε συνεργάτης επιλέγει ποιες προσφέρει και δηλώνει τις τιμές του.
          </p>
        </div>
        {canEdit && <button onClick={() => setEditing("new")} style={{ ...btn, ...btnPrimary }}><RiAddLine /> Νέα υπηρεσία</button>}
      </div>
      {err && <div style={errBox} role="alert">{err}</div>}

      {items.length === 0 ? (
        <div onClick={() => canEdit && setEditing("new")} style={{ border: "1.5px dashed var(--border-strong)", borderRadius: 8, padding: 40, textAlign: "center", color: "var(--muted-foreground)", cursor: canEdit ? "pointer" : "default", background: "var(--bg-canvas)", fontSize: "var(--fs-13)" }}>
          <RiPriceTag3Line style={{ fontSize: "var(--fs-26)", display: "block", margin: "0 auto 8px" }} />
          <div style={{ fontWeight: 600, color: "var(--foreground)", marginBottom: 3 }}>Ο κατάλογος είναι κενός</div>
          Προσθέστε π.χ. «Επισκευή θυροτηλεφώνου», «Ετήσια συντήρηση καυστήρα», «Καθαρισμός κοινοχρήστων».
        </div>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
            <thead><tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: "var(--fs-11)" }}>
              <th style={th}>Υπηρεσία</th><th style={th}>Κατηγορία</th><th style={th}>Μονάδα</th><th style={{ ...th, textAlign: "right" }}>Συνεργάτες</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)", opacity: r.active ? 1 : 0.55 }}>
                  <td style={td}><b>{r.name}</b>{!r.active && <RiEyeOffLine title="Ανενεργή" style={{ marginLeft: 6, fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }} />}{r.description && <div style={{ fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)" }}>{r.description}</div>}</td>
                  <td style={td}>{r.categoryName ?? "—"}</td>
                  <td style={td}>{r.unit ?? "—"}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><RiTeamLine style={{ color: "var(--muted-foreground)" }} /> {r.suppliers}</span></td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    {canEdit && <button onClick={() => setEditing(r)} style={iconBtn} title="Επεξεργασία"><RiPencilLine /></button>}
                    {canDelete && <button onClick={() => remove(r)} disabled={isPending} style={{ ...iconBtn, color: "#c50f1f" }} title="Διαγραφή"><RiDeleteBinLine /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <ItemModal editing={editing === "new" ? null : editing} categories={categories} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />
      )}
    </div>
  );
}

function ItemModal({ editing, categories, onClose, onDone }: { editing: Row | null; categories: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: editing?.name ?? "", description: editing?.description ?? "", unit: editing?.unit ?? "επίσκεψη", categoryId: editing?.categoryId ?? "", sortOrder: String(editing?.sortOrder ?? 0) });
  const [active, setActive] = useState(editing?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveServiceCatalogItem(editing?.id ?? null, { ...form, sortOrder: Number(form.sortOrder) || 0, active });
      if (res && "error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} width={480} title={editing ? "Επεξεργασία υπηρεσίας" : "Νέα υπηρεσία καταλόγου"}
      footer={<>
        <button onClick={onClose} style={cancelBtn}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={saveBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button>
      </>}>
      {error && <div style={errBox} role="alert">{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormField label="Όνομα" required><FieldInput value={form.name} onChange={f("name")} placeholder="π.χ. Ετήσια συντήρηση καυστήρα" /></FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px", gap: 10 }}>
          <FormField label="Κατηγορία βλάβης"><FieldSelect value={form.categoryId} onChange={f("categoryId")} placeholder="— Γενική —" options={categories.map((c) => ({ value: c.id, label: c.name }))} /></FormField>
          <FormField label="Προτεινόμενη μονάδα"><FieldInput value={form.unit} onChange={f("unit")} placeholder="επίσκεψη / ώρα / τ.μ." /></FormField>
          <FormField label="Σειρά"><FieldInput type="number" value={form.sortOrder} onChange={f("sortOrder")} /></FormField>
        </div>
        <FormField label="Περιγραφή"><FieldTextarea value={form.description} onChange={f("description")} rows={2} placeholder="Τι περιλαμβάνει" /></FormField>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-13)", color: "var(--foreground)", cursor: "pointer" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ενεργή — εμφανίζεται στο wizard των συνεργατών
        </label>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "11px 16px", color: "var(--foreground)", verticalAlign: "top" };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: "7px 13px", fontSize: "var(--fs-13)", fontWeight: 600, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: 6, marginLeft: 6, cursor: "pointer" };
const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: "var(--fs-13)", color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: "var(--fs-12)", border: "1px solid #fca5a530" };
