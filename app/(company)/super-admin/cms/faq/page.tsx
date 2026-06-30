import { db } from "@/lib/db";
import { FaqClient } from "./FaqClient";

export default async function FaqCmsPage() {
  const faqs = await db.fAQ.findMany({ orderBy: { order: "asc" } });
  return <FaqClient initial={JSON.parse(JSON.stringify(faqs))} />;
}
