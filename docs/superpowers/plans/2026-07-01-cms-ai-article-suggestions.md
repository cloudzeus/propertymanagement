# C3 — DeepSeek Article Suggestions + Draft Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DeepSeek "topic suggestions" panel to the articles admin (one-click create DRAFT + open editor) and an in-editor "generate full article" that fills excerpt + body from the title/angle — all guardrailed and non-persisting until an explicit action.

**Architecture:** Pure tested helpers (`lib/ai/articles.ts`: prompt builders + normalizers) back two server actions in `app/actions/ai-cms.ts` (`suggestArticleTopics`, `generateArticleDraft`). `ArticlesClient` gains a suggestions `Modal`; `ArticleEditor` gains a generate button that reuses its existing `setContent`. Reuses `createArticle`/`updateArticle` and `autoTranslate`.

**Tech Stack:** Next.js 16 (server actions), TypeScript, DeepSeek (`lib/ai.ts`), Prisma, CMS ui kit + `Modal`, vitest.

---

## Reused infrastructure

- `deepseekComplete(prompt)` (`lib/ai.ts`); `requireSuperAdmin` pattern in `app/actions/ai-cms.ts`.
- `createArticle(data): Promise<string>` (`app/actions/blog.ts`) — auto-slugs from `i18n.title.el`, returns id.
- `ArticlesClient.tsx` — `useRouter`, `useTransition`, `createArticle`, DataTable, `CmsPage`.
- `ArticleEditor.tsx` — i18n `{title,excerpt,body}` as `Record<locale,string>`; `setContent(group, value)` sets active-locale value; translate button ~line 164; `CmsButton` imported.
- `Modal` (`components/ui/modal.tsx`): `<Modal open onClose title>…</Modal>`.
- `db.article` for existing-title dedup.

---

## Task 1: Article AI helpers (pure, tested)

**Files:** Create `lib/ai/articles.ts`, `lib/ai/articles.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { normalizeTopics, normalizeDraft } from "./articles";

describe("normalizeTopics", () => {
  it("parses array, drops titleless, coerces tags", () => {
    const out = normalizeTopics(
      'x [{"title":" A ","angle":"a","tags":["t1"," t2 "]},{"title":"","angle":"b"}] y',
    );
    expect(out).toEqual([{ title: "A", angle: "a", tags: ["t1", "t2"] }]);
  });
  it("returns [] on garbage", () => {
    expect(normalizeTopics("nope")).toEqual([]);
  });
});

describe("normalizeDraft", () => {
  it("parses {excerpt, body}", () => {
    expect(normalizeDraft('{"excerpt":" e ","body":" b "}')).toEqual({ excerpt: "e", body: "b" });
  });
  it("falls back to body-only on non-JSON", () => {
    expect(normalizeDraft("# Title\n\ntext")).toEqual({ excerpt: "", body: "# Title\n\ntext" });
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run lib/ai/articles.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
export type Topic = { title: string; angle: string; tags: string[] };

function firstJsonArray(text: string): unknown {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}
function firstJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

export function normalizeTopics(raw: unknown): Topic[] {
  const arr = typeof raw === "string" ? firstJsonArray(raw) : raw;
  if (!Array.isArray(arr)) return [];
  const out: Topic[] = [];
  for (const r of arr) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const title = String(o.title ?? "").trim();
    if (!title) continue;
    const angle = String(o.angle ?? "").trim();
    const tags = Array.isArray(o.tags) ? o.tags.map((t) => String(t).trim()).filter(Boolean) : [];
    out.push({ title, angle, tags });
  }
  return out;
}

export function normalizeDraft(raw: unknown): { excerpt: string; body: string } {
  const obj = typeof raw === "string" ? firstJsonObject(raw) : raw;
  if (obj && typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    if ("body" in o || "excerpt" in o) {
      return { excerpt: String(o.excerpt ?? "").trim(), body: String(o.body ?? "").trim() };
    }
  }
  return { excerpt: "", body: typeof raw === "string" ? raw.trim() : "" };
}

export function buildTopicsPrompt(theme: string, existingTitles: string[], count: number): string {
  return [
    `You suggest blog article ideas for a Greek property-management SaaS (κοινόχρηστα, διαχείριση πολυκατοικίας, ακίνητα, νομοθεσία, Αθήνα).`,
    `Propose ${count} fresh, SEO-friendly, non-duplicate ideas in Greek.`,
    `Return ONLY a JSON array: [{"title","angle","tags"}] — angle = 1 sentence, tags = 2-4 short keywords.`,
    theme.trim() ? `Focus theme: ${theme.trim()}` : ``,
    existingTitles.length ? `Avoid duplicating these existing titles:\n- ${existingTitles.slice(0, 40).join("\n- ")}` : ``,
  ].filter(Boolean).join("\n");
}

export function buildDraftPrompt(title: string, angle: string, locale: "el" | "en"): string {
  const lang = locale === "el" ? "Greek" : "English";
  return [
    `Write a complete, original blog article in ${lang} for a property-management SaaS.`,
    `Title: ${title}`,
    angle.trim() ? `Angle: ${angle.trim()}` : ``,
    `Return ONLY a JSON object {"excerpt","body"}: excerpt = 1-2 sentences; body = Markdown, 600-900 words,`,
    `with ## H2 sections, practical and scannable. No front-matter, no title heading duplication.`,
  ].filter(Boolean).join("\n");
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run lib/ai/articles.test.ts` → PASS (4).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/articles.ts lib/ai/articles.test.ts
git commit -m "feat(ai): article topic + draft prompt/normalizers (C3)"
```

