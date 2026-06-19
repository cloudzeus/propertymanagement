"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RiLoaderLine, RiUpload2Line, RiFileTextLine } from "react-icons/ri";
import { Modal } from "@/components/ui/modal";
import { type CategorySplit } from "./ExpenseReviewForm";
import { updateBuildingExpense, uploadExpensePayment, type ExpenseRowDTO, type PaymentMethod } from "@/app/actions/building-expenses";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CARD", label: "Πιστωτική / Χρεωστική κάρτα" },
  { value: "CASH", label: "Μετρητά" },
  { value: "VIVA", label: "Viva" },
  { value: "BANK_TRANSFER", label: "Τραπεζική μεταφορά" },
  { value: "CHECK", label: "Επιταγή" },
  { value: "OTHER", label: "Άλλο" },
];

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 3, display: "block" };
const inp: React.CSSProperties = { width: "100%", height: 34, padding: "0 10px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "var(--bg-canvas)", fontSize: 13 };

export function ExpenseEditModal({
  open, onClose, expense, categories,
}: {
  open: boolean; onClose: () => void; expense: ExpenseRowDTO; categories: CategorySplit[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payRef = useRef<HTMLInputElement>(null);
  const [payUrl, setPayUrl] = useState<string | null>(expense.paymentUrl);
  const [uploadingPay, setUploadingPay] = useState(false);

  const [f, setF] = useState({
    categoryId: expense.categoryId ?? "",
    month: expense.month,
    supplierName: expense.supplierName ?? "",
    supplierVat: expense.supplierVat ?? "",
    documentNumber: expense.documentNumber ?? "",
    documentDate: expense.documentDate ? expense.documentDate.slice(0, 10) : "",
    netAmount: expense.netAmount?.toString() ?? "",
    vatAmount: expense.vatAmount?.toString() ?? "",
    totalAmount: expense.amount.toString(),
    description: expense.description ?? "",
    tenantPct: expense.tenantPct,
    paid: expense.paid,
    paymentMethod: (expense.paymentMethod as PaymentMethod | null) ?? "",
    paidAt: expense.paidAt ? expense.paidAt.slice(0, 10) : "",
  });
  const set = (k: keyof typeof f, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  const cat = categories.find((c) => c.category.id === f.categoryId);
  const isUtility = !!cat && cat.category.utilityType !== "NONE";
  const ownerPct = 100 - f.tenantPct;

  const [meter, setMeter] = useState({
    meterNumber: expense.meter?.meterNumber ?? "",
    previousReading: expense.meter?.previousReading?.toString() ?? "",
    currentReading: expense.meter?.currentReading?.toString() ?? "",
    consumption: expense.meter?.consumption?.toString() ?? "",
    unit: expense.meter?.unit ?? "",
    periodFrom: expense.meter?.periodFrom ? expense.meter.periodFrom.slice(0, 10) : "",
    periodTo: expense.meter?.periodTo ? expense.meter.periodTo.slice(0, 10) : "",
  });
  const setM = (k: keyof typeof meter, v: string) => setMeter((s) => ({ ...s, [k]: v }));

  function onCategoryChange(id: string) {
    set("categoryId", id);
    const c = categories.find((x) => x.category.id === id);
    if (c) set("tenantPct", c.effective.tenantPct);
  }

  const numOrNull = (s: string) => { const n = parseFloat(s.replace(",", ".")); return isNaN(n) ? null : n; };

  async function handlePayFile(file: File | null | undefined) {
    if (!file) return;
    setError(null);
    setUploadingPay(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadExpensePayment(expense.id, fd);
      setPayUrl(res.url);
      set("paid", true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Αποτυχία ανεβάσματος απόδειξης.");
    } finally {
      setUploadingPay(false);
    }
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const meterType = cat?.category.utilityType;
      await updateBuildingExpense(expense.id, {
        categoryId: f.categoryId || null,
        month: f.month,
        supplierName: f.supplierName || null,
        supplierVat: f.supplierVat || null,
        documentNumber: f.documentNumber || null,
        documentDate: f.documentDate || null,
        netAmount: numOrNull(f.netAmount),
        vatAmount: numOrNull(f.vatAmount),
        totalAmount: numOrNull(f.totalAmount) ?? 0,
        description: f.description || null,
        tenantPct: f.tenantPct, ownerPct,
        paid: f.paid,
        paymentMethod: f.paid ? ((f.paymentMethod || null) as PaymentMethod | null) : null,
        paidAt: f.paid ? (f.paidAt || null) : null,
        meter: isUtility && (meterType === "POWER" || meterType === "WATER" || meterType === "GAS")
          ? {
              meterType, meterNumber: meter.meterNumber || null, unit: meter.unit || null,
              periodFrom: meter.periodFrom || null, periodTo: meter.periodTo || null,
              previousReading: numOrNull(meter.previousReading), currentReading: numOrNull(meter.currentReading),
              consumption: numOrNull(meter.consumption),
            }
          : null,
      });
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Αποτυχία αποθήκευσης.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Επεξεργασία εξόδου" width={620}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {error && <div style={{ padding: 10, borderRadius: 6, background: "color-mix(in srgb, var(--color-danger) 12%, transparent)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", fontSize: 12 }}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>Κατηγορία</label>
            <select value={f.categoryId} onChange={(e) => onCategoryChange(e.target.value)} style={inp as React.CSSProperties}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.category.id} value={c.category.id}>{c.category.name}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Μήνας (YYYY-MM)</label><input value={f.month} onChange={(e) => set("month", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Προμηθευτής</label><input value={f.supplierName} onChange={(e) => set("supplierName", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>ΑΦΜ</label><input value={f.supplierVat} onChange={(e) => set("supplierVat", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Αρ. παραστατικού</label><input value={f.documentNumber} onChange={(e) => set("documentNumber", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Ημ/νία παραστατικού</label><input type="date" value={f.documentDate} onChange={(e) => set("documentDate", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Καθαρή αξία (€)</label><input value={f.netAmount} onChange={(e) => set("netAmount", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>ΦΠΑ (€)</label><input value={f.vatAmount} onChange={(e) => set("vatAmount", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Σύνολο (€)</label><input value={f.totalAmount} onChange={(e) => set("totalAmount", e.target.value)} style={inp} /></div>
          <div>
            <label style={lbl}>Επιμερισμός — Ενοικιαστής %</label>
            <input type="number" min={0} max={100} value={f.tenantPct} onChange={(e) => set("tenantPct", Math.max(0, Math.min(100, Number(e.target.value))))} style={inp} />
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Ιδιοκτήτης: {ownerPct}%</span>
          </div>
        </div>

        <div><label style={lbl}>Περιγραφή</label><input value={f.description} onChange={(e) => set("description", e.target.value)} style={inp} /></div>

        {isUtility && (
          <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
            <legend style={{ fontSize: 12, fontWeight: 600, padding: "0 6px" }}>Ένδειξη μετρητή</legend>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div><label style={lbl}>Αρ. μετρητή</label><input value={meter.meterNumber} onChange={(e) => setM("meterNumber", e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Μονάδα</label><input value={meter.unit} onChange={(e) => setM("unit", e.target.value)} style={inp} placeholder="kWh / m³" /></div>
              <div><label style={lbl}>Κατανάλωση</label><input value={meter.consumption} onChange={(e) => setM("consumption", e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Προηγ. ένδειξη</label><input value={meter.previousReading} onChange={(e) => setM("previousReading", e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Τρέχ. ένδειξη</label><input value={meter.currentReading} onChange={(e) => setM("currentReading", e.target.value)} style={inp} /></div>
              <div />
              <div><label style={lbl}>Περίοδος από</label><input type="date" value={meter.periodFrom} onChange={(e) => setM("periodFrom", e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Περίοδος έως</label><input type="date" value={meter.periodTo} onChange={(e) => setM("periodTo", e.target.value)} style={inp} /></div>
            </div>
          </fieldset>
        )}

        <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
          <legend style={{ fontSize: 12, fontWeight: 600, padding: "0 6px" }}>Πληρωμή</legend>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 8 }}>
            <input type="checkbox" checked={f.paid} onChange={(e) => set("paid", e.target.checked)} /> Πληρώθηκε
          </label>
          {f.paid && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div>
                <label style={lbl}>Τρόπος πληρωμής</label>
                <select value={f.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} style={inp as React.CSSProperties}>
                  <option value="">—</option>
                  {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Ημ/νία πληρωμής</label><input type="date" value={f.paidAt} onChange={(e) => set("paidAt", e.target.value)} style={inp} /></div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" onClick={() => payRef.current?.click()} disabled={uploadingPay} style={btnGhost}>
              {uploadingPay ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiUpload2Line />} Απόδειξη πληρωμής
            </button>
            {payUrl && <a href={payUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--color-primary)", display: "inline-flex", alignItems: "center", gap: 4 }}><RiFileTextLine /> Προβολή</a>}
            <input ref={payRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => handlePayFile(e.target.files?.[0])} />
          </div>
        </fieldset>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={btnGhost}>Άκυρο</button>
          <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "Αποθήκευση…" : "Αποθήκευση"}</button>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 16px", borderRadius: 6, border: "1px solid var(--color-primary)", background: "var(--color-primary)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "var(--bg-canvas)", color: "var(--foreground)", fontSize: 13, cursor: "pointer" };
