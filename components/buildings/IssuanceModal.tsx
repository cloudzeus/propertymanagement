"use client";

/**
 * «Έκδοση κοινοχρήστων»: pick the expenses that go into a month's issuance.
 * Used by the expenses panel (pre-selected rows) and by the building page's
 * «Ενέργειες» menu (nothing pre-selected). Same server action either way.
 */
import { useMemo, useState, useTransition } from "react";
import { RiCheckLine, RiLoaderLine, RiSecurePaymentLine } from "react-icons/ri";
import { Modal, FormField, FieldInput } from "@/components/ui/modal";
import { includeExpensesInIssuance, type ExpenseRowDTO } from "@/app/actions/building-expenses";

const fmtDate = (s: string | null) => { if (!s) return "—"; try { return new Date(s).toLocaleDateString("el-GR"); } catch { return "—"; } };
const eur = (n: number | null) => (n == null ? "—" : `${Number(n).toFixed(2)} €`);

export function IssuanceModal({ buildingId, expenses, initialSelected, onClose, onDone }: {
  buildingId: string;
  expenses: ExpenseRowDTO[];
  initialSelected?: Iterable<string>;
  onClose: () => void;
  onDone: (result: { count: number; month: string }) => void;
}) {
  const candidates = useMemo(() => expenses.filter((e) => e.status !== "ISSUED"), [expenses]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected ?? []));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allSelected = candidates.length > 0 && candidates.every((e) => selected.has(e.id));
  const total = candidates.filter((e) => selected.has(e.id)).reduce((s, e) => s + (e.amount ?? 0), 0);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function submit() {
    setError(null);
    if (!/^\d{4}-\d{2}$/.test(month)) { setError("Μη έγκυρος μήνας (YYYY-MM)."); return; }
    const ids = candidates.filter((e) => selected.has(e.id)).map((e) => e.id);
    if (!ids.length) { setError("Επιλέξτε τουλάχιστον ένα έξοδο."); return; }
    startTransition(async () => {
      try {
        const res = await includeExpensesInIssuance(buildingId, ids, month);
        onDone({ count: res.count, month });
      } catch (e) { setError(e instanceof Error ? e.message : "Σφάλμα"); }
    });
  }

  return (
    <Modal open onClose={onClose} title="Έκδοση κοινοχρήστων" width={680}
      footer={<>
        <button onClick={onClose} style={btnCancel}>Ακύρωση</button>
        <button onClick={submit} disabled={isPending || candidates.length === 0} style={btnSave}>
          {isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiSecurePaymentLine />} Συμπερίληψη σε έκδοση{selected.size ? ` (${selected.size})` : ""}
        </button>
      </>}>
      {error && <div style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, alignItems: "end" }}>
          <FormField label="Μήνας έκδοσης" required hint="YYYY-MM">
            <FieldInput type="month" value={month} onChange={setMonth} />
          </FormField>
          <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)", paddingBottom: 8 }}>
            Τα επιλεγμένα έξοδα θα μαρκαριστούν «Σε έκδοση {month}» και θα μπουν στα ειδοποιητήρια του μήνα.
            {selected.size > 0 && <> Σύνολο: <b style={{ color: "var(--foreground)" }}>{eur(total)}</b></>}
          </div>
        </div>

        {candidates.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted-foreground)", fontSize: "var(--fs-13)", border: "1px dashed var(--border-strong)", borderRadius: 8 }}>
            Δεν υπάρχουν έξοδα προς έκδοση — όλα έχουν ήδη συμπεριληφθεί. Καταχωρήστε πρώτα μια «Νέα δαπάνη».
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-13)" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: "var(--fs-11)" }}>
                <th style={{ padding: "6px 8px", width: 32 }}>
                  <input type="checkbox" checked={allSelected} aria-label="Επιλογή όλων"
                    onChange={() => setSelected(allSelected ? new Set() : new Set(candidates.map((e) => e.id)))} />
                </th>
                <th style={{ padding: "6px 8px" }}>Ημ/νία</th>
                <th style={{ padding: "6px 8px" }}>Προμηθευτής / περιγραφή</th>
                <th style={{ padding: "6px 8px" }}>Κατηγορία</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Ποσό</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((e) => (
                <tr key={e.id} onClick={() => toggle(e.id)} style={{ borderTop: "1px solid var(--border)", cursor: "pointer", background: selected.has(e.id) ? "color-mix(in srgb, var(--color-primary) 8%, transparent)" : undefined }}>
                  <td style={{ padding: "6px 8px" }}><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} onClick={(ev) => ev.stopPropagation()} /></td>
                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{fmtDate(e.documentDate ?? e.month)}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{e.supplierName ?? "—"}</div>
                    {e.description && <div style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)" }}>{e.description}</div>}
                  </td>
                  <td style={{ padding: "6px 8px", color: "var(--muted-foreground)" }}>{e.categoryName ?? "—"}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>{eur(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

const btnCancel: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: "var(--fs-13)", color: "var(--foreground)" };
const btnSave: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "#16a34a", color: "#fff", cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: "var(--fs-12)", marginBottom: 12 };
const _icon = RiCheckLine; void _icon;
