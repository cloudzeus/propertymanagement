"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormField, FieldInput, FieldTextarea } from "@/components/ui/modal";
import { saveSupplierService, deleteSupplierService, saveSupplierProduct, deleteSupplierProduct } from "@/app/actions/suppliers";
import { formatPrice, type CatalogItemDTO, type CatalogItemInput, type SupplierKind } from "@/lib/suppliers-shared";
import { RiAddLine, RiPencilLine, RiDeleteBinLine, RiCheckLine, RiLoaderLine, RiToolsLine, RiShoppingBag3Line, RiEyeOffLine } from "react-icons/ri";

type Kind = "service" | "product";

/** Services + products tables with add/edit/delete. Read-only when `canEdit` is false. */
export function CatalogEditor({ supplierId, kind, services, products, canEdit }: {
  supplierId: string;
  kind: SupplierKind;
  services: CatalogItemDTO[];
  products: CatalogItemDTO[];
  canEdit: boolean;
}) {
  const showServices = kind !== "PRODUCTS";
  const showProducts = kind !== "SERVICES";
  return (
    <div style={{ display: "grid", gridTemplateColumns: showServices && showProducts ? "1fr 1fr" : "1fr", gap: 16, alignItems: "start" }}>
      {showServices && <CatalogTable supplierId={supplierId} kind="service" items={services} canEdit={canEdit} />}
      {showProducts && <CatalogTable supplierId={supplierId} kind="product" items={products} canEdit={canEdit} />}
    </div>
  );
}

function CatalogTable({ supplierId, kind, items, canEdit }: { supplierId: string; kind: Kind; items: CatalogItemDTO[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CatalogItemDTO | null | "new">(null);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const isService = kind === "service";
  const Icon = isService ? RiToolsLine : RiShoppingBag3Line;

  function remove(item: CatalogItemDTO) {
    if (!confirm(`Διαγραφή «${item.name}»;`)) return;
    setErr(null);
    startTransition(async () => {
      const res = isService ? await deleteSupplierService(supplierId, item.id) : await deleteSupplierProduct(supplierId, item.id);
      if (res && "error" in res && res.error) { setErr(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
        <Icon style={{ color: "var(--color-primary)" }} />
        <b style={{ fontSize: 13, flex: 1 }}>{isService ? "Υπηρεσίες" : "Προϊόντα"} <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>({items.length})</span></b>
        {canEdit && <button onClick={() => setEditing("new")} style={smallBtn}><RiAddLine /> Προσθήκη</button>}
      </div>
      {err && <div style={errBox} role="alert">{err}</div>}
      {items.length === 0 ? (
        <div style={{ padding: 22, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>
          {isService ? "Δεν έχουν δηλωθεί υπηρεσίες." : "Δεν έχουν δηλωθεί προϊόντα."}
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11 }}>
            <th style={th}>{isService ? "Υπηρεσία" : "Προϊόν"}</th><th style={th}>Μονάδα</th><th style={{ ...th, textAlign: "right" }}>Τιμή (καθ.)</th><th style={{ ...th, textAlign: "right" }}>ΦΠΑ</th>{canEdit && <th style={th}></th>}
          </tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} style={{ borderTop: "1px solid var(--border)", opacity: it.active ? 1 : 0.55 }}>
                <td style={td}>
                  <b>{it.name}</b>{!it.active && <RiEyeOffLine title="Ανενεργό" style={{ marginLeft: 6, fontSize: 12, color: "var(--muted-foreground)" }} />}
                  {it.sku && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--muted-foreground)" }}>{it.sku}</span>}
                  {it.description && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{it.description}</div>}
                </td>
                <td style={td}>{it.unit ?? "—"}</td>
                <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatPrice(it.price)}</td>
                <td style={{ ...td, textAlign: "right" }}>{it.vatPct}%</td>
                {canEdit && (
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => setEditing(it)} style={iconBtn} title="Επεξεργασία"><RiPencilLine /></button>
                    <button onClick={() => remove(it)} disabled={isPending} style={{ ...iconBtn, color: "#c50f1f" }} title="Διαγραφή"><RiDeleteBinLine /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing !== null && (
        <ItemModal supplierId={supplierId} kind={kind} editing={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />
      )}
    </div>
  );
}

function ItemModal({ supplierId, kind, editing, onClose, onDone }: { supplierId: string; kind: Kind; editing: CatalogItemDTO | null; onClose: () => void; onDone: () => void }) {
  const isService = kind === "service";
  const [form, setForm] = useState({
    name: editing?.name ?? "", sku: editing?.sku ?? "", description: editing?.description ?? "", unit: editing?.unit ?? (isService ? "επίσκεψη" : "τεμ."),
    price: editing?.price != null ? String(editing.price) : "", vatPct: String(editing?.vatPct ?? 24),
  });
  const [active, setActive] = useState(editing?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function save() {
    setError(null);
    const payload: CatalogItemInput = {
      name: form.name, sku: form.sku, description: form.description, unit: form.unit,
      price: form.price.trim() ? Number(form.price.replace(",", ".")) : null, vatPct: Number(form.vatPct), active,
    };
    startTransition(async () => {
      const res = isService ? await saveSupplierService(supplierId, editing?.id ?? null, payload) : await saveSupplierProduct(supplierId, editing?.id ?? null, payload);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} width={480} title={editing ? `Επεξεργασία ${isService ? "υπηρεσίας" : "προϊόντος"}` : isService ? "Νέα υπηρεσία" : "Νέο προϊόν"}
      footer={<>
        <button onClick={onClose} style={cancelBtn}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={saveBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button>
      </>}>
      {error && <div style={errBox} role="alert">{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormField label="Όνομα" required><FieldInput value={form.name} onChange={f("name")} placeholder={isService ? "π.χ. Επισκευή θυροτηλεφώνου" : "π.χ. Λαμπτήρας LED 10W"} /></FormField>
        {!isService && <FormField label="Κωδικός (SKU)"><FieldInput value={form.sku} onChange={f("sku")} /></FormField>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <FormField label="Μονάδα"><FieldInput value={form.unit} onChange={f("unit")} placeholder={isService ? "επίσκεψη / ώρα" : "τεμ."} /></FormField>
          <FormField label="Τιμή καθαρή (€)"><FieldInput type="number" value={form.price} onChange={f("price")} placeholder="0.00" /></FormField>
          <FormField label="ΦΠΑ %"><FieldInput type="number" value={form.vatPct} onChange={f("vatPct")} /></FormField>
        </div>
        <FormField label="Περιγραφή"><FieldTextarea value={form.description} onChange={f("description")} rows={2} /></FormField>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ενεργό — εμφανίζεται στις προσφορές
        </label>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

const th: React.CSSProperties = { padding: "8px 14px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "9px 14px", color: "var(--foreground)", verticalAlign: "top" };
const smallBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: 5, marginLeft: 6, cursor: "pointer" };
const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { margin: 10, padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530" };
