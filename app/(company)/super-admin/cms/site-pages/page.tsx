import Link from "next/link";
import { RiLayoutMasonryLine, RiExternalLinkLine } from "react-icons/ri";
import { requirePermission } from "@/lib/rbac/permissions";
import { ensureMarketingPages } from "@/lib/cms/marketing-pages.server";
import { MARKETING_PAGE_META, MARKETING_PAGE_SLUGS } from "@/lib/cms/marketing-pages";
import { CmsPage, CmsCard } from "@/components/cms/ui";

export const dynamic = "force-dynamic";

export default async function SitePagesIndex() {
  await requirePermission("cms-site-pages", "view");
  await ensureMarketingPages();

  return (
    <CmsPage
      icon={<RiLayoutMasonryLine size={20} />}
      title="CMS — Δημόσιες σελίδες"
      subtitle="Κείμενα και δομή των σελίδων Τιμές, Νέα, FAQ και Επικοινωνία"
    >
      <CmsCard title="Σελίδες">
        <div style={{ display: "grid", gap: 12 }}>
          {MARKETING_PAGE_SLUGS.map((slug) => {
            const meta = MARKETING_PAGE_META[slug];
            return (
              <div
                key={slug}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  background: "var(--card)",
                  padding: 16,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{meta.label}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 3 }}>
                    {meta.description}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
                  <Link
                    href={meta.path}
                    target="_blank"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--muted-foreground)" }}
                  >
                    <RiExternalLinkLine size={14} /> {meta.path}
                  </Link>
                  <Link
                    href={`/super-admin/cms/site-pages/${slug}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      borderRadius: 8,
                      background: "var(--primary)",
                      color: "var(--primary-foreground)",
                      padding: "8px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Επεξεργασία
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </CmsCard>

      <CmsCard title="Πού αλλάζει τι">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.7 }}>
          <li>Τα πακέτα τιμών (όνομα, τιμή, ελάχιστο ανά κτήριο, χαρακτηριστικά) → <Link href="/super-admin/cms/pricing" style={{ textDecoration: "underline" }}>CMS: Τιμές</Link>.</li>
          <li>Οι ερωτήσεις και οι απαντήσεις → <Link href="/super-admin/cms/faq" style={{ textDecoration: "underline" }}>CMS: FAQ</Link>.</li>
          <li>Τα άρθρα και οι συγγραφείς → <Link href="/super-admin/cms/articles" style={{ textDecoration: "underline" }}>CMS: Άρθρα</Link>.</li>
          <li>Οι τιμές του κοστολογίου και η έκπτωση ετήσιας χρέωσης → <Link href="/super-admin/cms/landing/CALCULATOR" style={{ textDecoration: "underline" }}>Αρχική → Κοστολόγιο</Link>.</li>
        </ul>
      </CmsCard>
    </CmsPage>
  );
}
