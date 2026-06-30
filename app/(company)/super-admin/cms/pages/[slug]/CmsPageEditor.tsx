"use client";

import { useState, useTransition } from "react";
import { RiFileEditLine, RiTranslate2 } from "react-icons/ri";
import { updateCmsPage } from "@/app/actions/pages-cms";
import { updatePageSeo } from "@/app/actions/landing-cms";
import { autoTranslate } from "@/app/actions/translate";
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

type Locale = "el" | "en";
type I18n = { title: Record<Locale, string>; body: Record<Locale, string> };
type Seo = { el: SeoMeta; en: SeoMeta };

type Props = {
  slug: string;
  initialI18n: I18n;
  initialStatus: string;
  initialSeo: Seo;
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? {}));
}

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];

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

export function CmsPageEditor({ slug, initialI18n, initialStatus, initialSeo }: Props) {
  const [i18n, setI18n] = useState<I18n>(() => clone(initialI18n));
  const [seo, setSeo] = useState<Seo>(() => clone(initialSeo));
  const [status, setStatus] = useState(initialStatus);
  const [activeLocale, setActiveLocale] = useState<Locale>("el");
  const [saved, setSaved] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [pending, startTransition] = useTransition();

  async function translateEnFromEl() {
    setTranslating(true);
    try {
      const [t, b] = await Promise.all([
        i18n.title.el.trim() ? autoTranslate(i18n.title.el, "el", "en") : Promise.resolve(""),
        i18n.body.el.trim() ? autoTranslate(i18n.body.el, "el", "en") : Promise.resolve(""),
      ]);
      setI18n((prev) => {
        const next = clone(prev);
        next.title.en = t;
        next.body.en = b;
        return next;
      });
    } finally {
      setTranslating(false);
    }
  }

  function setField(group: "title" | "body", value: string) {
    setI18n((prev) => {
      const next = clone(prev);
      next[group][activeLocale] = value;
      return next;
    });
  }

  function setSeoField(key: keyof SeoMeta, value: string) {
    setSeo((prev) => {
      const next = clone(prev);
      (next[activeLocale] as any)[key] = value;
      return next;
    });
  }

  const curSeo = seo[activeLocale];

  function save() {
    setSaved(false);
    startTransition(async () => {
      await updateCmsPage(slug, i18n, status);
      await updatePageSeo(slug, seo);
      setSaved(true);
    });
  }

  return (
    <CmsPage
      icon={<RiFileEditLine />}
      title={`Επεξεργασία: ${slug}`}
      subtitle="Περιεχόμενο & SEO (el/en)"
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <LocaleTabs value={activeLocale} onChange={setActiveLocale} />
        <CmsButton
          variant="secondary"
          loading={translating}
          onClick={translateEnFromEl}
          icon={<RiTranslate2 size={15} />}
        >
          {translating ? "Μετάφραση…" : "Μετάφραση EN από EL"}
        </CmsButton>
        <div style={{ marginLeft: "auto", minWidth: 200 }}>
          <CmsField label="Κατάσταση">
            <select
              style={selectStyle}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </CmsField>
        </div>
      </div>

      <CmsCard title="Περιεχόμενο">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CmsField label="Τίτλος">
            <CmsInput
              value={i18n.title[activeLocale] ?? ""}
              onChange={(e) => setField("title", e.target.value)}
            />
          </CmsField>
          <CmsField label="Κείμενο (Markdown)">
            <CmsTextarea
              mono
              rows={18}
              value={i18n.body[activeLocale] ?? ""}
              onChange={(e) => setField("body", e.target.value)}
            />
          </CmsField>
        </div>
      </CmsCard>

      <CmsCard title="SEO">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CmsField label="Τίτλος (title)">
            <CmsInput
              value={curSeo.title ?? ""}
              onChange={(e) => setSeoField("title", e.target.value)}
            />
          </CmsField>
          <CmsField label="Περιγραφή (description)">
            <CmsTextarea
              rows={3}
              value={curSeo.description ?? ""}
              onChange={(e) => setSeoField("description", e.target.value)}
            />
          </CmsField>
          <CmsField label="Λέξεις-κλειδιά (keywords)">
            <CmsInput
              value={curSeo.keywords ?? ""}
              onChange={(e) => setSeoField("keywords", e.target.value)}
            />
          </CmsField>
          <CmsField label="OG Image (URL)">
            <CmsInput
              value={curSeo.ogImage ?? ""}
              onChange={(e) => setSeoField("ogImage", e.target.value)}
            />
          </CmsField>
        </div>
      </CmsCard>

      <div>
        <SaveBar onSave={save} pending={pending} saved={saved} />
      </div>
    </CmsPage>
  );
}
