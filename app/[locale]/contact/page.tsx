import { getLocale } from "next-intl/server";
import { RiPhoneLine, RiMailLine, RiFlagLine } from "react-icons/ri";
import type { Locale } from "@/i18n";
import { getMarketingPage } from "@/lib/cms/marketing-pages.server";
import { buildPageMetadata, SITE_BASE } from "@/lib/seo/page-metadata";
import { JsonLd } from "@/components/seo/JsonLd";
import { contactPageSchema, breadcrumbSchema } from "@/lib/seo/schema";
import { MarketingShell } from "@/components/site/MarketingShell";
import { Card, DarkPanel, IconBadge, ImagePlaceholder, PageHeader, Wrap } from "@/components/site/kit";
import { ContactForm } from "./ContactForm";

const PATH = "/contact";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return buildPageMetadata("contact", locale as Locale, PATH);
}

const ICONS = { phone: RiPhoneLine, mail: RiMailLine, flag: RiFlagLine };

export default async function Page() {
  const locale = (await getLocale()) as Locale;
  const content = await getMarketingPage("contact", locale);

  return (
    <MarketingShell>
      <PageHeader
        eyebrow={content.header.eyebrow}
        title={content.header.title}
        lead={content.header.lead}
        titleMaxWidth={700}
      />

      <Wrap className="pb-4">
        <div className="mt-[52px] grid items-start gap-[26px] lg:grid-cols-[1.1fr_.9fr]">
          <ContactForm content={content.form} />

          <div className="flex flex-col gap-3.5">
            {content.cards.map((card) => {
              const Icon = ICONS[card.icon] ?? RiMailLine;
              return (
                <Card key={card.title} radius={18} className="px-[26px] py-6">
                  <IconBadge size={38}>
                    <Icon size={15} />
                  </IconBadge>
                  <div className="mt-4 text-[15.5px] font-bold">{card.title}</div>
                  <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[var(--mut)]">{card.body}</p>
                  <a
                    href={card.href}
                    className="mt-3 inline-block text-[15px] font-bold text-[var(--accent)]"
                  >
                    {card.value}
                  </a>
                </Card>
              );
            })}

            <DarkPanel radius={18} className="px-[26px] py-6">
              <div className="text-[15.5px] font-bold text-white">{content.hours.heading}</div>
              <div className="mt-2">
                {content.hours.rows.map((row) => (
                  <div
                    key={row.day}
                    className="flex justify-between gap-4 border-b border-[rgba(255,255,255,.1)] py-[9px] text-[13.5px] last:border-b-0"
                  >
                    <span className="text-[rgba(255,255,255,.6)]">{row.day}</span>
                    <span className="tnum font-bold">{row.hours}</span>
                  </div>
                ))}
              </div>
            </DarkPanel>
          </div>
        </div>

        {/* Offices */}
        <div className="mt-14 grid gap-4 lg:grid-cols-2">
          {content.offices.map((office) => (
            <Card key={office.city} radius={18} className="reveal overflow-hidden">
              <div className="h-[170px]">
                <ImagePlaceholder label={office.city} src={office.imageUrl} />
              </div>
              <div className="px-6 pb-6 pt-[22px]">
                <div className="text-[17px] font-extrabold">{office.city}</div>
                <p className="mt-2 text-[13.5px] leading-[1.55] text-[var(--mut)]">{office.address}</p>
              </div>
            </Card>
          ))}
        </div>
      </Wrap>

      <JsonLd
        data={[
          contactPageSchema({ name: content.header.title, url: `${SITE_BASE}${PATH}` }),
          breadcrumbSchema([
            { name: "Home", url: SITE_BASE },
            { name: content.header.eyebrow, url: `${SITE_BASE}${PATH}` },
          ]),
        ]}
      />
    </MarketingShell>
  );
}
