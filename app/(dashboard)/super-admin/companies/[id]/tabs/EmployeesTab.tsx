"use client";

import { useState, useTransition } from "react";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput, FieldSelect } from "@/components/ui/modal";
import { UserCombo } from "@/components/ui/user-combo";
import { createEmployee, updateEmployee, deleteEmployee, type UserOption } from "@/app/actions/employees";
import { EMPLOYEE_ROLES } from "@/lib/roles-constants";
import { RiUserLine, RiPencilLine, RiDeleteBinLine, RiCheckLine, RiLoaderLine } from "react-icons/ri";

type Department = { id: string; name: string };
type JobPosition = { id: string; title: string; departmentId: string | null };

type Employee = {
  id: string;
  userId: string | null;
  user: { id: string; name: string | null; email: string } | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  employeeCode: string | null;
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED";
  hireDate: Date | null;
  terminationDate: Date | null;
  afm: string | null;
  amka: string | null;
  ikaNumber: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  departmentId: string | null;
  jobPositionId: string | null;
  department: { name: string } | null;
  jobPosition: { title: string } | null;
  createdAt: Date;
};

const STATUS_CONFIG = {
  ACTIVE:     { label: "Ενεργός",    color: "#16a34a" },
  INACTIVE:   { label: "Ανενεργός",  color: "#6b7280" },
  ON_LEAVE:   { label: "Άδεια",      color: "#ca5d00" },
  TERMINATED: { label: "Απόλυση",    color: "#c50f1f" },
};

function initForm() {
  return {
    userId: "",
    firstName: "", lastName: "", email: "", phone: "", mobile: "",
    employeeCode: "", departmentId: "", jobPositionId: "",
    hireDate: "", terminationDate: "", status: "ACTIVE" as Employee["status"],
    afm: "", amka: "", ikaNumber: "",
    address: "", city: "", postalCode: "",
  };
}

