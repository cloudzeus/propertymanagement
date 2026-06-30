# Translation Tooling (Sub-project D) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** DB-backed UI strings (editable without redeploy) + AI auto-translate (DeepSeek) reusable across all CMS el/en editors + a Translations admin page.

**Architecture:** `UiMessage` table holds per-key el/en overrides; `loadMessages(locale)` deep-merges file defaults + DB overrides and feeds `i18n/request.ts`. `lib/ai/translate.ts` does a non-stream DeepSeek call; a SUPER_ADMIN server action exposes it; `AutoTranslateButton` calls it from editors. A Translations admin page edits UI keys with bulk auto-translate.

**Tech Stack:** Next.js 16.2, Prisma 7 (diff+deploy; DB scripts `npx tsx --env-file=.env`), next-intl v4, DeepSeek (`DEEPSEEK_API_KEY`, ENDPOINT `https://api.deepseek.com/v1/chat/completions`), Vitest. Foundation: `lib/ai/agent.ts` (reuse endpoint+key+`logAPIUsage` pattern), `messages/{el,en}.json` (90 keys), `i18n/routing.ts`.

**Verified facts:**
- `lib/ai/agent.ts`: `ENDPOINT`, uses `env.DEEPSEEK_API_KEY`, `logAPIUsage({apiName:"deepseek",endpoint,model,tokensUsed,status})` from a lib. Model `deepseek-chat`.
- `i18n/request.ts`: returns `{ locale, messages: (await import(\`../messages/${locale}.json\`)).default }`.
- Existing el/en editors: `app/(company)/super-admin/cms/landing/{SectionEditor,SeoEditor}.tsx`, `.../cms/pages/[slug]/CmsPageEditor.tsx`, `.../cms/pricing/PricingTierEditor.tsx`, `.../cms/faq/FaqEditor.tsx`. CMS menu group "cms" in `components/admin/sidebar-nav.tsx`.

---

## Task 1: `UiMessage` model + `loadMessages` merge + request.ts

**Files:** Modify `prisma/schema.prisma`, `i18n/request.ts`; create `lib/i18n/messages.ts`, `lib/i18n/messages.test.ts`.

- [ ] **Step 1:** Add model:
```prisma
model UiMessage {
  id        String   @id @default(cuid())
  key       String   @unique
  el        String   @db.Text
  en        String   @db.Text
  updatedAt DateTime @updatedAt
}
```
`npx prisma generate`; migration via diff → `prisma/migrations/20260630050000_add_ui_message/migration.sql`; `npx prisma migrate deploy` (if DB down, DONE_WITH_CONCERNS).
- [ ] **Step 2: TDD** the pure deep-set/merge in `lib/i18n/messages.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { applyOverrides } from "./messages";
describe("applyOverrides", () => {
  it("deep-sets dotted keys over defaults", () => {
    const base = { a: { b: "x" }, c: "y" };
    const out = applyOverrides(base, [{ key: "a.b", value: "X" }, { key: "c", value: "Y" }]);
    expect(out).toEqual({ a: { b: "X" }, c: "Y" });
  });
  it("creates missing paths", () => {
    expect(applyOverrides({}, [{ key: "x.y.z", value: "1" }])).toEqual({ x: { y: { z: "1" } } });
  });
  it("does not mutate base", () => {
    const base = { a: "1" }; applyOverrides(base, [{ key: "a", value: "2" }]); expect(base.a).toBe("1");
  });
});
```
Run → fail.
- [ ] **Step 3:** Implement `lib/i18n/messages.ts`:
```ts
import "server-only";
import { db } from "@/lib/db";

export function applyOverrides(base: Record<string, any>, overrides: { key: string; value: string }[]): Record<string, any> {
  const out = structuredClone(base);
  for (const { key, value } of overrides) {
    const parts = key.split(".");
    let node = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== "object" || node[parts[i]] == null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }
  return out;
}

export async function loadMessages(locale: "el" | "en"): Promise<Record<string, any>> {
  const base = (await import(`../messages/${locale}.json`)).default;
  try {
    const rows = await db.uiMessage.findMany();
    const overrides = rows.map((r) => ({ key: r.key, value: (locale === "el" ? r.el : r.en) ?? "" })).filter((o) => o.value !== "");
    return applyOverrides(base, overrides);
  } catch {
    return base; // DB unavailable → file defaults only
  }
}
```
Run test → pass. (`structuredClone` is available in Node 24.)
- [ ] **Step 4:** Update `i18n/request.ts` to use it:
```ts
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { loadMessages } from "@/lib/i18n/messages";
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) locale = routing.defaultLocale;
  return { locale, messages: await loadMessages(locale as "el" | "en") };
});
```
- [ ] **Step 5:** `npx tsc --noEmit | grep -iE "messages|request" || echo ok`; `npm run test -- lib/i18n/messages.test.ts`; `npm run build`. Commit `git add prisma/schema.prisma prisma/migrations/ lib/prisma i18n/request.ts lib/i18n/messages.ts lib/i18n/messages.test.ts && git commit -m "feat(i18n): DB-backed UI messages (UiMessage + loadMessages merge)"`.

