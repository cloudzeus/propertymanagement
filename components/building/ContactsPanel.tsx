"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormField, FieldInput, FieldTextarea } from "@/components/ui/modal";
import { createContact, updateContact, deleteContact } from "@/app/actions/contacts";
import { RiAddLine, RiPhoneLine, RiPencilLine, RiDeleteBinLine, RiCheckLine, RiLoaderLine, RiContactsBook3Line } from "react-icons/ri";
import type { BuildingCaps } from "@/lib/building-caps";

export type ContactRow = { id: string; name: string; category: string | null; phone: string | null; email: string | null; notes: string | null };

export function ContactsPanel({ buildingId, contacts, can }: { buildingId: string; contacts: ContactRow[]; can: BuildingCaps }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ContactRow | null | "new">(null);
  const [isPending, startTransition] = useTransition();

  function remove(id: string) {
    if (!confirm("Διαγραφή επαφής;")) return;
    startTransition(async () => { await deleteContact(id); router.refresh(); });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}><RiContactsBook3Line /> {contacts.length} επαφές</div>
        {can.manageContacts && <button onClick={() => setEditing("new")} style={{ ...btn, ...btnPrimary }}><RiAddLine /> Νέα επαφή</button>}
      </div>

      {contacts.length === 0 ? (
        can.manageContacts ? (
          <Empty onAdd={() => setEditing("new")} />
        ) : (
          <div style={{ border: "1.5px dashed var(--border-strong)", borderRadius: 8, padding: 36, textAlign: "center", color: "var(--muted-foreground)", background: "var(--bg-canvas)" }}>
            Δεν υπάρχουν επαφές.
          </div>
        )
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11 }}>
              <th style={th}>Όνομα</th><th style={th}>Κατηγορία</th><th style={th}>Τηλέφωνο</th><th style={th}>Email</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}><b>{c.name}</b>{c.notes && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{c.notes}</div>}</td>
                  <td style={td}>{c.category ? <span style={chip}>{c.category}</span> : "—"}</td>
                  <td style={td}>{c.phone ?? "—"}</td>
                  <td style={td}>{c.email ?? "—"}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    {c.phone && <a href={`tel:${c.phone}`} style={iconBtn} title="Κλήση"><RiPhoneLine /></a>}
                    {can.manageContacts && (
                      <>
                        <button onClick={() => setEditing(c)} style={iconBtn} title="Επεξεργασία"><RiPencilLine /></button>
                        <button onClick={() => remove(c.id)} disabled={isPending} style={{ ...iconBtn, color: "#c50f1f" }} title="Διαγραφή"><RiDeleteBinLine /></button>
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
        <ContactModal buildingId={buildingId} editing={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />
      )}
    </div>
  );
}

function ContactModal({ buildingId, editing, onClose, onDone }: { buildingId: string; editing: ContactRow | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: editing?.name ?? "", category: editing?.category ?? "", phone: editing?.phone ?? "", email: editing?.email ?? "", notes: editing?.notes ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  function save() {
    setError(null);
    startTransition(async () => {
      const res = editing ? await updateContact(editing.id, form) : await createContact(buildingId, form);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }
  return (
    <Modal open onClose={onClose} title={editing ? "Επεξεργασία επαφής" : "Νέα επαφή"} width={480}
      footer={<><button onClick={onClose} style={cancelBtn}>Ακύρωση</button><button onClick={save} disabled={isPending} style={saveBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button></>}>
      {error && <div style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Όνομα" required><FieldInput value={form.name} onChange={f("name")} placeholder="π.χ. KLEEMANN" /></FormField>
          <FormField label="Κατηγορία"><FieldInput value={form.category} onChange={f("category")} placeholder="π.χ. Ανελκυστήρας" /></FormField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Τηλέφωνο"><FieldInput value={form.phone} onChange={f("phone")} /></FormField>
          <FormField label="Email"><FieldInput type="email" value={form.email} onChange={f("email")} /></FormField>
        </div>
        <FormField label="Σημειώσεις"><FieldTextarea value={form.notes} onChange={f("notes")} rows={2} /></FormField>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div onClick={onAdd} style={{ border: "1.5px dashed var(--border-strong)", borderRadius: 8, padding: 36, textAlign: "center", color: "var(--muted-foreground)", cursor: "pointer", background: "var(--bg-canvas)" }}>
      Δεν υπάρχουν επαφές. Πάτησε για προσθήκη.
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 14px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "11px 14px", borderTop: "1px solid var(--border)", color: "var(--foreground)" };
const chip: React.CSSProperties = { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--color-blue-soft)", color: "var(--color-blue)" };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: 6, marginLeft: 6, cursor: "pointer", textDecoration: "none" };
const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 12 };
