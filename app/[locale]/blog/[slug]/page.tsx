import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n";
import { getArticleBySlug, localizedArticle } from "@/lib/cms/blog";
import { getMediaByIds } from "@/lib/cms/media";
import { getSiteSettings } from "@/lib/cms/site-settings";
import { pickLocale } from "@/lib/i18n/translatable";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE_BASE } from "@/lib/seo/page-metadata";
import { articleSchema, breadcrumbSchema } from "@/lib/seo/schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { Markdown } from "@/components/cms/Markdown";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Gallery } from "./Gallery";

// Reads articles from the DB, so it must not be statically prerendered at
// build time (no database during the Docker build).
export const dynamic = "force-dynamic";

// Convert a YouTube/Vimeo watch URL to its embeddable src. If the URL already
// looks like an embed/iframe src, return it unchanged.
function embedToSrc(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (host.endsWith("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith("/shorts/")) {
        return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
      }
    }
    if (host.endsWith("vimeo.com")) {
      if (host === "player.vimeo.com") return url;
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    /* fall through */
  }
  return url;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const a = await getArticleBySlug(slug);
  if (!a) return {};
  const loc = localizedArticle(a, locale as Locale);
  const featuredUrl = a.featuredMediaId
    ? (await getMediaByIds([a.featuredMediaId]))[0]?.url
    : undefined;
  const site = await getSiteSettings();

  const seo = a.seo
    ? pickLocale(a.seo as any, locale as Locale)
    : { title: loc.title, description: loc.excerpt };
  if (!seo.ogImage && featuredUrl) seo.ogImage = featuredUrl;

  return buildMetadata({
    seo,
    locale: locale as Locale,
    path: `/blog/${slug}`,
    baseUrl: SITE_BASE,
    defaultOgImage: featuredUrl ?? site.defaultOgImage ?? undefined,
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const a = await getArticleBySlug(slug);
  if (!a || a.status !== "PUBLISHED") notFound();

  const locale = (await getLocale()) as Locale;
  const loc = localizedArticle(a, locale);

  const featured = (await getMediaByIds([a.featuredMediaId].filter(Boolean) as string[]))[0];
  const gallery = await getMediaByIds(((a.galleryMediaIds as string[] | null) ?? []));
  const avatar = a.author?.avatarMediaId
    ? (await getMediaByIds([a.author.avatarMediaId]))[0]
    : null;

  const date = new Intl.DateTimeFormat(locale).format(new Date(a.publishedAt ?? a.createdAt));
  const published = a.publishedAt ?? a.createdAt;

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {a.featuredEmbedUrl ? (
          <div className="aspect-video overflow-hidden rounded-xl">
            <iframe
              src={embedToSrc(a.featuredEmbedUrl)}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : featured?.type === "VIDEO" ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={featured.url} controls className="w-full rounded-xl" />
        ) : featured ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={featured.url} alt={loc.title} className="w-full rounded-xl" />
        ) : null}

        <h1 className="mt-8 text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
          {loc.title}
        </h1>

        {(a.author?.name || date) && (
          <div className="mt-4 flex items-center gap-3 text-sm text-gray-600">
            {avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar.url}
                alt={a.author?.name ?? ""}
                className="h-9 w-9 rounded-full object-cover"
              />
            )}
            {a.author?.name && <span className="font-medium text-gray-900">{a.author.name}</span>}
            {a.author?.name && <span aria-hidden>·</span>}
            <time>{date}</time>
          </div>
        )}

        <div className="mt-8">
          <Markdown>{loc.body}</Markdown>
        </div>

        {gallery.length > 0 && (
          <Gallery items={gallery.map((m) => ({ url: m!.url, alt: m!.alt ?? "" }))} />
        )}

        {a.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2 border-t border-gray-100 pt-6">
            {a.tags.map((t) => (
              <Link
                key={t}
                href={`/blog?tag=${encodeURIComponent(t)}`}
                className="inline-block rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 transition hover:bg-gray-50"
              >
                {t}
              </Link>
            ))}
          </div>
        )}

        <JsonLd
          data={[
            articleSchema({
              headline: loc.title,
              url: `${SITE_BASE}/blog/${a.slug}`,
              description: loc.excerpt,
              image: featured?.url,
              datePublished: published?.toISOString?.() ?? undefined,
              authorName: a.author?.name,
            }),
            breadcrumbSchema([
              { name: "Home", url: SITE_BASE },
              { name: "Blog", url: `${SITE_BASE}/blog` },
              { name: loc.title, url: `${SITE_BASE}/blog/${a.slug}` },
            ]),
          ]}
        />
      </main>
      <LandingFooter />
    </div>
  );
}