---

## Task 2: `lib/ai/translate.ts` (DeepSeek) + tests

**Files:** Create `lib/ai/translate.ts`, `lib/ai/translate.test.ts`.

- [ ] **Step 1: TDD** the pure prompt builder. `lib/ai/translate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildTranslatePrompt } from "./translate";
describe("buildTranslatePrompt", () => {
  it("names source and target languages", () => {
    const { system } = buildTranslatePrompt("el", "en");
    expect(system).toMatch(/Greek/i);
    expect(system).toMatch(/English/i);
  });
  it("instructs to preserve markdown/placeholders and return only the translation", () => {
    const { system } = buildTranslatePrompt("el", "en");
    expect(system).toMatch(/markdown|placeholder/i);
  });
});
```
Run → fail.
- [ ] **Step 2:** Implement `lib/ai/translate.ts`:
```ts
import "server-only";
const ENDPOINT = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1/chat/completions";
const LANG: Record<string, string> = { el: "Greek", en: "English" };

export function buildTranslatePrompt(from: string, to: string) {
  const system = `You are a professional translator. Translate from ${LANG[from] ?? from} to ${LANG[to] ?? to}. Preserve markdown formatting and placeholders like {name} or {count} exactly. Return ONLY the translation, no quotes, no commentary.`;
  return { system };
}

export async function translateText(text: string, from: string, to: string): Promise<string> {
  if (!text?.trim()) return text;
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return text; // no key → passthrough
  const { system } = buildTranslatePrompt(from, to);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: system }, { role: "user", content: text }], stream: false, temperature: 0.2 }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content ?? text).trim();
  } catch {
    return text;
  }
}

export async function translateBatch(items: string[], from: string, to: string): Promise<string[]> {
  return Promise.all(items.map((t) => translateText(t, from, to)));
}
```
Run test → pass.
- [ ] **Step 3:** `npm run test -- lib/ai/translate.test.ts`. Commit `git add lib/ai/translate.ts lib/ai/translate.test.ts && git commit -m "feat(ai): DeepSeek translate helper (translateText/Batch)"`.

---

## Task 3: autoTranslate action + AutoTranslateButton

**Files:** Create `app/actions/translate.ts`, `components/i18n/AutoTranslateButton.tsx`.

- [ ] **Step 1:** `app/actions/translate.ts`:
```ts
"use server";
import { auth } from "@/auth";
import { translateText } from "@/lib/ai/translate";
async function requireSuperAdmin() { const s = await auth(); if ((s?.user as any)?.role !== "SUPER_ADMIN") throw new Error("Forbidden"); }
export async function autoTranslate(text: string, from: string, to: string): Promise<string> {
  await requireSuperAdmin();
  return translateText(text, from, to);
}
```
- [ ] **Step 2:** `components/i18n/AutoTranslateButton.tsx` ('use client'):
```tsx
"use client";
import { useState } from "react";
import { autoTranslate } from "@/app/actions/translate";
export function AutoTranslateButton({ source, from = "el", to = "en", onResult }: { source: string; from?: string; to?: string; onResult: (translated: string) => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <button type="button" disabled={loading || !source?.trim()} onClick={async () => { setLoading(true); try { onResult(await autoTranslate(source, from, to)); } finally { setLoading(false); } }}
      className="text-xs px-2 py-1 rounded border text-gray-600 hover:bg-gray-50 disabled:opacity-50">
      {loading ? "Μετάφραση…" : `Μετάφραση ${from.toUpperCase()}→${to.toUpperCase()}`}
    </button>
  );
}
```
- [ ] **Step 3:** `npx tsc --noEmit | grep -iE "translate|AutoTranslate" || echo ok`; `npm run build`. Commit `git add app/actions/translate.ts components/i18n/AutoTranslateButton.tsx && git commit -m "feat(i18n): autoTranslate action + reusable AutoTranslateButton"`.

