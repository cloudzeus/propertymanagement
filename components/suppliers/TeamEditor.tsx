"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormField, FieldInput, FieldSelect } from "@/components/ui/modal";
import { createSupplierUser, updateSupplierUser, removeSupplierUser, type SupplierUserInput } from "@/app/actions/suppliers";
import type { SupplierUserDTO } from "@/lib/suppliers-shared";
import { RiAddLine, RiPencilLine, RiDeleteBinLine, RiCheckLine, RiLoaderLine, RiShieldUserLine, RiUserLine } from "react-icons/ri";

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Ενεργός", INACTIVE: "Ανενεργός", SUSPENDED: "Σε αναστολή" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "ποτέ");

/** COLLABORATOR logins under one supplier (admin + technicians). */
export function TeamEditor({ supplierId, users, canEdit, selfId }: { supplierId: string; users: SupplierUserDTO[]; canEdit: boolean; selfId: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SupplierUserDTO | null | "new">(null);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function remove(u: SupplierUserDTO) {
    if (!confirm(`Διαγραφή λογαριασμού ${u.email};`)) return;
    setErr(null);
    startTransition(async () => {
      const res = await removeSupplierUser(supplierId, u.id);
      if (res && "error" in res && res.error) { setErr(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
        <RiUserLine style={{ color: "var(--color-primary)" }} />
        <b style={{ fontSize: "var(--fs-13)", flex: 1 }}>Ομάδα & λογαριασμοί <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>({users.length})</span></b>
        {canEdit && <button onClick={() => setEditing("new")} style={smallBtn}><RiAddLine /> Νέος λογαριασμός</button>}
      </div>
      {err && <div style={errBox} role="alert">{err}</div>}
      {users.length === 0 ? (
        <div style={{ padding: 22, textAlign: "center", fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>
          Κανένας λογαριασμός ακόμη. Ο πρώτος λογαριασμός με ρόλο «Διαχειριστής» θα μπορεί να διαχειρίζεται προφίλ, κατάλογο και ομάδα από το δικό του dashboard.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
          <thead><tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: "var(--fs-11)" }}>
            <th style={th}>Χρήστης</th><th style={th}>Ρόλος</th><th style={th}>Κατάσταση</th><th style={th}>Τελευταία σύνδεση</th>{canEdit && <th style={th}></th>}
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid var(--border)", opacity: u.status === "ACTIVE" ? 1 : 0.6 }}>
                <td style={td}><b>{u.name ?? "—"}</b>{u.id === selfId && <span style={{ marginLeft: 6, fontSize: "var(--fs-11)", color: "var(--muted-foreground)" }}>(εσείς)</span>}<div style={{ fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)" }}>{u.email}{u.phone ? ` · ${u.phone}` : ""}</div></td>
                <td style={td}>{u.isSupplierAdmin ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#107C10", fontWeight: 600 }}><RiShieldUserLine /> Διαχειριστής</span> : "Τεχνικός"}</td>
                <td style={td}>{STATUS_LABEL[u.status] ?? u.status}</td>
                <td style={{ ...td, color: "var(--muted-foreground)" }}>{fmt(u.lastLoginAt)}</td>
                {canEdit && (
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => setEditing(u)} style={iconBtn} title="Επεξεργασία"><RiPencilLine /></button>
                    {u.id !== selfId && <button onClick={() => remove(u)} disabled={isPending} style={{ ...iconBtn, color: "#c50f1f" }} title="Διαγραφή"><RiDeleteBinLine /></button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing !== null && (
        <UserModal supplierId={supplierId} editing={editing === "new" ? null : editing} isSelf={editing !== "new" && editing.id === selfId} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />
      )}
    </div>
  );
}

function UserModal({ supplierId, editing, isSelf, onClose, onDone }: { supplierId: string; editing: SupplierUserDTO | null; isSelf: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: editing?.name ?? "", email: editing?.email ?? "", phone: editing?.phone ?? "", password: "", status: editing?.status ?? "ACTIVE" });
  const [isAdmin, setIsAdmin] = useState(editing?.isSupplierAdmin ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function save() {
    setError(null);
    const payload: SupplierUserInput = { name: form.name, email: form.email, phone: form.phone, password: form.password || null, isSupplierAdmin: isAdmin, status: form.status as SupplierUserInput["status"] };
    startTransition(async () => {
      const res = editing ? await updateSupplierUser(supplierId, editing.id, payload) : await createSupplierUser(supplierId, payload);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} width={460} title={editing ? "Επεξεργασία λογαριασμού" : "Νέος λογαριασμός συνεργάτη"}
      footer={<>
        <button onClick={onClose} style={cancelBtn}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={saveBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button>
      </>}>
      {error && <div style={errBox} role="alert">{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormField label="Ονοματεπώνυμο"><FieldInput value={form.name} onChange={f("name")} /></FormField>
        <FormField label="Email (σύνδεση)" required><FieldInput type="email" value={form.email} onChange={f("email")} /></FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Κινητό"><FieldInput value={form.phone} onChange={f("phone")} /></FormField>
          <FormField label={editing ? "Νέος κωδικός" : "Κωδικός"} required={!editing} hint={editing ? "κενό = χωρίς αλλαγή" : "τουλάχιστον 6 χαρακτήρες"}><FieldInput type="password" value={form.password} onChange={f("password")} /></FormField>
        </div>
        {editing && !isSelf && (
          <FormField label="Κατάσταση"><FieldSelect value={form.status} onChange={f("status")} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} /></FormField>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-13)", color: "var(--foreground)", cursor: isSelf ? "not-allowed" : "pointer" }}>
          <input type="checkbox" checked={isAdmin} disabled={isSelf} onChange={(e) => setIsAdmin(e.target.checked)} />
          Διαχειριστής συνεργάτη — επεξεργάζεται προφίλ, κατάλογο και ομάδα
        </label>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

const th: React.CSSProperties = { padding: "8px 14px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "9px 14px", color: "var(--foreground)", verticalAlign: "top" };
const smallBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: "5px 10px", fontSize: "var(--fs-12)", fontWeight: 600, cursor: "pointer" };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: 5, marginLeft: 6, cursor: "pointer" };
const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: "var(--fs-13)", color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { margin: 10, padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: "var(--fs-12)", border: "1px solid #fca5a530" };
