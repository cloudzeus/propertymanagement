"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { createBuildingExpense, previewExpenseAllocation } from "@/app/actions/building-expenses";

type UtilityType = "NONE" | "POWER" | "WATER" | "GAS";

export type ExtractedMeter = {
  meterType: "POWER" | "WATER" | "GAS" | null;
  meterNumber: string | null;
  unit: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  previousReading: number | null;
  currentReading: number | null;
  consumption: number | null;
} | null;

export type ExtractedDoc = {
  docType: "invoice" | "receipt" | "utility" | "tax" | "other";
  supplierName: string | null;
  supplierVat: string | null;
  supplierDoy: string | null;
  documentNumber: string | null;
  documentDate: string | null;
  netAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  suggestedCategoryCode: string | null;
  meter: ExtractedMeter;
  confidence: number;
};

export type CategorySplit = {
  category: {
    id: string;
    name: string;
    code: string;
    utilityType: UtilityType;
    defaultTenantPct: number;
    defaultOwnerPct: number;
  };
  override: unknown;
  effective: { tenantPct: number; ownerPct: number };
  isOverridden: boolean;
};

type AllocRow = {
  unitId: string;
  unitShare: number;
  tenantUserId: string | null;
  tenantAmount: number;
  ownerUserId: string | null;
  ownerAmount: number;
  missingWeight: boolean;
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function eur(n: number) {
  return `${n.toFixed(2)} €`;
}

export function ExpenseReviewForm({
  buildingId, fileId, fileUrl, extracted, categories, onDone,
}: {
  buildingId: string;
  fileId: string;
  fileUrl: string;
  extracted: ExtractedDoc;
  categories: CategorySplit[];
  onDone: () => void;
}) {
  const router = useRouter();

  const initialCat = useMemo(() => {
    if (extracted.suggestedCategoryCode) {
      const m = categories.find((c) => c.category.code === extracted.suggestedCategoryCode);
      if (m) return m;
    }
    return categories[0] ?? null;
  }, [categories, extracted.suggestedCategoryCode]);

  const [categoryId, setCategoryId] = useState<string>(initialCat?.category.id ?? "");
  const [supplierName, setSupplierName] = useState(extracted.supplierName ?? "");
  const [supplierVat, setSupplierVat] = useState(extracted.supplierVat ?? "");
  const [documentNumber, setDocumentNumber] = useState(extracted.documentNumber ?? "");
  const [documentDate, setDocumentDate] = useState(extracted.documentDate ?? "");
  const [netAmount, setNetAmount] = useState(extracted.netAmount != null ? String(extracted.netAmount) : "");
  const [vatAmount, setVatAmount] = useState(extracted.vatAmount != null ? String(extracted.vatAmount) : "");
  const [totalAmount, setTotalAmount] = useState(extracted.totalAmount != null ? String(extracted.totalAmount) : "");
  const [month, setMonth] = useState((extracted.documentDate ?? "").slice(0, 7) || currentMonth());
  const [description, setDescription] = useState("");
  const [tenantPct, setTenantPct] = useState<number>(initialCat?.effective.tenantPct ?? 0);

  // meter
  const [meterNumber, setMeterNumber] = useState(extracted.meter?.meterNumber ?? "");
  const [previousReading, setPreviousReading] = useState(extracted.meter?.previousReading != null ? String(extracted.meter.previousReading) : "");
  const [currentReading, setCurrentReading] = useState(extracted.meter?.currentReading != null ? String(extracted.meter.currentReading) : "");
  const [consumption, setConsumption] = useState(extracted.meter?.consumption != null ? String(extracted.meter.consumption) : "");
  const [meterUnit, setMeterUnit] = useState(extracted.meter?.unit ?? "");
  const [periodFrom, setPeriodFrom] = useState(extracted.meter?.periodFrom ?? "");
  const [periodTo, setPeriodTo] = useState(extracted.meter?.periodTo ?? "");

  const [preview, setPreview] = useState<AllocRow[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCat = categories.find((c) => c.category.id === categoryId) ?? null;
  const utilityType = selectedCat?.category.utilityType ?? "NONE";
  const ownerPct = 100 - tenantPct;

  // auto consumption = current - previous
  useEffect(() => {
    if (consumption.trim() !== "") return;
    const prev = num(previousReading);
    const cur = num(currentReading);
    if (prev != null && cur != null && cur - prev >= 0) {
      setConsumption(String(Math.round((cur - prev) * 1000) / 1000));
    }
  }, [previousReading, currentReading, consumption]);

  function onCategoryChange(id: string) {
    setCategoryId(id);
    const c = categories.find((x) => x.category.id === id);
    if (c) setTenantPct(c.effective.tenantPct);
  }

  // debounced allocation preview
  const total = num(totalAmount);
  useEffect(() => {
    if (total == null || total <= 0 || tenantPct < 0 || tenantPct > 100) {
      setPreview(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const rows = await previewExpenseAllocation(buildingId, { total, tenantPct, ownerPct, categoryId: categoryId || null, month: month || null });
        setPreview(rows as AllocRow[]);
      } catch {
        setPreview(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [buildingId, total, tenantPct, ownerPct, categoryId, month]);

  const isPdf = /\.pdf($|\?)/i.test(fileUrl);

  const conf = Math.round(extracted.confidence * 100);
  const confColor = extracted.confidence >= 0.8 ? "#16a34a" : extracted.confidence >= 0.5 ? "#d97706" : "#dc2626";

  async function submit() {
    setError(null);
    const totalVal = num(totalAmount);
    if (totalVal == null || totalVal <= 0) {
      setError("Συμπληρώστε έγκυρο σύνολο.");
      return;
    }
    if (!month.match(/^\d{4}-\d{2}$/)) {
      setError("Μη έγκυρος μήνας (YYYY-MM).");
      return;
    }
    const useMeter = utilityType !== "NONE";
    setPending(true);
    try {
      await createBuildingExpense(buildingId, {
        fileId,
        categoryId: categoryId || null,
        month,
        supplierName: supplierName || null,
        supplierVat: supplierVat || null,
        documentNumber: documentNumber || null,
        documentDate: documentDate || null,
        netAmount: num(netAmount),
        vatAmount: num(vatAmount),
        totalAmount: totalVal,
        description: description || null,
        tenantPct,
        ownerPct,
        ocrRaw: extracted,
        ocrConfidence: extracted.confidence,
        meter: useMeter
          ? {
              meterType: utilityType as "POWER" | "WATER" | "GAS",
              meterNumber: meterNumber || null,
              unit: meterUnit || null,
              periodFrom: periodFrom || null,
              periodTo: periodTo || null,
              previousReading: num(previousReading),
              currentReading: num(currentReading),
              consumption: num(consumption),
            }
          : null,
      });
      onDone();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Σφάλμα καταχώρησης.");
      setPending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* preview + confidence */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px", minWidth: 200, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--bg-canvas)" }}>
          {isPdf ? (
            <iframe src={fileUrl} className="w-full h-72" style={{ border: 0, width: "100%", height: 288 }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl} alt="παραστατικό" style={{ width: "100%", display: "block", maxHeight: 288, objectFit: "contain" }} />
          )}
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <span style={{
            display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
            color: confColor, background: `${confColor}18`, border: `1px solid ${confColor}44`,
          }}>
            Αξιοπιστία OCR: {conf}%
          </span>
        </div>
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: 6, background: "#FEE7E618", border: "1px solid var(--color-danger)", color: "var(--color-danger)", fontSize: 12 }}>
          {error}
        </div>
      )}

      <FormField label="Κατηγορία">
        <FieldSelect
          value={categoryId}
          onChange={onCategoryChange}
          options={categories.map((c) => ({ value: c.category.id, label: c.category.name }))}
          placeholder="— Επιλογή —"
        />
      </FormField>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormField label="Προμηθευτής">
          <FieldInput value={supplierName} onChange={setSupplierName} />
        </FormField>
        <FormField label="ΑΦΜ">
          <FieldInput value={supplierVat} onChange={setSupplierVat} />
        </FormField>
        <FormField label="Αρ. παραστατικού">
          <FieldInput value={documentNumber} onChange={setDocumentNumber} />
        </FormField>
        <FormField label="Ημ/νία παραστατικού">
          <FieldInput type="date" value={documentDate} onChange={setDocumentDate} />
        </FormField>
        <FormField label="Καθαρό (€)">
          <FieldInput type="number" value={netAmount} onChange={setNetAmount} />
        </FormField>
        <FormField label="ΦΠΑ (€)">
          <FieldInput type="number" value={vatAmount} onChange={setVatAmount} />
        </FormField>
        <FormField label="Σύνολο (€)" required>
          <FieldInput type="number" value={totalAmount} onChange={setTotalAmount} />
        </FormField>
        <FormField label="Μήνας χρέωσης" hint="YYYY-MM">
          <FieldInput type="month" value={month} onChange={setMonth} />
        </FormField>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormField label="Ποσοστό ενοικιαστή (%)">
          <FieldInput
            type="number"
            value={String(tenantPct)}
            onChange={(v) => setTenantPct(Math.max(0, Math.min(100, Math.round(Number(v) || 0))))}
          />
        </FormField>
        <FormField label="Ποσοστό ιδιοκτήτη (%)">
          <FieldInput type="number" value={String(ownerPct)} onChange={() => {}} disabled />
        </FormField>
      </div>

      <FormField label="Περιγραφή">
        <FieldTextarea value={description} onChange={setDescription} rows={2} />
      </FormField>

      {utilityType !== "NONE" && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>Μέτρηση παροχής</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Αρ. μετρητή">
              <FieldInput value={meterNumber} onChange={setMeterNumber} />
            </FormField>
            <FormField label="Μονάδα">
              <FieldInput value={meterUnit} onChange={setMeterUnit} />
            </FormField>
            <FormField label="Προηγ. ένδειξη">
              <FieldInput type="number" value={previousReading} onChange={setPreviousReading} />
            </FormField>
            <FormField label="Τρέχουσα ένδειξη">
              <FieldInput type="number" value={currentReading} onChange={setCurrentReading} />
            </FormField>
            <FormField label="Κατανάλωση">
              <FieldInput type="number" value={consumption} onChange={setConsumption} />
            </FormField>
            <div />
            <FormField label="Περίοδος από">
              <FieldInput type="date" value={periodFrom} onChange={setPeriodFrom} />
            </FormField>
            <FormField label="Περίοδος έως">
              <FieldInput type="date" value={periodTo} onChange={setPeriodTo} />
            </FormField>
          </div>
        </div>
      )}

      {preview && preview.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>
            Προεπισκόπηση επιμερισμού
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={pth}>Διαμέρισμα</th>
                <th style={{ ...pth, textAlign: "right" }}>Μερίδιο</th>
                <th style={{ ...pth, textAlign: "right" }}>Ενοικ.</th>
                <th style={{ ...pth, textAlign: "right" }}>Ιδιοκτ.</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r) => (
                <tr key={r.unitId}>
                  <td style={ptd}>
                    {r.unitId}
                    {r.missingWeight && (
                      <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 999, fontSize: 10, fontWeight: 700, color: "#d97706", background: "#d9770618", border: "1px solid #d9770644" }}>
                        χωρίς χιλιοστά
                      </span>
                    )}
                  </td>
                  <td style={{ ...ptd, textAlign: "right" }}>{eur(r.unitShare)}</td>
                  <td style={{ ...ptd, textAlign: "right" }}>{eur(r.tenantAmount)}</td>
                  <td style={{ ...ptd, textAlign: "right" }}>{eur(r.ownerAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onDone} disabled={pending} style={btnGhost}>Άκυρο</button>
        <button onClick={submit} disabled={pending} style={{ ...btnPrimary, opacity: pending ? 0.6 : 1, cursor: pending ? "not-allowed" : "pointer" }}>
          {pending ? "Καταχώρηση…" : "Καταχώρηση"}
        </button>
      </div>
    </div>
  );
}

const pth: React.CSSProperties = { textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", padding: "7px 12px", borderBottom: "1px solid var(--border)" };
const ptd: React.CSSProperties = { fontSize: 12, color: "var(--foreground)", padding: "7px 12px", borderBottom: "1px solid var(--border)" };
const btnGhost: React.CSSProperties = { height: 34, padding: "0 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-canvas)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--foreground)" };
const btnPrimary: React.CSSProperties = { height: 34, padding: "0 14px", borderRadius: 6, border: "1px solid var(--color-primary)", background: "var(--color-primary)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" };
