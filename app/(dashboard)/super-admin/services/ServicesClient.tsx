"use client";

import { useState, useTransition } from "react";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { createService, updateService, deleteService } from "@/app/actions/services";
import { RiCheckLine, RiLoaderLine, RiPencilLine, RiDeleteBinLine } from "react-icons/ri";

export const PRICING_MODELS = [
  { value: "PER_UNIT", label: "Ανά μονάδα / μήνα" },
  { value: "PER_BUILDING", label: "Ανά κτήριο / μήνα" },
  { value: "PER_COMMON_AREA", label: "Ανά κοινόχρηστο χώρο / μήνα" },
  { value: "FLAT", label: "Σταθερή / μήνα" },
  { value: "METERED_PREPAID", label: "Με μέτρηση + προαγορά" },
] as const;

const PRICING_LABEL: Record<string, string> = Object.fromEntries(PRICING_MODELS.map((p) => [p.value, p.label]));

type Service = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isCore: boolean;
  pricingModel: string;
  price: number;
  active: boolean;
};

function initForm() {
  return { name: "", code: "", description: "", isCore: "false", pricingModel: "PER_UNIT", price: "", active: "true" };
}

export function ServicesClient({ initial }: { initial: Service[] }) {
  const [data, setData] = useState<Service[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(initForm());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const f = (k: keyof ReturnType<typeof initForm>) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function openAdd() {
    setEditing(null); setForm(initForm()); setError(null); setOpen(true);
  }
  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name, code: s.code, description: s.description ?? "",
      isCore: String(s.isCore), pricingModel: s.pricingModel,
      price: String(s.price), active: String(s.active),
    });
    setError(null); setOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) { setError("Το όνομα είναι υποχρεωτικό"); return; }
    if (!form.code.trim()) { setError("Ο κωδικός είναι υποχρεωτικός"); return; }
    const price = parseFloat(form.price || "0");
    if (Number.isNaN(price) || price < 0) { setError("Μη έγκυρη τιμή"); return; }
    startTransition(async () => {
      const payload = {
        name: form.name, code: form.code, description: form.description || null,
        isCore: form.isCore === "true", pricingModel: form.pricingModel as Service["pricingModel"] as any,
        price, active: form.active === "true",
      };
      const res = editing ? await updateService(editing.id, payload) : await createService(payload);
      if ("error" in res && res.error) { setError(res.error); return; }
      const saved = (res as { service: Service }).service;
      setData((prev) => editing ? prev.map((x) => x.id === saved.id ? saved : x) : [saved, ...prev]);
      setOpen(false);
    });
  }

  function handleDelete(s: Service) {
    if (!confirm(`Διαγραφή υπηρεσίας «${s.name}»;`)) return;
    startTransition(async () => {
      const res = await deleteService(s.id);
      if ("error" in res && res.error) { alert(res.error); return; }
      setData((prev) => prev.filter((x) => x.id !== s.id));
    });
  }

  const columns: ColDef<Service>[] = [
    {
      id: "name", header: "Υπηρεσία", sortKey: "name", width: 240,
      accessor: (s) => `${s.name} ${s.code}`,
      cell: (s) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{s.name}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{s.code}</div>
        </div>
      ),
    },
    {
      id: "type", header: "Τύπος", sortKey: "isCore", width: 90,
      accessor: (s) => (s.isCore ? "CORE" : "Module"),
      cell: (s) => (
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
          background: s.isCore ? "#0078D418" : "#8764B818", color: s.isCore ? "#0078D4" : "#8764B8",
        }}>{s.isCore ? "CORE" : "Module"}</span>
      ),
    },
    {
      id: "pricing", header: "Χρέωση", sortKey: "pricingModel", width: 200,
      accessor: (s) => PRICING_LABEL[s.pricingModel] ?? s.pricingModel,
      cell: (s) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{PRICING_LABEL[s.pricingModel] ?? s.pricingModel}</span>,
    },
    {
      id: "price", header: "Τιμή (€)", sortKey: "price", width: 110,
      accessor: (s) => s.price,
      cell: (s) => <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>€ {s.price.toFixed(2)}</span>,
    },
    {
      id: "active", header: "Κατάσταση", sortKey: "active", width: 110,
      accessor: (s) => (s.active ? "Ενεργή" : "Ανενεργή"),
      cell: (s) => (
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
          background: s.active ? "#107C1018" : "#70707018", color: s.active ? "#107C10" : "#707070",
        }}>{s.active ? "Ενεργή" : "Ανενεργή"}</span>
      ),
    },
  ];

  const getRowActions = (_s: Service): RowAction<Service>[] => [
    { label: "Επεξεργασία", icon: <RiPencilLine />, onClick: openEdit },
    { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: handleDelete },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Υπηρεσίες</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
          Κατάλογος υπηρεσιών του παρόχου — {data.length} υπηρεσίες
        </p>
      </div>

      <DataTable
        data={data}
        columns={columns}
        totalRows={data.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="super-admin-services"
        searchPlaceholder="Αναζήτηση υπηρεσίας…"
        getRowActions={getRowActions}
        onAddNew={openAdd}
        addNewLabel="Νέα Υπηρεσία"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Επεξεργασία: ${editing.name}` : "Νέα Υπηρεσία"}
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
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <FormField label="Όνομα" required><FieldInput value={form.name} onChange={f("name")} placeholder="π.χ. Κοινόχρηστα" /></FormField>
            <FormField label="Κωδικός" required><FieldInput value={form.code} onChange={f("code")} placeholder="CORE / ASSEMBLY…" /></FormField>
          </div>
          <FormField label="Περιγραφή"><FieldTextarea value={form.description} onChange={f("description")} placeholder="Σύντομη περιγραφή" rows={2} /></FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Τύπος">
              <FieldSelect value={form.isCore} onChange={f("isCore")} options={[{ value: "false", label: "Module" }, { value: "true", label: "CORE" }]} />
            </FormField>
            <FormField label="Κατάσταση">
              <FieldSelect value={form.active} onChange={f("active")} options={[{ value: "true", label: "Ενεργή" }, { value: "false", label: "Ανενεργή" }]} />
            </FormField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <FormField label="Τρόπος χρέωσης" required>
              <FieldSelect value={form.pricingModel} onChange={f("pricingModel")} options={PRICING_MODELS.map((p) => ({ value: p.value, label: p.label }))} />
            </FormField>
            <FormField label="Τιμή (€/μήνα)" required><FieldInput type="number" value={form.price} onChange={f("price")} placeholder="0.00" /></FormField>
          </div>
        </div>

        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </Modal>
    </div>
  );
}
