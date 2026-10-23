"use client";

import { useMemo, useState } from "react";
import { FieldInput, FieldSelect } from "@/components/ui/modal";
import { filterCandidates, type RfqCandidateDTO } from "@/lib/rfq-shared";
import { RiStarFill, RiMapPin2Line, RiUserFollowLine, RiMailLine, RiAlertLine, RiFlashlightLine } from "react-icons/ri";

const KM_OPTIONS = [{ value: "", label: "Όλες οι αποστάσεις" }, { value: "5", label: "έως 5 km" }, { value: "10", label: "έως 10 km" }, { value: "25", label: "έως 25 km" }, { value: "50", label: "έως 50 km" }];
const RATING_OPTIONS = [{ value: "", label: "Κάθε βαθμολογία" }, { value: "3", label: "3★ και άνω" }, { value: "4", label: "4★ και άνω" }, { value: "4.5", label: "4,5★ και άνω" }];

/**
 * Pick registry suppliers for an RFQ. Rows arrive ranked (continuity, specialty,
 * rating, proximity); the filters narrow them by category, distance, rating,
 * account and name. Each row shows where the invitation e-mail would go.
 */
export function RfqSupplierPicker({ candidates, categories, defaultCategoryId, selected, onChange, excludeIds = [] }: {
  candidates: RfqCandidateDTO[]; categories: { id: string; name: string }[]; defaultCategoryId: string | null;
  selected: Set<string>; onChange: (s: Set<string>) => void; excludeIds?: string[];
}) {
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");
  const [km, setKm] = useState("");
  const [rating, setRating] = useState("");
  const [withAccount, setWithAccount] = useState(false);
  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const rows = useMemo(
    () => filterCandidates(candidates.filter((c) => !excluded.has(c.id)), { q, categoryId: categoryId || null, maxKm: km ? Number(km) : null, minRating: rating ? Number(rating) : null, withAccount }),
    [candidates, excluded, q, categoryId, km, rating, withAccount],
  );
  const toggle = (id: string, on: boolean) => { const n = new Set(selected); if (on) n.add(id); else n.delete(id); onChange(n); };
  const allVisible = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1.4fr) repeat(3, minmax(120px, 1fr))", gap: 8 }}>
        <FieldInput value={q} onChange={setQ} placeholder="Αναζήτηση συνεργάτη…" />
        <FieldSelect value={categoryId} onChange={setCategoryId} options={[{ value: "", label: "Όλες οι κατηγορίες" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
        <FieldSelect value={km} onChange={setKm} options={KM_OPTIONS} />
        <FieldSelect value={rating} onChange={setRating} options={RATING_OPTIONS} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="checkbox" checked={withAccount} onChange={(e) => setWithAccount(e.target.checked)} /> Μόνο με λογαριασμό</label>
        <span style={{ flex: 1 }} />
        <span>{rows.length} από {candidates.length - excluded.size} · επιλεγμένοι {selected.size}</span>
        {rows.length > 0 && <button type="button" onClick={() => { const n = new Set(selected); rows.forEach((r) => (allVisible ? n.delete(r.id) : n.add(r.id))); onChange(n); }} style={linkBtn}>{allVisible ? "Αποεπιλογή όλων" : "Επιλογή όλων"}</button>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxHeight: 300, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
        {rows.length === 0 && <div style={{ padding: 16, textAlign: "center", fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>Κανένας συνεργάτης δεν ταιριάζει στα φίλτρα.</div>}
        {rows.map((r, idx) => (
          <label key={r.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center", padding: "8px 10px", borderTop: idx ? "1px solid var(--border)" : "none", cursor: "pointer", background: selected.has(r.id) ? "var(--paper)" : "transparent" }}>
            <input type="checkbox" checked={selected.has(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: "var(--fs-13)" }}>
                <b>{r.name}</b>
                {r.reasons.filter((x) => x === "προτιμώμενος" || x === "ίδιος με προηγούμενη").map((x) => <span key={x} style={tag}>{x}</span>)}
                {r.emergency24h && <span style={tag}><RiFlashlightLine /> 24/7</span>}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)", marginTop: 2 }}>
                {r.categories.length > 0 && <span>{r.categories.join(" · ")}</span>}
                {r.distanceKm != null && <span><RiMapPin2Line style={{ verticalAlign: "-2px" }} /> {r.distanceKm.toLocaleString("el-GR", { maximumFractionDigits: 1 })} km</span>}
                {r.ratingAvg != null && <span style={{ color: "var(--color-warning)" }}><RiStarFill style={{ verticalAlign: "-2px" }} /> {r.ratingAvg.toFixed(1)} ({r.ratingCount})</span>}
                {r.hasAccounts && <span><RiUserFollowLine style={{ verticalAlign: "-2px" }} /> έχει λογαριασμό</span>}
              </span>
            </span>
            <span style={{ fontSize: "var(--fs-11-5)", color: r.recipientEmail ? "var(--muted-foreground)" : "var(--destructive)", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
              {r.recipientEmail ? <><RiMailLine /> {r.recipientEmail}</> : <><RiAlertLine /> χωρίς email</>}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

const tag: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 3, fontSize: "var(--fs-11)", fontWeight: 600, padding: "1px 7px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--paper)", color: "var(--foreground)" };
const linkBtn: React.CSSProperties = { border: "none", background: "none", color: "var(--color-primary)", fontSize: "var(--fs-12-5)", fontWeight: 600, cursor: "pointer", padding: 0 };
