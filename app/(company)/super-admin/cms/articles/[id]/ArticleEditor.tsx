"use client";

import { useState, useTransition } from "react";
import { RiArticleLine, RiTranslate2, RiSparkling2Line } from "react-icons/ri";
import { updateArticle } from "@/app/actions/blog";
import { autoTranslate } from "@/app/actions/translate";
import { generateArticleDraft } from "@/app/actions/ai-cms";
import type { SeoMeta } from "@/lib/seo/types";
import {
  CmsPage,
  CmsCard,
  CmsField,
  CmsInput,
  CmsTextarea,
  LocaleTabs,
  CmsButton,
  SaveBar,
} from "@/components/cms/ui";
import { MediaPicker } from "@/components/cms/MediaPicker";

type Locale = "el" | "en";
type Tr = Record<Locale, string>;
type I18n = { title: Tr; excerpt: Tr; body: Tr };
type Seo = { el: SeoMeta; en: SeoMeta };

type Author = { id: string; name: string };

type Article = {
  id: string;
  slug: string;
  i18n: any;
  authorId: string | null;
  status: string;
  publishedAt: string | null;
  featuredMediaId: string | null;
  featuredEmbedUrl: string | null;
  galleryMediaIds: any;
  tags: string[];
  seo: any;
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? {}));
}

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];

const emptyTr: Tr = { el: "", en: "" };
const emptySeo: SeoMeta = { title: "", description: "", keywords: "", ogImage: "" };

function initI18n(raw: any): I18n {
  const r = raw ?? {};
  return {
    title: { el: r?.title?.el ?? "", en: r?.title?.en ?? "" },
    excerpt: { el: r?.excerpt?.el ?? "", en: r?.excerpt?.en ?? "" },
    body: { el: r?.body?.el ?? "", en: r?.body?.en ?? "" },
  };
}

function initSeo(raw: any): Seo {
  const r = raw ?? {};
  return {
    el: { ...emptySeo, ...(r?.el ?? {}) },
    en: { ...emptySeo, ...(r?.en ?? {}) },
  };
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 13,
  color: "var(--foreground)",
  background: "var(--bg-canvas)",
  outline: "none",
  boxSizing: "border-box",
};

