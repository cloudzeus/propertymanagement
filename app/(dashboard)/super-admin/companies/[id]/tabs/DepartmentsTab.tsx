"use client";

import { useState, useTransition } from "react";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput, FieldTextarea } from "@/components/ui/modal";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/app/actions/departments";
import {
  RiBuildingLine,
  RiPencilLine,
  RiDeleteBinLine,
  RiCheckLine,
  RiCloseLine,
  RiLoaderLine,
} from "react-icons/ri";

type Department = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  _count: { positions: number; employees: number };
  createdAt: Date;
};

const EMPTY: Omit<Department, "id" | "_count" | "createdAt"> = {
  name: "",
  description: null,
  isActive: true,
  sortOrder: 0,
};

export function DepartmentsTab({
  companyId,
  initial,
}: {
  companyId: string;
  initial: Department[];
}) {
  const [data, setData] = useState<Department[]>(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: "", description: "", isActive: true });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", description: "", isActive: true });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(dept: Department) {
    setEditing(dept);
    setForm({ name: dept.name, description: dept.description ?? "", isActive: dept.isActive });
    setError(null);
    setModalOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) { setError("Το όνομα είναι υποχρεωτικό"); return; }
    startTransition(async () => {
      try {
        if (editing) {
          const res = await updateDepartment(editing.id, { name: form.name, description: form.description || undefined, isActive: form.isActive });
          setData((prev) => prev.map((d) => d.id === editing.id ? { ...d, ...res.department } : d));
        } else {
          const res = await createDepartment(companyId, { name: form.name, description: form.description || undefined });
          setData((prev) => [...prev, { ...res.department, _count: { positions: 0, employees: 0 } } as Department]);
        }
        setModalOpen(false);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function handleDelete(dept: Department) {
    if (!confirm(`Διαγραφή τμήματος "${dept.name}";`)) return;
    startTransition(async () => {
      await deleteDepartment(dept.id);
      setData((prev) => prev.filter((d) => d.id !== dept.id));
    });
  }

  const columns: ColDef<Department>[] = [
    {
      id: "name",
      header: "Τμήμα",
      sortKey: "name",
      width: 220,
      cell: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 6, flexShrink: 0,
            background: "var(--color-primary)18",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <RiBuildingLine style={{ fontSize: 14, color: "var(--color-primary)" }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{r.name}</span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Κατάσταση",
      width: 110,
      cell: (r) => (
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
          background: r.isActive ? "#16a34a18" : "#6b728018",
          color: r.isActive ? "#16a34a" : "#6b7280",
        }}>
          {r.isActive ? "Ενεργό" : "Ανενεργό"}
        </span>
      ),
    },
    {
      id: "positions",
      header: "Θέσεις",
      width: 90,
      cell: (r) => <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{r._count.positions}</span>,
    },
    {
      id: "employees",
      header: "Υπάλληλοι",
      width: 100,
      cell: (r) => <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{r._count.employees}</span>,
    },
    {
      id: "createdAt",
      header: "Δημιουργία",
      width: 120,
      defaultVisible: false,
      cell: (r) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{new Date(r.createdAt).toLocaleDateString("el-GR")}</span>,
    },
  ];

  const getRowActions = (r: Department): RowAction<Department>[] => [
    { label: "Επεξεργασία", icon: <RiPencilLine />, onClick: openEdit },
    { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: handleDelete },
  ];

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        totalRows={data.length}
        page={1}
        pageSize={50}
        clientSide
        storageKey="company-departments"
        searchPlaceholder="Αναζήτηση τμήματος…"
        expandedContent={(r) => (
          <div style={{ padding: "12px 16px", background: "var(--bg-canvas)", fontSize: 13 }}>
            {r.description
              ? <p style={{ margin: 0, color: "var(--foreground)" }}>{r.description}</p>
              : <p style={{ margin: 0, color: "var(--muted-foreground)" }}>Χωρίς περιγραφή</p>
            }
          </div>
        )}
        getRowActions={getRowActions}
        onAddNew={openAdd}
        addNewLabel="Νέο Τμήμα"
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Επεξεργασία Τμήματος" : "Νέο Τμήμα"}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} style={{
              padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)",
              background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)",
            }}>Ακύρωση</button>
            <button onClick={handleSave} disabled={isPending} style={{
              padding: "7px 16px", borderRadius: 6, border: "none",
              background: "var(--color-primary)", color: "#fff",
              cursor: isPending ? "wait" : "pointer", fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />}
              Αποθήκευση
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530" }}>
              {error}
            </div>
          )}
          <FormField label="Όνομα τμήματος" required>
            <FieldInput value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="π.χ. Τεχνικό Τμήμα" />
          </FormField>
          <FormField label="Περιγραφή">
            <FieldTextarea value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} placeholder="Σύντομη περιγραφή…" />
          </FormField>
          {editing && (
            <FormField label="Κατάσταση">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                Ενεργό τμήμα
              </label>
            </FormField>
          )}
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </Modal>
    </>
  );
}
