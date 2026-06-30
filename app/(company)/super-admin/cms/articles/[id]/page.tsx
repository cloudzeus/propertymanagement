import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { listAuthors } from "@/lib/cms/blog";
import { ArticleEditor } from "./ArticleEditor";

export default async function ArticleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [article, authors] = await Promise.all([
    db.article.findUnique({ where: { id } }),
    listAuthors(),
  ]);
  if (!article) notFound();
  return (
    <ArticleEditor
      article={JSON.parse(JSON.stringify(article))}
      authors={JSON.parse(JSON.stringify(authors))}
    />
  );
}