---

## Task 2: Server actions

**Files:** Modify `app/actions/ai-cms.ts`

- [ ] **Step 1: Add actions**

Append to `app/actions/ai-cms.ts` (imports at top: add the article helpers; `db`, `Locale`, `deepseekComplete` already imported by C2):

```ts
import { buildTopicsPrompt, normalizeTopics, buildDraftPrompt, normalizeDraft, type Topic } from "@/lib/ai/articles";

export async function suggestArticleTopics(theme: string, count: number): Promise<Topic[]> {
  await requireSuperAdmin();
  const n = Math.min(Math.max(Math.round(count) || 5, 1), 8);
  const rows = await db.article.findMany({ select: { i18n: true }, take: 40, orderBy: { updatedAt: "desc" } });
  const titles = rows
    .map((r) => {
      const i = (r.i18n ?? {}) as any;
      return String(i?.title?.el ?? i?.title?.en ?? "").trim();
    })
    .filter(Boolean);
  const text = await deepseekComplete(buildTopicsPrompt(theme, titles, n));
  return normalizeTopics(text).slice(0, n);
}

export async function generateArticleDraft(
  title: string,
  angle: string,
  locale: Locale,
): Promise<{ excerpt: string; body: string }> {
  await requireSuperAdmin();
  const text = await deepseekComplete(buildDraftPrompt(title, angle, locale));
  return normalizeDraft(text);
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint app/actions/ai-cms.ts`
Expected: clean (ignore pre-existing `no-explicit-any`).

- [ ] **Step 3: Commit**

```bash
git add app/actions/ai-cms.ts
git commit -m "feat(ai): suggestArticleTopics + generateArticleDraft actions (C3)"
```

---

## Task 3: Suggestions modal in ArticlesClient

**Files:** Modify `app/(company)/super-admin/cms/articles/ArticlesClient.tsx`

- [ ] **Step 1: Read the file first**

Run: `sed -n '1,120p' "app/(company)/super-admin/cms/articles/ArticlesClient.tsx"` — note the header area where the "new article" flow lives and the `CmsPage` wrapper, so the button is placed in the page header/toolbar and `useState` is available (add `useState` to the React import if only `useTransition` is imported).

- [ ] **Step 2: Add imports + state + handlers**

Add to imports:
```tsx
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { CmsField, CmsInput, CmsButton } from "@/components/cms/ui";
import { suggestArticleTopics } from "@/app/actions/ai-cms";
import { RiSparkling2Line } from "react-icons/ri";
import type { Topic } from "@/lib/ai/articles";
```
Inside the component (alongside `router`/`startTransition`):
```tsx
  const [aiOpen, setAiOpen] = useState(false);
  const [theme, setTheme] = useState("");
  const [count, setCount] = useState(5);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function runSuggest() {
    setAiError(null); setAiBusy(true);
    try {
      setTopics(await suggestArticleTopics(theme, count));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Αποτυχία");
    } finally { setAiBusy(false); }
  }

  function createFromTopic(t: Topic) {
    startTransition(async () => {
      const id = await createArticle({
        status: "DRAFT",
        tags: t.tags,
        i18n: {
          title: { el: t.title, en: "" },
          excerpt: { el: t.angle, en: "" },
          body: { el: "", en: "" },
        },
      });
      router.push(`/super-admin/cms/articles/${id}`);
    });
  }
```

- [ ] **Step 3: Add the trigger button + modal in the render**

