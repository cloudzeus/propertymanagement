# C2 — AI Auto SEO/GEO per Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A central `/super-admin/cms/seo` page to manage SEO for every public page, with a DeepSeek "AI generate" panel producing locality-aware `{title, description, keywords}` per locale from each page's own content, plus a GEO-completeness status card.

**Architecture:** Pure, tested helpers (`lib/ai/seo.ts` prompt+normalizer, `lib/cms/seo-context.ts` content extractor) back a `generateSeo` server action. The existing `SeoEditor` gains an AI panel + char counters; a new central SEO page renders one editor per public page and a `GeoStatus` card. GEO stays as the existing sitewide `LocalBusiness` JSON-LD.

**Tech Stack:** Next.js 16 (server actions), TypeScript, Prisma, DeepSeek (`lib/ai.ts`), Orithon CMS ui kit, vitest.

---

## Reused infrastructure

- `SeoMeta` (`lib/seo/types.ts`): `{title, description, keywords?, ogImage?, canonical?, robots?}`.
- `getPageSeo(slug)` (`lib/cms/page-seo.ts`), `updatePageSeo(slug, seo)` (`app/actions/landing-cms.ts`).
- `SeoEditor` (`app/(company)/super-admin/cms/landing/SeoEditor.tsx`) — props `{ slug, initial: {el,en} }`, manual fields + `autoTranslate`.
- `deepseekComplete(prompt)` (`lib/ai.ts`), `pickLocale` (`lib/i18n/translatable`).
- Content: `getAllLandingSections()` (`lib/cms/landing.ts`, returns rows w/ `data` `{el,en}`), `db.pricingTier`, `db.fAQ`, `db.cMSPage` (has `i18n`, `title`, `content`).
- CMS ui kit; sidebar CMS group at `components/admin/sidebar-nav.tsx` (`id: "cms"`, items list ~line 101).

---

## Task 1: SEO prompt + normalizer (pure, tested)

**Files:** Create `lib/ai/seo.ts`, `lib/ai/seo.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { normalizeSeo } from "./seo";

describe("normalizeSeo", () => {
  it("parses JSON and clamps lengths", () => {
    const out = normalizeSeo(
      JSON.stringify({ title: "T".repeat(80), description: "D".repeat(200), keywords: ["a", "b"] }),
    );
    expect(out.title.length).toBe(60);
    expect(out.description.length).toBe(155);
    expect(out.keywords).toBe("a, b");
  });

  it("extracts JSON from surrounding prose and trims", () => {
    const out = normalizeSeo('Here you go:\n{"title":"  Hi  ","description":"d","keywords":"k1, k2"} thanks');
    expect(out).toEqual({ title: "Hi", description: "d", keywords: "k1, k2" });
  });

  it("returns safe empties on garbage", () => {
    expect(normalizeSeo("no json here")).toEqual({ title: "", description: "", keywords: "" });
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run lib/ai/seo.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
export type GeneratedSeo = { title: string; description: string; keywords: string };

function firstJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function normalizeSeo(raw: unknown): GeneratedSeo {
  const obj = typeof raw === "string" ? firstJsonObject(raw) : raw;
  if (!obj || typeof obj !== "object") return { title: "", description: "", keywords: "" };
  const o = obj as Record<string, unknown>;
  const title = String(o.title ?? "").trim().slice(0, 60);
  const description = String(o.description ?? "").trim().slice(0, 155);
  const kw = o.keywords;
  const keywords = Array.isArray(kw)
    ? kw.map((k) => String(k).trim()).filter(Boolean).join(", ")
    : String(kw ?? "").trim();
  return { title, description, keywords };
}

export function buildSeoPrompt(context: string, brief: string, locale: "el" | "en", siteName: string): string {
  const lang = locale === "el" ? "Greek" : "English";
  return [
    `You are an SEO specialist for "${siteName}", a property-management SaaS operating in Greece (Athens).`,
    `Write SEO metadata in ${lang} for the page described by the CONTEXT below.`,
    `Return ONLY a JSON object: {"title","description","keywords"}.`,
    `Rules: title ≤ 60 characters, description 120–155 characters, keywords = 6-10 comma-separated terms`,
    `mixing the service with local intent (e.g. city/area, "διαχείριση πολυκατοικίας"). Make it unique and click-worthy.`,
    brief.trim() ? `Extra guidance from the editor: ${brief.trim()}` : ``,
    ``,
    `CONTEXT:\n${context}`,
  ].filter(Boolean).join("\n");
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run lib/ai/seo.test.ts` → PASS (3).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/seo.ts lib/ai/seo.test.ts
git commit -m "feat(ai): SEO prompt builder + normalizer (C2)"
```

---

## Task 2: Page content extractor (tested summarizer)

**Files:** Create `lib/cms/seo-context.ts`, `lib/cms/seo-context.test.ts`

- [ ] **Step 1: Failing test (pure helper only)**

```ts
import { describe, it, expect } from "vitest";
import { summarizeContext } from "./seo-context";

