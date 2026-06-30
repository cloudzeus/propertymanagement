import Link from "next/link";
import {
  RiPagesLine,
  RiPriceTag3Line,
  RiQuestionLine,
  RiToolsLine,
  RiMailLine,
  RiShieldUserLine,
  RiFileTextLine,
  RiCupLine,
} from "react-icons/ri";
import { CmsPage } from "@/components/cms/ui";

const EDITORS: { label: string; href: string; desc: string; icon: React.ReactNode }[] = [
  { label: "Τιμές", href: "/super-admin/cms/pricing", desc: "Πακέτα & τιμολόγηση", icon: <RiPriceTag3Line size={20} /> },
  { label: "FAQ", href: "/super-admin/cms/faq", desc: "Συχνές ερωτήσεις", icon: <RiQuestionLine size={20} /> },
  { label: "Υπηρεσίες", href: "/super-admin/cms/pages/services", desc: "Σελίδα υπηρεσιών", icon: <RiToolsLine size={20} /> },
  { label: "Επικοινωνία", href: "/super-admin/cms/pages/contact", desc: "Σελίδα επικοινωνίας", icon: <RiMailLine size={20} /> },
  { label: "Πολιτική απορρήτου", href: "/super-admin/cms/pages/privacy", desc: "Privacy policy", icon: <RiShieldUserLine size={20} /> },
  { label: "Όροι χρήσης", href: "/super-admin/cms/pages/terms", desc: "Terms of service", icon: <RiFileTextLine size={20} /> },
  { label: "Πολιτική cookies", href: "/super-admin/cms/pages/cookie-policy", desc: "Cookie policy", icon: <RiCupLine size={20} /> },
];

export default function CmsPagesHub() {
  return (
    <CmsPage
      icon={<RiPagesLine />}
      title="Σελίδες"
      subtitle="Διαχείριση περιεχομένου δημόσιων σελίδων"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {EDITORS.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 20,
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "color-mix(in srgb, var(--color-primary) 12%, white)",
                color: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {e.icon}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>{e.label}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{e.desc}</div>
          </Link>
        ))}
      </div>
    </CmsPage>
  );
}
