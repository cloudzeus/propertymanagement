import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CmsPage } from "@/components/cms/ui";
import { SectionForm } from "./SectionForm";
import { LANDING_META } from "@/lib/cms/landing-meta";
import { RiLayoutLine } from "react-icons/ri";

export default async function SectionEditPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const section = await db.landingSection.findUnique({ where: { type } });
  if (!section) notFound();
  return (
    <CmsPage icon={<RiLayoutLine size={20} />} title={`CMS — ${LANDING_META[type]?.label ?? type}`} subtitle={LANDING_META[type]?.description ?? "Επεξεργασία ενότητας"}>
      <SectionForm section={JSON.parse(JSON.stringify(section))} />
    </CmsPage>
  );
}
