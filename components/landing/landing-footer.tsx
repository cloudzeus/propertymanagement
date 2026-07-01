import Link from "next/link";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Προϊόν",
    links: [
      { href: "/pricing", label: "Τιμολόγηση" },
      { href: "/services", label: "Υπηρεσίες" },
      { href: "/faq", label: "Συχνές ερωτήσεις" },
    ],
  },
  {
    title: "Εταιρία",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/contact", label: "Επικοινωνία" },
    ],
  },
  {
    title: "Νομικά",
    links: [
      { href: "/privacy", label: "Απόρρητο" },
      { href: "/terms", label: "Όροι χρήσης" },
      { href: "/cookie-policy", label: "Πολιτική cookies" },
    ],
  },
];

export function LandingFooter() {
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
              Κάθε κτήριο, υπό έλεγχο. Διαχείριση πολυκατοικιών, κοινοχρήστων και εργασιών σε μία πλατφόρμα.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <div className="mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                  {col.title}
                </div>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
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
          <p className="text-[13px] text-[var(--muted-foreground)]">
            © {new Date().getFullYear()} Orithon · Athens · Greece
          </p>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}
