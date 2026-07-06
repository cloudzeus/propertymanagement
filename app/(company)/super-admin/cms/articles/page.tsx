import { requirePermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { ArticlesClient } from "./ArticlesClient";

export default async function ArticlesCmsPage() {
  await requirePermission("cms-articles", "view");
  const articles = await db.article.findMany({
    orderBy: { updatedAt: "desc" },
    include: { author: true },
  });
  return <ArticlesClient initial={JSON.parse(JSON.stringify(articles))} />;
}
