import Link from "next/link";

const EDITORS: { label: string; href: string; desc: string }[] = [
  { label: "Τιμές", href: "/super-admin/cms/pricing", desc: "Πακέτα & τιμολόγηση" },
  { label: "FAQ", href: "/super-admin/cms/faq", desc: "Συχνές ερωτήσεις" },
  { label: "Υπηρεσίες", href: "/super-admin/cms/pages/services", desc: "Σελίδα υπηρεσιών" },
  { label: "Επικοινωνία", href: "/super-admin/cms/pages/contact", desc: "Σελίδα επικοινωνίας" },
  { label: "Πολιτική απορρήτου", href: "/super-admin/cms/pages/privacy", desc: "Privacy policy" },
  { label: "Όροι χρήσης", href: "/super-admin/cms/pages/terms", desc: "Terms of service" },
  { label: "Πολιτική cookies", href: "/super-admin/cms/pages/cookie-policy", desc: "Cookie policy" },
];

export default function CmsPagesHub() {
  return (
    <div className="p-6 sm:p-8">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Σελίδες</h1>
      <p className="mb-6 text-sm text-slate-500">
        Επεξεργασία περιεχομένου των δημόσιων σελίδων του ιστότοπου.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EDITORS.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <h2 className="text-base font-semibold text-slate-900 group-hover:text-blue-600">
              {e.label}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{e.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