---

## Task 4: Translations admin page + action + menu

**Files:** Create `app/(company)/super-admin/cms/translations/page.tsx` + `TranslationsEditor.tsx`; add `updateUiMessages` to `app/actions/translate.ts`; modify `components/admin/sidebar-nav.tsx`.

- [ ] **Step 1:** Add to `app/actions/translate.ts`:
```ts
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
export async function updateUiMessages(entries: { key: string; el: string; en: string }[]): Promise<void> {
  await requireSuperAdmin();
  for (const e of entries) {
    await db.uiMessage.upsert({ where: { key: e.key }, update: { el: e.el, en: e.en }, create: { key: e.key, el: e.el, en: e.en } });
  }
  revalidatePath("/", "layout");
}
```
- [ ] **Step 2:** `page.tsx` (server): flatten the default `messages/el.json` + `en.json` into dotted-key rows; merge any existing `db.uiMessage` overrides; pass `rows: {key, el, en}[]` to `<TranslationsEditor rows={...} />`.
- [ ] **Step 3:** `TranslationsEditor.tsx` ('use client'): a table of key | el input | en input. A per-row `<AutoTranslateButton source={el} onResult={set en}/>`. A bulk button "Auto-translate κενά EN" (loops rows where en empty, calls autoTranslate). A "Αποθήκευση" → `updateUiMessages(changedRows)` (send only rows that differ from defaults to keep the table lean) via useTransition. Search/filter box for keys (90+ keys). Keep it functional.
- [ ] **Step 4:** Menu: add «Μεταφράσεις» → `/super-admin/cms/translations` to the CMS group (`sidebar-nav.tsx`), ri icon RiTranslate2/RiTranslate (verify; substitute if needed).
- [ ] **Step 5:** `npm run build`; manual: edit a key's en + save → reflected; auto-translate fills en. Commit `git add "app/(company)/super-admin/cms/translations" app/actions/translate.ts components/admin/sidebar-nav.tsx && git commit -m "feat(i18n): translations admin page + bulk auto-translate + menu"`.

---

## Task 5: Wire AutoTranslateButton into CMS editors

**Files:** Modify `app/(company)/super-admin/cms/landing/SectionEditor.tsx`, `SeoEditor.tsx`, `.../cms/pages/[slug]/CmsPageEditor.tsx`, `.../cms/pricing/PricingTierEditor.tsx`, `.../cms/faq/FaqEditor.tsx`.

- [ ] **Step 1:** In each editor, for the primary text fields, add an `<AutoTranslateButton source={<el value>} onResult={(t)=> set en value}/>` next to the EN field (when the active tab is EN, or always near the EN inputs). Keep changes minimal and consistent: import the component, place buttons for the main fields (titles/descriptions/body/question/answer/features-join). For features (array) translate the joined text then split. Don't overbuild — one button per translatable text field (or a single "translate all EN from EL" per editor if simpler).
- [ ] **Step 2:** `npx tsc --noEmit | grep -iE "Editor" || echo ok`; `npm run build` → success.
- [ ] **Step 3:** Commit `git add "app/(company)/super-admin/cms" && git commit -m "feat(i18n): AutoTranslate buttons in all CMS editors"`.

---

## Task 6: Final verification

- [ ] **Step 1:** `npm run test` (all pass) + `npm run build` (success).
- [ ] **Step 2:** Manual: editing a UI string in the Translations admin changes the rendered app text (after reload); auto-translate populates EN from EL in editors and the translations page; messages fall back to file defaults if DB has no override.
- [ ] **Step 3:** `npx tsc --noEmit 2>&1 | grep -iE "i18n|translate|messages|UiMessage" || echo ok`. Commit fixes.

## Done = A+B+C+D complete: fully bilingual, SEO-complete, CMS-managed front-end with site settings, consent, and AI translation tooling.