export function EmployeesTab({
  companyId,
  initial,
  departments,
  positions,
}: {
  companyId: string;
  initial: Employee[];
  departments: Department[];
  positions: JobPosition[];
}) {
  const [data, setData] = useState<Employee[]>(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(initForm());
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<"personal" | "employment" | "tax">("personal");

  // Filter positions by selected department
  const filteredPositions = form.departmentId
    ? positions.filter((p) => p.departmentId === form.departmentId)
    : positions;

  function f(key: keyof typeof form) {
    return (v: string) => setForm((p) => ({ ...p, [key]: v }));
  }

  function openAdd() {
    setEditing(null);
    setForm(initForm());
    setSelectedUser(null);
    setError(null);
    setModalTab("personal");
    setModalOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setSelectedUser(emp.user ? { ...emp.user, role: "" } : null);
    setForm({
      userId: emp.userId ?? "",
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email ?? "",
      phone: emp.phone ?? "",
      mobile: emp.mobile ?? "",
      employeeCode: emp.employeeCode ?? "",
      departmentId: emp.departmentId ?? "",
      jobPositionId: emp.jobPositionId ?? "",
      hireDate: emp.hireDate ? emp.hireDate.toISOString().slice(0, 10) : "",
      terminationDate: emp.terminationDate ? emp.terminationDate.toISOString().slice(0, 10) : "",
      status: emp.status,
      afm: emp.afm ?? "",
      amka: emp.amka ?? "",
      ikaNumber: emp.ikaNumber ?? "",
      address: emp.address ?? "",
      city: emp.city ?? "",
      postalCode: emp.postalCode ?? "",
    });
    setError(null);
    setModalTab("personal");
    setModalOpen(true);
  }

  function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Όνομα και επώνυμο είναι υποχρεωτικά");
      setModalTab("personal");
      return;
    }
    startTransition(async () => {
      try {
        const payload = {
          userId: form.userId || null,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email || null,
          phone: form.phone || null,
          mobile: form.mobile || null,
          employeeCode: form.employeeCode || null,
          departmentId: form.departmentId || null,
          jobPositionId: form.jobPositionId || null,
          hireDate: form.hireDate || null,
          terminationDate: form.terminationDate || null,
          status: form.status,
          afm: form.afm || null,
          amka: form.amka || null,
          ikaNumber: form.ikaNumber || null,
          address: form.address || null,
          city: form.city || null,
          postalCode: form.postalCode || null,
        };
        if (editing) {
          const res = await updateEmployee(editing.id, payload);
          setData((prev) => prev.map((e) => e.id === editing.id ? { ...e, ...res.employee } as Employee : e));
        } else {
          const res = await createEmployee(companyId, payload);
          setData((prev) => [...prev, res.employee as Employee]);
        }
        setModalOpen(false);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function handleDelete(emp: Employee) {
    if (!confirm(`Διαγραφή υπαλλήλου ${emp.firstName} ${emp.lastName};`)) return;
    startTransition(async () => {
      await deleteEmployee(emp.id);
      setData((prev) => prev.filter((e) => e.id !== emp.id));
    });
  }

  const columns: ColDef<Employee>[] = [
    {
      id: "name",
      header: "Υπάλληλος",
      sortKey: "lastName",
      width: 200,
      cell: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
            background: "var(--color-primary)18",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "var(--color-primary)",
          }}>
            {r.firstName[0]}{r.lastName[0]}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{r.firstName} {r.lastName}</div>
            {r.employeeCode && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>#{r.employeeCode}</div>}
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Κατάσταση",
      width: 110,
      cell: (r) => {
        const s = STATUS_CONFIG[r.status];
        return (
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: `${s.color}18`, color: s.color }}>
            {s.label}
          </span>
        );
      },
    },
    {
      id: "department",
      header: "Τμήμα",
      width: 160,
      cell: (r) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{r.department?.name ?? "—"}</span>,
    },
    {
      id: "position",
      header: "Θέση",
      width: 180,
      cell: (r) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{r.jobPosition?.title ?? "—"}</span>,
    },
    {
      id: "email",
      header: "Email",
      width: 200,
      cell: (r) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{r.email ?? "—"}</span>,
    },
    {
      id: "phone",
      header: "Τηλέφωνο",
      width: 130,
      defaultVisible: false,
      cell: (r) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{r.phone ?? r.mobile ?? "—"}</span>,
    },
    {
      id: "hireDate",
      header: "Ημ. Πρόσληψης",
      width: 130,
      defaultVisible: false,
      cell: (r) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{r.hireDate ? new Date(r.hireDate).toLocaleDateString("el-GR") : "—"}</span>,
    },
  ];

  const getRowActions = (r: Employee): RowAction<Employee>[] => [
    { label: "Επεξεργασία", icon: <RiPencilLine />, onClick: openEdit },
    { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: handleDelete },
  ];

  const tabStyle = (active: boolean) => ({
    padding: "6px 14px", borderRadius: 4, fontSize: 12, fontWeight: 600,
    border: "none", cursor: "pointer",
    background: active ? "var(--color-primary)" : "transparent",
    color: active ? "#fff" : "var(--muted-foreground)",
  } as React.CSSProperties);

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        totalRows={data.length}
        page={1}
        pageSize={50}
        clientSide
        storageKey="company-employees"
        searchPlaceholder="Αναζήτηση υπαλλήλου…"
        expandedContent={(r) => (
          <div style={{ padding: "14px 16px", background: "var(--bg-canvas)", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, fontSize: 12 }}>
            <div>
              <p style={{ fontWeight: 600, color: "var(--foreground)", margin: "0 0 4px" }}>Στοιχεία επικοινωνίας</p>
              <p style={{ color: "var(--muted-foreground)", margin: "2px 0" }}>Email: {r.email ?? "—"}</p>
              <p style={{ color: "var(--muted-foreground)", margin: "2px 0" }}>Τηλ: {r.phone ?? "—"}</p>
              <p style={{ color: "var(--muted-foreground)", margin: "2px 0" }}>Κινητό: {r.mobile ?? "—"}</p>
            </div>
            <div>
              <p style={{ fontWeight: 600, color: "var(--foreground)", margin: "0 0 4px" }}>Φορολογικά</p>
              <p style={{ color: "var(--muted-foreground)", margin: "2px 0" }}>ΑΦΜ: {r.afm ?? "—"}</p>
              <p style={{ color: "var(--muted-foreground)", margin: "2px 0" }}>ΑΜΚΑ: {r.amka ?? "—"}</p>
              <p style={{ color: "var(--muted-foreground)", margin: "2px 0" }}>ΙΚΑ: {r.ikaNumber ?? "—"}</p>
            </div>
            <div>
              <p style={{ fontWeight: 600, color: "var(--foreground)", margin: "0 0 4px" }}>Διεύθυνση</p>
              <p style={{ color: "var(--muted-foreground)", margin: "2px 0" }}>{r.address ?? "—"}</p>
              <p style={{ color: "var(--muted-foreground)", margin: "2px 0" }}>{r.city} {r.postalCode}</p>
            </div>
          </div>
        )}
        getRowActions={getRowActions}
        onAddNew={openAdd}
        addNewLabel="Νέος Υπάλληλος"
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `${editing.firstName} ${editing.lastName}` : "Νέος Υπάλληλος"}
        width={620}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" }}>Ακύρωση</button>
            <button onClick={handleSave} disabled={isPending} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: isPending ? "wait" : "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              {isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />}
              Αποθήκευση
            </button>
          </>
        }
      >
        {/* Mini tab bar inside modal */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, padding: "4px", background: "var(--bg-canvas)", borderRadius: 6, border: "1px solid var(--border)" }}>
          {(["personal", "employment", "tax"] as const).map((t) => (
            <button key={t} onClick={() => setModalTab(t)} style={tabStyle(modalTab === t)}>
              {{ personal: "Στοιχεία", employment: "Εργασία", tax: "Φορολογικά / Διεύθυνση" }[t]}
            </button>
          ))}
        </div>

        {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 12 }}>{error}</div>}

        {modalTab === "personal" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <FormField label="Σύνδεση με χρήστη εφαρμογής">
              <UserCombo
                selected={selectedUser}
                roles={EMPLOYEE_ROLES}
                onSelect={(u) => {
                  setSelectedUser(u);
                  if (u) {
                    const parts = (u.name ?? "").trim().split(/\s+/);
                    setForm((p) => ({
                      ...p,
                      userId: u.id,
                      firstName: parts[0] ?? p.firstName,
                      lastName: parts.slice(1).join(" ") || p.lastName,
                      email: u.email || p.email,
                    }));
                  } else {
                    setForm((p) => ({ ...p, userId: "" }));
                  }
                }}
              />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Όνομα" required><FieldInput value={form.firstName} onChange={f("firstName")} placeholder="Γιάννης" /></FormField>
              <FormField label="Επώνυμο" required><FieldInput value={form.lastName} onChange={f("lastName")} placeholder="Παπαδόπουλος" /></FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Email"><FieldInput type="email" value={form.email} onChange={f("email")} placeholder="email@example.com" /></FormField>
              <FormField label="Αριθμός υπαλλήλου"><FieldInput value={form.employeeCode} onChange={f("employeeCode")} placeholder="EMP-001" /></FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Τηλέφωνο"><FieldInput value={form.phone} onChange={f("phone")} placeholder="210 1234567" /></FormField>
              <FormField label="Κινητό"><FieldInput value={form.mobile} onChange={f("mobile")} placeholder="693 1234567" /></FormField>
            </div>
          </div>
        )}

        {modalTab === "employment" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Τμήμα">
                <FieldSelect value={form.departmentId} onChange={(v) => { f("departmentId")(v); f("jobPositionId")(""); }} options={departments.map((d) => ({ value: d.id, label: d.name }))} placeholder="— Επιλογή —" />
              </FormField>
              <FormField label="Θέση">
                <FieldSelect value={form.jobPositionId} onChange={f("jobPositionId")} options={filteredPositions.map((p) => ({ value: p.id, label: p.title }))} placeholder="— Επιλογή —" />
              </FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Κατάσταση">
                <FieldSelect value={form.status} onChange={(v) => setForm((p) => ({ ...p, status: v as Employee["status"] }))} options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} />
              </FormField>
              <FormField label="Ημ. Πρόσληψης"><FieldInput type="date" value={form.hireDate} onChange={f("hireDate")} /></FormField>
            </div>
            <FormField label="Ημ. Αποχώρησης"><FieldInput type="date" value={form.terminationDate} onChange={f("terminationDate")} /></FormField>
          </div>
        )}

        {modalTab === "tax" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <FormField label="ΑΦΜ"><FieldInput value={form.afm} onChange={f("afm")} placeholder="123456789" /></FormField>
              <FormField label="ΑΜΚΑ"><FieldInput value={form.amka} onChange={f("amka")} placeholder="01010099999" /></FormField>
              <FormField label="Αρ. ΙΚΑ"><FieldInput value={form.ikaNumber} onChange={f("ikaNumber")} /></FormField>
            </div>
            <FormField label="Διεύθυνση"><FieldInput value={form.address} onChange={f("address")} placeholder="Οδός 10" /></FormField>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <FormField label="Πόλη"><FieldInput value={form.city} onChange={f("city")} placeholder="Αθήνα" /></FormField>
              <FormField label="ΤΚ"><FieldInput value={form.postalCode} onChange={f("postalCode")} placeholder="10000" /></FormField>
            </div>
          </div>
        )}

        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </Modal>
    </>
  );
}
