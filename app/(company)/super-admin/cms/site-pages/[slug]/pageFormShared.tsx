"use client";
import { useState, useTransition } from "react";
import { updateMarketingPage } from "@/app/actions/marketing-cms";
import { CmsField, CmsInput, CmsTextarea, LocaleTabs, SaveBar } from "@/components/cms/ui";
import { MARKETING_PAGE_DEFAULTS, type MarketingPageSlug } from "@/lib/cms/marketing-pages";

export type Locale = "el" | "en";

/** One locale's content blob. Shapes are enforced by the typed page forms. */
type LocaleBlob = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? {}));
}

/**
 * Bilingual editor state for one marketing page. Mirrors the landing-section
 * form contract (`useSectionForm`) so the two editors behave identically —
 * locale tabs, dirty tracking, one save button.
 */
export function usePageForm(slug: MarketingPageSlug, initial: unknown) {
  const [data, setData] = useState<{ el: LocaleBlob; en: LocaleBlob }>(() => {
    const fallback = MARKETING_PAGE_DEFAULTS[slug];
    if (initial && typeof initial === "object" && ("el" in (initial as object) || "en" in (initial as object))) {
      const r = initial as { el?: unknown; en?: unknown };
      return { el: clone(r.el ?? fallback.el) as LocaleBlob, en: clone(r.en ?? fallback.en) as LocaleBlob };
    }
    return clone(fallback) as { el: LocaleBlob; en: LocaleBlob };
  });
  const [locale, setLocale] = useState<Locale>("el");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  /** Merge into the active locale only. */
  function patch(p: Record<string, unknown>) {
    setData((d) => ({ ...d, [locale]: { ...d[locale], ...p } }));
    setSaved(false);
  }
  /** Merge into a nested object of the active locale — `set("header", {title})`. */
  function setGroup(key: string, p: Record<string, unknown>) {
    setData((d) => ({ ...d, [locale]: { ...d[locale], [key]: { ...(d[locale]?.[key] ?? {}), ...p } } }));
    setSaved(false);
  }
  function setList(key: string, items: unknown[]) {
    setData((d) => ({ ...d, [locale]: { ...d[locale], [key]: items } }));
    setSaved(false);
  }
  function save() {
    start(async () => {
      await updateMarketingPage(slug, data);
      setSaved(true);
    });
  }
  return { data, cur: data[locale] ?? {}, locale, setLocale, patch, setGroup, setList, save, saved, pending };
}

export function FormGroup({ title, hint, cols = 1, children }: {
  title: string; hint?: string; cols?: 1 | 2; children: React.ReactNode;
}) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--card)", padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--foreground)" }}>{title}</div>
      {hint && <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 2 }}>{hint}</div>}
      <div style={{ display: "grid", gridTemplateColumns: cols === 2 ? "1fr 1fr" : "1fr", gap: 14, marginTop: 14 }}>
        {children}
      </div>
    </div>
  );
}

export function FormChrome({ locale, setLocale, save, saved, pending, children }: {
  locale: Locale;
  setLocale: (l: Locale) => void;
  save: () => void;
  saved: boolean;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 760 }}>
      <LocaleTabs value={locale} onChange={setLocale} />
      {children}
      <div style={{ position: "sticky", bottom: 0, paddingTop: 8 }}>
        <SaveBar onSave={save} pending={pending} saved={saved} />
      </div>
    </div>
  );
}

/** The eyebrow / H1 / lead block every inner page shares. */
export function HeaderFields({
  header,
  onChange,
}: {
  header: { eyebrow?: string; title?: string; lead?: string };
  onChange: (p: Record<string, unknown>) => void;
}) {
  return (
    <FormGroup title="Επικεφαλίδα σελίδας">
      <CmsField label="Eyebrow" hint="Το μικρό pill πάνω από τον τίτλο.">
        <CmsInput value={header?.eyebrow ?? ""} onChange={(e) => onChange({ eyebrow: e.target.value })} />
      </CmsField>
      <CmsField label="Τίτλος (H1)">
        <CmsInput value={header?.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} />
      </CmsField>
      <CmsField label="Εισαγωγή">
        <CmsTextarea value={header?.lead ?? ""} onChange={(e) => onChange({ lead: e.target.value })} />
      </CmsField>
    </FormGroup>
  );
}

/** Editable list of simple rows, with add / remove / reorder. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function RowList<T extends Record<string, any>>({
  items,
  onChange,
  newItem,
  addLabel,
  renderFields,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  newItem: () => T;
  addLabel: string;
  renderFields: (item: T, patch: (p: Partial<T>) => void) => React.ReactNode;
}) {
  function patchAt(i: number, p: Partial<T>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  const btn: React.CSSProperties = {
    border: "1px solid var(--border)", borderRadius: 6, background: "var(--card)",
    padding: "3px 8px", fontSize: 12, cursor: "pointer", color: "var(--muted-foreground)",
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item, i) => (
        <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--bg-canvas)" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 8 }}>
            <button type="button" style={btn} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
            <button type="button" style={btn} onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
            <button type="button" style={btn} onClick={() => onChange(items.filter((_, idx) => idx !== i))}>Διαγραφή</button>
          </div>
          <div style={{ display: "grid", gap: 12 }}>{renderFields(item, (p) => patchAt(i, p))}</div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, newItem()])}
        style={{ ...btn, padding: "8px 12px", fontSize: 13, justifySelf: "start", color: "var(--foreground)" }}
      >
        + {addLabel}
      </button>
    </div>
  );
}

/** Comma-or-newline separated list, edited as free text. Good for short option lists. */
export function ListTextarea({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <CmsField label={label} hint={hint ?? "Μία επιλογή ανά γραμμή."}>
      <CmsTextarea
        rows={5}
        value={(value ?? []).join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
      />
    </CmsField>
  );
}
