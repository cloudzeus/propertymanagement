"use client";

import { useState, useTransition } from "react";
import { updateFaq, deleteFaq } from "@/app/actions/pages-cms";
import { AutoTranslateButton } from "@/components/i18n/AutoTranslateButton";

type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  order: number;
  published: boolean;
  i18n: any;
};

type Locale = "el" | "en";

type I18n = {
  question: { el: string; en: string };
  answer: { el: string; en: string };
};

function initI18n(faq: Faq): I18n {
  const raw = (faq.i18n ?? {}) as any;
  return {
    question: {
      el: raw?.question?.el ?? faq.question ?? "",
      en: raw?.question?.en ?? "",
    },
    answer: {
      el: raw?.answer?.el ?? faq.answer ?? "",
      en: raw?.answer?.en ?? "",
    },
  };
}

export function FaqEditor({ faq }: { faq: Faq }) {
  const init = initI18n(faq);
  const [question, setQuestion] = useState(init.question);
  const [answer, setAnswer] = useState(init.answer);
  const [category, setCategory] = useState(faq.category ?? "general");
  const [order, setOrder] = useState(faq.order);
  const [published, setPublished] = useState(faq.published);

  const [locale, setLocale] = useState<Locale>("el");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const i18n = { question, answer };
    startTransition(async () => {
      await updateFaq(faq.id, {
        i18n,
        question: i18n.question.el,
        answer: i18n.answer.el,
        category,
        order,
        published,
      });
      setSaved(true);
    });
  }

  function onDelete() {
    if (!confirm("Διαγραφή ερώτησης;")) return;
    startTransition(async () => {
      await deleteFaq(faq.id);
    });
  }

  const inputCls =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-slate-600";

  return (
    <form onSubmit={onSave} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-900">
          {question.el || "(χωρίς τίτλο)"}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            published ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {published ? "Δημοσιευμένο" : "Πρόχειρο"}
        </span>
      </div>

      <div className="mb-4 flex gap-2">
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
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className={labelCls}>Ερώτηση</span>
          <div className="flex items-start gap-2">
            <input
              className={inputCls}
              value={question[locale]}
              onChange={(e) => setQuestion({ ...question, [locale]: e.target.value })}
            />
            {locale === "en" && (
              <AutoTranslateButton
                source={question.el}
                onResult={(t) => setQuestion((p) => ({ ...p, en: t }))}
              />
            )}
          </div>
        </label>
        <label className="block">
          <span className={labelCls}>Απάντηση</span>
          <div className="flex items-start gap-2">
            <textarea
              className={inputCls}
              rows={4}
              value={answer[locale]}
              onChange={(e) => setAnswer({ ...answer, [locale]: e.target.value })}
            />
            {locale === "en" && (
              <AutoTranslateButton
                source={answer.el}
                onResult={(t) => setAnswer((p) => ({ ...p, en: t }))}
              />
            )}
          </div>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>Κατηγορία</span>
          <input
            className={inputCls}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
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
