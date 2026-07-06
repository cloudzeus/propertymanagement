"use client";

import { useState, useTransition } from "react";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput, FieldSelect } from "@/components/ui/modal";
import { createUser, updateUser, deleteUser } from "@/app/actions/users";
import { USER_STATUSES, EMPLOYEE_ROLES } from "@/lib/roles-constants";
import { RiCheckLine, RiLoaderLine, RiPencilLine, RiDeleteBinLine } from "react-icons/ri";

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Διαχειριστής",
  MANAGER: "Manager",
  EMPLOYEE: "Υπάλληλος",
  PROPERTY_ADMIN: "Διαχ. Ακινήτου",
  PROPERTY_OWNER: "Ιδιοκτήτης",
  PROPERTY_RESIDENT: "Ένοικος",
  PROPERTY_VIEWER: "Θεατής",
  COLLABORATOR: "Συνεργάτης",
};

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: "#A4262C", ADMIN: "#0078D4", MANAGER: "#8764B8",
  PROPERTY_ADMIN: "#038387", EMPLOYEE: "#CA5D00", COLLABORATOR: "#107C10",
  PROPERTY_OWNER: "#8764B8", PROPERTY_RESIDENT: "#0078D4", PROPERTY_VIEWER: "#707070",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ενεργός", INACTIVE: "Ανενεργός", SUSPENDED: "Σε αναστολή",
};

type Company = { id: string; name: string };
type RoleRow = { id: string; key: string; label: string; baseRole: string; surface: string; isSystem: boolean };
type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  roleId: string | null;
  status: string;
  companyId: string | null;
  company: { name: string } | null;
  lastLoginAt: Date | null;
};

function initForm() {
  return { name: "", email: "", role: "EMPLOYEE", roleId: "", status: "ACTIVE", companyId: "", password: "" };
}

