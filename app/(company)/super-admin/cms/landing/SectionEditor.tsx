"use client";

import { useState, useTransition } from "react";
import { updateSection } from "@/app/actions/landing-cms";
import { autoTranslate } from "@/app/actions/translate";
import { ICON_NAMES } from "@/lib/cms/icon-registry";
import {
  CmsField,
  CmsInput,
  CmsTextarea,
  LocaleTabs,
  CmsButton,
  SaveBar,
} from "@/components/cms/ui";
import { RiTranslate2 } from "react-icons/ri";

// Translatable text field paths per section type.
const TEXT_FIELDS: Record<string, string[]> = {
  HERO: ["title", "subtitle", "primaryCta.label", "secondaryCta.label"],
  LOGOS: ["heading"],
  FEATURES: ["heading"],
  PRICING: ["heading", "subtitle"],
  TESTIMONIALS: ["heading"],
  CTA: ["heading", "body", "cta.label"],
};

function getPath(obj: any, path: string): any {
  let v = obj;
  for (const p of path.split(".")) v = v?.[p];
  return v;
}

function setPath(obj: any, path: string, value: any) {
  const parts = path.split(".");
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    o[parts[i]] = o[parts[i]] ?? {};
    o = o[parts[i]];
  }
  o[parts[parts.length - 1]] = value;
}

type Props = { section: { id: string; type: string; data: any } };

type Locale = "el" | "en";

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? {}));
}

// Defensive: if incoming data isn't {el,en} shaped, wrap the legacy single
// payload as both locales.
function toBilingual(raw: any): { el: any; en: any } {
  if (raw && typeof raw === "object" && ("el" in raw || "en" in raw)) {
    return { el: clone(raw.el ?? {}), en: clone(raw.en ?? {}) };
  }
  return { el: clone(raw ?? {}), en: clone(raw ?? {}) };
}

export function SectionEditor({ section }: Props) {
  const [data, setData] = useState<{ el: any; en: any }>(() =>
    toBilingual(section.data),
  );
  const [activeLocale, setActiveLocale] = useState<Locale>("el");

  const initial = toBilingual(section.data);
  const [itemsText, setItemsText] = useState<{ el: string; en: string }>(() => ({
    el: JSON.stringify(initial.el?.items ?? [], null, 2),
    en: JSON.stringify(initial.en?.items ?? [], null, 2),
  }));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [pending, startTransition] = useTransition();

  async function translateEnFromEl() {
    const paths = TEXT_FIELDS[section.type] ?? [];
    setTranslating(true);
    try {
      const results = await Promise.all(
        paths.map((p) => {
          const src = getPath(data.el, p);
          return typeof src === "string" && src.trim()
            ? autoTranslate(src, "el", "en")
            : Promise.resolve<string | null>(null);
        }),
      );
      setData((prev) => {
        const next = clone(prev);
        paths.forEach((p, i) => {
          if (results[i] != null) setPath(next.en, p, results[i]);
        });
        return next;
      });
    } finally {
      setTranslating(false);
    }
  }

  function set(path: string, value: string) {
    setData((prev) => {
      const next = clone(prev);
      const parts = path.split(".");
      let obj = next[activeLocale];
      for (let i = 0; i < parts.length - 1; i++) {
        obj[parts[i]] = obj[parts[i]] ?? {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      return next;
    });
  }

  function field(label: string, path: string) {
    const parts = path.split(".");
    let v: any = data[activeLocale];
    for (const p of parts) v = v?.[p];
    return (
      <CmsField label={label}>
        <CmsInput value={v ?? ""} onChange={(e) => set(path, e.target.value)} />
      </CmsField>
    );
  }

  const hasItems = ["LOGOS", "FEATURES", "TESTIMONIALS"].includes(section.type);

  function save() {
    setError(null);
    setSaved(false);

    const payload = clone(data);

    if (hasItems) {
      for (const loc of ["el", "en"] as Locale[]) {
        try {
          payload[loc].items = JSON.parse(itemsText[loc]);
        } catch {
          setError(
            `Μη έγκυρο JSON στα στοιχεία (items) — ${loc === "el" ? "Ελληνικά" : "English"}.`,
          );
          return;
        }
      }
    }

    startTransition(async () => {
      await updateSection(section.id, payload);
      setSaved(true);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <LocaleTabs value={activeLocale} onChange={setActiveLocale} />
        {(TEXT_FIELDS[section.type]?.length ?? 0) > 0 && (
          <div style={{ marginLeft: "auto" }}>
            <CmsButton
              variant="secondary"
              loading={translating}
              onClick={translateEnFromEl}
              icon={<RiTranslate2 size={15} />}
            >
              {translating ? "Μετάφραση…" : "Μετάφραση EL→EN (section)"}
            </CmsButton>
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {section.type === "HERO" && (
          <>
            {field("Τίτλος", "title")}
            {field("Υπότιτλος", "subtitle")}
            {field("URL εικόνας", "imageUrl")}
            <div />
            {field("Κύριο CTA — Κείμενο", "primaryCta.label")}
            {field("Κύριο CTA — Σύνδεσμος", "primaryCta.href")}
            {field("Δευτερεύον CTA — Κείμενο", "secondaryCta.label")}
            {field("Δευτερεύον CTA — Σύνδεσμος", "secondaryCta.href")}
          </>
        )}

        {section.type === "LOGOS" && <>{field("Επικεφαλίδα", "heading")}</>}

        {section.type === "FEATURES" && <>{field("Επικεφαλίδα", "heading")}</>}

        {section.type === "PRICING" && (
          <>
            {field("Επικεφαλίδα", "heading")}
            {field("Υπότιτλος", "subtitle")}
          </>
        )}

        {section.type === "TESTIMONIALS" && <>{field("Επικεφαλίδα", "heading")}</>}

        {section.type === "CTA" && (
          <>
            {field("Επικεφαλίδα", "heading")}
            {field("Κείμενο", "body")}
            {field("CTA — Κείμενο", "cta.label")}
            {field("CTA — Σύνδεσμος", "cta.href")}
          </>
        )}
      </div>

      {hasItems && (
        <CmsField label="Στοιχεία (items) — JSON">
          <CmsTextarea
            mono
            rows={8}
            style={{ fontSize: 12 }}
            value={itemsText[activeLocale]}
            onChange={(e) =>
              setItemsText((prev) => ({ ...prev, [activeLocale]: e.target.value }))
            }
          />
        </CmsField>
      )}

      {section.type === "FEATURES" && (
        <details style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            Διαθέσιμα εικονίδια (icon)
          </summary>
          <ul
            style={{
              marginTop: 8,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              listStyle: "none",
              padding: 0,
            }}
          >
            {ICON_NAMES.map((n) => (
              <li
                key={n}
                style={{
                  borderRadius: 4,
                  background: "var(--muted)",
                  padding: "4px 8px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                {n}
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && (
        <p style={{ fontSize: 13, color: "var(--color-danger)", margin: 0 }}>{error}</p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <SaveBar onSave={save} pending={pending} saved={saved} />
      </div>
    </form>
  );
}
