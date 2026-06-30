"use client";

import { useState, useTransition } from "react";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { createJobPosition, updateJobPosition, deleteJobPosition } from "@/app/actions/job-positions";
import { RiBriefcaseLine, RiPencilLine, RiDeleteBinLine, RiCheckLine, RiLoaderLine } from "react-icons/ri";

type Department = { id: string; name: string };
type JobPosition = {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  isActive: boolean;
  departmentId: string | null;
  department: { name: string } | null;
  _count: { employees: number };
  createdAt: Date;
};

const LEVELS = ["Junior", "Senior", "Manager", "Director", "Executive"];

export function PositionsTab({
  companyId,
  initial,
  departments,
}: {
  companyId: string;
  initial: JobPosition[];
  departments: Department[];
}) {
  const [data, setData] = useState<JobPosition[]>(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JobPosition | null>(null);
  const [form, setForm] = useState({ title: "", description: "", level: "", departmentId: "", isActive: true });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setForm({ title: "", description: "", level: "", departmentId: "", isActive: true });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(pos: JobPosition) {
    setEditing(pos);
    setForm({
      title: pos.title,
      description: pos.description ?? "",
      level: pos.level ?? "",
      departmentId: pos.departmentId ?? "",
      isActive: pos.isActive,
    });
    setError(null);
    setModalOpen(true);
  }

  function handleSave() {
    if (!form.title.trim()) { setError("Ο τίτλος είναι υποχρεωτικός"); return; }
    startTransition(async () => {
      try {
        const payload = {
          title: form.title,
          description: form.description || undefined,
          level: form.level || undefined,
          departmentId: form.departmentId || null,
          isActive: form.isActive,
        };
        if (editing) {
          const res = await updateJobPosition(editing.id, payload);
          setData((prev) => prev.map((p) => p.id === editing.id ? { ...p, ...res.position } as JobPosition : p));
        } else {
          const res = await createJobPosition(companyId, payload);
          setData((prev) => [...prev, { ...res.position, _count: { employees: 0 } } as JobPosition]);
        }
        setModalOpen(false);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function handleDelete(pos: JobPosition) {
    if (!confirm(`Διαγραφή θέσης "${pos.title}";`)) return;
    startTransition(async () => {
      await deleteJobPosition(pos.id);
      setData((prev) => prev.filter((p) => p.id !== pos.id));
    });
  }

  const levelColor: Record<string, string> = {
    Junior: "#0078D4", Senior: "#8764B8", Manager: "#CA5D00", Director: "#C50F1F", Executive: "#107C10",
  };

  const columns: ColDef<JobPosition>[] = [
    {
      id: "title",
      header: "Θέση",
      sortKey: "title",
      width: 220,
      cell: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RiBriefcaseLine style={{ fontSize: 16, color: "var(--color-primary)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{r.title}</span>
        </div>
      ),
    },
    {
      id: "level",
      header: "Επίπεδο",
      width: 110,
      cell: (r) => r.level ? (
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
          background: `${levelColor[r.level] || "#6b7280"}18`,
          color: levelColor[r.level] || "#6b7280",
        }}>{r.level}</span>
      ) : <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>—</span>,
    },
    {
      id: "department",
      header: "Τμήμα",
      width: 180,
      cell: (r) => <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{r.department?.name ?? "—"}</span>,
    },
    {
      id: "employees",
      header: "Υπάλληλοι",
      width: 100,
      cell: (r) => <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{r._count.employees}</span>,
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
        }}>{r.isActive ? "Ενεργή" : "Ανενεργή"}</span>
      ),
    },
  ];

  const getRowActions = (r: JobPosition): RowAction<JobPosition>[] => [
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
        storageKey="company-positions"
        searchPlaceholder="Αναζήτηση θέσης…"
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
        addNewLabel="Νέα Θέση"
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Επεξεργασία Θέσης" : "Νέα Θέση Εργασίας"}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530" }}>{error}</div>}
          <FormField label="Τίτλος θέσης" required>
            <FieldInput value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} placeholder="π.χ. Υπεύθυνος Συντήρησης" />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Τμήμα">
              <FieldSelect
                value={form.departmentId}
                onChange={(v) => setForm((p) => ({ ...p, departmentId: v }))}
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
                placeholder="— Επιλογή —"
              />
            </FormField>
            <FormField label="Επίπεδο">
              <FieldSelect
                value={form.level}
                onChange={(v) => setForm((p) => ({ ...p, level: v }))}
                options={LEVELS.map((l) => ({ value: l, label: l }))}
                placeholder="— Επιλογή —"
              />
            </FormField>
          </div>
          <FormField label="Περιγραφή">
            <FieldTextarea value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} placeholder="Αρμοδιότητες…" />
          </FormField>
          {editing && (
            <FormField label="Κατάσταση">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
                Ενεργή θέση
              </label>
            </FormField>
          )}
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </Modal>
    </>
  );
}
