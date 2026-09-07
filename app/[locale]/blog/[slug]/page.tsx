import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n";
import {
  getArticleBySlug,
  getRelatedArticles,
  localizedArticle,
  readMinutes,
} from "@/lib/cms/blog";
import { getMediaByIds } from "@/lib/cms/media";
import { getSiteSettings } from "@/lib/cms/site-settings";
import { getMarketingPage } from "@/lib/cms/marketing-pages.server";
import { pickLocale } from "@/lib/i18n/translatable";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE_BASE } from "@/lib/seo/page-metadata";
import { articleSchema, breadcrumbSchema } from "@/lib/seo/schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { MarketingShell } from "@/components/site/MarketingShell";
import { ReadingProgress } from "@/components/site/ReadingProgress";
import { Prose } from "@/components/site/Prose";
import { ShareRow } from "@/components/site/ShareRow";
import { PostCard, type PostSummary } from "@/components/site/PostCard";
import {
  Avatar,
  Card,
  GlowBlob,
  Grain,
  ImagePlaceholder,
  Kicker,
  Tag,
  Wrap,
  btnClass,
} from "@/components/site/kit";
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
  const lang = locale === "en" ? "en" : "el";
  const loc = localizedArticle(a, locale);
  const content = await getMarketingPage("news", locale);

  const [featured, gallery, avatar, related] = await Promise.all([
    getMediaByIds([a.featuredMediaId].filter(Boolean) as string[]).then((m) => m[0]),
    getMediaByIds(((a.galleryMediaIds as string[] | null) ?? [])),
    a.author?.avatarMediaId ? getMediaByIds([a.author.avatarMediaId]).then((m) => m[0]) : null,
    getRelatedArticles(a.tags, a.slug, 3),
  ]);

  const relatedMedia = await getMediaByIds(
    related.map((r) => r.featuredMediaId).filter(Boolean) as string[],
  );
  const relatedById = new Map(relatedMedia.map((m) => [m!.id, m!]));

  const dateFmt = new Intl.DateTimeFormat(lang === "el" ? "el-GR" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const published = a.publishedAt ?? a.createdAt;
  const date = dateFmt.format(new Date(published));
  const readTime = loc.body
    ? content.readTimeTemplate.replace("{minutes}", String(readMinutes(loc.body)))
    : null;
  const category = a.tags[0] ?? null;

  const relatedPosts: PostSummary[] = related.map((r) => {
    const rl = localizedArticle(r, locale);
    const asset = r.featuredMediaId ? relatedById.get(r.featuredMediaId) : undefined;
    return {
      slug: r.slug,
      title: rl.title,
      excerpt: rl.excerpt,
      category: r.tags[0] ?? null,
      imageUrl: asset?.url ?? null,
      imageAlt: asset?.alt ?? null,
      date: dateFmt.format(new Date(r.publishedAt ?? r.createdAt)),
      readTime: rl.body ? content.readTimeTemplate.replace("{minutes}", String(readMinutes(rl.body))) : null,
      author: r.author?.name ?? null,
    };
  });

  return (
    <MarketingShell>
      <ReadingProgress />

      {/* Header — narrow column, over the same glow + grain as the other pages */}
      <section className="relative overflow-hidden pt-[74px]">
        <GlowBlob variant="header" />
        <Grain />
        <Wrap narrow={760} className="relative">
          <nav className="mb-[26px] flex flex-wrap items-center gap-2 text-[13px] text-[var(--mut2)]">
            <Link href="/blog" className="hover:text-[var(--txt)]">
              {content.article.breadcrumbRoot}
            </Link>
            {category ? (
              <>
                <span aria-hidden>›</span>
                <span>{category}</span>
              </>
            ) : null}
          </nav>

          {category ? <div><Tag>{category}</Tag></div> : null}

          <h1 className="mt-5 text-[34px] font-extrabold leading-[1.02] tracking-[-.03em] sm:text-[44px] lg:text-[52px]">
            {loc.title}
          </h1>

          {loc.excerpt ? (
            <p className="mt-[18px] text-[19px] leading-[1.62] text-[var(--mut)]">{loc.excerpt}</p>
          ) : null}

          <div className="mt-[30px] flex items-center gap-3.5">
            <Avatar size={46} src={avatar?.url} alt={a.author?.name ?? ""} />
            <div>
              {a.author?.name ? <div className="text-[14.5px] font-bold">{a.author.name}</div> : null}
              <div className="text-[12.5px] text-[var(--mut)]">
                {[date, readTime].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
        </Wrap>
      </section>

      {/* Hero media — wider than the text column */}
      {(a.featuredEmbedUrl || featured) && (
        <Wrap narrow={1000} className="mt-11">
          <div className="overflow-hidden rounded-[22px] border border-[var(--line)]">
            {a.featuredEmbedUrl ? (
              <div className="aspect-video">
                <iframe
                  src={embedToSrc(a.featuredEmbedUrl)}
                  title={loc.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : featured?.type === "VIDEO" ? (
              <video src={featured.url} controls className="w-full" />
            ) : (
              <div className="h-[280px] lg:h-[440px]">
                <ImagePlaceholder label={featured?.alt || loc.title} src={featured?.url} />
              </div>
            )}
          </div>
          {featured?.title ? (
            <p className="mt-3 text-center text-[12.5px] italic text-[var(--mut2)]">{featured.title}</p>
          ) : null}
        </Wrap>
      )}

      {/* Body */}
      <Wrap narrow={760} className="pb-5 pt-14">
        <div className="mx-auto" style={{ maxWidth: 720 }}>
          <Prose>{loc.body}</Prose>

          {gallery.length > 0 && (
            <Gallery items={gallery.map((m) => ({ url: m!.url, alt: m!.alt ?? "" }))} />
          )}

          <ShareRow label={content.article.shareLabel} title={loc.title} />

          {a.author?.name && (
            <Card radius={18} className="flex items-start gap-5 px-[30px] py-7">
              <Avatar size={62} src={avatar?.url} alt={a.author.name} />
              <div>
                <div className="text-[16.5px] font-extrabold">{a.author.name}</div>
                {a.author.bio ? (
                  <p className="mt-3 text-[14px] leading-[1.6] text-[var(--mut)]">
                    {pickLocale(a.author.bio as any, locale) as string}
                  </p>
                ) : null}
              </div>
            </Card>
          )}

          {a.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {a.tags.map((t) => (
                <Link
                  key={t}
                  href={`/blog?category=${encodeURIComponent(t)}`}
                  className="inline-block rounded-full border border-[var(--line2)] bg-[var(--paper)] px-3 py-1.5 text-[12.5px] text-[var(--mut)] transition-colors hover:text-[var(--txt)]"
                >
                  {t}
                </Link>
              ))}
            </div>
          )}
        </div>
      </Wrap>

      {/* Related band */}
      {relatedPosts.length > 0 && (
        <section className="mt-[60px] bg-[var(--section-alt)] py-[72px]">
          <Wrap>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
              <div>
                <Kicker>{content.article.relatedKicker}</Kicker>
                <h2 className="mt-3 text-[30px] font-extrabold leading-[1.05] tracking-[-.02em] sm:text-[36px]">
                  {content.article.relatedHeading}
                </h2>
              </div>
              <Link href="/blog" className={btnClass("ghost", "sm")}>
                {content.article.relatedCtaLabel}
              </Link>
            </div>
            <div className="grid gap-5 min-[560px]:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </Wrap>
        </section>
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
            { name: content.article.breadcrumbRoot, url: `${SITE_BASE}/blog` },
            { name: loc.title, url: `${SITE_BASE}/blog/${a.slug}` },
          ]),
        ]}
      />
    </MarketingShell>
  );
}
