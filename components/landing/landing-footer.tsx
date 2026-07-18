import Link from "next/link";
import { getLocale } from "next-intl/server";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { getChromeSection } from "@/lib/cms/landing";
import { pickLocale } from "@/lib/i18n/translatable";
import type { Locale } from "@/i18n";
import type { FooterData } from "@/lib/cms/landing-types";

const COLUMNS: {
  title: { el: string; en: string };
  links: { href: string; el: string; en: string }[];
}[] = [
  {
    title: { el: "Προϊόν", en: "Product" },
    links: [
      { href: "/pricing", el: "Τιμολόγηση", en: "Pricing" },
      { href: "/services", el: "Υπηρεσίες", en: "Solutions" },
      { href: "/faq", el: "Συχνές ερωτήσεις", en: "FAQ" },
    ],
  },
  {
    title: { el: "Εταιρία", en: "Company" },
    links: [
      { href: "/blog", el: "Blog", en: "Blog" },
      { href: "/contact", el: "Επικοινωνία", en: "Contact" },
    ],
  },
  {
    title: { el: "Νομικά", en: "Legal" },
    links: [
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

export async function LandingFooter() {
  const raw = await getLocale();
  const locale = raw === "en" ? "en" : "el";
  const cms = await getChromeSection("FOOTER");
  const data = cms ? (pickLocale(cms as any, locale as Locale) as FooterData) : null;

  const columns = data?.columns?.length
    ? data.columns.map((c) => ({ title: c.heading, links: c.links.map((l) => ({ href: l.href, label: l.label })) }))
    : COLUMNS.map((c) => ({ title: c.title[locale], links: c.links.map((l) => ({ href: l.href, label: l[locale] })) }));
  const tagline = data?.tagline || TAGLINE[locale];
  const copyright = data?.copyright || `© ${new Date().getFullYear()} Orithon · Athens · Greece`;

  return (
    <footer className="border-t" style={{ borderColor: "rgba(27,28,26,.07)" }}>
      <div className="mx-auto max-w-[1200px] px-5 sm:px-7 pt-14 pb-10">
        <div className="flex flex-col gap-12 md:flex-row md:justify-between">
          {/* Brand block */}
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/orithon/orithon-symbol-black.png" alt="Orithon" width={24} height={24} className="h-6 w-6 object-contain" />
              <span
                className="text-[19px] font-semibold text-[var(--foreground)]"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.16em" }}
              >
                ORITHON
              </span>
            </div>
            <p className="mt-4 text-sm text-[var(--muted-foreground)] leading-relaxed">
              {tagline}
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {columns.map((col) => (
              <div key={col.title}>
                <div className="mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                  {col.title}
                </div>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
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

        {/* Bottom bar */}
        <div
          className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row"
          style={{ borderColor: "rgba(27,28,26,.07)" }}
        >
          <p className="text-[13px] text-[var(--muted-foreground)]">{copyright}</p>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}
