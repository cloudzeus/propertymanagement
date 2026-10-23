"use client";

/**
 * One-step chooser shown before a modal that needs a subject (a unit, a
 * person, an open fault): searchable list, click = pick. Keeps the
 * «Ενέργειες» menu flat — the user never has to find the right tab first.
 */
import { useMemo, useState } from "react";
import { RiSearchLine } from "react-icons/ri";
import { Modal } from "@/components/ui/modal";
import { normalizeForSearch } from "@/lib/building-actions";

export type PickerItem = { id: string; title: string; subtitle?: string | null; badge?: string | null };

export function PickerModal({ title, hint, items, emptyText, onPick, onClose, width = 520 }: {
  title: string;
  hint?: string;
  items: PickerItem[];
  emptyText: string;
  onPick: (id: string) => void;
  onClose: () => void;
  width?: number;
}) {
  const [q, setQ] = useState("");
  const visible = useMemo(() => {
    const n = normalizeForSearch(q.trim());
    if (!n) return items;
    return items.filter((i) => normalizeForSearch(`${i.title} ${i.subtitle ?? ""} ${i.badge ?? ""}`).includes(n));
  }, [items, q]);

  return (
    <Modal open onClose={onClose} title={title} width={width}
      footer={<button type="button" onClick={onClose} style={btnCancel}>Ακύρωση</button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {hint && <p style={{ margin: 0, fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{hint}</p>}
        {items.length > 6 && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 6, padding: "0 10px", height: 36, background: "var(--card)" }}>
            <RiSearchLine style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση…" aria-label="Αναζήτηση"
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: "var(--fs-13)", color: "var(--foreground)", fontFamily: "inherit" }} />
          </label>
        )}
        {items.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted-foreground)", fontSize: "var(--fs-13)", border: "1px dashed var(--border-strong)", borderRadius: 8 }}>{emptyText}</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 16, textAlign: "center", color: "var(--muted-foreground)", fontSize: "var(--fs-13)" }}>Κανένα αποτέλεσμα για «{q}».</div>
        ) : (
          <div role="listbox" style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: "55vh", overflowY: "auto" }}>
            {visible.map((i) => (
              <button key={i.id} type="button" role="option" aria-selected={false} onClick={() => onPick(i.id)} style={row}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--card)")}>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.title}</span>
                  {i.subtitle && <span style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.subtitle}</span>}
                </span>
                {i.badge && <span style={{ flexShrink: 0, fontSize: "var(--fs-10)", fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "var(--bg-canvas)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>{i.badge}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", minHeight: 44,
  padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", cursor: "pointer", fontFamily: "inherit",
};
const btnCancel: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: "var(--fs-13)", color: "var(--foreground)" };
