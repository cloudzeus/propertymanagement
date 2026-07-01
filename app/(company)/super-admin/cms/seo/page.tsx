import { getPageSeo } from "@/lib/cms/page-seo";
import { getSiteSettings } from "@/lib/cms/site-settings";
import { SeoEditor } from "../landing/SeoEditor";
import { GeoStatus } from "@/components/cms/GeoStatus";
import { PUBLIC_PAGES } from "@/lib/cms/public-pages";
import { CmsPage, CmsCard } from "@/components/cms/ui";
import { RiSearchEyeLine } from "react-icons/ri";
import type { SeoMeta } from "@/lib/seo/types";

const EMPTY: SeoMeta = { title: "", description: "" };

export default async function SeoAdminPage() {
  const settings = await getSiteSettings();
  const geoFields = [
    { label: "Συντεταγμένες", ok: settings.geo != null },
    { label: "Διεύθυνση", ok: !!settings.address?.street && !!settings.address?.city },
    { label: "Τηλέφωνο", ok: !!settings.telephone },
    { label: "Ώρες", ok: !!settings.openingHours },
  ];

  const seos = await Promise.all(
    PUBLIC_PAGES.map(async (p) => {
      const t = await getPageSeo(p.slug);
      return {
        page: p,
        initial: {
          el: { ...EMPTY, ...(t?.el ?? {}) },
          en: { ...EMPTY, ...(t?.en ?? {}) },
        },
      };
    }),
  );

  return (
    <CmsPage icon={<RiSearchEyeLine size={20} />} title="CMS — SEO & GEO" subtitle="SEO ανά σελίδα με δημιουργία AI">
      <GeoStatus fields={geoFields} />
      {seos.map(({ page, initial }) => (
        <CmsCard key={page.slug} title={page.label}>
          <SeoEditor slug={page.slug} initial={initial} />
        </CmsCard>
      ))}
    </CmsPage>
  );
}
