import Link from "next/link";
import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n";
import {
  getPublishedArticles,
  countPublishedArticles,
  allPublishedTags,
  localizedArticle,
} from "@/lib/cms/blog";
import { getMediaByIds } from "@/lib/cms/media";
import { buildPageMetadata, SITE_BASE } from "@/lib/seo/page-metadata";
import { breadcrumbSchema } from "@/lib/seo/schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";

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
  searchParams: Promise<{ page?: string; tag?: string }>;
}) {
  await params;
  const sp = await searchParams;
  const locale = (await getLocale()) as Locale;

  const page = Math.max(1, Number(sp.page) || 1);
  const tag = sp.tag;

  const [articles, total, tags] = await Promise.all([
    getPublishedArticles({ tag, take: PER, skip: (page - 1) * PER }),
    countPublishedArticles(tag),
    allPublishedTags(),
  ]);

  const media = await getMediaByIds(
    articles.map((a) => a.featuredMediaId).filter(Boolean) as string[],
  );
  const mediaById = new Map(media.map((m) => [m!.id, m!]));

  const heading = "Blog";
  const subtitle =
    locale === "el"
      ? "Νέα, οδηγοί και ενημερώσεις για τη διαχείριση ακινήτων."
      : "News, guides, and updates on property management.";

  const totalPages = Math.max(1, Math.ceil(total / PER));
  const tagQuery = tag ? `&tag=${encodeURIComponent(tag)}` : "";
  const dateFmt = new Intl.DateTimeFormat(locale);

  const chipBase =
    "inline-block rounded-full px-4 py-1.5 text-sm font-medium transition border";
  const activeStyle = { background: "var(--color-primary)", borderColor: "var(--color-primary)", color: "#fff" };

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{heading}</h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">{subtitle}</p>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            <Link
              href="/blog"
              className={`${chipBase} ${!tag ? "" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
              style={!tag ? activeStyle : undefined}
            >
              {locale === "el" ? "Όλα" : "All"}
            </Link>
            {tags.map((t) => {
              const active = tag === t;
              return (
                <Link
                  key={t}
                  href={`/blog?tag=${encodeURIComponent(t)}`}
                  className={`${chipBase} ${active ? "" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  style={active ? activeStyle : undefined}
                >
                  {t}
                </Link>
              );
            })}
          </div>
        )}

        {articles.length === 0 ? (
          <p className="text-center text-gray-600 py-12">
            {locale === "el" ? "Δεν υπάρχουν αναρτήσεις ακόμη." : "No articles yet."}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((a) => {
              const la = localizedArticle(a, locale);
              const asset = a.featuredMediaId ? mediaById.get(a.featuredMediaId) : undefined;
              const date = dateFmt.format(new Date(a.publishedAt ?? a.createdAt));
              return (
                <Link
                  key={a.id}
                  href={`/blog/${a.slug}`}
                  className="group flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm transition hover:shadow-md"
                >
                  {asset ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.url}
                      alt={asset.alt ?? la.title}
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-video w-full bg-gray-100" />
                  )}
                  <div className="flex flex-1 flex-col p-6">
                    <h2 className="font-semibold text-gray-900 group-hover:opacity-90">
                      {la.title}
                    </h2>
                    {la.excerpt && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-3">{la.excerpt}</p>
                    )}
                    <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 pt-4 border-t border-gray-100">
                      {a.author?.name && <span>{a.author.name}</span>}
                      {a.author?.name && <span aria-hidden>·</span>}
                      <time>{date}</time>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {total > PER && (
          <div className="mt-14 flex items-center justify-center gap-4">
            {page > 1 ? (
              <Link
                href={`/blog?page=${page - 1}${tagQuery}`}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {locale === "el" ? "Προηγούμενο" : "Previous"}
              </Link>
            ) : (
              <span className="rounded-lg border border-gray-100 px-4 py-2 text-sm font-medium text-gray-300">
                {locale === "el" ? "Προηγούμενο" : "Previous"}
              </span>
            )}
            <span className="text-sm text-gray-600">
              {locale === "el" ? "Σελίδα" : "Page"} {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={`/blog?page=${page + 1}${tagQuery}`}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {locale === "el" ? "Επόμενο" : "Next"}
              </Link>
            ) : (
              <span className="rounded-lg border border-gray-100 px-4 py-2 text-sm font-medium text-gray-300">
                {locale === "el" ? "Επόμενο" : "Next"}
              </span>
            )}
          </div>
        )}

        <JsonLd
          data={breadcrumbSchema([
            { name: "Home", url: SITE_BASE },
            { name: "Blog", url: `${SITE_BASE}/blog` },
          ])}
        />
      </main>
      <LandingFooter />
    </div>
  );
}