describe("summarizeContext", () => {
  it("joins non-empty parts and truncates to max", () => {
    expect(summarizeContext(["a", "", "  b  ", "c"], 100)).toBe("a\nb\nc");
  });
  it("truncates overly long content", () => {
    expect(summarizeContext(["x".repeat(50), "y".repeat(50)], 40).length).toBe(40);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run lib/cms/seo-context.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
import "server-only";
import { db } from "@/lib/db";
import { pickLocale } from "@/lib/i18n/translatable";
import { getAllLandingSections } from "@/lib/cms/landing";
import type { Locale } from "@/i18n";

/** Join non-empty, trimmed parts and hard-truncate to max chars. */
export function summarizeContext(parts: string[], max: number): string {
  const text = parts.map((p) => p.trim()).filter(Boolean).join("\n");
  return text.length > max ? text.slice(0, max) : text;
}

const MAX = 1500;

export async function getPageContext(slug: string, locale: Locale): Promise<string> {
  if (slug === "home") {
    const sections = await getAllLandingSections();
    const parts = sections.flatMap((s) => {
      const d = pickLocale(s.data as any, locale) as any;
      return [d?.heading, d?.title, d?.subtitle, ...(Array.isArray(d?.items) ? d.items.map((i: any) => i?.title) : [])];
    });
    return summarizeContext(["Αρχική σελίδα — Orithon property management.", ...parts.map((p) => String(p ?? ""))], MAX);
  }
  if (slug === "pricing") {
    const tiers = await db.pricingTier.findMany({ orderBy: { order: "asc" } });
    return summarizeContext(["Σελίδα τιμών / πακέτα.", ...tiers.map((t) => `${t.name}: ${t.description ?? ""}`)], MAX);
  }
  if (slug === "faq") {
    const faqs = await db.fAQ.findMany({ orderBy: { order: "asc" }, take: 20 });
    return summarizeContext(["Συχνές ερωτήσεις.", ...faqs.map((f) => f.question)], MAX);
  }
  if (["services", "contact", "privacy", "terms", "cookie-policy"].includes(slug)) {
    const page = await db.cMSPage.findUnique({ where: { slug } });
    const i = (page?.i18n ?? {}) as any;
    const title = i?.title ? pickLocale(i.title, locale) : page?.title ?? slug;
    const body = i?.body ? pickLocale(i.body, locale) : page?.content ?? "";
    return summarizeContext([String(title), String(body)], MAX);
  }
  if (slug === "blog") {
    return summarizeContext(["Blog & άρθρα για διαχείριση κτηρίων, κοινόχρηστα και ακίνητα."], MAX);
  }
  return summarizeContext([`Σελίδα: ${slug} — Orithon property management, Αθήνα.`], MAX);
}
```

Note: verify `pickLocale` signature (`pickLocale(translatable, locale)`) in `lib/i18n/translatable.ts` and match; landing section `data` and CMSPage `i18n` shapes are `{el,en}` — adapt field names if the real shape differs.

- [ ] **Step 4: Run → pass**

Run: `npx vitest run lib/cms/seo-context.test.ts` → PASS (2).

- [ ] **Step 5: Commit**

```bash
git add lib/cms/seo-context.ts lib/cms/seo-context.test.ts
git commit -m "feat(cms): per-page SEO content extractor (C2)"
```

---

## Task 3: `generateSeo` server action

**Files:** Modify `app/actions/ai-cms.ts`

- [ ] **Step 1: Add the action**

Append to `app/actions/ai-cms.ts` (keep existing `generateFeatures` + `requireSuperAdmin`):

```ts
import { db } from "@/lib/db";
import { buildSeoPrompt, normalizeSeo, type GeneratedSeo } from "@/lib/ai/seo";
import { getPageContext } from "@/lib/cms/seo-context";
import type { Locale } from "@/i18n";

export async function generateSeo(slug: string, brief: string, locale: Locale): Promise<GeneratedSeo> {
  await requireSuperAdmin();
  const settings = await db.siteSettings.findUnique({ where: { id: "singleton" } });
  const siteName = settings?.siteName ?? "Orithon";
  const context = await getPageContext(slug, locale);
  const text = await deepseekComplete(buildSeoPrompt(context, brief, locale, siteName));
  return normalizeSeo(text);
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint app/actions/ai-cms.ts`
Expected: clean (ignore pre-existing `no-explicit-any` elsewhere).

- [ ] **Step 3: Commit**

```bash
git add app/actions/ai-cms.ts
git commit -m "feat(ai): generateSeo server action via DeepSeek (C2)"
```

---

## Task 4: PUBLIC_PAGES constant

**Files:** Create `lib/cms/public-pages.ts`

- [ ] **Step 1: Implement**

```ts
export type PublicPage = { slug: string; label: string };

export const PUBLIC_PAGES: PublicPage[] = [
  { slug: "home", label: "Αρχική" },
  { slug: "pricing", label: "Τιμές" },
  { slug: "services", label: "Υπηρεσίες" },
  { slug: "faq", label: "Συχνές ερωτήσεις" },
  { slug: "contact", label: "Επικοινωνία" },
  { slug: "blog", label: "Blog" },
  { slug: "privacy", label: "Απόρρητο" },
  { slug: "terms", label: "Όροι χρήσης" },
  { slug: "cookie-policy", label: "Πολιτική cookies" },
];
```

- [ ] **Step 2: Commit**

```bash
git add lib/cms/public-pages.ts
git commit -m "feat(cms): PUBLIC_PAGES constant (C2)"
```

---

## Task 5: SeoEditor — AI panel + char counters

**Files:** Modify `app/(company)/super-admin/cms/landing/SeoEditor.tsx`

- [ ] **Step 1: Add AI state + imports**

At the top imports add:
```tsx
import { useState as _useState } from "react"; // (already imported useState — do NOT duplicate; reuse existing)
import { generateSeo } from "@/app/actions/ai-cms";
import { RiSparkling2Line } from "react-icons/ri";
```
(Only add `generateSeo` + `RiSparkling2Line`; `useState`/`useTransition` are already imported.)

Inside the component, after existing state, add:
```tsx
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
```

- [ ] **Step 2: Render the AI panel + counters**

Immediately after the `LocaleTabs` row `</div>`, insert:
```tsx
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--paper)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--foreground)" }}><RiSparkling2Line /> Δημιουργία SEO με AI</div>
        <CmsField label="Οδηγία (προαιρετικό)">
          <CmsInput value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="π.χ. έμφαση σε κοινόχρηστα & Αθήνα" />
        </CmsField>
        {aiError && <p style={{ color: "var(--destructive)", fontSize: 13 }}>{aiError}</p>}
        <div>
          <CmsButton variant="secondary" loading={aiBusy} disabled={aiBusy} onClick={runAiSeo} icon={<RiSparkling2Line size={15} />}>
            {aiBusy ? "Δημιουργία…" : "Δημιουργία SEO"}
          </CmsButton>
        </div>
      </div>
```

Under the title field, add a counter line beneath its `CmsField`:
```tsx
      <div style={{ fontSize: 11, marginTop: -8, color: (cur.title ?? "").length > 60 ? "var(--color-warning)" : "var(--muted-foreground)" }}>
        {(cur.title ?? "").length}/60
      </div>
```
And similarly under the description field:
```tsx
      <div style={{ fontSize: 11, marginTop: -8, color: (cur.description ?? "").length > 155 ? "var(--color-warning)" : "var(--muted-foreground)" }}>
        {(cur.description ?? "").length}/155
      </div>
```

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add "app/(company)/super-admin/cms/landing/SeoEditor.tsx"
git commit -m "feat(cms): AI SEO generate panel + char counters (C2)"
```

---

## Task 6: GeoStatus component

**Files:** Create `components/cms/GeoStatus.tsx`

- [ ] **Step 1: Implement**

```tsx
import Link from "next/link";
import { RiCheckboxCircleFill, RiCloseCircleLine, RiMapPin2Line } from "react-icons/ri";
import { CmsCard } from "@/components/cms/ui";

type Field = { label: string; ok: boolean };

export function GeoStatus({ fields }: { fields: Field[] }) {
  return (
    <CmsCard title="GEO — LocalBusiness">
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 0 }}>
        <RiMapPin2Line style={{ verticalAlign: "-2px" }} /> Το τοπικό schema εμφανίζεται σε όλες τις σελίδες από τις Ρυθμίσεις.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {fields.map((f) => (
          <span key={f.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: f.ok ? "var(--color-success)" : "var(--muted-foreground)" }}>
            {f.ok ? <RiCheckboxCircleFill size={15} /> : <RiCloseCircleLine size={15} />} {f.label}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Link href="/super-admin/cms/settings" style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
          Επεξεργασία GEO στις Ρυθμίσεις →
        </Link>
      </div>
    </CmsCard>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint components/cms/GeoStatus.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/cms/GeoStatus.tsx
git commit -m "feat(cms): GeoStatus card (C2)"
```

---

## Task 7: Central SEO admin page

**Files:** Create `app/(company)/super-admin/cms/seo/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import { getPageSeo } from "@/lib/cms/page-seo";
import { getSiteSettings } from "@/lib/cms/site-settings";
import { SeoEditor } from "../landing/SeoEditor";
import { GeoStatus } from "@/components/cms/GeoStatus";
import { PUBLIC_PAGES } from "@/lib/cms/public-pages";
import { CmsPage, CmsCard } from "@/components/cms/ui";
import { RiSearchEyeLine } from "react-icons/ri";
import type { SeoMeta } from "@/lib/seo/types";

const EMPTY: SeoMeta = { title: "", description: "" };

export default async function SeoAdminPage() {
  const settings = await getSiteSettings();
  const geoFields = [
    { label: "Γεωγρ. πλάτος", ok: settings.geoLat != null },
    { label: "Γεωγρ. μήκος", ok: settings.geoLng != null },
    { label: "Διεύθυνση", ok: !!settings.addrStreet && !!settings.addrCity },
    { label: "Τηλέφωνο", ok: !!settings.telephone },
    { label: "Ώρες", ok: !!settings.openingHours },
  ];

  const seos = await Promise.all(
    PUBLIC_PAGES.map(async (p) => {
      const t = await getPageSeo(p.slug);
      return {
        page: p,
        initial: {
          el: { ...EMPTY, ...(t?.el ?? {}) },
          en: { ...EMPTY, ...(t?.en ?? {}) },
        },
      };
    }),
  );

  return (
    <CmsPage icon={<RiSearchEyeLine size={20} />} title="CMS — SEO & GEO" subtitle="SEO ανά σελίδα με δημιουργία AI">
      <GeoStatus fields={geoFields} />
      {seos.map(({ page, initial }) => (
        <CmsCard key={page.slug} title={page.label}>
          <SeoEditor slug={page.slug} initial={initial} />
        </CmsCard>
      ))}
    </CmsPage>
  );
}
```

Note: verify `getSiteSettings()` returns the GEO fields (`geoLat`, `geoLng`, `addrStreet`, `addrCity`, `telephone`, `openingHours`) — read `lib/cms/site-settings.ts`; if a field name differs, adapt the `geoFields` mapping.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `/super-admin/cms/seo` present.

- [ ] **Step 3: Commit**

```bash
git add "app/(company)/super-admin/cms/seo/page.tsx"
git commit -m "feat(cms): central SEO/GEO admin page (C2)"
```

---

## Task 8: Sidebar SEO menu item

**Files:** Modify `components/admin/sidebar-nav.tsx`

- [ ] **Step 1: Add the item to the SUPER_ADMIN CMS group**

In the `cms` group `items` array (after the "Αρχική" landing item), add:
```tsx
        { label: "SEO", href: "/super-admin/cms/seo", icon: RiSearchEyeLine, iconActive: RiSearchEyeLine, color: "#8764b8" },
```
Add `RiSearchEyeLine` to the `react-icons/ri` import block at the top of the file.

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint components/admin/sidebar-nav.tsx`
Expected: clean (ignore pre-existing warnings).

- [ ] **Step 3: Commit**

```bash
git add components/admin/sidebar-nav.tsx
git commit -m "feat(cms): SEO sidebar menu item (C2)"
```

---

## Task 9: Verification

- [ ] **Step 1: Tests + build**

Run: `npx vitest run lib/ai/seo.test.ts lib/cms/seo-context.test.ts` → green.
Run: `npm run build` → clean.

- [ ] **Step 2: Manual pass**

`npm run dev`, as SUPER_ADMIN open `/super-admin/cms/seo`:
- GeoStatus reflects SiteSettings.
- For "Αρχική": type a brief, "Δημιουργία SEO" → title/description/keywords fill; counters show; edit; Save.
- Confirm `/` `<head>` shows the saved title/description (view-source).
- Switch locale tab → generate EN.

- [ ] **Step 3: Final commit (if fixes)**

```bash
git add -A && git commit -m "fix(cms): C2 verification fixes"
```

---

## Notes for the executor

- **Read before matching:** `lib/i18n/translatable.ts` (`pickLocale`), `lib/cms/site-settings.ts` (GEO field names), `SeoEditor.tsx` (exact insertion points; do not duplicate existing `useState`/`useTransition` imports).
- **No JSON**, Orithon styling, `--paper` for the AI panel.
- **DeepSeek** needs `DEEPSEEK_API_KEY`; failure path shows an inline error and never persists.
- Light-only; no `dark:`.

## Out of scope

- Per-page GEO overrides; OG image generation; C3 article suggestions.
