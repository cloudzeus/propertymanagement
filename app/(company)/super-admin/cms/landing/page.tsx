import { getAllLandingSections } from "@/lib/cms/landing";
import { getPageSeo } from "@/lib/cms/page-seo";
import { toggleSection, reorderSection } from "@/app/actions/landing-cms";
import { SectionEditor } from "./SectionEditor";
import { SeoEditor } from "./SeoEditor";
import type { SeoMeta } from "@/lib/seo/types";

const EMPTY_SEO: SeoMeta = { title: "", description: "" };

export default async function LandingCmsPage() {
  const sections = await getAllLandingSections();
  const homeSeo = await getPageSeo("home");
  const seoInitial = {
    el: { ...EMPTY_SEO, ...(homeSeo?.el ?? {}) },
    en: { ...EMPTY_SEO, ...(homeSeo?.en ?? {}) },
  };

  return (
    <div className="p-6 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">CMS — Landing</h1>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">SEO — Αρχική</h2>
        <SeoEditor slug="home" initial={seoInitial} />
      </div>

      <div className="space-y-4">
        {sections.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-slate-900">
                  {s.type}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    s.enabled
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {s.enabled ? "Ενεργό" : "Ανενεργό"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <form action={reorderSection.bind(null, s.id, "up")}>
                  <button
                    type="submit"
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-50"
                    title="Πάνω"
                  >
                    ▲
                  </button>
                </form>
                <form action={reorderSection.bind(null, s.id, "down")}>
                  <button
                    type="submit"
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-50"
                    title="Κάτω"
                  >
                    ▼
                  </button>
                </form>
                <form action={toggleSection.bind(null, s.id)}>
                  <button
                    type="submit"
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm font-medium hover:bg-slate-50"
                  >
                    {s.enabled ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                  </button>
                </form>
              </div>
            </div>

            <SectionEditor section={{ id: s.id, type: s.type, data: s.data }} />
          </div>
        ))}
      </div>
    </div>
  );
}
