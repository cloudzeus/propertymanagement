import { getLocale } from "next-intl/server";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { getLandingSections } from "@/lib/cms/landing";
import { renderSection } from "@/components/landing/section-registry";
import { pickLocale } from "@/lib/i18n/translatable";
import type { Locale } from "@/i18n";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildSiteSchemas } from "@/lib/seo/site-schema";
import { getPageSeo } from "@/lib/cms/page-seo";
import { buildMetadata } from "@/lib/seo/metadata";
import { getSiteSettings } from "@/lib/cms/site-settings";
import { getAppSettings } from "@/lib/app-settings";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://property.dgsmart.gr";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, site] = await Promise.all([getPageSeo("home"), getSiteSettings()]);
  const seo = t ? pickLocale(t, locale as Locale) : { title: "PropertyPro", description: "" };
  return buildMetadata({ seo, locale: locale as Locale, path: "/", baseUrl: BASE, defaultOgImage: site.defaultOgImage ?? undefined });
}

export default async function Home() {
  const locale = (await getLocale()) as Locale;
  const [site, app] = await Promise.all([getSiteSettings(), getAppSettings()]);
  const schemas = buildSiteSchemas(site, BASE, app.logoFullLight ?? app.logoUrl ?? undefined);
  let sections: Awaited<ReturnType<typeof getLandingSections>> = [];
  try { sections = await getLandingSections(); } catch { sections = []; }
  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={schemas} />
      <LandingHeader />
      <main>{sections.map((s) => renderSection(s.type, pickLocale(s.data as any, locale), s.id))}</main>
      <LandingFooter />
    </div>
  );
}
