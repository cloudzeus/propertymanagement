"use client";

import { useMemo, useState, useTransition } from "react";
import { AutoTranslateButton } from "@/components/i18n/AutoTranslateButton";
import { autoTranslate, updateUiMessages } from "@/app/actions/translate";

type Row = { key: string; el: string; en: string };

export function TranslationsEditor({ rows }: { rows: Row[] }) {
  const original = useMemo(() => {
    const m = new Map<string, { el: string; en: string }>();
    for (const r of rows) m.set(r.key, { el: r.el, en: r.en });
    return m;
  }, [rows]);

  const [state, setState] = useState<Record<string, { el: string; en: string }>>(() =>
    Object.fromEntries(rows.map((r) => [r.key, { el: r.el, en: r.en }]))
  );
  const [search, setSearch] = useState("");
  const [bulk, setBulk] = useState<{ running: boolean; done: number; total: number }>({
    running: false,
    done: 0,
    total: 0,
  });
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => !q || r.key.toLowerCase().includes(q));
  }, [rows, search]);

  function setField(key: string, field: "el" | "en", value: string) {
    setSaved(false);
    setState((s) => ({ ...s, [key]: { ...s[key], [field]: value } }));
  }

  async function bulkTranslateEmptyEn() {
    const targets = rows.filter((r) => !(state[r.key]?.en ?? "").trim() && (state[r.key]?.el ?? "").trim());
    setBulk({ running: true, done: 0, total: targets.length });
    let done = 0;
    for (const r of targets) {
      try {
        const t = await autoTranslate(state[r.key].el, "el", "en");
        setField(r.key, "en", t);
      } catch {
        /* skip failures */
      }
      done += 1;
      setBulk({ running: true, done, total: targets.length });
    }
    setBulk({ running: false, done, total: targets.length });
  }

  function save() {
    const changed: Row[] = [];
    for (const r of rows) {
      const cur = state[r.key];
      const orig = original.get(r.key)!;
      if (cur.el !== orig.el || cur.en !== orig.en) {
        changed.push({ key: r.key, el: cur.el, en: cur.en });
      }
    }
    if (changed.length === 0) {
      setSaved(true);
      return;
    }
    startTransition(async () => {
      await updateUiMessages(changed);
      setSaved(true);
    });
  }

  const changedCount = rows.reduce((n, r) => {
    const cur = state[r.key];
    const orig = original.get(r.key)!;
    return n + (cur.el !== orig.el || cur.en !== orig.en ? 1 : 0);
  }, 0);

  return (
    <div style={{ padding: 24, fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#201F1E" }}>Μεταφράσεις UI</h1>
          <p style={{ fontSize: 13, color: "#707070", margin: "4px 0 0" }}>
            {rows.length} κλειδιά · {changedCount} τροποποιημένα
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={bulkTranslateEmptyEn}
            disabled={bulk.running}
            style={btnSecondary}
          >
            {bulk.running ? `Μετάφραση ${bulk.done}/${bulk.total}…` : "Auto-translate κενά EN"}
          </button>
          <button type="button" onClick={save} disabled={isPending} style={btnPrimary}>
            {isPending ? "Αποθήκευση…" : saved ? "Αποθηκεύτηκε ✓" : "Αποθήκευση"}
          </button>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Αναζήτηση κλειδιού…"
        style={{
          width: "100%", maxWidth: 360, padding: "8px 12px", marginBottom: 12,
          border: "1px solid var(--border)", borderRadius: 6, fontSize: 13,
        }}
      />

      <div style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ position: "sticky", top: 0, background: "#FAFAFA", zIndex: 1 }}>
            <tr>
              <th style={th}>Κλειδί</th>
              <th style={th}>EL</th>
              <th style={th}>EN</th>
              <th style={{ ...th, width: 1 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const cur = state[r.key];
              return (
                <tr key={r.key} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "#5C5C5C", whiteSpace: "nowrap" }}>
                    {r.key}
                  </td>
                  <td style={td}>
                    <input
                      type="text"
                      value={cur.el}
                      onChange={(e) => setField(r.key, "el", e.target.value)}
                      style={cellInput}
                    />
                  </td>
                  <td style={td}>
                    <input
                      type="text"
                      value={cur.en}
                      onChange={(e) => setField(r.key, "en", e.target.value)}
                      style={cellInput}
                    />
                  </td>
                  <td style={td}>
                    <AutoTranslateButton source={cur.el} onResult={(t) => setField(r.key, "en", t)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.05em", color: "#707070",
};
const td: React.CSSProperties = { padding: "4px 10px", verticalAlign: "middle" };
const cellInput: React.CSSProperties = {
  width: "100%", padding: "6px 8px", border: "1px solid var(--border)",
  borderRadius: 4, fontSize: 13, background: "#fff",
};
const btnPrimary: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary, #0078D4)",
  color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border)",
  background: "#fff", color: "#292929", fontSize: 13, fontWeight: 500, cursor: "pointer",
};
