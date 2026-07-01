"use client";
import { useState, useTransition } from "react";
import { updateSection } from "@/app/actions/landing-cms";
import { LocaleTabs, SaveBar } from "@/components/cms/ui";

export type Locale = "el" | "en";

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? {}));
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
  return { data, cur: data[locale] ?? {}, locale, setLocale, patch, setItems, save, saved, pending };
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
