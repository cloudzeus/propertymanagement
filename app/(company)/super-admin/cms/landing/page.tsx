import { getAllLandingSections } from "@/lib/cms/landing";
import { getPageSeo } from "@/lib/cms/page-seo";
import { toggleSection, reorderSection } from "@/app/actions/landing-cms";
import { SectionEditor } from "./SectionEditor";
import { SeoEditor } from "./SeoEditor";
import { CmsPage, CmsCard } from "@/components/cms/ui";
import { RiLayoutLine, RiArrowUpLine, RiArrowDownLine } from "react-icons/ri";
import type { SeoMeta } from "@/lib/seo/types";

const EMPTY_SEO: SeoMeta = { title: "", description: "" };

const ctrlBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  background: "transparent",
  color: "var(--foreground)",
  border: "1px solid var(--border)",
};

export default async function LandingCmsPage() {
  const sections = await getAllLandingSections();
  const homeSeo = await getPageSeo("home");
  const seoInitial = {
    el: { ...EMPTY_SEO, ...(homeSeo?.el ?? {}) },
    en: { ...EMPTY_SEO, ...(homeSeo?.en ?? {}) },
  };

  return (
    <CmsPage
      icon={<RiLayoutLine size={20} />}
      title="CMS — Αρχική"
      subtitle="Διαχείριση των ενοτήτων της αρχικής σελίδας"
    >
      <CmsCard title="SEO — Αρχική">
        <SeoEditor slug="home" initial={seoInitial} />
      </CmsCard>

      {sections.map((s) => (
        <CmsCard key={s.id}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--foreground)",
                }}
              >
                {s.type}
              </span>
              <span
                style={{
                  borderRadius: 999,
                  padding: "2px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  background: s.enabled
                    ? "color-mix(in srgb, var(--color-success) 14%, white)"
                    : "var(--muted)",
                  color: s.enabled ? "var(--color-success)" : "var(--muted-foreground)",
                }}
              >
                {s.enabled ? "Ενεργό" : "Ανενεργό"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <form action={reorderSection.bind(null, s.id, "up")}>
                <button type="submit" title="Πάνω" style={ctrlBtnStyle}>
                  <RiArrowUpLine size={15} />
                </button>
              </form>
              <form action={reorderSection.bind(null, s.id, "down")}>
                <button type="submit" title="Κάτω" style={ctrlBtnStyle}>
                  <RiArrowDownLine size={15} />
                </button>
              </form>
              <form action={toggleSection.bind(null, s.id)}>
                <button type="submit" style={ctrlBtnStyle}>
                  {s.enabled ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                </button>
              </form>
            </div>
          </div>

          <SectionEditor section={{ id: s.id, type: s.type, data: s.data }} />
        </CmsCard>
      ))}
    </CmsPage>
  );
}
