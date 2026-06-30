"use client";

import { useMemo, useState, useTransition } from "react";
import { RiTranslate2 } from "react-icons/ri";
import { AutoTranslateButton } from "@/components/i18n/AutoTranslateButton";
import { CmsPage, CmsCard, CmsInput, CmsButton, SaveBar } from "@/components/cms/ui";
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
    <CmsPage
      icon={<RiTranslate2 />}
      title="Μεταφράσεις"
      subtitle="Επεξεργασία κειμένων διεπαφής (el/en)"
    >
      <CmsCard
        title={`${rows.length} κλειδιά · ${changedCount} τροποποιημένα`}
        actions={
          <>
            <CmsButton variant="secondary" onClick={bulkTranslateEmptyEn} disabled={bulk.running}>
              {bulk.running ? `Μετάφραση ${bulk.done}/${bulk.total}…` : "Auto-translate κενά EN"}
            </CmsButton>
            <SaveBar onSave={save} pending={isPending} saved={saved} />
          </>
        }
      >
        <CmsInput
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Αναζήτηση κλειδιού…"
          style={{ maxWidth: 360, marginBottom: 12 }}
        />

        <div
          style={{
            maxHeight: "calc(100vh - 320px)",
            overflowY: "auto",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, background: "var(--muted)", zIndex: 1 }}>
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
                    <td
                      style={{
                        ...td,
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.key}
                    </td>
                    <td style={td}>
                      <CmsInput
                        type="text"
                        value={cur.el}
                        onChange={(e) => setField(r.key, "el", e.target.value)}
                        style={{ padding: "6px 8px", borderRadius: 4 }}
                      />
                    </td>
                    <td style={td}>
                      <CmsInput
                        type="text"
                        value={cur.en}
                        onChange={(e) => setField(r.key, "en", e.target.value)}
                        style={{ padding: "6px 8px", borderRadius: 4 }}
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
      </CmsCard>
    </CmsPage>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--muted-foreground)",
};
const td: React.CSSProperties = { padding: "4px 10px", verticalAlign: "middle" };
