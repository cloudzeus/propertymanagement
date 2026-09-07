"use client";

import { useMemo, useState } from "react";
import { RiSearchLine, RiArrowLeftLine, RiLoaderLine, RiBuilding2Line } from "react-icons/ri";
import { Modal } from "@/components/ui/modal";
import { ExpenseUploadFlow } from "./ExpenseUploadFlow";
import { type CategorySplit } from "./ExpenseReviewForm";
import { getBuildingCategorySplits } from "@/app/actions/expense-categories";
import type { ManageableBuilding } from "@/app/actions/building-expenses";

/**
 * The "Νέο έξοδο" flow (pick a building → OCR upload + review), opened from
 * the quick-actions menu. Step 1: pick a building. Step 2: run the shared
 * upload + review flow for that building.
 */
export function ExpenseQuickModal({ open, onClose, buildings }: { open: boolean; onClose: () => void; buildings: ManageableBuilding[] }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ManageableBuilding | null>(null);
  const [categories, setCategories] = useState<CategorySplit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return buildings;
    return buildings.filter((b) =>
      [b.name, b.city, b.propertyName].filter(Boolean).some((s) => s!.toLowerCase().includes(q)),
    );
  }, [buildings, query]);

  if (!buildings.length) return null;

  function reset() {
    setQuery("");
    setPicked(null);
    setCategories(null);
    setLoading(false);
    setError(null);
  }
  function close() {
    onClose();
    reset();
  }

  async function pick(b: ManageableBuilding) {
    setError(null);
    setLoading(true);
    setPicked(b);
    try {
      const cats = await getBuildingCategorySplits(b.id);
      setCategories(cats as CategorySplit[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Αποτυχία φόρτωσης κατηγοριών.");
      setPicked(null);
    } finally {
      setLoading(false);
    }
  }

  const title = picked
    ? `Νέο έξοδο — ${picked.name}`
    : "Νέο έξοδο — επιλογή κτηρίου";

  return (
    <>
      <Modal open={open} onClose={close} title={title} width={picked && categories ? 760 : 480}>
        {error && (
          <div style={{ padding: 10, borderRadius: 6, background: "#FEE7E618", border: "1px solid var(--color-danger)", color: "var(--color-danger)", fontSize: "var(--fs-12)", marginBottom: 10 }}>
            {error}
          </div>
        )}

        {picked && categories ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={reset} style={backBtn}>
              <RiArrowLeftLine /> Αλλαγή κτηρίου
            </button>
            <ExpenseUploadFlow buildingId={picked.id} categories={categories} onDone={close} />
          </div>
        ) : loading ? (
          <div style={{ padding: 36, textAlign: "center", color: "var(--muted-foreground)" }}>
            <RiLoaderLine style={{ fontSize: "var(--fs-26)", animation: "spin 1s linear infinite" }} />
            <div style={{ marginTop: 8 }}>Φόρτωση…</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ position: "relative" }}>
              <RiSearchLine style={{ position: "absolute", left: 10, top: 10, color: "var(--muted-foreground)", fontSize: "var(--fs-16)" }} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Αναζήτηση κτηρίου…"
                style={{ width: "100%", height: 36, padding: "0 10px 0 32px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "var(--bg-canvas)", fontSize: "var(--fs-13)" }}
              />
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", color: "var(--muted-foreground)", fontSize: "var(--fs-13)" }}>Κανένα κτήριο.</div>
              ) : (
                filtered.map((b) => (
                  <button key={b.id} onClick={() => pick(b)} style={row}>
                    <RiBuilding2Line style={{ fontSize: "var(--fs-18)", color: "var(--color-primary)", flexShrink: 0 }} />
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                      <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--foreground)" }}>{b.name}</span>
                      <span style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)" }}>
                        {[b.propertyName, b.city].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </Modal>
    </>
  );
}

const backBtn: React.CSSProperties = {
  alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6,
  height: 30, padding: "0 10px", borderRadius: 6,
  border: "1px solid var(--border-strong)", background: "var(--bg-canvas)",
  color: "var(--foreground)", fontSize: "var(--fs-12)", cursor: "pointer",
};

const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--card)", cursor: "pointer", textAlign: "left", width: "100%",
};
