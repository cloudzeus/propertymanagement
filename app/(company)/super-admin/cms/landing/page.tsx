import { requirePermission } from "@/lib/rbac/permissions";
import { getAllLandingSections } from "@/lib/cms/landing";
import { getPageSeo } from "@/lib/cms/page-seo";
import { SeoEditor } from "./SeoEditor";
import { LandingIndexClient } from "./LandingIndexClient";
import { CmsPage, CmsCard } from "@/components/cms/ui";
import { RiLayoutLine } from "react-icons/ri";
import type { SeoMeta } from "@/lib/seo/types";

const EMPTY_SEO: SeoMeta = { title: "", description: "" };

export default async function LandingCmsPage() {
  await requirePermission("cms-landing", "view");
  const sections = await getAllLandingSections();
  const homeSeo = await getPageSeo("home");
  const seoInitial = {
    el: { ...EMPTY_SEO, ...(homeSeo?.el ?? {}) },
    en: { ...EMPTY_SEO, ...(homeSeo?.en ?? {}) },
  };

  return (
    <CmsPage
      icon={<RiLayoutLine size={20} />}
      title="CMS — Αρχική"
      subtitle="Διαχείριση των ενοτήτων της αρχικής σελίδας"
    >
      <CmsCard title="SEO — Αρχική">
        <SeoEditor slug="home" initial={seoInitial} />
      </CmsCard>

      <CmsCard title="Ενότητες — σύρετε για αλλαγή σειράς">
        <LandingIndexClient
          initial={sections.map((s) => ({ id: s.id, type: s.type, enabled: s.enabled, order: s.order }))}
        />
      </CmsCard>
    </CmsPage>
  );
}
