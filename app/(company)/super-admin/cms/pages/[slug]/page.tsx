import { getCmsPage } from "@/lib/cms/pages";
import { getPageSeo } from "@/lib/cms/page-seo";
import { CmsPageEditor } from "./CmsPageEditor";
import type { SeoMeta } from "@/lib/seo/types";

const EMPTY_SEO: SeoMeta = { title: "", description: "", keywords: "", ogImage: "" };

export default async function CmsPageEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = await getCmsPage(slug);
  const pageSeo = await getPageSeo(slug);

  const initialI18n = (row?.i18n as any) ?? {
    title: { el: row?.title ?? "", en: row?.title ?? "" },
    body: { el: row?.content ?? "", en: row?.content ?? "" },
  };
  const initialStatus = row?.status ?? "DRAFT";
  const initialSeo = {
    el: { ...EMPTY_SEO, ...(pageSeo?.el ?? {}) },
    en: { ...EMPTY_SEO, ...(pageSeo?.en ?? {}) },
  };

  return (
    <div className="p-6 sm:p-8">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">CMS — Σελίδα</h1>
      <p className="mb-6 font-mono text-sm text-slate-500">/{slug}</p>
      <CmsPageEditor
        slug={slug}
        initialI18n={initialI18n}
        initialStatus={initialStatus}
        initialSeo={initialSeo}
      />
    </div>
  );
}
