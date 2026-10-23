"use client";

import { useState, useTransition } from "react";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { createService, updateService, deleteService } from "@/app/actions/services";
import { RiCheckLine, RiLoaderLine, RiPencilLine, RiDeleteBinLine } from "react-icons/ri";
import type { DistanceZone } from "@/lib/distance/zones";

export const PRICING_MODELS = [
  { value: "PER_UNIT", label: "Ανά μονάδα / μήνα" },
  { value: "PER_BUILDING", label: "Ανά κτήριο / μήνα" },
  { value: "PER_COMMON_AREA", label: "Ανά κοινόχρηστο χώρο / μήνα" },
  { value: "FLAT", label: "Σταθερή / μήνα" },
  { value: "METERED_PREPAID", label: "Με μέτρηση + προαγορά" },
  { value: "PER_ZONE", label: "Ανά ζώνη απόστασης / μήνα" },
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
  zonePrices: Record<string, number> | null;
};

function initForm() {
  return { name: "", code: "", description: "", isCore: "false", pricingModel: "PER_UNIT", price: "", active: "true" };
}

const eur = (n: number) => `${n.toLocaleString("el-GR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;

export function ServicesClient({ initial, zones }: { initial: Service[]; zones: DistanceZone[] }) {
  const [data, setData] = useState<Service[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(initForm());
  const [zonePrices, setZonePrices] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const f = (k: keyof ReturnType<typeof initForm>) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function openAdd() {
    setEditing(null); setForm(initForm()); setZonePrices({}); setError(null); setOpen(true);
  }
  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name, code: s.code, description: s.description ?? "",
      isCore: String(s.isCore), pricingModel: s.pricingModel,
      price: String(s.price), active: String(s.active),
    });
    setZonePrices(Object.fromEntries(Object.entries(s.zonePrices ?? {}).map(([k, v]) => [k, String(v)])));
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
        zonePrices: form.pricingModel === "PER_ZONE"
          ? Object.fromEntries(zones.map((z) => [z.code, parseFloat((zonePrices[z.code] ?? "0").replace(",", ".")) || 0]))
          : null,
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
          <div style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--foreground)" }}>{s.name}</div>
          <div style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)", fontFamily: "monospace" }}>{s.code}</div>
        </div>
      ),
    },
    {
      id: "type", header: "Τύπος", sortKey: "isCore", width: 90,
      accessor: (s) => (s.isCore ? "CORE" : "Module"),
      cell: (s) => (
        <span style={{
          fontSize: "var(--fs-11)", fontWeight: 600, padding: "2px 8px", borderRadius: 20,
          background: s.isCore ? "color-mix(in srgb, var(--color-info) 9%, transparent)" : "color-mix(in srgb, var(--color-purple) 9%, transparent)", color: s.isCore ? "var(--color-info)" : "var(--color-purple)",
        }}>{s.isCore ? "CORE" : "Module"}</span>
      ),
    },
    {
      id: "pricing", header: "Χρέωση", sortKey: "pricingModel", width: 200,
      accessor: (s) => PRICING_LABEL[s.pricingModel] ?? s.pricingModel,
      cell: (s) => (
        <span style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>
          {PRICING_LABEL[s.pricingModel] ?? s.pricingModel}
          {s.pricingModel === "PER_ZONE" && s.zonePrices && (
            <span style={{ display: "block", fontSize: "var(--fs-11)" }}>{zones.map((z) => `${z.label} ${eur(Number(s.zonePrices?.[z.code] ?? 0))}`).join(" · ")}</span>
          )}
        </span>
      ),
    },
    {
      id: "price", header: "Τιμή (€)", sortKey: "price", width: 110,
      accessor: (s) => s.price,
      cell: (s) => <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--foreground)" }}>€ {s.price.toFixed(2)}</span>,
    },
    {
      id: "active", header: "Κατάσταση", sortKey: "active", width: 110,
      accessor: (s) => (s.active ? "Ενεργή" : "Ανενεργή"),
      cell: (s) => (
        <span style={{
          fontSize: "var(--fs-11)", fontWeight: 600, padding: "2px 8px", borderRadius: 20,
          background: s.active ? "color-mix(in srgb, var(--color-success) 9%, transparent)" : "color-mix(in srgb, var(--muted-foreground) 9%, transparent)", color: s.active ? "var(--color-success)" : "var(--muted-foreground)",
        }}>{s.active ? "Ενεργή" : "Ανενεργή"}</span>
      ),
    },
  ];

  const getRowActions = (_s: Service): RowAction<Service>[] => [
    { label: "Επεξεργασία", icon: <RiPencilLine />, onClick: openEdit },
    { label: "Διαγραφή", icon: <RiDeleteBinLine />, danger: true, onClick: handleDelete },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h1 style={{ fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Υπηρεσίες</h1>
        <p style={{ fontSize: "var(--fs-13)", color: "var(--muted-foreground)", marginTop: 4 }}>
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
            <button onClick={() => setOpen(false)} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: "var(--fs-13)", color: "var(--foreground)" }}>Ακύρωση</button>
            <button onClick={handleSave} disabled={isPending} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: isPending ? "wait" : "pointer", fontSize: "var(--fs-13)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              {isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />}
              Αποθήκευση
            </button>
          </>
        }
      >
        {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--danger-soft)", color: "var(--color-danger)", fontSize: "var(--fs-12)", border: "1px solid var(--danger-soft)", marginBottom: 14 }}>{error}</div>}

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
            <FormField label={form.pricingModel === "PER_ZONE" ? "Βασική τιμή (€/μήνα)" : "Τιμή (€/μήνα)"} required><FieldInput type="number" value={form.price} onChange={f("price")} placeholder="0.00" /></FormField>
          </div>
          {form.pricingModel === "PER_ZONE" && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: "var(--fs-12)", fontWeight: 700, color: "var(--foreground)" }}>Ποσό ανά ζώνη (€/κτήριο/μήνα)</div>
              <div style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)" }}>Μηνιαίο ποσό = βασική τιμή + το ποσό της ζώνης κάθε κτηρίου του ακινήτου. Κτήρια χωρίς απόσταση δεν προσθέτουν ποσό. Οι ζώνες ορίζονται στις Ρυθμίσεις → Σταθμός βάσης & ζώνες.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                {zones.map((z) => (
                  <FormField key={z.code} label={`${z.label}${z.maxKm != null ? ` (έως ${z.maxKm} km)` : " (και άνω)"}`}>
                    <FieldInput type="number" value={zonePrices[z.code] ?? ""} onChange={(v) => setZonePrices((p) => ({ ...p, [z.code]: v }))} placeholder="0.00" />
                  </FormField>
                ))}
              </div>
            </div>
          )}
        </div>

        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </Modal>
    </div>
  );
}
