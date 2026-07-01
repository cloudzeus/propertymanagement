import Link from "next/link";
import { getLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { getPublishedArticles, localizedArticle } from "@/lib/cms/blog";
import type { NewsData } from "@/lib/cms/landing-types";
import { Reveal } from "@/components/landing/Reveal";
import type { Locale } from "@/i18n";

export async function NewsSection({ data }: { data: NewsData }) {
  const take = Math.min(Math.max(data.count ?? 3, 1), 9);
  const rows = await getPublishedArticles({ take });
  if (rows.length === 0) return null;
  const locale = (await getLocale()) as Locale;

  // Batch-resolve featured images (localizedArticle does not expose media).
  const mediaIds = rows.map((r) => r.featuredMediaId).filter(Boolean) as string[];
  const media = mediaIds.length
    ? await db.mediaAsset.findMany({ where: { id: { in: mediaIds } }, select: { id: true, url: true } })
    : [];
  const urlById = new Map(media.map((m) => [m.id, m.url]));

  return (
    <section>
      <div className="mx-auto max-w-[1200px] px-5 sm:px-7 py-[84px]">
        {data.heading && (
          <Reveal>
            <h2 className="text-[32px] font-extrabold tracking-[-0.02em] text-[var(--foreground)] md:text-[46px]">
              {data.heading}
            </h2>
          </Reveal>
        )}
        {data.intro && (
          <p className="mt-3 max-w-2xl text-[17px] text-[var(--muted-foreground)]">{data.intro}</p>
        )}
        <Reveal stagger className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {rows.map((row) => {
            const a = localizedArticle(row, locale);
            const img = row.featuredMediaId ? urlById.get(row.featuredMediaId) : undefined;
            return (
              <Link
                key={row.id}
                href={`/blog/${row.slug}`}
                className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--card)] shadow-[var(--shadow-card)] transition hover:-translate-y-0.5"
                style={{ borderColor: "rgba(27,28,26,.12)" }}
              >
                <div className="aspect-[16/10] w-full bg-[var(--paper)]">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={a.title} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="p-5">
                  <h3 className="text-[18px] font-bold text-[var(--foreground)]">{a.title}</h3>
                  {a.excerpt && (
                    <p className="mt-2 line-clamp-2 text-[14.5px] text-[var(--muted-foreground)]">
                      {a.excerpt}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
