"use client";

import { useState, useTransition } from "react";
import { updateCmsPage } from "@/app/actions/pages-cms";
import { updatePageSeo } from "@/app/actions/landing-cms";
import { autoTranslate } from "@/app/actions/translate";
import type { SeoMeta } from "@/lib/seo/types";

type Locale = "el" | "en";
type I18n = { title: Record<Locale, string>; body: Record<Locale, string> };
type Seo = { el: SeoMeta; en: SeoMeta };

type Props = {
  slug: string;
  initialI18n: I18n;
  initialStatus: string;
  initialSeo: Seo;
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? {}));
}

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export function CmsPageEditor({ slug, initialI18n, initialStatus, initialSeo }: Props) {
  const [i18n, setI18n] = useState<I18n>(() => clone(initialI18n));
  const [seo, setSeo] = useState<Seo>(() => clone(initialSeo));
  const [status, setStatus] = useState(initialStatus);
  const [activeLocale, setActiveLocale] = useState<Locale>("el");
  const [saved, setSaved] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [pending, startTransition] = useTransition();

  async function translateEnFromEl() {
    setTranslating(true);
    try {
      const [t, b] = await Promise.all([
        i18n.title.el.trim() ? autoTranslate(i18n.title.el, "el", "en") : Promise.resolve(""),
        i18n.body.el.trim() ? autoTranslate(i18n.body.el, "el", "en") : Promise.resolve(""),
      ]);
      setI18n((prev) => {
        const next = clone(prev);
        next.title.en = t;
        next.body.en = b;
        return next;
      });
    } finally {
      setTranslating(false);
    }
  }

  function setField(group: "title" | "body", value: string) {
    setI18n((prev) => {
      const next = clone(prev);
      next[group][activeLocale] = value;
      return next;
    });
  }

  function setSeoField(key: keyof SeoMeta, value: string) {
    setSeo((prev) => {
      const next = clone(prev);
      (next[activeLocale] as any)[key] = value;
      return next;
    });
  }

  const curSeo = seo[activeLocale];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await updateCmsPage(slug, i18n, status);
      await updatePageSeo(slug, seo);
      setSaved(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
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
          <button
            type="button"
            onClick={translateEnFromEl}
            disabled={translating}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {translating ? "Μετάφραση…" : "Μετάφραση EN από EL (τίτλος + κείμενο)"}
          </button>
        </div>
        <label className="ml-auto flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Κατάσταση</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Περιεχόμενο</h2>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Τίτλος</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={i18n.title[activeLocale] ?? ""}
            onChange={(e) => setField("title", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Κείμενο (Markdown)
          </span>
          <textarea
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
            rows={18}
            value={i18n.body[activeLocale] ?? ""}
            onChange={(e) => setField("body", e.target.value)}
          />
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">SEO</h2>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Τίτλος (title)</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={curSeo.title ?? ""}
            onChange={(e) => setSeoField("title", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Περιγραφή (description)
          </span>
          <textarea
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            rows={3}
            value={curSeo.description ?? ""}
            onChange={(e) => setSeoField("description", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Λέξεις-κλειδιά (keywords)
          </span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={curSeo.keywords ?? ""}
            onChange={(e) => setSeoField("keywords", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">OG Image (URL)</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={curSeo.ogImage ?? ""}
            onChange={(e) => setSeoField("ogImage", e.target.value)}
          />
        </label>
      </div>

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
