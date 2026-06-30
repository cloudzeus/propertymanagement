import { getLocale } from "next-intl/server";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { getLandingSections } from "@/lib/cms/landing";
import { renderSection } from "@/components/landing/section-registry";
import { pickLocale } from "@/lib/i18n/translatable";
import type { Locale } from "@/i18n";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema, webSiteSchema } from "@/lib/seo/schema";
import { getPageSeo } from "@/lib/cms/page-seo";
import { buildMetadata } from "@/lib/seo/metadata";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://property.dgsmart.gr";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getPageSeo("home");
  const seo = t ? pickLocale(t, locale as Locale) : { title: "PropertyPro", description: "" };
  return buildMetadata({ seo, locale: locale as Locale, path: "/", baseUrl: BASE });
}

export default async function Home() {
  const locale = (await getLocale()) as Locale;
  let sections: Awaited<ReturnType<typeof getLandingSections>> = [];
  try { sections = await getLandingSections(); } catch { sections = []; }
  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[organizationSchema({ name: "PropertyPro", url: BASE }), webSiteSchema({ name: "PropertyPro", url: BASE })]} />
      <LandingHeader />
      <main>{sections.map((s) => renderSection(s.type, pickLocale(s.data as any, locale), s.id))}</main>
      <LandingFooter />
    </div>
  );
}
