"use client";

import { useState, useTransition } from "react";
import { updateSection } from "@/app/actions/landing-cms";
import { ICON_NAMES } from "@/lib/cms/icon-registry";

type Props = { section: { id: string; type: string; data: any } };

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? {}));
}

export function SectionEditor({ section }: Props) {
  const [data, setData] = useState<any>(() => clone(section.data));
  const [itemsText, setItemsText] = useState<string>(() =>
    JSON.stringify(section.data?.items ?? [], null, 2),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function set(path: string, value: string) {
    setData((prev: any) => {
      const next = clone(prev);
      const parts = path.split(".");
      let obj = next;
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
    let v: any = data;
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
      try {
        payload.items = JSON.parse(itemsText);
      } catch {
        setError("Μη έγκυρο JSON στα στοιχεία (items).");
        return;
      }
    }

    startTransition(async () => {
      await updateSection(section.id, payload);
      setSaved(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
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
            value={itemsText}
            onChange={(e) => setItemsText(e.target.value)}
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
