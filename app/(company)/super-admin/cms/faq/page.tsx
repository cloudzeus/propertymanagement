import { db } from "@/lib/db";
import { createFaq } from "@/app/actions/pages-cms";
import { FaqEditor } from "./FaqEditor";

async function addFaq() {
  "use server";
  await createFaq({
    question: "",
    answer: "",
    category: "general",
    order: 0,
    published: false,
    i18n: {
      question: { el: "", en: "" },
      answer: { el: "", en: "" },
    },
  });
}

export default async function FaqCmsPage() {
  const faqs = await db.fAQ.findMany({ orderBy: { order: "asc" } });

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">CMS — Συχνές ερωτήσεις</h1>
        <form action={addFaq}>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Νέα ερώτηση
          </button>
        </form>
      </div>

      {faqs.length === 0 && (
        <p className="text-sm text-slate-500">Δεν υπάρχουν ερωτήσεις ακόμη.</p>
      )}

      <div className="space-y-4">
        {faqs.map((f) => (
          <FaqEditor key={f.id} faq={f as any} />
        ))}
      </div>
    </div>
  );
}