Place a button in the page header (inside `CmsPage`, near the existing "new article" control):
```tsx
      <div style={{ marginBottom: 12 }}>
        <CmsButton onClick={() => setAiOpen(true)} icon={<RiSparkling2Line size={15} />}>
          Προτάσεις με AI
        </CmsButton>
      </div>
```
And render the modal (anywhere inside the returned tree):
```tsx
      <Modal open={aiOpen} onClose={() => setAiOpen(false)} title="Προτάσεις άρθρων (AI)" width={640}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <CmsField label="Θέμα (προαιρετικό)">
            <CmsInput value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="π.χ. ενεργειακή αναβάθμιση πολυκατοικίας" />
          </CmsField>
          <CmsField label="Πλήθος">
            <CmsInput type="number" min={1} max={8} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </CmsField>
          {aiError && <p style={{ color: "var(--destructive)", fontSize: 13, margin: 0 }}>{aiError}</p>}
          <div>
            <CmsButton variant="secondary" loading={aiBusy} disabled={aiBusy} onClick={runSuggest} icon={<RiSparkling2Line size={15} />}>
              {aiBusy ? "Δημιουργία…" : "Δημιουργία προτάσεων"}
            </CmsButton>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topics.map((t, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--card)", padding: 12 }}>
                <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{t.title}</div>
                {t.angle && <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>{t.angle}</div>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {t.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--paper)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>{tag}</span>
                  ))}
                </div>
                <div style={{ marginTop: 10 }}>
                  <CmsButton variant="secondary" onClick={() => createFromTopic(t)}>Δημιουργία draft →</CmsButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add "app/(company)/super-admin/cms/articles/ArticlesClient.tsx"
git commit -m "feat(cms): AI article suggestions modal + create-draft (C3)"
```

---

## Task 4: Full-draft generation in ArticleEditor

**Files:** Modify `app/(company)/super-admin/cms/articles/[id]/ArticleEditor.tsx`

- [ ] **Step 1: Read the file first**

Run: `sed -n '95,190p' "app/(company)/super-admin/cms/articles/[id]/ArticleEditor.tsx"` — locate `setContent`, the `locale` state, the translate `CmsButton` (~line 164), and `i18n.title/excerpt/body`.

- [ ] **Step 2: Add import + state + handler**

Add to imports:
```tsx
import { RiSparkling2Line } from "react-icons/ri";
import { generateArticleDraft } from "@/app/actions/ai-cms";
```
Add state (near existing `useState`s) + handler (near `translate`):
```tsx
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
```

- [ ] **Step 3: Add the button next to the translate button**

Immediately after the translate `CmsButton` (`…Μετάφραση EN από EL…</CmsButton>`), add:
```tsx
              <CmsButton
                variant="secondary"
                loading={genBusy}
                disabled={genBusy}
                onClick={generateDraft}
                icon={<RiSparkling2Line size={15} />}
              >
                {genBusy ? "Δημιουργία…" : "Δημιουργία πλήρους άρθρου (AI)"}
              </CmsButton>
```
And render the error near it (below the button row):
```tsx
              {genError && <p style={{ color: "var(--destructive)", fontSize: 13, margin: 0 }}>{genError}</p>}
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add "app/(company)/super-admin/cms/articles/[id]/ArticleEditor.tsx"
git commit -m "feat(cms): AI full-article draft generation in editor (C3)"
```

---

## Task 5: Verification

- [ ] **Step 1: Tests + build**

Run: `npx vitest run lib/ai/articles.test.ts` → green.
Run: `npm run build` → clean.

- [ ] **Step 2: Manual pass**

`npm run dev`, as SUPER_ADMIN at `/super-admin/cms/articles`:
- "Προτάσεις με AI" → optional theme → suggestions list appears; "Δημιουργία draft" creates a DRAFT and opens the editor.
- In the editor, "Δημιουργία πλήρους άρθρου" fills excerpt + body (markdown); edit; Save; the overwrite confirm fires when body is non-empty.
- EN via existing translate button.

- [ ] **Step 3: Final commit (if fixes)**

```bash
git add -A && git commit -m "fix(cms): C3 verification fixes"
```

---

## Notes for the executor

- **Read before editing** ArticlesClient/ArticleEditor to match exact insertion points, the `locale`/`i18n` variable names, and whether `useState` is already imported (don't duplicate imports).
- **DeepSeek** needs `DEEPSEEK_API_KEY`; failures show inline errors and never persist.
- Orithon styling; `--paper`/`--card`/`--border`; light-only.
- Only `createArticle` (draft) and Save persist; generation returns editable drafts.

## Out of scope

- Auto-publish/scheduling; article image generation; article-level SEO auto-fill (per-page SEO is C2).
