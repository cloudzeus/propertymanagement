import Link from "next/link";
import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n";
import {
  getPublishedArticles,
  countPublishedArticles,
  allPublishedTags,
  localizedArticle,
  readMinutes,
} from "@/lib/cms/blog";
import { getMediaByIds } from "@/lib/cms/media";
import { getMarketingPage } from "@/lib/cms/marketing-pages.server";
import { buildPageMetadata, SITE_BASE } from "@/lib/seo/page-metadata";
import { breadcrumbSchema } from "@/lib/seo/schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { MarketingShell } from "@/components/site/MarketingShell";
import { NewsletterStrip } from "@/components/site/NewsletterStrip";
import { PostCard, type PostSummary } from "@/components/site/PostCard";
import { ImagePlaceholder, MetaRow, PageHeader, Tag, Wrap, btnClass } from "@/components/site/kit";

// Reads articles from the DB, so it must not be statically prerendered at
// build time (no database during the Docker build).
export const dynamic = "force-dynamic";

const PER = 12;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return buildPageMetadata("blog", locale as Locale, "/blog");
}

export default async function BlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; tag?: string; category?: string }>;
}) {
  await params;
  const sp = await searchParams;
  const locale = (await getLocale()) as Locale;
  const lang = locale === "en" ? "en" : "el";

  const page = Math.max(1, Number(sp.page) || 1);
  // `category` is the shareable name from the design; `tag` stays as an alias so
  // links that predate the redesign keep working.
  const active = sp.category || sp.tag || "";

  const [content, articles, total, tags] = await Promise.all([
    getMarketingPage("news", locale),
    getPublishedArticles({ tag: active || undefined, take: PER, skip: (page - 1) * PER }),
    countPublishedArticles(active || undefined),
    allPublishedTags(),
  ]);

  const media = await getMediaByIds(
    articles.map((a) => a.featuredMediaId).filter(Boolean) as string[],
  );
  const mediaById = new Map(media.map((m) => [m!.id, m!]));

  const dateFmt = new Intl.DateTimeFormat(lang === "el" ? "el-GR" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function toSummary(a: (typeof articles)[number]): PostSummary {
    const la = localizedArticle(a, locale);
    const asset = a.featuredMediaId ? mediaById.get(a.featuredMediaId) : undefined;
    return {
      slug: a.slug,
      title: la.title,
      excerpt: la.excerpt,
      category: a.tags[0] ?? null,
      imageUrl: asset?.url ?? null,
      imageAlt: asset?.alt ?? null,
      date: dateFmt.format(new Date(a.publishedAt ?? a.createdAt)),
      readTime: la.body ? content.readTimeTemplate.replace("{minutes}", String(readMinutes(la.body))) : null,
      author: a.author?.name ?? null,
    };
  }

  // The newest unfiltered article leads the page. Under a filter or on page 2+
  // every result is an equal card — a "featured" item there would be arbitrary.
  const showFeatured = page === 1 && !active && articles.length > 0;
  const featured = showFeatured ? toSummary(articles[0]) : null;
  const rest = (showFeatured ? articles.slice(1) : articles).map(toSummary);

  // Categories the editor listed, plus any tag in use that they have not named.
  const chips = [
    ...content.categories,
    ...tags
      .filter((t) => !content.categories.some((c) => c.slug === t))
      .map((t) => ({ slug: t, label: t })),
  ];

  const totalPages = Math.max(1, Math.ceil(total / PER));
  const catQuery = active ? `&category=${encodeURIComponent(active)}` : "";

  return (
    <MarketingShell>
      <PageHeader
        eyebrow={content.header.eyebrow}
        title={content.header.title}
        lead={content.header.lead}
        titleMaxWidth={760}
      >
        <div className="mt-[34px] flex flex-wrap gap-[9px]">
          {chips.map((c) => {
            const on = c.slug === active;
            return (
              <Link
                key={c.slug || "all"}
                href={c.slug ? `/blog?category=${encodeURIComponent(c.slug)}` : "/blog"}
                className={`flex min-h-[44px] items-center rounded-full px-4 text-[13.5px] transition-colors ${
                  on
                    ? "bg-[var(--ink-chip)] font-bold text-white"
                    : "border border-[var(--line)] bg-white font-semibold text-[var(--mut)] hover:text-[var(--txt)]"
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      </PageHeader>

      <Wrap className="pb-4">
        {articles.length === 0 ? (
          <p className="py-16 text-[var(--mut)]">
            {lang === "el" ? "Δεν υπάρχουν άρθρα ακόμη." : "No articles yet."}
          </p>
        ) : (
          <>
            {featured && (
              <Link
                href={`/blog/${featured.slug}`}
                className="mt-12 grid overflow-hidden rounded-[22px] border border-[var(--line)] bg-white shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-[180ms] ease-[cubic-bezier(.2,.7,.3,1)] hover:-translate-y-[3px] hover:shadow-[var(--shadow-feature)] lg:grid-cols-[1.08fr_.92fr]"
              >
                <div className="min-h-[260px] lg:min-h-[380px]">
                  <ImagePlaceholder label={featured.imageAlt || featured.title} src={featured.imageUrl} />
                </div>
                <div className="flex flex-col justify-center px-7 py-10 sm:px-[46px] sm:py-11">
                  {featured.category ? <div><Tag>{featured.category}</Tag></div> : null}
                  <h2 className="mb-3.5 mt-5 text-[26px] font-extrabold leading-[1.05] tracking-[-.02em] sm:text-[33px]">
                    {featured.title}
                  </h2>
                  {featured.excerpt ? (
                    <p className="text-[16px] leading-[1.62] text-[var(--mut)]">{featured.excerpt}</p>
                  ) : null}
                  <div className="mt-[18px]">
                    <MetaRow items={[featured.author, featured.date, featured.readTime]} />
                  </div>
                  <span className={btnClass("ghost", "sm", "mt-[26px] self-start")}>
                    {content.featuredCtaLabel}
                  </span>
                </div>
              </Link>
            )}

            {rest.length > 0 && (
              <div className="mt-6 grid gap-5 min-[560px]:grid-cols-2 lg:grid-cols-3">
                {rest.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>
            )}

            {page < totalPages && (
              <div className="mt-11 flex justify-center">
                <Link href={`/blog?page=${page + 1}${catQuery}`} className={btnClass("ghost")}>
                  {content.loadMoreLabel}
                </Link>
              </div>
            )}

            {page > 1 && (
              <div className="mt-4 flex justify-center">
                <Link
                  href={page - 1 === 1 ? `/blog${active ? `?category=${encodeURIComponent(active)}` : ""}` : `/blog?page=${page - 1}${catQuery}`}
                  className="text-[13.5px] text-[var(--mut)] hover:text-[var(--txt)]"
                >
                  {lang === "el" ? "← Προηγούμενη σελίδα" : "← Previous page"}
                </Link>
              </div>
            )}
          </>
        )}

        <NewsletterStrip {...content.newsletter} />
      </Wrap>

      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: SITE_BASE },
          { name: content.header.eyebrow, url: `${SITE_BASE}/blog` },
        ])}
      />
    </MarketingShell>
  );
}
