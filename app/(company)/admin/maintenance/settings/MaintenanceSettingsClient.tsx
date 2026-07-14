"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal, FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { saveCategory, deleteCategory, saveCoverageRule, deleteCoverageRule } from "@/app/actions/maintenance-requests";
import { RiAddLine, RiArrowLeftLine, RiDeleteBinLine, RiEditLine, RiShieldCheckLine, RiPriceTag3Line } from "react-icons/ri";

type Category = { id: string; name: string; icon: string | null; active: boolean; sortOrder: number; slaHours: number | null; companyResponsible: boolean };
type Rule = { id: string; propertyId: string | null; propertyName: string | null; categoryId: string | null; categoryName: string | null; elementLabel: string | null; covered: boolean; quantityLimit: number | null; periodMonths: number | null; notes: string | null };
type PropertyOpt = { id: string; name: string };

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18 };
const btn: React.CSSProperties = { height: 32, padding: "0 12px", border: "1px solid var(--border)", background: "var(--paper)", borderRadius: "var(--radius-sm)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "var(--foreground)", display: "inline-flex", alignItems: "center", gap: 6 };
const btnPrimary: React.CSSProperties = { ...btn, background: "var(--primary)", color: "var(--primary-foreground)", border: "none" };
const th: React.CSSProperties = { textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "var(--muted-foreground)", padding: "8px 10px", borderBottom: "1px solid var(--border)" };
const td: React.CSSProperties = { fontSize: 13, color: "var(--foreground)", padding: "8px 10px", borderBottom: "1px solid var(--border)" };

export function MaintenanceSettingsClient({ categories, rules, properties }: {
  categories: Category[]; rules: Rule[]; properties: PropertyOpt[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Category modal
  const [catOpen, setCatOpen] = useState(false);
  const [catId, setCatId] = useState<string | null>(null);
  const [cat, setCat] = useState({ name: "", slaHours: "", companyResponsible: false, active: true, sortOrder: "0" });

  // Rule modal
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [rule, setRule] = useState({ propertyId: "", categoryId: "", elementLabel: "", covered: true, quantityLimit: "", periodMonths: "", notes: "" });

  async function run(fn: () => Promise<{ error?: string } | any>) {
    setBusy(true); setError(null);
    const res = await fn();
    setBusy(false);
    if (res?.error) { setError(res.error); return false; }
    router.refresh();
    return true;
  }

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
      <Link href="/admin/maintenance" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted-foreground)", textDecoration: "none" }}>
        <RiArrowLeftLine /> Πίσω στις βλάβες
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Ρυθμίσεις βλαβών</h1>
      {error && <div style={{ color: "var(--destructive)", fontSize: 13 }}>{error}</div>}

      {/* Categories */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: 0, flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
            <RiPriceTag3Line /> Κατηγορίες βλαβών
          </h2>
          <button style={btnPrimary} onClick={() => { setCatId(null); setCat({ name: "", slaHours: "", companyResponsible: false, active: true, sortOrder: "0" }); setCatOpen(true); }}>
            <RiAddLine /> Νέα κατηγορία
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Όνομα</th><th style={th}>SLA (ώρες)</th><th style={th}>Ευθύνη εταιρίας</th><th style={th}>Ενεργή</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.name}</td>
                <td style={td}>{c.slaHours ?? "—"}</td>
                <td style={td}>{c.companyResponsible ? "Ναι" : "Όχι"}</td>
                <td style={td}>{c.active ? "Ναι" : "Όχι"}</td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  <button style={btn} onClick={() => { setCatId(c.id); setCat({ name: c.name, slaHours: c.slaHours ? String(c.slaHours) : "", companyResponsible: c.companyResponsible, active: c.active, sortOrder: String(c.sortOrder) }); setCatOpen(true); }}><RiEditLine /></button>{" "}
                  <button style={{ ...btn, color: "var(--destructive)" }} disabled={busy} onClick={() => run(() => deleteCategory(c.id))}><RiDeleteBinLine /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Coverage rules */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: 0, flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
            <RiShieldCheckLine /> Κανόνες κάλυψης managed συμβολαίων
          </h2>
          <button style={btnPrimary} onClick={() => { setRuleId(null); setRule({ propertyId: "", categoryId: "", elementLabel: "", covered: true, quantityLimit: "", periodMonths: "", notes: "" }); setRuleOpen(true); }}>
            <RiAddLine /> Νέος κανόνας
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 0 }}>
          Ορίστε τι αναλαμβάνει η εταιρία σε managed ακίνητα: ανά κατηγορία ή/και ποσοτικά (όριο επιλύσεων ανά περίοδο).
          Κανόνας χωρίς ακίνητο ισχύει ως γενικός για όλα τα managed ακίνητα.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Ακίνητο</th><th style={th}>Κατηγορία</th><th style={th}>Στοιχείο</th><th style={th}>Κάλυψη</th><th style={th}>Όριο</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {rules.length === 0 && <tr><td style={td} colSpan={6}>Δεν υπάρχουν κανόνες — ισχύουν τα defaults των κατηγοριών.</td></tr>}
            {rules.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.propertyName ?? "Όλα (γενικός)"}</td>
                <td style={td}>{r.categoryName ?? "Όλες"}</td>
                <td style={td}>{r.elementLabel ?? "—"}</td>
                <td style={td}>{r.covered ? "Εταιρία" : "Διαχειριστής"}</td>
                <td style={td}>{r.quantityLimit ? `${r.quantityLimit} / ${r.periodMonths ?? 12} μήνες` : "—"}</td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  <button style={btn} onClick={() => { setRuleId(r.id); setRule({ propertyId: r.propertyId ?? "", categoryId: r.categoryId ?? "", elementLabel: r.elementLabel ?? "", covered: r.covered, quantityLimit: r.quantityLimit ? String(r.quantityLimit) : "", periodMonths: r.periodMonths ? String(r.periodMonths) : "", notes: r.notes ?? "" }); setRuleOpen(true); }}><RiEditLine /></button>{" "}
                  <button style={{ ...btn, color: "var(--destructive)" }} disabled={busy} onClick={() => run(() => deleteCoverageRule(r.id))}><RiDeleteBinLine /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Category modal */}
      <Modal open={catOpen} onClose={() => setCatOpen(false)} title={catId ? "Επεξεργασία κατηγορίας" : "Νέα κατηγορία"}
        footer={<>
          <button style={btn} onClick={() => setCatOpen(false)}>Άκυρο</button>
          <button style={btnPrimary} disabled={busy} onClick={async () => {
            if (await run(() => saveCategory(catId, { name: cat.name, slaHours: cat.slaHours ? Number(cat.slaHours) : null, companyResponsible: cat.companyResponsible, active: cat.active, sortOrder: Number(cat.sortOrder) || 0 }))) setCatOpen(false);
          }}>Αποθήκευση</button>
        </>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FormField label="Όνομα" required><FieldInput value={cat.name} onChange={(v) => setCat({ ...cat, name: v })} /></FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="SLA (ώρες)" hint="Κενό = χωρίς SLA"><FieldInput type="number" value={cat.slaHours} onChange={(v) => setCat({ ...cat, slaHours: v })} /></FormField>
            <FormField label="Σειρά"><FieldInput type="number" value={cat.sortOrder} onChange={(v) => setCat({ ...cat, sortOrder: v })} /></FormField>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)" }}>
            <input type="checkbox" checked={cat.companyResponsible} onChange={(e) => setCat({ ...cat, companyResponsible: e.target.checked })} />
            Καλύπτεται από την εταιρία σε managed ακίνητα (default)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)" }}>
            <input type="checkbox" checked={cat.active} onChange={(e) => setCat({ ...cat, active: e.target.checked })} />
            Ενεργή
          </label>
        </div>
      </Modal>

      {/* Rule modal */}
      <Modal open={ruleOpen} onClose={() => setRuleOpen(false)} title={ruleId ? "Επεξεργασία κανόνα" : "Νέος κανόνας κάλυψης"} width={560}
        footer={<>
          <button style={btn} onClick={() => setRuleOpen(false)}>Άκυρο</button>
          <button style={btnPrimary} disabled={busy} onClick={async () => {
            if (await run(() => saveCoverageRule(ruleId, { propertyId: rule.propertyId || null, categoryId: rule.categoryId || null, elementLabel: rule.elementLabel || null, covered: rule.covered, quantityLimit: rule.quantityLimit ? Number(rule.quantityLimit) : null, periodMonths: rule.periodMonths ? Number(rule.periodMonths) : null, notes: rule.notes || null }))) setRuleOpen(false);
          }}>Αποθήκευση</button>
        </>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Ακίνητο" hint="Κενό = γενικός κανόνας">
              <FieldSelect value={rule.propertyId} onChange={(v) => setRule({ ...rule, propertyId: v })} placeholder="Όλα τα managed"
                options={properties.map((p) => ({ value: p.id, label: p.name }))} />
            </FormField>
            <FormField label="Κατηγορία" hint="Κενό = όλες">
              <FieldSelect value={rule.categoryId} onChange={(v) => setRule({ ...rule, categoryId: v })} placeholder="Όλες"
                options={categories.filter((c) => c.active).map((c) => ({ value: c.id, label: c.name }))} />
            </FormField>
          </div>
          <FormField label="Στοιχείο εξοπλισμού (προαιρετικά)" hint="π.χ. Κοινόχρηστα φώτα">
            <FieldInput value={rule.elementLabel} onChange={(v) => setRule({ ...rule, elementLabel: v })} />
          </FormField>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)" }}>
            <input type="checkbox" checked={rule.covered} onChange={(e) => setRule({ ...rule, covered: e.target.checked })} />
            Η επίλυση καλύπτεται από την εταιρία
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Ποσοτικό όριο" hint="Κενό = απεριόριστο">
              <FieldInput type="number" value={rule.quantityLimit} onChange={(v) => setRule({ ...rule, quantityLimit: v })} />
            </FormField>
            <FormField label="Περίοδος (μήνες)" hint="Default 12">
              <FieldInput type="number" value={rule.periodMonths} onChange={(v) => setRule({ ...rule, periodMonths: v })} />
            </FormField>
          </div>
          <FormField label="Σημειώσεις"><FieldTextarea value={rule.notes} onChange={(v) => setRule({ ...rule, notes: v })} rows={2} /></FormField>
        </div>
      </Modal>
    </div>
  );
}
