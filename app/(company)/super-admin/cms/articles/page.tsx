import { db } from "@/lib/db";
import { ArticlesClient } from "./ArticlesClient";

export default async function ArticlesCmsPage() {
  const articles = await db.article.findMany({
    orderBy: { updatedAt: "desc" },
    include: { author: true },
  });
  return <ArticlesClient initial={JSON.parse(JSON.stringify(articles))} />;
}
