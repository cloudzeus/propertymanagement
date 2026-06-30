import Link from "next/link";

const LINKS = [
  { href: "/pricing", label: "Τιμολόγηση" },
  { href: "/faq", label: "Συχνές ερωτήσεις" },
  { href: "/contact", label: "Επικοινωνία" },
  { href: "/privacy", label: "Απόρρητο" },
  { href: "/terms", label: "Όροι χρήσης" },
  { href: "/cookie-policy", label: "Πολιτική cookies" },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-gray-600 transition hover:text-gray-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="mt-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Property Management. Με επιφύλαξη παντός δικαιώματος.
        </p>
      </div>
    </footer>
  );
}
