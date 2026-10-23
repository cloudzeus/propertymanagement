"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput, FieldTextarea } from "@/components/ui/modal";
import { saveSupplierContact, deactivateSupplierContact, reactivateSupplierContact, resendContactInvite, removeSupplierContact } from "@/app/actions/supplier-contacts";
import type { SupplierContactDTO, SupplierContactInput } from "@/lib/suppliers-shared";
import { RiContactsLine, RiPencilLine, RiMailSendLine, RiUserUnfollowLine, RiUserFollowLine, RiDeleteBinLine, RiCheckLine, RiLoaderLine, RiShieldUserLine, RiStarLine } from "react-icons/ri";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—");

/** Access state of a contact as the company sees it. */
export function accessChip(c: SupplierContactDTO): { label: string; color: string } {
  if (c.user?.hasPassword) return c.user.status === "ACTIVE" ? { label: "Ενεργή πρόσβαση", color: "var(--color-success)" } : { label: "Ανενεργή πρόσβαση", color: "var(--color-danger)" };
  if (c.pendingInvite) return new Date(c.pendingInvite.expiresAt).getTime() < Date.now() ? { label: "Πρόσκληση έληξε", color: "var(--color-danger)" } : { label: `Πρόσκληση εστάλη ${fmt(c.pendingInvite.sentAt)}${c.pendingInvite.openedAt ? " · ανοίχτηκε" : ""}`, color: "var(--color-info)" };
  return { label: "Χωρίς πρόσβαση", color: "var(--muted-foreground)" };
}

/**
 * Contacts of a supplier (name/position/phones/e-mail) with optional login to
 * /marketplace. Shared by the company supplier card and the supplier's own
 * «Ομάδα» page. Access is granted by e-mail link (default) or a one-time
 * typed password that is hashed and never shown again.
 */
