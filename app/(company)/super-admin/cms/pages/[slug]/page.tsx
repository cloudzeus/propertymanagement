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
    <CmsPageEditor
      slug={slug}
      initialI18n={initialI18n}
      initialStatus={initialStatus}
      initialSeo={initialSeo}
    />
  );
}
