# Blog / Articles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Bilingual blog: Author + Article models, public `[locale]/blog` list + `[locale]/blog/[slug]` detail (featured image/video/embed, byline, markdown, gallery lightbox, tags) with Article/Person JSON-LD, and SUPER_ADMIN admin (DataTable + full-page article editor + Authors) reusing the Media library + CMS kit.

**Architecture:** `Author`/`Article` Prisma models (Article.i18n Translatable, featured via MediaAsset id or embed url, galleryMediaIds Json). Accessors in `lib/cms/blog.ts`. Public pages reuse `buildPageMetadata`, `<Markdown>`, schema builders. Admin reuses CMS UI kit, DataTable/Modal, MediaPicker, AutoTranslate.

**Tech Stack:** Next.js 16.2 (`app/[locale]/blog/*`), Prisma 7 (diff+deploy; `npx tsx --env-file=.env`), next-intl, Vitest. Reuse: `components/cms/{ui,MediaPicker,Markdown}.tsx`, `lib/cms/media.ts` getMediaByIds, `lib/seo/{metadata,page-metadata,schema}.ts`, `components/seo/JsonLd.tsx`, `lib/i18n/translatable.ts`, `app/actions/translate.ts` autoTranslate.

**Verified facts:**
- MediaPicker props `{value,onChange,multiple?,accept?}` (value=asset id(s)). `getMediaByIds(ids)` preserves order. MediaAsset `{id,type,url,width,height,alt}`.
- `buildPageMetadata(slug,locale,path)` + `SITE_BASE` in `lib/seo/page-metadata.ts`. `<Markdown>{md}</Markdown>` server component. `<JsonLd data={...}/>`. `pickLocale`. `getLocale` from next-intl/server.
- `app/sitemap.ts` has `const PATHS = [...]`. CMS menu group "cms" in `components/admin/sidebar-nav.tsx`. Public nav in `components/landing/{landing-header,landing-footer}.tsx`.
- `lib/seo/schema.ts` lacks Article/Person. Prisma delegate naming: `db.article`, `db.author` (verify).

---

## File Structure
**New:** `lib/cms/blog.ts`, `app/[locale]/blog/page.tsx`, `app/[locale]/blog/[slug]/page.tsx` + `Gallery.tsx`, `app/actions/blog.ts`, `app/(company)/super-admin/cms/articles/page.tsx` + `ArticlesClient.tsx`, `app/(company)/super-admin/cms/articles/[id]/page.tsx` + `ArticleEditor.tsx`, `app/(company)/super-admin/cms/authors/page.tsx` + `AuthorsClient.tsx`, `prisma/seed-blog.ts`.
**Modified:** `prisma/schema.prisma`, `lib/seo/schema.ts` (+test), `app/sitemap.ts`, `components/admin/sidebar-nav.tsx`, `components/landing/landing-footer.tsx`.

---

## Task 1: Author + Article models + accessors

**Files:** Modify `prisma/schema.prisma`; create `lib/cms/blog.ts`.

