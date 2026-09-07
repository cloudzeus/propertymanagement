import Link from "next/link";
import { notFound } from "next/navigation";
import { RiLayoutMasonryLine } from "react-icons/ri";
import { requirePermission } from "@/lib/rbac/permissions";
import { getMarketingPageRaw } from "@/lib/cms/marketing-pages.server";
import { MARKETING_PAGE_META, isMarketingPageSlug } from "@/lib/cms/marketing-pages";
import { CmsPage } from "@/components/cms/ui";
import { PricingPageForm } from "./PricingPageForm";
import { NewsPageForm } from "./NewsPageForm";
import { FaqPageForm } from "./FaqPageForm";
import { ContactPageForm } from "./ContactPageForm";

export const dynamic = "force-dynamic";

export default async function SitePageEditor({ params }: { params: Promise<{ slug: string }> }) {
  await requirePermission("cms-site-pages", "edit");
  const { slug } = await params;
  if (!isMarketingPageSlug(slug)) notFound();

  const meta = MARKETING_PAGE_META[slug];
  const initial = JSON.parse(JSON.stringify(await getMarketingPageRaw(slug)));

  return (
    <CmsPage
      icon={<RiLayoutMasonryLine size={20} />}
      title={`CMS — ${meta.label}`}
      subtitle={meta.description}
    >
      <div style={{ marginBottom: 16, fontSize: 12.5 }}>
        <Link href="/super-admin/cms/site-pages" style={{ color: "var(--muted-foreground)" }}>
          ← Δημόσιες σελίδες
        </Link>
      </div>

      {slug === "pricing" && <PricingPageForm initial={initial} />}
      {slug === "news" && <NewsPageForm initial={initial} />}
      {slug === "faq" && <FaqPageForm initial={initial} />}
      {slug === "contact" && <ContactPageForm initial={initial} />}
    </CmsPage>
  );
}
