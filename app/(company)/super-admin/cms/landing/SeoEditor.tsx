"use client";

import { useState, useTransition } from "react";
import { updatePageSeo } from "@/app/actions/landing-cms";
import { autoTranslate } from "@/app/actions/translate";
import type { SeoMeta } from "@/lib/seo/types";

type Locale = "el" | "en";
type Props = { slug: string; initial: { el: SeoMeta; en: SeoMeta } };

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? {}));
}

export function SeoEditor({ slug, initial }: Props) {
  const [data, setData] = useState<{ el: SeoMeta; en: SeoMeta }>(() => clone(initial));
  const [activeLocale, setActiveLocale] = useState<Locale>("el");
  const [saved, setSaved] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [pending, startTransition] = useTransition();

  async function translateEnFromEl() {
    setTranslating(true);
    try {
      const el = data.el;
      const fields = ["title", "description", "keywords"] as (keyof SeoMeta)[];
      const results = await Promise.all(
        fields.map((k) => {
          const src = (el[k] as string | undefined)?.trim();
          return src ? autoTranslate(src, "el", "en") : Promise.resolve("");
        }),
      );
      setData((prev) => {
        const next = clone(prev);
        fields.forEach((k, i) => {
          (next.en as any)[k] = results[i];
        });
        return next;
      });
    } finally {
      setTranslating(false);
    }
  }

  function set(key: keyof SeoMeta, value: string) {
    setData((prev) => {
      const next = clone(prev);
      (next[activeLocale] as any)[key] = value;
      return next;
    });
  }

  const cur = data[activeLocale];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await updatePageSeo(slug, data);
      setSaved(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex items-center gap-2">
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
        <button
          type="button"
          onClick={translateEnFromEl}
          disabled={translating}
          className="ml-auto rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {translating ? "Μετάφραση…" : "Μετάφραση EN από EL"}
        </button>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Τίτλος (title)</span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          value={cur.title ?? ""}
          onChange={(e) => set("title", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Περιγραφή (description)
        </span>
        <textarea
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          rows={3}
          value={cur.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Λέξεις-κλειδιά (keywords)
        </span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          value={cur.keywords ?? ""}
          onChange={(e) => set("keywords", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">OG Image (URL)</span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          value={cur.ogImage ?? ""}
          onChange={(e) => set("ogImage", e.target.value)}
        />
      </label>

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
