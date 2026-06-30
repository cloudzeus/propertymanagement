# Blog / Articles (Σύστημα 2) — Design

**Ημερομηνία:** 2026-06-30
**Κατάσταση:** Approved
**Μέρος του:** Blog/Media feature. Σύστημα 2 — καταναλώνει το Media library (Σύστημα 1, shipped).

## Στόχος

Δίγλωσσο (el/en) blog/άρθρα στο CMS: τίτλος/excerpt/body, συγγραφέας (entity), ημερομηνία, κεντρική φωτό **ή** βίντεο (upload ή embed), συλλογή φωτογραφιών (gallery), tags, slug. Public σελίδες με SEO (Article/Person/Breadcrumb JSON-LD) + gallery lightbox. Admin με DataTable + editor, MediaPicker, AI auto-translate.

## Πλαίσιο / υπάρχοντα (όλα reusable)
- Media: `components/cms/MediaPicker.tsx` (`{value,onChange,multiple?,accept?}`, value=asset id(s)), `lib/cms/media.ts` `getMediaByIds(ids)`, `MediaAsset {id,type,url,width,height,...}`.
- i18n/SEO: `Translatable`/`pickLocale`, `buildPageMetadata(slug,locale,path)`, `lib/seo/schema.ts` builders + `<JsonLd>`, `PageSeo`, `components/cms/Markdown.tsx` (react-markdown+sanitize).
- CMS UI kit, DataTable/Modal, AI `autoTranslate`/`AutoTranslateButton`, `requireSuperAdmin` pattern.
- `lib/seo/schema.ts` ΔΕΝ έχει Article/Person → προστίθενται.

## Ενότητα 1 — Models
```prisma
model Author {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  avatarMediaId String?
  bio           Json?    // Translatable<string>
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  articles      Article[]
}
model Article {
  id              String   @id @default(cuid())
  slug            String   @unique
  i18n            Json     // Translatable: { title, excerpt, body }
  authorId        String?
  author          Author?  @relation(fields: [authorId], references: [id], onDelete: SetNull)
  status          String   @default("DRAFT") // DRAFT | PUBLISHED | ARCHIVED
  publishedAt     DateTime?
  featuredMediaId String?  // MediaAsset (image or video)
  featuredEmbedUrl String? // YouTube/Vimeo embed (alternative to featuredMedia)
  galleryMediaIds Json?    // ordered string[] of MediaAsset ids
  tags            String[]
  seo             Json?    // Translatable<SeoMeta>
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@index([status, publishedAt])
}
```
Migration (diff+deploy). Accessors `lib/cms/blog.ts`: `getPublishedArticles({tag?,take?,skip?})`, `getArticleBySlug(slug)`, `localizedArticle(row,locale)→{title,excerpt,body}`, `listAuthors()`, `getAuthor(id)`, `allTags()`. Resolve featured/gallery/avatar μέσω `getMediaByIds`.

## Ενότητα 2 — SEO schema additions
Στο `lib/seo/schema.ts`: `articleSchema({headline,description?,image?,datePublished?,dateModified?,authorName?,url})` (@type Article/BlogPosting) + `personSchema({name,url?,image?})`. Unit-tested.

## Ενότητα 3 — Public σελίδες (`app/[locale]/blog/`)
- `blog/page.tsx`: λίστα published άρθρων (cards: featured image, title, excerpt, author byline, ημερομηνία, tags), pagination (`?page=`), προαιρετικό φίλτρο `?tag=`. `generateMetadata` → `buildPageMetadata("blog",locale,"/blog")` (seed PageSeo row "blog"). JsonLd: Breadcrumb (+ CollectionPage προαιρετικό). Header/footer wrapper.
- `blog/[slug]/page.tsx` (dynamic): featured (image/video/embed) → title → byline (avatar+όνομα συγγραφέα + formatted date) → body `<Markdown>` → **gallery** (client lightbox) → tags. `generateMetadata`: από `article.seo` (pickLocale) με fallback σε title/excerpt + featured image ως OG. JsonLd: `articleSchema` (με author Person) + Breadcrumb. `dynamic="force-dynamic"`.
- `blog/[slug]/Gallery.tsx` ('use client'): grid thumbnails → lightbox (κλικ → fullscreen overlay, prev/next, esc).
- Sitemap: πρόσθεσε `/blog` + δυναμικά τα published article slugs (×locales) στο `app/sitemap.ts`.
- Πρόσθεσε link «Blog» στο public header/footer nav.

## Ενότητα 4 — Admin
- **Άρθρα**: `/super-admin/cms/articles` (DataTable: title(el), author, status, ημερομηνία, tags) + «Νέο άρθρο». Επεξεργασία σε **full page** `/super-admin/cms/articles/[id]` (τα άρθρα είναι μεγάλα → όχι modal): el/en tabs (title/excerpt/body markdown CmsTextarea + AutoTranslate), author `<select>`, publishedAt date, slug, status, tags (chips/comma input), **featured** (MediaPicker single, accept all — ή featuredEmbedUrl field), **gallery** (MediaPicker multiple, accept image), SEO card (el/en). Save → actions.
- **Συγγραφείς**: `/super-admin/cms/authors` (DataTable + Modal edit: name, slug, avatar via MediaPicker single image, bio el/en).
- Actions `app/actions/blog.ts` (SUPER_ADMIN): `createArticle/updateArticle/deleteArticle`, `createAuthor/updateAuthor/deleteAuthor`. revalidate `/blog`, `/`, admin paths.
- Menu: «Άρθρα», «Συγγραφείς» στο CMS group.
- Seed: PageSeo "blog" (el/en); ένας sample Author + 1 PUBLISHED sample Article (i18n el/en, tags) ώστε να φαίνεται το public blog.

## Out of scope
- Σχόλια, RSS feed, related-articles, κατηγορίες (μόνο tags), scheduled publishing (status+publishedAt χειροκίνητα).
- Video transcoding (από Media library).

## Σημεία προσοχής
- Reuse MediaPicker/getMediaByIds — μη ξαναγράψεις media logic.
- featured: είτε `featuredMediaId` είτε `featuredEmbedUrl` (embed → render iframe). Gallery = images.
- `galleryMediaIds` ordered Json string[] — resolve+order μέσω getMediaByIds (διατηρεί σειρά).
- Article editor full-page (μεγάλο)· Authors modal (μικρό).
- Article JSON-LD: `image` = featured asset url· `datePublished` = publishedAt.
- Tags filter στο public: distinct tags από published άρθρα.
