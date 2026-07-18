"use client";
import { useState, useTransition } from "react";
import { updateSection } from "@/app/actions/landing-cms";
import { LocaleTabs, SaveBar } from "@/components/cms/ui";

export type Locale = "el" | "en";

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? {}));
}

/** Immutable deep set; walks objects and arrays ("items.2.imageUrl"). Missing objects are created,
 *  missing array indices are skipped (nothing to attach the value to in that locale). */
export function setDeep<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  function walk(node: any, i: number): any {
    const k = keys[i];
    if (i === keys.length - 1) {
      if (Array.isArray(node)) {
        const idx = Number(k);
        if (!Number.isInteger(idx) || idx < 0 || idx >= node.length) return node;
        const next = [...node]; next[idx] = value; return next;
      }
      return { ...(node ?? {}), [k]: value };
    }
    if (Array.isArray(node)) {
      const idx = Number(k);
      if (!Number.isInteger(idx) || idx < 0 || idx >= node.length) return node;
      const next = [...node]; next[idx] = walk(next[idx], i + 1); return next;
    }
    const cur = node && typeof node === "object" ? node : {};
    return { ...cur, [k]: walk(cur[k], i + 1) };
  }
  return walk(obj ?? {}, 0);
}

export function toBilingual(raw: unknown): { el: any; en: any } {
  if (raw && typeof raw === "object" && ("el" in (raw as object) || "en" in (raw as object))) {
    const r = raw as { el?: unknown; en?: unknown };
    return { el: clone(r.el ?? {}), en: clone(r.en ?? {}) };
  }
  return { el: clone(raw ?? {}), en: clone(raw ?? {}) };
}

/** Bilingual editor state + save for a landing section. */
export function useSectionForm(section: { id: string; data: unknown }) {
  const [data, setData] = useState<{ el: any; en: any }>(() => toBilingual(section.data));
  const [locale, setLocale] = useState<Locale>("el");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function patch(p: Record<string, unknown>) {
    setData((d) => ({ ...d, [locale]: { ...d[locale], ...p } }));
    setSaved(false);
  }
  /** Media (images/videos) are language-independent — write the value into EVERY locale.
   *  `path` is a deep path ("imageUrl", "imageTile.imageUrl", "items.2.avatarUrl" — array indices allowed). */
  function patchMedia(path: string, value: string) {
    setData((d) => ({ el: setDeep(d.el, path, value), en: setDeep(d.en, path, value) }));
    setSaved(false);
  }
  function setItems(key: string, items: unknown[]) {
    setData((d) => ({ ...d, [locale]: { ...d[locale], [key]: items } }));
    setSaved(false);
  }
  function save() {
    start(async () => {
      await updateSection(section.id, data);
      setSaved(true);
    });
  }
  return { data, cur: data[locale] ?? {}, locale, setLocale, patch, patchMedia, setItems, save, saved, pending };
}

/** Titled group of fields — gives long forms visible structure. `cols={2}` lays short inputs side by side. */
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

export function FormChrome({
  locale, setLocale, save, saved, pending, children,
}: {
  locale: Locale;
  setLocale: (l: Locale) => void;
  save: () => void;
  saved: boolean;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>
      <LocaleTabs value={locale} onChange={setLocale} />
      {children}
      <div style={{ position: "sticky", bottom: 0, paddingTop: 8 }}>
        <SaveBar onSave={save} pending={pending} saved={saved} />
      </div>
    </div>
  );
}
