import { getEffectiveSession } from "@/lib/auth-effective";
import { findArticleForPath, getArticle, loadWikiIndex, hubHrefForRole } from "@/lib/help/index";
import { MANUALS, manualForRole } from "@/lib/help";
import { relatedArticles } from "@/lib/help/hub";
import { anchorForTab } from "@/lib/help/anchors";

/**
 * GET /api/help/article?path=/admin/maintenance&s=tab → the role-filtered wiki article for that page (404 + fallback when none),
 * with `anchor` = the heading id the tab maps to. `&fields=prompts` returns only `{ prompts }` (cheap: no markdown, no index walk).
 */
export async function GET(request: Request) {
  const eff = await getEffectiveSession();
  if (!eff) return new Response("Unauthorized", { status: 401 });
  const role = eff.user.role as string;
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "/";
  const hubHref = hubHrefForRole(role);

  const meta = await findArticleForPath(path, role);
  if (url.searchParams.get("fields") === "prompts") return Response.json({ prompts: meta?.prompts ?? [] });
  const article = meta ? await getArticle(meta.slug, role) : null;
  if (!meta || !article) {
    const manual = manualForRole(role);
    return Response.json({ fallback: { title: MANUALS[manual].title, hubHref, manualHref: `${hubHref}?m=${manual}` } }, { status: 404 });
  }
  const related = relatedArticles(await loadWikiIndex(), meta.related, role);
  const anchor = anchorForTab(article.markdown, meta.sections ?? [], url.searchParams.get("s") ?? "");
  return Response.json({
    slug: meta.slug, title: meta.title, route: meta.route, summary: meta.summary, markdown: article.markdown, prompts: meta.prompts, related, anchor,
    kind: meta.kind, video: meta.video ?? null, videoPoster: meta.videoPoster ?? null, minutes: meta.minutes ?? null,
    hubHref, openInHub: `${hubHref}?a=${encodeURIComponent(meta.slug)}`,
  });
}
