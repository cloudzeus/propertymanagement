"use client";

import { useState, useTransition } from "react";
import { updateSection } from "@/app/actions/landing-cms";
import { ICON_NAMES } from "@/lib/cms/icon-registry";

type Props = { section: { id: string; type: string; data: any } };

type Locale = "el" | "en";

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? {}));
}

// Defensive: if incoming data isn't {el,en} shaped, wrap the legacy single
// payload as both locales.
function toBilingual(raw: any): { el: any; en: any } {
  if (raw && typeof raw === "object" && ("el" in raw || "en" in raw)) {
    return { el: clone(raw.el ?? {}), en: clone(raw.en ?? {}) };
  }
  return { el: clone(raw ?? {}), en: clone(raw ?? {}) };
}

export function SectionEditor({ section }: Props) {
  const [data, setData] = useState<{ el: any; en: any }>(() =>
    toBilingual(section.data),
  );
  const [activeLocale, setActiveLocale] = useState<Locale>("el");

  const initial = toBilingual(section.data);
  const [itemsText, setItemsText] = useState<{ el: string; en: string }>(() => ({
    el: JSON.stringify(initial.el?.items ?? [], null, 2),
    en: JSON.stringify(initial.en?.items ?? [], null, 2),
  }));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function set(path: string, value: string) {
    setData((prev) => {
      const next = clone(prev);
      const parts = path.split(".");
      let obj = next[activeLocale];
      for (let i = 0; i < parts.length - 1; i++) {
        obj[parts[i]] = obj[parts[i]] ?? {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      return next;
    });
  }

  function field(label: string, path: string) {
    const parts = path.split(".");
    let v: any = data[activeLocale];
    for (const p of parts) v = v?.[p];
    return (
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          value={v ?? ""}
          onChange={(e) => set(path, e.target.value)}
        />
      </label>
    );
  }

  const hasItems = ["LOGOS", "FEATURES", "TESTIMONIALS"].includes(section.type);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const payload = clone(data);

    if (hasItems) {
      for (const loc of ["el", "en"] as Locale[]) {
        try {
          payload[loc].items = JSON.parse(itemsText[loc]);
        } catch {
          setError(
            `Μη έγκυρο JSON στα στοιχεία (items) — ${loc === "el" ? "Ελληνικά" : "English"}.`,
          );
          return;
        }
      }
    }

    startTransition(async () => {
      await updateSection(section.id, payload);
      setSaved(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
      <div className="flex gap-2">
        {(["el", "en"] as Locale[]).map((loc) => (
          <button
            key={loc}
            type="button"
            onClick={() => setActiveLocale(loc)}
            className={`rounded-md px-3 py-1 text-sm font-medium ${
              activeLocale === loc
                ? "bg-blue-600 text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {loc === "el" ? "Ελληνικά" : "English"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {section.type === "HERO" && (
          <>
            {field("Τίτλος", "title")}
            {field("Υπότιτλος", "subtitle")}
            {field("URL εικόνας", "imageUrl")}
            <div className="hidden sm:block" />
            {field("Κύριο CTA — Κείμενο", "primaryCta.label")}
            {field("Κύριο CTA — Σύνδεσμος", "primaryCta.href")}
            {field("Δευτερεύον CTA — Κείμενο", "secondaryCta.label")}
            {field("Δευτερεύον CTA — Σύνδεσμος", "secondaryCta.href")}
          </>
        )}

        {section.type === "LOGOS" && <>{field("Επικεφαλίδα", "heading")}</>}

        {section.type === "FEATURES" && <>{field("Επικεφαλίδα", "heading")}</>}

        {section.type === "PRICING" && (
          <>
            {field("Επικεφαλίδα", "heading")}
            {field("Υπότιτλος", "subtitle")}
          </>
        )}

        {section.type === "TESTIMONIALS" && <>{field("Επικεφαλίδα", "heading")}</>}

        {section.type === "CTA" && (
          <>
            {field("Επικεφαλίδα", "heading")}
            {field("Κείμενο", "body")}
            {field("CTA — Κείμενο", "cta.label")}
            {field("CTA — Σύνδεσμος", "cta.href")}
          </>
        )}
      </div>

      {hasItems && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Στοιχεία (items) — JSON
          </span>
          <textarea
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
            rows={8}
            value={itemsText[activeLocale]}
            onChange={(e) =>
              setItemsText((prev) => ({ ...prev, [activeLocale]: e.target.value }))
            }
          />
        </label>
      )}

      {section.type === "FEATURES" && (
        <details className="text-xs text-slate-600">
          <summary className="cursor-pointer font-medium">Διαθέσιμα εικονίδια (icon)</summary>
          <ul className="mt-2 flex flex-wrap gap-2">
            {ICON_NAMES.map((n) => (
              <li key={n} className="rounded bg-slate-100 px-2 py-1 font-mono">
                {n}
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Αποθήκευση…" : "Αποθήκευση"}
        </button>
        {saved && <span className="text-sm font-medium text-green-600">Αποθηκεύτηκε</span>}
      </div>
    </form>
  );
}
