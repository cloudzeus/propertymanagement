import { getEffectiveSession } from "@/lib/auth-effective";
import { findArticleForPath, getArticle, loadWikiIndex, hubHrefForRole } from "@/lib/help/index";
import { MANUALS, manualForRole } from "@/lib/help";

/** GET /api/help/article?path=/admin/maintenance&s=tab → the role-filtered wiki article for that page (404 + fallback when none). */
export async function GET(request: Request) {
  const eff = await getEffectiveSession();
  if (!eff) return new Response("Unauthorized", { status: 401 });
  const role = eff.user.role as string;
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "/";
  const hubHref = hubHrefForRole(role);

  const meta = await findArticleForPath(path, role);
  const article = meta ? await getArticle(meta.slug, role) : null;
  if (!meta || !article) {
    const manual = manualForRole(role);
    return Response.json({ fallback: { title: MANUALS[manual].title, hubHref, manualHref: `${hubHref}?m=${manual}` } }, { status: 404 });
  }
  const all = await loadWikiIndex();
  const related = meta.related.map((slug) => all.find((a) => a.slug === slug)).filter((a): a is NonNullable<typeof a> => !!a).map((a) => ({ slug: a.slug, title: a.title }));
  return Response.json({
    slug: meta.slug, title: meta.title, route: meta.route, summary: meta.summary, markdown: article.markdown, prompts: meta.prompts, related,
    hubHref, openInHub: `${hubHref}?a=${encodeURIComponent(meta.slug)}`,
  });
}
