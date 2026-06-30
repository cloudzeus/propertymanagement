import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n";
import { getCmsPage, localizedCmsPage } from "@/lib/cms/pages";
import { buildPageMetadata, SITE_BASE } from "@/lib/seo/page-metadata";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/lib/seo/schema";
import { Markdown } from "@/components/cms/Markdown";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";

const SLUG = "terms";
const PATH = "/terms";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return buildPageMetadata(SLUG, locale as Locale, PATH);
}

export default async function Page() {
  const locale = (await getLocale()) as Locale;
  const row = await getCmsPage(SLUG);
  const c = row ? localizedCmsPage(row as any, locale) : { title: SLUG, body: "" };
  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={breadcrumbSchema([{ name: "Home", url: SITE_BASE }, { name: c.title, url: `${SITE_BASE}${PATH}` }])} />
      <LandingHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold tracking-tight mb-8">{c.title}</h1>
        <Markdown>{c.body}</Markdown>
      </main>
      <LandingFooter />
    </div>
  );
}