export function ArticleEditor({ article, authors }: { article: Article; authors: Author[] }) {
  const [i18n, setI18n] = useState<I18n>(() => initI18n(article.i18n));
  const [seo, setSeo] = useState<Seo>(() => initSeo(article.seo));
  const [slug, setSlug] = useState(article.slug ?? "");
  const [authorId, setAuthorId] = useState(article.authorId ?? "");
  const [status, setStatus] = useState(article.status ?? "DRAFT");
  const [publishedAt, setPublishedAt] = useState(
    article.publishedAt ? new Date(article.publishedAt).toISOString().slice(0, 10) : ""
  );
  const [tags, setTags] = useState((article.tags ?? []).join(", "));
  const [featuredMediaId, setFeaturedMediaId] = useState(article.featuredMediaId ?? "");
  const [featuredEmbedUrl, setFeaturedEmbedUrl] = useState(article.featuredEmbedUrl ?? "");
  const [galleryMediaIds, setGalleryMediaIds] = useState<string[]>(
    Array.isArray(article.galleryMediaIds) ? article.galleryMediaIds : []
  );
  const [locale, setLocale] = useState<Locale>("el");
  const [saved, setSaved] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  async function generateDraft() {
    const title = (i18n.title[locale] || i18n.title.el || "").trim();
    if (!title) { setGenError("Χρειάζεται τίτλος πρώτα"); return; }
    if ((i18n.body[locale] ?? "").trim() && !confirm("Αντικατάσταση υπάρχοντος κειμένου;")) return;
    setGenError(null); setGenBusy(true);
    try {
      const d = await generateArticleDraft(title, i18n.excerpt[locale] ?? "", locale);
      setContent("excerpt", d.excerpt || i18n.excerpt[locale] || "");
      setContent("body", d.body);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Αποτυχία δημιουργίας");
    } finally { setGenBusy(false); }
  }

  async function translateEnFromEl() {
    setTranslating(true);
    try {
      const [t, e, b] = await Promise.all([
        i18n.title.el.trim() ? autoTranslate(i18n.title.el, "el", "en") : Promise.resolve(""),
        i18n.excerpt.el.trim() ? autoTranslate(i18n.excerpt.el, "el", "en") : Promise.resolve(""),
        i18n.body.el.trim() ? autoTranslate(i18n.body.el, "el", "en") : Promise.resolve(""),
      ]);
      setI18n((prev) => {
        const next = clone(prev);
        next.title.en = t;
        next.excerpt.en = e;
        next.body.en = b;
        return next;
      });
    } finally {
      setTranslating(false);
    }
  }

  function setContent(group: keyof I18n, value: string) {
    setI18n((prev) => {
      const next = clone(prev);
      next[group][locale] = value;
      return next;
    });
  }

  function setSeoField(key: keyof SeoMeta, value: string) {
    setSeo((prev) => {
      const next = clone(prev);
      (next[locale] as any)[key] = value;
      return next;
    });
  }

  const curSeo = seo[locale];

  function save() {
    setSaved(false);
    startTransition(async () => {
      await updateArticle(article.id, {
        slug,
        i18n,
        authorId: authorId || null,
        status,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        featuredMediaId: featuredMediaId || null,
        featuredEmbedUrl: featuredEmbedUrl || null,
        galleryMediaIds,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        seo,
      });
      setSaved(true);
    });
  }

  return (
    <CmsPage icon={<RiArticleLine />} title="Επεξεργασία άρθρου" subtitle={slug}>
      <CmsCard
        title="Περιεχόμενο"
        actions={
          <>
            <LocaleTabs value={locale} onChange={setLocale} />
            <CmsButton
              variant="secondary"
              loading={genBusy}
              disabled={genBusy}
              onClick={generateDraft}
              icon={<RiSparkling2Line size={15} />}
            >
              {genBusy ? "Δημιουργία…" : "Δημιουργία πλήρους άρθρου (AI)"}
            </CmsButton>
            {locale === "en" && (
              <CmsButton
                variant="secondary"
                loading={translating}
                onClick={translateEnFromEl}
                icon={<RiTranslate2 size={15} />}
              >
                {translating ? "Μετάφραση…" : "Μετάφραση EN από EL"}
              </CmsButton>
            )}
            {genError && <span style={{ color: "var(--destructive)", fontSize: 12 }}>{genError}</span>}
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CmsField label="Τίτλος">
            <CmsInput value={i18n.title[locale] ?? ""} onChange={(e) => setContent("title", e.target.value)} />
          </CmsField>
          <CmsField label="Περίληψη">
            <CmsTextarea rows={3} value={i18n.excerpt[locale] ?? ""} onChange={(e) => setContent("excerpt", e.target.value)} />
          </CmsField>
          <CmsField label="Κείμενο (Markdown)">
            <CmsTextarea mono rows={20} value={i18n.body[locale] ?? ""} onChange={(e) => setContent("body", e.target.value)} />
          </CmsField>
        </div>
      </CmsCard>

      <CmsCard title="Ρυθμίσεις">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <CmsField label="Slug">
            <CmsInput value={slug} onChange={(e) => setSlug(e.target.value)} />
          </CmsField>
          <CmsField label="Συγγραφέας">
            <select
              style={selectStyle}
              value={authorId}
              onChange={(e) => setAuthorId(e.target.value)}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <option value="">—</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </CmsField>
          <CmsField label="Κατάσταση">
            <select
              style={selectStyle}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </CmsField>
          <CmsField label="Ημ. δημοσίευσης">
            <input
              type="date"
              style={selectStyle}
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
            />
          </CmsField>
          <CmsField label="Tags (χωρισμένα με κόμμα)">
            <CmsInput value={tags} onChange={(e) => setTags(e.target.value)} placeholder="news, updates" />
          </CmsField>
        </div>
      </CmsCard>

      <CmsCard title="Πολυμέσα">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <CmsField label="Εικόνα/βίντεο προβολής (featured)">
            <MediaPicker
              value={featuredMediaId}
              onChange={(v) => setFeaturedMediaId(v as string)}
              accept="all"
            />
          </CmsField>
          <CmsField label="ή Embed URL (YouTube/Vimeo)">
            <CmsInput
              value={featuredEmbedUrl}
              onChange={(e) => setFeaturedEmbedUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </CmsField>
          <CmsField label="Συλλογή εικόνων (gallery)">
            <MediaPicker
              value={galleryMediaIds}
              onChange={(v) => setGalleryMediaIds(v as string[])}
              multiple
              accept="image"
            />
          </CmsField>
        </div>
      </CmsCard>

      <CmsCard
        title="SEO"
        actions={<LocaleTabs value={locale} onChange={setLocale} />}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CmsField label="Τίτλος (title)">
            <CmsInput value={curSeo.title ?? ""} onChange={(e) => setSeoField("title", e.target.value)} />
          </CmsField>
          <CmsField label="Περιγραφή (description)">
            <CmsTextarea rows={3} value={curSeo.description ?? ""} onChange={(e) => setSeoField("description", e.target.value)} />
          </CmsField>
          <CmsField label="Λέξεις-κλειδιά (keywords)">
            <CmsInput value={curSeo.keywords ?? ""} onChange={(e) => setSeoField("keywords", e.target.value)} />
          </CmsField>
          <CmsField label="OG Image (URL)">
            <CmsInput value={curSeo.ogImage ?? ""} onChange={(e) => setSeoField("ogImage", e.target.value)} />
          </CmsField>
        </div>
      </CmsCard>

      <div>
        <SaveBar onSave={save} pending={pending} saved={saved} />
      </div>
    </CmsPage>
  );
}