- [ ] **Step 1:** Add the `Author` and `Article` models (exactly as in the spec's Ενότητα 1). `npx prisma generate`; migration via `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script` → `prisma/migrations/20260630070000_add_blog/migration.sql`; `npx prisma migrate deploy` (if DB down, DONE_WITH_CONCERNS).
- [ ] **Step 2:** `lib/cms/blog.ts`:
```ts
import "server-only";
import { db } from "@/lib/db";
import { pickLocale } from "@/lib/i18n/translatable";
import type { Locale } from "@/i18n";

export async function getPublishedArticles(opts?: { tag?: string; take?: number; skip?: number }) {
  return db.article.findMany({
    where: { status: "PUBLISHED", ...(opts?.tag ? { tags: { has: opts.tag } } : {}) },
    orderBy: { publishedAt: "desc" },
    take: opts?.take ?? 12, skip: opts?.skip ?? 0,
    include: { author: true },
  });
}
export async function countPublishedArticles(tag?: string) {
  return db.article.count({ where: { status: "PUBLISHED", ...(tag ? { tags: { has: tag } } : {}) } });
}
export async function getArticleBySlug(slug: string) {
  return db.article.findUnique({ where: { slug }, include: { author: true } });
}
export function localizedArticle(row: { i18n: any }, locale: Locale) {
  const i = row.i18n ?? {};
  return { title: i.title ? pickLocale(i.title, locale) : "", excerpt: i.excerpt ? pickLocale(i.excerpt, locale) : "", body: i.body ? pickLocale(i.body, locale) : "" };
}
export async function allPublishedTags(): Promise<string[]> {
  const rows = await db.article.findMany({ where: { status: "PUBLISHED" }, select: { tags: true } });
  return [...new Set(rows.flatMap((r) => r.tags))].sort();
}
export async function listAuthors() { return db.author.findMany({ orderBy: { name: "asc" } }); }
export async function getAuthor(id: string) { return db.author.findUnique({ where: { id } }); }
export async function publishedArticleSlugs() {
  return db.article.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } });
}
```
(Verify delegates `db.article`/`db.author`.)
- [ ] **Step 3:** `npx tsc --noEmit | grep -i "cms/blog" || echo ok`. Commit `git add prisma/schema.prisma prisma/migrations/ lib/prisma lib/cms/blog.ts && git commit -m "feat(blog): Author + Article models + accessors"`.

---

## Task 2: Article/Person JSON-LD schema (TDD)

**Files:** Modify `lib/seo/schema.ts`; create/extend `lib/seo/schema.test.ts`.

- [ ] **Step 1: Failing test** (add to `lib/seo/schema.test.ts`):
```ts
import { articleSchema, personSchema } from "./schema";
describe("article/person schema", () => {
  it("article", () => {
    const s = articleSchema({ headline: "T", url: "https://x.gr/blog/a", datePublished: "2026-01-01", authorName: "Jo", image: "https://x.gr/i.webp" });
    expect(s["@type"]).toBe("Article");
    expect(s.headline).toBe("T");
    expect(s.author.name).toBe("Jo");
    expect(s.image).toBe("https://x.gr/i.webp");
  });
  it("person", () => {
    expect(personSchema({ name: "Jo" })["@type"]).toBe("Person");
  });
});
```
Run → fail.
- [ ] **Step 2:** Add to `lib/seo/schema.ts`:
```ts
export function personSchema(o: { name: string; url?: string; image?: string }) {
  return { "@context": "https://schema.org", "@type": "Person", name: o.name, ...(o.url ? { url: o.url } : {}), ...(o.image ? { image: o.image } : {}) };
}
export function articleSchema(o: { headline: string; url: string; description?: string; image?: string; datePublished?: string; dateModified?: string; authorName?: string }) {
  return { "@context": "https://schema.org", "@type": "Article", headline: o.headline, mainEntityOfPage: o.url,
    ...(o.description ? { description: o.description } : {}), ...(o.image ? { image: o.image } : {}),
    ...(o.datePublished ? { datePublished: o.datePublished } : {}), ...(o.dateModified ? { dateModified: o.dateModified } : {}),
    ...(o.authorName ? { author: { "@type": "Person", name: o.authorName } } : {}) };
}
```
Run → pass.
- [ ] **Step 3:** `npm run test -- lib/seo/schema.test.ts`. Commit `git add lib/seo/schema.ts lib/seo/schema.test.ts && git commit -m "feat(seo): Article + Person JSON-LD builders"`.

---

## Task 3: Seed blog (PageSeo + sample author + article)

**Files:** Create `prisma/seed-blog.ts`.

- [ ] **Step 1:** Idempotent seed: upsert PageSeo "blog" (el/en title/description). Upsert one `Author` (where slug "omada-propertypro": name "Ομάδα PropertyPro", bio {el,en}). Upsert one `Article` (where slug "kalwsorisate"): i18n {title:{el,en}, excerpt:{el,en}, body:{el,en} (a few markdown paragraphs)}, authorId=that author, status "PUBLISHED", publishedAt new Date(), tags ["νέα","propertypro"], galleryMediaIds [], featuredMediaId null, featuredEmbedUrl null. Use real Greek+English copy (not "TODO"). `update:{}` create-only on conflict for idempotency.
- [ ] **Step 2:** Run `npx tsx --env-file=.env prisma/seed-blog.ts` twice. If DB down, DONE_WITH_CONCERNS.
- [ ] **Step 3:** Commit `git add prisma/seed-blog.ts && git commit -m "feat(blog): seed PageSeo + sample author + article"`.

---

## Task 4: Public blog list page

**Files:** Create `app/[locale]/blog/page.tsx`.

- [ ] **Step 1:** Server page, `dynamic="force-dynamic"`. `generateMetadata` → `buildPageMetadata("blog", locale, "/blog")`. Body: read `searchParams` (`page`, `tag`), `getLocale()`, `getPublishedArticles({tag, take:12, skip:(page-1)*12})` + `countPublishedArticles(tag)` + `allPublishedTags()`. For each article resolve featured image via `getMediaByIds([featuredMediaId].filter(Boolean))`. Render: heading ("Blog"/localized), a tag filter row (Link chips `?tag=`), a responsive card grid: each card = featured image (or placeholder) + `localizedArticle(a,locale).title` + excerpt + author name + date (`Intl.DateTimeFormat(locale)`), linking to `/blog/${a.slug}` (use the locale-aware path — el unprefixed, en `/en/blog/...`; since the page is already under [locale], a relative `Link href={`/blog/${slug}`}` works with next-intl? Use plain `<Link>` from next/link with the path WITHOUT locale prefix — next-intl middleware handles it; confirm in build). Pagination (prev/next Links preserving tag). `<JsonLd>` Breadcrumb. Wrap in LandingHeader/main/LandingFooter.
- [ ] **Step 2:** `npm run build` → success; `/blog`, `/en/blog` build. Commit `git add "app/[locale]/blog/page.tsx" && git commit -m "feat(blog): public blog list page + SEO"`.

---

## Task 5: Public article detail + Gallery + sitemap + nav

**Files:** Create `app/[locale]/blog/[slug]/page.tsx`, `app/[locale]/blog/[slug]/Gallery.tsx`; modify `app/sitemap.ts`, `components/landing/landing-footer.tsx`.

- [ ] **Step 1:** `[slug]/page.tsx` (server, `dynamic="force-dynamic"`): `getArticleBySlug(slug)` → if null `notFound()`. `localizedArticle`. Resolve featured (getMediaByIds) + gallery (getMediaByIds(galleryMediaIds)) + author avatar. `generateMetadata`: from `article.seo` (pickLocale) if present else `{ title, description: excerpt }`; pass featured image url as ogImage via buildMetadata (build inline: fetch site defaultOgImage fallback). Render: featured (image `<img>`, or video `<video controls>`, or embed → `<iframe>` from featuredEmbedUrl), `<h1>` title, byline (author avatar `<img>` + name + formatted date), `<Markdown>{body}</Markdown>`, `<Gallery items={galleryAssets}/>` if any, tags chips. `<JsonLd data={[articleSchema({headline:title, url:`${SITE_BASE}/blog/${slug}`, description:excerpt, image:featuredUrl, datePublished:publishedAt?.toISOString(), authorName:author?.name}), breadcrumbSchema([...])]} />`. LandingHeader/footer.
- [ ] **Step 2:** `Gallery.tsx` ('use client'): thumbnail grid → lightbox overlay (fixed, dark bg) with prev/next + close (Esc/click), `useState` index. react-icons/ri arrows/close.
- [ ] **Step 3:** `app/sitemap.ts`: add `/blog` to PATHS; AND append dynamic article entries — make `sitemap()` async, fetch `publishedArticleSlugs()` from `lib/cms/blog.ts`, add `${BASE}/blog/${slug}` (+ en alternate) for each. (Wrap DB call in try/catch → [] so build doesn't break without DB.)
- [ ] **Step 4:** `landing-footer.tsx`: add a «Blog» → `/blog` link.
- [ ] **Step 5:** `npm run build` → success; `/blog/[slug]` builds. Commit `git add "app/[locale]/blog" app/sitemap.ts components/landing/landing-footer.tsx && git commit -m "feat(blog): article detail + gallery lightbox + sitemap + nav"`.

---

## Task 6: Blog actions (Article + Author CRUD)

**Files:** Create `app/actions/blog.ts`.

- [ ] **Step 1:** `"use server"` with `requireSuperAdmin()`; export:
```ts
createArticle(data), updateArticle(id, data), deleteArticle(id),
createAuthor(data), updateAuthor(id, data), deleteAuthor(id)
```
Each does the corresponding `db.article`/`db.author` create/update/delete with `data as any` (the client sends the full shape incl i18n/tags/galleryMediaIds/featured*). revalidatePath("/blog"), revalidatePath("/"), and the relevant admin paths. For createArticle/createAuthor generate a slug if missing (slugify name/title.el). 
- [ ] **Step 2:** `npx tsc --noEmit | grep -i "actions/blog" || echo ok`; `npm run build`. Commit `git add app/actions/blog.ts && git commit -m "feat(blog): article + author server actions"`.

---

## Task 7: Admin — Authors (DataTable + Modal)

**Files:** Create `app/(company)/super-admin/cms/authors/page.tsx` + `AuthorsClient.tsx`.

- [ ] **Step 1:** `page.tsx` (server): `listAuthors()` → `<AuthorsClient initial={serialized} />`. `AuthorsClient` ('use client'): `<CmsPage icon={<RiUserStarLine/>} title="Συγγραφείς" subtitle="...">` + DataTable (name, slug). Toolbar "Νέος συγγραφέας" → Modal. Row actions edit/delete. Modal: name (CmsInput), slug (CmsInput), avatar (`<MediaPicker value={avatarMediaId} onChange={...} accept="image"/>`), bio with LocaleTabs (CmsTextarea el/en). Save → `updateAuthor`/`createAuthor`, delete → `deleteAuthor`; router.refresh(). Mirror the pricing/faq client pattern.
- [ ] **Step 2:** `npm run build` → success. Commit `git add "app/(company)/super-admin/cms/authors" && git commit -m "feat(blog): authors admin (DataTable + Modal + avatar picker)"`.

---

## Task 8: Admin — Articles list + full-page editor

**Files:** Create `app/(company)/super-admin/cms/articles/page.tsx` + `ArticlesClient.tsx`, `app/(company)/super-admin/cms/articles/[id]/page.tsx` + `ArticleEditor.tsx`.

- [ ] **Step 1:** `articles/page.tsx` (server): `db.article.findMany({ orderBy:{updatedAt:"desc"}, include:{author:true} })` → `<ArticlesClient initial={serialized} />`. `ArticlesClient`: `<CmsPage icon={<RiArticleLine/>} title="Άρθρα">` + DataTable (title=i18n.title.el, author?.name, status badge, publishedAt date, tags). Toolbar "Νέο άρθρο" → calls `createArticle({ i18n:{title:{el:"Νέο άρθρο",en:"New article"},excerpt:{el:"",en:""},body:{el:"",en:""}}, status:"DRAFT", tags:[] })` then `router.push` to `/super-admin/cms/articles/${newId}` (so the action must RETURN the id — adjust createArticle to return id, OR create then refresh and let the user click). Simplest: make `createArticle` return the new id (change its signature to `Promise<string>`), push to editor. Row actions: Επεξεργασία (Link to `[id]`), Διαγραφή (`deleteArticle`).
- [ ] **Step 2:** `articles/[id]/page.tsx` (server): fetch the article + `listAuthors()` → `<ArticleEditor article={serialized} authors={serialized} />`.
- [ ] **Step 3:** `ArticleEditor.tsx` ('use client'): `<CmsPage icon={<RiArticleLine/>} title="Επεξεργασία άρθρου">`. Cards: **Περιεχόμενο** (LocaleTabs → title CmsInput, excerpt CmsTextarea, body CmsTextarea mono; AutoTranslate EL→EN for the three). **Ρυθμίσεις** (slug, author `<select>` from authors, status select, publishedAt `<input type="date">`, tags input [comma-separated → string[]]). **Media** (featured: `<MediaPicker value={featuredMediaId} onChange accept="all"/>` OR a featuredEmbedUrl CmsInput; gallery: `<MediaPicker value={galleryMediaIds} onChange multiple accept="image"/>`). **SEO** (LocaleTabs title/description/keywords/ogImage). `SaveBar` → `updateArticle(id, {...all fields...})`. useTransition.
- [ ] **Step 4:** `npm run build` → success. Commit `git add "app/(company)/super-admin/cms/articles" app/actions/blog.ts && git commit -m "feat(blog): articles admin (list + full-page editor with media/SEO/translate)"`.

---

## Task 9: Menu + final verification

**Files:** Modify `components/admin/sidebar-nav.tsx`.

- [ ] **Step 1:** Add «Άρθρα» → `/super-admin/cms/articles` and «Συγγραφείς» → `/super-admin/cms/authors` to the "cms" group (ri icons RiArticleLine/RiUserStarLine; verify, substitute if needed).
- [ ] **Step 2: FULL verification:** `npm run test` (all pass) + `npm run build` (success); routes present: `/[locale]/blog`, `/[locale]/blog/[slug]`, `/super-admin/cms/{articles,articles/[id],authors}`. `npx tsc --noEmit 2>&1 | grep -iE "blog|article|author|cms" || echo ok`. Manual: public `/blog` lists the seeded article (el/en); detail renders featured/body/gallery/tags + Article JSON-LD; admin creates/edits an article with MediaPicker + autotranslate; authors CRUD.
- [ ] **Step 3:** Commit `git add components/admin/sidebar-nav.tsx && git commit -m "feat(blog): menu items + final polish"`.

## Done = bilingual blog with media-rich articles, SEO, and full CMS admin.