export function ContactsEditor({ supplierId, contacts, canEdit, selfUserId, storageKey }: { supplierId: string; contacts: SupplierContactDTO[]; canEdit: boolean; selfUserId: string | null; storageKey: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SupplierContactDTO | null | "new">(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ error?: string } | { ok?: true }>, okMsg?: string) {
    setErr(null); setInfo(null);
    start(async () => {
      const res = await fn();
      if ("error" in res && res.error) { setErr(res.error); return; }
      if (okMsg) setInfo(okMsg);
      router.refresh();
    });
  }

  const columns: ColDef<SupplierContactDTO>[] = [
    { id: "name", header: "Επαφή", width: 220, sortKey: "name", accessor: (r) => r.name, cell: (r) => <><b style={{ opacity: r.active ? 1 : 0.55 }}>{r.name}</b>{r.isPrimary && <span title="Υπεύθυνος επαφής" style={{ marginLeft: 6, color: "var(--color-warning)" }}><RiStarLine style={{ verticalAlign: "-2px" }} /></span>}{r.user?.id === selfUserId && <span style={{ marginLeft: 6, fontSize: "var(--fs-11)", color: "var(--muted-foreground)" }}>(εσείς)</span>}{r.position && <div style={{ fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)" }}>{r.position}</div>}</> },
    { id: "phone", header: "Τηλέφωνο", width: 130, accessor: (r) => r.phone ?? "", cell: (r) => r.phone ?? "—" },
    { id: "mobile", header: "Κινητό", width: 130, accessor: (r) => r.mobile ?? "", cell: (r) => r.mobile ?? "—" },
    { id: "email", header: "Email", width: 220, accessor: (r) => r.email ?? "", cell: (r) => r.email ?? "—" },
    { id: "access", header: "Πρόσβαση", width: 220, accessor: (r) => accessChip(r).label, cell: (r) => { const c = accessChip(r); return <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: "var(--fs-11-5)", fontWeight: 600, color: c.color, background: `color-mix(in srgb, ${c.color} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${c.color} 25%, transparent)`, whiteSpace: "nowrap" }}>{c.label}</span>; } },
    { id: "role", header: "Ρόλος", width: 130, accessor: (r) => (r.user ? (r.user.isSupplierAdmin ? "Διαχειριστής" : "Τεχνικός") : ""), cell: (r) => (r.user ? (r.user.isSupplierAdmin ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--color-success)", fontWeight: 600 }}><RiShieldUserLine /> Διαχειριστής</span> : "Τεχνικός") : "—") },
    { id: "rfq", header: "Λαμβάνει RFQ", width: 110, accessor: (r) => (r.receivesRfq ? "ναι" : "όχι"), cell: (r) => (r.receivesRfq && r.email ? "Ναι" : "Όχι") },
    { id: "login", header: "Τελευταία σύνδεση", width: 150, accessor: (r) => r.user?.lastLoginAt ?? "", cell: (r) => (r.user ? fmt(r.user.lastLoginAt) : "—"), defaultVisible: false },
  ];

  const actions = (r: SupplierContactDTO): RowAction<SupplierContactDTO>[] => {
    if (!canEdit) return [];
    const out: RowAction<SupplierContactDTO>[] = [{ label: "Επεξεργασία", icon: <RiPencilLine />, onClick: () => setEditing(r) }];
    if (r.email && !r.user?.hasPassword) out.push({ label: r.pendingInvite ? "Αποστολή πρόσκλησης ξανά" : "Αποστολή πρόσκλησης", icon: <RiMailSendLine />, onClick: () => run(() => resendContactInvite(supplierId, r.id), `Η πρόσκληση στάλθηκε στο ${r.email}.`) });
    if (r.active) {
      if (r.user?.id !== selfUserId) out.push({ label: "Απενεργοποίηση", icon: <RiUserUnfollowLine />, danger: true, onClick: () => { if (confirm(`Απενεργοποίηση της επαφής ${r.name};${r.user ? " Ο λογαριασμός της δεν θα μπορεί να συνδεθεί." : ""}`)) run(() => deactivateSupplierContact(supplierId, r.id)); } });
    } else out.push({ label: "Επανενεργοποίηση", icon: <RiUserFollowLine />, onClick: () => run(() => reactivateSupplierContact(supplierId, r.id)) });
    if (!r.user) out.push({ label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: () => { if (confirm(`Διαγραφή της επαφής ${r.name};`)) run(() => removeSupplierContact(supplierId, r.id)); } });
    return out;
  };

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
        <RiContactsLine style={{ color: "var(--color-primary)" }} />
        <b style={{ fontSize: "var(--fs-13)", flex: 1 }}>Επαφές & πρόσβαση <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>({contacts.length})</span></b>
        {pending && <RiLoaderLine style={{ animation: "spin 1s linear infinite", color: "var(--muted-foreground)" }} />}
      </div>
      {err && <div role="alert" style={errBox}>{err}</div>}
      {info && <div style={{ ...errBox, background: "color-mix(in srgb, var(--color-success) 8%, transparent)", color: "var(--color-success)", border: "1px solid color-mix(in srgb, var(--color-success) 19%, transparent)" }}>{info}</div>}
      <div style={{ padding: contacts.length ? 0 : 0 }}>
        <DataTable data={contacts} columns={columns} totalRows={contacts.length} page={1} pageSize={25} clientSide storageKey={storageKey} searchPlaceholder="Αναζήτηση επαφής…"
          getRowActions={actions} onAddNew={canEdit ? () => setEditing("new") : undefined} addNewLabel="Νέα επαφή" />
      </div>
      {editing !== null && (
        <ContactModal supplierId={supplierId} editing={editing === "new" ? null : editing} isSelf={editing !== "new" && editing.user?.id === selfUserId} onClose={() => setEditing(null)} onDone={(msg) => { setEditing(null); setInfo(msg); router.refresh(); }} />
      )}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function ContactModal({ supplierId, editing, isSelf, onClose, onDone }: { supplierId: string; editing: SupplierContactDTO | null; isSelf: boolean; onClose: () => void; onDone: (msg: string | null) => void }) {
  const hasLogin = !!editing?.user;
  const [form, setForm] = useState({ name: editing?.name ?? "", position: editing?.position ?? "", phone: editing?.phone ?? "", mobile: editing?.mobile ?? "", email: editing?.email ?? "", notes: editing?.notes ?? "", password: "" });
  const [isPrimary, setIsPrimary] = useState(editing?.isPrimary ?? false);
  const [receivesRfq, setReceivesRfq] = useState(editing?.receivesRfq ?? true);
  const [access, setAccess] = useState<SupplierContactInput["access"]>(hasLogin ? "none" : "invite");
  const [isAdmin, setIsAdmin] = useState(editing?.user?.isSupplierAdmin ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function save() {
    setError(null);
    const payload: SupplierContactInput = { name: form.name, position: form.position, phone: form.phone, mobile: form.mobile, email: form.email, notes: form.notes, isPrimary, receivesRfq, access, password: access === "password" ? form.password : null, isSupplierAdmin: hasLogin || access !== "none" ? isAdmin : undefined };
    start(async () => {
      const res = await saveSupplierContact(supplierId, editing?.id ?? null, payload);
      if ("error" in res && res.error) { setError(res.error); return; }
      onDone("invited" in res && res.invited ? `Η πρόσκληση με link ορισμού κωδικού στάλθηκε στο ${form.email.trim().toLowerCase()}.` : null);
    });
  }

  return (
    <Modal open onClose={onClose} width={540} title={editing ? "Επεξεργασία επαφής" : "Νέα επαφή συνεργάτη"}
      footer={<>
        <button onClick={onClose} style={cancelBtn}>Ακύρωση</button>
        <button onClick={save} disabled={pending} style={saveBtn}>{pending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button>
      </>}>
      {error && <div role="alert" style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Ονοματεπώνυμο" required><FieldInput value={form.name} onChange={f("name")} /></FormField>
          <FormField label="Θέση / ρόλος στην επιχείρηση"><FieldInput value={form.position} onChange={f("position")} placeholder="π.χ. Υπεύθυνος έργων" /></FormField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Τηλέφωνο"><FieldInput value={form.phone} onChange={f("phone")} /></FormField>
          <FormField label="Κινητό"><FieldInput value={form.mobile} onChange={f("mobile")} /></FormField>
        </div>
        <FormField label="Email" required={access !== "none"} hint={hasLogin ? "Το email σύνδεσης αλλάζει μόνο από τον διαχειριστή χρηστών." : undefined}><FieldInput type="email" value={form.email} onChange={f("email")} disabled={hasLogin} /></FormField>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "var(--fs-13)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} /> Υπεύθυνος επαφής</label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={receivesRfq} onChange={(e) => setReceivesRfq(e.target.checked)} /> Λαμβάνει αιτήματα προσφοράς</label>
        </div>
        {!hasLogin && (
          <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", margin: 0 }}>
            <legend style={{ fontSize: "var(--fs-12)", fontWeight: 600, padding: "0 4px" }}>Πρόσβαση στο περιβάλλον συνεργατών</legend>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--fs-13)" }}>
              <label style={radio}><input type="radio" name="access" checked={access === "none"} onChange={() => setAccess("none")} /> Καμία — μόνο στοιχεία επικοινωνίας</label>
              <label style={radio}><input type="radio" name="access" checked={access === "invite"} onChange={() => setAccess("invite")} /> Πρόσκληση με link ορισμού κωδικού <span style={{ color: "var(--muted-foreground)" }}>(προτείνεται· ισχύει 14 ημέρες)</span></label>
              <label style={radio}><input type="radio" name="access" checked={access === "password"} onChange={() => setAccess("password")} /> Ορισμός κωδικού τώρα <span style={{ color: "var(--muted-foreground)" }}>(αποθηκεύεται κρυπτογραφημένος, δεν εμφανίζεται ξανά)</span></label>
              {access === "password" && <FormField label="Κωδικός" required hint="τουλάχιστον 8 χαρακτήρες — δώστε τον στην επαφή με ασφαλή τρόπο, όχι με email"><FieldInput type="password" value={form.password} onChange={f("password")} /></FormField>}
            </div>
          </fieldset>
        )}
        {(hasLogin || access !== "none") && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-13)", cursor: isSelf ? "not-allowed" : "pointer" }}>
            <input type="checkbox" checked={isAdmin || isPrimary} disabled={isSelf || isPrimary} onChange={(e) => setIsAdmin(e.target.checked)} />
            Διαχειριστής συνεργάτη — επεξεργάζεται προφίλ, κατάλογο, ομάδα και υπογράφει συμβάσεις{isPrimary ? " (ο υπεύθυνος επαφής είναι πάντα διαχειριστής)" : ""}
          </label>
        )}
        <FormField label="Σημειώσεις"><FieldTextarea value={form.notes} onChange={f("notes")} rows={2} /></FormField>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

const radio: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, cursor: "pointer" };
const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: "var(--fs-13)", color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { margin: 10, padding: "8px 12px", borderRadius: 6, background: "var(--danger-soft)", color: "var(--color-danger)", fontSize: "var(--fs-12)", border: "1px solid var(--danger-soft)" };
