"use client";

import { useState, useTransition } from "react";
import { updatePricingTier, deletePricingTier } from "@/app/actions/pages-cms";
import { autoTranslate } from "@/app/actions/translate";

type Tier = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  highlighted: boolean;
  order: number;
  published: boolean;
  i18n: any;
};

type Locale = "el" | "en";

type I18n = {
  name: { el: string; en: string };
  description: { el: string; en: string };
  features: { el: string[]; en: string[] };
};

function initI18n(tier: Tier): I18n {
  const raw = (tier.i18n ?? {}) as any;
  return {
    name: {
      el: raw?.name?.el ?? tier.name ?? "",
      en: raw?.name?.en ?? "",
    },
    description: {
      el: raw?.description?.el ?? tier.description ?? "",
      en: raw?.description?.en ?? "",
    },
    features: {
      el: Array.isArray(raw?.features?.el) ? raw.features.el : (tier.features ?? []),
      en: Array.isArray(raw?.features?.en) ? raw.features.en : [],
    },
  };
}

export function PricingTierEditor({ tier }: { tier: Tier }) {
  const init = initI18n(tier);
  const [name, setName] = useState(init.name);
  const [description, setDescription] = useState(init.description);
  const [featuresText, setFeaturesText] = useState<{ el: string; en: string }>({
    el: init.features.el.join("\n"),
    en: init.features.en.join("\n"),
  });
  const [slug, setSlug] = useState(tier.slug);
  const [monthlyPrice, setMonthlyPrice] = useState(tier.monthlyPrice);
  const [annualPrice, setAnnualPrice] = useState(tier.annualPrice);
  const [highlighted, setHighlighted] = useState(tier.highlighted);
  const [order, setOrder] = useState(tier.order);
  const [published, setPublished] = useState(tier.published);

  const [locale, setLocale] = useState<Locale>("el");
  const [saved, setSaved] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [pending, startTransition] = useTransition();

  async function translateEnFromEl() {
    setTranslating(true);
    try {
      const [n, d, f] = await Promise.all([
        name.el.trim() ? autoTranslate(name.el, "el", "en") : Promise.resolve(""),
        description.el.trim() ? autoTranslate(description.el, "el", "en") : Promise.resolve(""),
        featuresText.el.trim() ? autoTranslate(featuresText.el, "el", "en") : Promise.resolve(""),
      ]);
      setName((p) => ({ ...p, en: n }));
      setDescription((p) => ({ ...p, en: d }));
      setFeaturesText((p) => ({ ...p, en: f }));
    } finally {
      setTranslating(false);
    }
  }

  function splitFeatures(s: string): string[] {
    return s
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const i18n = {
      name,
      description,
      features: {
        el: splitFeatures(featuresText.el),
        en: splitFeatures(featuresText.en),
      },
    };
    startTransition(async () => {
      await updatePricingTier(tier.id, {
        i18n,
        name: i18n.name.el,
        description: i18n.description.el,
        features: i18n.features.el,
        monthlyPrice,
        annualPrice,
        highlighted,
        order,
        published,
        slug,
      });
      setSaved(true);
    });
  }

  function onDelete() {
    if (!confirm("Διαγραφή πλάνου;")) return;
    startTransition(async () => {
      await deletePricingTier(tier.id);
    });
  }

  const inputCls =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-slate-600";

  return (
    <form onSubmit={onSave} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-sm font-semibold text-slate-900">{slug}</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            published ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {published ? "Δημοσιευμένο" : "Πρόχειρο"}
        </span>
      </div>

      <div className="mb-4 flex items-center gap-2">
        {(["el", "en"] as Locale[]).map((loc) => (
          <button
            key={loc}
            type="button"
            onClick={() => setLocale(loc)}
            className={`rounded-md px-3 py-1 text-sm font-medium ${
              locale === loc
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

      <div className="space-y-3">
        <label className="block">
          <span className={labelCls}>Όνομα</span>
          <input
            className={inputCls}
            value={name[locale]}
            onChange={(e) => setName({ ...name, [locale]: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Περιγραφή</span>
          <textarea
            className={inputCls}
            rows={2}
            value={description[locale]}
            onChange={(e) => setDescription({ ...description, [locale]: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Χαρακτηριστικά (ένα ανά γραμμή)</span>
          <textarea
            className={inputCls}
            rows={5}
            value={featuresText[locale]}
            onChange={(e) => setFeaturesText({ ...featuresText, [locale]: e.target.value })}
          />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>Slug</span>
          <input className={inputCls} value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Σειρά</span>
          <input
            type="number"
            className={inputCls}
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Μηνιαία τιμή (€)</span>
          <input
            type="number"
            step="0.01"
            className={inputCls}
            value={monthlyPrice}
            onChange={(e) => setMonthlyPrice(Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Ετήσια τιμή (€)</span>
          <input
            type="number"
            step="0.01"
            className={inputCls}
            value={annualPrice}
            onChange={(e) => setAnnualPrice(Number(e.target.value))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={highlighted}
            onChange={(e) => setHighlighted(e.target.checked)}
          />
          Προβεβλημένο
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          Δημοσιευμένο
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3 border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Αποθήκευση…" : "Αποθήκευση"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Διαγραφή
        </button>
        {saved && <span className="text-sm font-medium text-green-600">Αποθηκεύτηκε</span>}
      </div>
    </form>
  );
}