export function UsersClient({
  initial, companies, roles, managingCompanyId,
}: {
  initial: User[];
  companies: Company[];
  roles: RoleRow[];
  managingCompanyId: string;
}) {
  const [data, setData] = useState<User[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(initForm());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const f = (key: keyof ReturnType<typeof initForm>) => (v: string) => setForm((p) => ({ ...p, [key]: v }));

  // Staff roles (admin/manager/employee) default to the managing company.
  function setRoleId(roleId: string) {
    setForm((p) => {
      const roleRow = roles.find((r) => r.id === roleId);
      const baseRole = roleRow?.baseRole ?? p.role;
      const isStaff = (EMPLOYEE_ROLES as readonly string[]).includes(baseRole);
      return {
        ...p,
        roleId,
        role: baseRole,
        companyId: isStaff && managingCompanyId ? managingCompanyId : p.companyId,
      };
    });
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...initForm(), companyId: managingCompanyId || "" });
    setError(null);
    setOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    const fallbackRoleId = u.roleId || roles.find((r) => r.isSystem && r.key === u.role)?.id || "";
    setForm({
      name: u.name ?? "", email: u.email, role: u.role, roleId: fallbackRoleId, status: u.status,
      companyId: u.companyId ?? "", password: "",
    });
    setError(null);
    setOpen(true);
  }

  function handleSave() {
    if (!form.email.trim()) { setError("Το email είναι υποχρεωτικό"); return; }
    if (!editing && form.password.length < 6) { setError("Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες"); return; }
    startTransition(async () => {
      const payload = {
        name: form.name || null,
        email: form.email,
        role: form.role,
        roleId: form.roleId || null,
        status: form.status,
        companyId: form.companyId || null,
        password: form.password || null,
      };
      const res = editing ? await updateUser(editing.id, payload) : await createUser(payload);
      if ("error" in res && res.error) { setError(res.error); return; }
      const saved = (res as { user: User }).user;
      setData((prev) => editing ? prev.map((u) => u.id === saved.id ? saved : u) : [saved, ...prev]);
      setOpen(false);
    });
  }

  function handleDelete(u: User) {
    if (!confirm(`Διαγραφή χρήστη ${u.name || u.email};`)) return;
    startTransition(async () => {
      const res = await deleteUser(u.id);
      if ("error" in res && res.error) { alert(res.error); return; }
      setData((prev) => prev.filter((x) => x.id !== u.id));
    });
  }

  const roleIdOptions = roles.map((r) => ({ value: r.id, label: r.isSystem ? `${r.label} (system)` : r.label }));
  const statusOptions = USER_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] ?? s }));
  const companyOptions = companies.map((c) => ({ value: c.id, label: c.name }));

  const columns: ColDef<User>[] = [
    {
      id: "name", header: "Χρήστης", sortKey: "name", width: 240,
      accessor: (u) => `${u.name ?? ""} ${u.email}`,
      cell: (u) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: "#DEECF9", border: "1px solid #A3CEEE",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#005A9E",
          }}>
            {(u.name || u.email || "?").charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name || "—"}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      id: "company", header: "Εταιρεία", sortKey: "company", width: 180,
      accessor: (u) => u.company?.name ?? "",
      cell: (u) => <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{u.company?.name || "—"}</span>,
    },
    {
      id: "role", header: "Ρόλος", sortKey: "role", width: 150,
      accessor: (u) => ROLE_LABEL[u.role] ?? u.role,
      cell: (u) => {
        const c = ROLE_COLOR[u.role] || "#707070";
        return <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: `${c}18`, color: c }}>{ROLE_LABEL[u.role] ?? u.role}</span>;
      },
    },
    {
      id: "status", header: "Κατάσταση", sortKey: "status", width: 120,
      accessor: (u) => STATUS_LABEL[u.status] ?? u.status,
      cell: (u) => (
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
          background: u.status === "ACTIVE" ? "#107C1018" : "#70707018",
          color: u.status === "ACTIVE" ? "#107C10" : "#707070",
        }}>{STATUS_LABEL[u.status] ?? u.status}</span>
      ),
    },
    {
      id: "lastLogin", header: "Τελευταία Σύνδεση", sortKey: "lastLoginAt", width: 150, defaultVisible: false,
      accessor: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : 0),
      cell: (u) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("el-GR") : "—"}</span>,
    },
  ];

  const getRowActions = (_u: User): RowAction<User>[] => [
    { label: "Επεξεργασία", icon: <RiPencilLine />, onClick: openEdit },
    { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: handleDelete },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Χρήστες</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>{data.length} χρήστες στο σύστημα</p>
      </div>

      <DataTable
        data={data}
        columns={columns}
        totalRows={data.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="super-admin-users"
        searchPlaceholder="Αναζήτηση χρήστη…"
        getRowActions={getRowActions}
        onAddNew={openAdd}
        addNewLabel="Νέος Χρήστης"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Επεξεργασία: ${editing.name || editing.email}` : "Νέος Χρήστης"}
        width={560}
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Όνομα"><FieldInput value={form.name} onChange={f("name")} placeholder="Γιάννης Παπαδόπουλος" /></FormField>
            <FormField label="Email" required><FieldInput type="email" value={form.email} onChange={f("email")} placeholder="user@example.com" /></FormField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Ρόλος" required>
              <FieldSelect value={form.roleId} onChange={setRoleId} options={roleIdOptions} />
            </FormField>
            <FormField label="Κατάσταση">
              <FieldSelect value={form.status} onChange={f("status")} options={statusOptions} />
            </FormField>
          </div>
          <FormField label="Εταιρεία">
            <FieldSelect value={form.companyId} onChange={f("companyId")} options={companyOptions} placeholder="— Καμία (Super Admin) —" />
          </FormField>
          <FormField label={editing ? "Νέος κωδικός (προαιρετικό)" : "Κωδικός"} required={!editing}>
            <FieldInput type="password" value={form.password} onChange={f("password")} placeholder={editing ? "Αφήστε κενό για να μην αλλάξει" : "Τουλάχιστον 6 χαρακτήρες"} />
          </FormField>
        </div>

        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </Modal>
    </div>
  );
}
