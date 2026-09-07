import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getChromeSection } from "@/lib/cms/landing";
import { pickLocale } from "@/lib/i18n/translatable";
import type { Locale } from "@/i18n";
import type { FooterData } from "@/lib/cms/landing-types";

/**
 * Handoff 02 §2 names the columns Product / Company / Resources. Only routes
 * that actually exist are linked — About, Careers, Security, Help centre and
 * the API docs are still unwritten, so they are left out rather than shipped
 * as dead links. Everything here is overridden by the FOOTER CMS section.
 */
const COLUMNS: {
  title: { el: string; en: string };
  links: { href: string; el: string; en: string }[];
}[] = [
  {
    title: { el: "Προϊόν", en: "Product" },
    links: [
      { href: "/pricing", el: "Τιμές", en: "Pricing" },
      { href: "/#features", el: "Δυνατότητες", en: "Features" },
      { href: "/#calc", el: "Κοστολόγιο", en: "Calculator" },
      { href: "/services", el: "Υπηρεσίες", en: "Solutions" },
    ],
  },
  {
    title: { el: "Εταιρία", en: "Company" },
    links: [
      { href: "/blog", el: "Νέα", en: "News" },
      { href: "/contact", el: "Επικοινωνία", en: "Contact" },
    ],
  },
  {
    title: { el: "Πόροι", en: "Resources" },
    links: [
      { href: "/faq", el: "Συχνές ερωτήσεις", en: "FAQ" },
      { href: "/privacy", el: "Απόρρητο", en: "Privacy" },
      { href: "/terms", el: "Όροι χρήσης", en: "Terms" },
      { href: "/cookie-policy", el: "Πολιτική cookies", en: "Cookie policy" },
    ],
  },
];

const TAGLINE = {
  el: "Κάθε κτήριο, υπό έλεγχο. Διαχείριση πολυκατοικιών, κοινοχρήστων και εργασιών σε μία πλατφόρμα.",
  en: "Every building, under control. Manage shared expenses, tasks and communication in one platform.",
};

const RIGHTS = { el: "Με επιφύλαξη παντός δικαιώματος.", en: "All rights reserved." };
const PLACE = { el: "Αθήνα · Ελλάδα", en: "Athens · Greece" };

export async function LandingFooter() {
  const raw = await getLocale();
  const locale = raw === "en" ? "en" : "el";
  const cms = await getChromeSection("FOOTER");
  const data = cms ? (pickLocale(cms as any, locale as Locale) as FooterData) : null;

  const columns = data?.columns?.length
    ? data.columns.map((c) => ({ title: c.heading, links: c.links.map((l) => ({ href: l.href, label: l.label })) }))
    : COLUMNS.map((c) => ({ title: c.title[locale], links: c.links.map((l) => ({ href: l.href, label: l[locale] })) }));
  const tagline = data?.tagline || TAGLINE[locale];
  const copyright =
    data?.copyright || `© ${new Date().getFullYear()} Orithon. ${RIGHTS[locale]}`;

  return (
    <footer className="border-t border-[var(--line2)]">
      <div className="mx-auto max-w-[1200px] px-5 pb-10 pt-14 sm:px-7">
        <div className="flex flex-wrap justify-between gap-10">
          {/* Brand block */}
          <div style={{ maxWidth: 300 }}>
            <div className="flex items-center gap-[11px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/orithon/orithon-symbol-black.png" alt="Orithon" width={24} height={24} className="h-6 w-6 object-contain" />
              <span
                className="text-[19px] font-semibold text-[var(--txt)]"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.16em", paddingLeft: ".06em" }}
              >
                ORITHON
              </span>
            </div>
            <p className="mt-4 text-[14px] leading-[1.6] text-[var(--mut)]">{tagline}</p>
          </div>

          {/* Link columns */}
          <div className="flex flex-wrap gap-10 lg:gap-[60px]">
            {columns.map((col) => (
              <div key={col.title}>
                <div className="u-caps mb-4 text-[12px] font-bold tracking-[.08em] text-[var(--mut2)]">
                  {col.title}
                </div>
                <ul>
                  {col.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link
                        href={link.href}
                        className="block py-1.5 text-[14px] text-[var(--mut)] transition-colors hover:text-[var(--txt)]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-[46px] flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line2)] pt-6 text-[13px] text-[var(--mut2)]">
          <p>{copyright}</p>
          <p>{PLACE[locale]}</p>
        </div>
      </div>
    </footer>
  );
}
