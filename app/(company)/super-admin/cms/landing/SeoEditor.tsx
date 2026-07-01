"use client";

import { useState, useTransition } from "react";
import { updatePageSeo } from "@/app/actions/landing-cms";
import { autoTranslate } from "@/app/actions/translate";
import {
  CmsField,
  CmsInput,
  CmsTextarea,
  LocaleTabs,
  CmsButton,
  SaveBar,
} from "@/components/cms/ui";
import { RiTranslate2, RiSparkling2Line } from "react-icons/ri";
import { generateSeo } from "@/app/actions/ai-cms";
import type { SeoMeta } from "@/lib/seo/types";

type Locale = "el" | "en";
type Props = { slug: string; initial: { el: SeoMeta; en: SeoMeta } };

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? {}));
}

export function SeoEditor({ slug, initial }: Props) {
  const [data, setData] = useState<{ el: SeoMeta; en: SeoMeta }>(() => clone(initial));
  const [activeLocale, setActiveLocale] = useState<Locale>("el");
  const [saved, setSaved] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [brief, setBrief] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  async function runAiSeo() {
    setAiError(null);
    setAiBusy(true);
    try {
      const gen = await generateSeo(slug, brief, activeLocale);
      setData((prev) => {
        const next = clone(prev);
        (next[activeLocale] as any).title = gen.title;
        (next[activeLocale] as any).description = gen.description;
        (next[activeLocale] as any).keywords = gen.keywords;
        return next;
      });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Αποτυχία δημιουργίας");
    } finally {
      setAiBusy(false);
    }
  }

  async function translateEnFromEl() {
    setTranslating(true);
    try {
      const el = data.el;
      const fields = ["title", "description", "keywords"] as (keyof SeoMeta)[];
      const results = await Promise.all(
        fields.map((k) => {
          const src = (el[k] as string | undefined)?.trim();
          return src ? autoTranslate(src, "el", "en") : Promise.resolve("");
        }),
      );
      setData((prev) => {
        const next = clone(prev);
        fields.forEach((k, i) => {
          (next.en as any)[k] = results[i];
        });
        return next;
      });
    } finally {
      setTranslating(false);
    }
  }

  function set(key: keyof SeoMeta, value: string) {
    setData((prev) => {
      const next = clone(prev);
      (next[activeLocale] as any)[key] = value;
      return next;
    });
  }

  const cur = data[activeLocale];

  function save() {
    setSaved(false);
    startTransition(async () => {
      await updatePageSeo(slug, data);
      setSaved(true);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <LocaleTabs value={activeLocale} onChange={setActiveLocale} />
        <div style={{ marginLeft: "auto" }}>
          <CmsButton
            variant="secondary"
            loading={translating}
            onClick={translateEnFromEl}
            icon={<RiTranslate2 size={15} />}
          >
            {translating ? "Μετάφραση…" : "Μετάφραση EN από EL"}
          </CmsButton>
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--paper)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--foreground)" }}><RiSparkling2Line /> Δημιουργία SEO με AI</div>
        <CmsField label="Οδηγία (προαιρετικό)">
          <CmsInput value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="π.χ. έμφαση σε κοινόχρηστα & Αθήνα" />
        </CmsField>
        {aiError && <p style={{ color: "var(--destructive)", fontSize: 13, margin: 0 }}>{aiError}</p>}
        <div>
          <CmsButton variant="secondary" loading={aiBusy} disabled={aiBusy} onClick={runAiSeo} icon={<RiSparkling2Line size={15} />}>
            {aiBusy ? "Δημιουργία…" : "Δημιουργία SEO"}
          </CmsButton>
        </div>
      </div>

      <CmsField label="Τίτλος (title)">
        <CmsInput value={cur.title ?? ""} onChange={(e) => set("title", e.target.value)} />
      </CmsField>
      <div style={{ fontSize: 11, marginTop: -8, color: (cur.title ?? "").length > 60 ? "var(--color-warning)" : "var(--muted-foreground)" }}>
        {(cur.title ?? "").length}/60
      </div>

      <CmsField label="Περιγραφή (description)">
        <CmsTextarea
          rows={3}
          value={cur.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
        />
      </CmsField>
      <div style={{ fontSize: 11, marginTop: -8, color: (cur.description ?? "").length > 155 ? "var(--color-warning)" : "var(--muted-foreground)" }}>
        {(cur.description ?? "").length}/155
      </div>

      <CmsField label="Λέξεις-κλειδιά (keywords)">
        <CmsInput
          value={cur.keywords ?? ""}
          onChange={(e) => set("keywords", e.target.value)}
        />
      </CmsField>

      <CmsField label="OG Image (URL)">
        <CmsInput
          value={cur.ogImage ?? ""}
          onChange={(e) => set("ogImage", e.target.value)}
        />
      </CmsField>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <SaveBar onSave={save} pending={pending} saved={saved} />
      </div>
    </form>
  );
}
