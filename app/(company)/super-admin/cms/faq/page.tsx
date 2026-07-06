import { requirePermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { FaqClient } from "./FaqClient";

export default async function FaqCmsPage() {
  await requirePermission("cms-faq", "view");
  const faqs = await db.fAQ.findMany({ orderBy: { order: "asc" } });
  return <FaqClient initial={JSON.parse(JSON.stringify(faqs))} />;
}
