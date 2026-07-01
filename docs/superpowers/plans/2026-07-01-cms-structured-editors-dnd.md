# C1 — Structured CMS Editors + Drag-and-Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing CMS's raw-JSON editing with structured, article-like full-page editors for every section (Hero, Features, Pricing, Testimonials, Logos, FAQ, News), add drag-and-drop ordering everywhere, featured images via the media gallery, and DeepSeek-assisted feature generation — all bilingual (el/en) and in the Orithon design language.

**Architecture:** A reusable dnd-kit `SortableList` + a pure `applyReorder` helper power ordering across sections/items/tiers/faqs. Each landing section gets a typed full-page form (dispatched by `type`) built from shared CMS primitives and a shared `ItemsEditor`. A new `NEWS` section renders latest published Articles. DeepSeek generates feature drafts via a new server action backed by `lib/ai.ts`. Storage stays as-is (`LandingSection.data` JSON, `PricingTier`, `FAQ`); only the editing UX and one new section type change.

**Tech Stack:** Next.js 16 (App Router, server actions), TypeScript, `@dnd-kit/{core,sortable,utilities}` (installed), Prisma, DeepSeek (`lib/ai.ts`), Orithon tokens + CMS ui kit, GSAP (installed) for section reveals, vitest.

**Visual-hierarchy / UX directive (apply to every UI task):** establish one clear focal point per screen, a consistent type scale (page title → section title → field label → helper), generous but rhythmic spacing (group related fields, separate groups with whitespace not lines where possible), left-aligned scannable forms, sticky `SaveBar` for focus, and calm GSAP entrance/reorder motion (respect `prefers-reduced-motion`). Public sections reuse the existing `Reveal` (GSAP ScrollTrigger).

---

## Reused infrastructure (do not rebuild — exact signatures)

- CMS ui (`components/cms/ui.tsx`): `CmsPage`, `CmsCard`, `CmsField`, `CmsInput`, `CmsTextarea`, `LocaleTabs`, `CmsButton`, `SaveBar`.
- `components/cms/MediaPicker.tsx`: `<MediaPicker value={string|string[]|null} onChange={(v:string|string[])=>void} multiple? accept="image"|"video"|"all" />`.
- `lib/cms/icon-registry.ts`: `ICON_NAMES: string[]`, `resolveIcon(name): IconType`.
- `lib/ai.ts`: private `deepseekRequest(prompt, model?)` returning `{ success: boolean; content?: string; error?: string }` (`AIResponse`). Add exports here.
- `lib/cms/blog.ts`: `getPublishedArticles({ take }): Promise<Article[]>`, `localizedArticle(row, locale)`.
- `app/actions/landing-cms.ts`: `updateSection(id,data)`, `toggleSection(id)`, `reorderSection(id,dir)` (to be superseded), `updatePageSeo`.
- `app/actions/translate.ts`: `autoTranslate(...)` (used by existing SectionEditor).
- `components/landing/Reveal.tsx`: `<Reveal stagger? y? className?>`.
- `components/landing/section-registry.tsx`, `lib/cms/landing-types.ts`.

---

## Task 1: Pure reorder helper + tests

**Files:**
- Create: `lib/cms/reorder.ts`
- Test: `lib/cms/reorder.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { applyReorder } from "./reorder";

describe("applyReorder", () => {
  const rows = [
    { id: "a", order: 0 },
    { id: "b", order: 1 },
    { id: "c", order: 2 },
  ];

  it("assigns sequential order matching the given id sequence", () => {
    expect(applyReorder(["c", "a", "b"], rows)).toEqual([
      { id: "c", order: 0 },
      { id: "a", order: 1 },
      { id: "b", order: 2 },
    ]);
  });

  it("ignores unknown ids and appends missing rows in original order", () => {
    expect(applyReorder(["b", "zzz"], rows)).toEqual([
      { id: "b", order: 0 },
      { id: "a", order: 1 },
      { id: "c", order: 2 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/cms/reorder.test.ts`
Expected: FAIL ("applyReorder is not a function").

- [ ] **Step 3: Implement**

```ts
export type Orderable = { id: string };

/**
 * Given a desired id order and the existing rows, return each row's id with its
 * new sequential `order`. Unknown ids in `orderedIds` are ignored; rows absent
 * from `orderedIds` keep their relative order and are appended after.
 */
export function applyReorder<T extends Orderable>(
  orderedIds: string[],
  rows: T[],
): { id: string; order: number }[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const sequence: string[] = [];
  for (const id of orderedIds) {
    if (byId.has(id) && !seen.has(id)) {
      sequence.push(id);
      seen.add(id);
    }
  }
  for (const r of rows) {
    if (!seen.has(r.id)) sequence.push(r.id);
  }
  return sequence.map((id, i) => ({ id, order: i }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/cms/reorder.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/cms/reorder.ts lib/cms/reorder.test.ts
git commit -m "feat(cms): applyReorder helper for DnD ordering (C1)"
```

---

## Task 2: Reusable SortableList component

**Files:**
- Create: `components/cms/SortableList.tsx`

- [ ] **Step 1: Implement the component**

```tsx
"use client";

import { ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RiDraggable } from "react-icons/ri";

type Props<T extends { id: string }> = {
  items: T[];
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T) => ReactNode;
};

function Row({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        display: "flex",
        alignItems: "stretch",
        gap: 8,
      }}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 6px",
          cursor: "grab",
          color: "var(--muted-foreground)",
          background: "transparent",
          border: "none",
          touchAction: "none",
        }}
      >
        <RiDraggable size={18} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function SortableList<T extends { id: string }>({ items, onReorder, renderItem }: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex).map((i) => i.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item) => (
            <Row key={item.id} id={item.id}>
              {renderItem(item)}
            </Row>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint components/cms/SortableList.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/cms/SortableList.tsx
git commit -m "feat(cms): reusable dnd-kit SortableList (C1)"
```

---

## Task 3: Landing section reorder action (DnD)

**Files:**
- Modify: `app/actions/landing-cms.ts`

- [ ] **Step 1: Add `reorderSections` action**

Append to `app/actions/landing-cms.ts` (keep existing exports; `reorderSection` up/down may stay unused):

```ts
import { applyReorder } from "@/lib/cms/reorder";

export async function reorderSections(orderedIds: string[]): Promise<void> {
  await requireSuperAdmin();
  const rows = await db.landingSection.findMany({ orderBy: { order: "asc" } });
  const updates = applyReorder(orderedIds, rows);
  await db.$transaction(
    updates.map((u) => db.landingSection.update({ where: { id: u.id }, data: { order: u.order } })),
  );
  revalidatePath("/");
  revalidatePath("/super-admin/cms/landing");
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint app/actions/landing-cms.ts`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/actions/landing-cms.ts
git commit -m "feat(cms): reorderSections server action (C1)"
```

---

## Task 4: NEWS section type + renderer + registry

**Files:**
- Modify: `lib/cms/landing-types.ts`
- Create: `components/landing/sections/NewsSection.tsx`
- Modify: `components/landing/section-registry.tsx`

- [ ] **Step 1: Add NEWS to types**

In `lib/cms/landing-types.ts`: add `"NEWS"` to `LANDING_SECTION_TYPES`, add interface and default:

```ts
export interface NewsData { heading: string; intro?: string; count: number }
```
In `defaultSectionData`, add:
```ts
    case "NEWS": return { heading: "", intro: "", count: 3 };
```
Add `NewsData` to the `SectionData` union.

- [ ] **Step 2: Create the renderer**

```tsx
// components/landing/sections/NewsSection.tsx
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getPublishedArticles, localizedArticle } from "@/lib/cms/blog";
import type { NewsData } from "@/lib/cms/landing-types";
import { Reveal } from "@/components/landing/Reveal";
import type { Locale } from "@/i18n";

export async function NewsSection({ data }: { data: NewsData }) {
  const take = Math.min(Math.max(data.count ?? 3, 1), 9);
  const rows = await getPublishedArticles({ take });
  if (rows.length === 0) return null;
  const locale = (await getLocale()) as Locale;

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
            return (
              <Link
                key={row.id}
                href={`/blog/${row.slug}`}
                className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--card)] shadow-[var(--shadow-card)] transition hover:-translate-y-0.5"
                style={{ borderColor: "rgba(27,28,26,.12)" }}
              >
                <div className="aspect-[16/10] w-full bg-[var(--paper)]">
                  {a.featuredImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.featuredImage} alt={a.title} className="h-full w-full object-cover" />
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
```

Note: `localizedArticle` returns the article's localized fields. Verify the returned shape exposes `title`, `excerpt`, `featuredImage` (or the media URL field); if the property names differ, adapt this mapping to the actual shape returned by `lib/cms/blog.ts` — read it before implementing and match exactly.

- [ ] **Step 3: Register in section-registry**

In `components/landing/section-registry.tsx` add the import and case:
```tsx
import { NewsSection } from "./sections/NewsSection";
// ...
    case "NEWS": return <NewsSection key={key} data={data} />;
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add lib/cms/landing-types.ts components/landing/sections/NewsSection.tsx components/landing/section-registry.tsx
git commit -m "feat(cms): NEWS landing section (latest articles) (C1)"
```

---

## Task 5: DeepSeek feature generation — normalizer + tests

**Files:**
- Create: `lib/ai/features.ts`
- Test: `lib/ai/features.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { normalizeFeatureItems } from "./features";

const ICONS = ["ri-home", "ri-wallet", "ri-tools"];

describe("normalizeFeatureItems", () => {
  it("keeps valid items and coerces unknown icons to the fallback", () => {
    const out = normalizeFeatureItems(
      [
        { icon: "ri-wallet", title: "Payments", body: "Pay online." },
        { icon: "nonsense", title: "Tasks", body: "Track repairs." },
      ],
      ICONS,
      "ri-home",
    );
    expect(out).toEqual([
      { icon: "ri-wallet", title: "Payments", body: "Pay online." },
      { icon: "ri-home", title: "Tasks", body: "Track repairs." },
    ]);
  });

  it("drops items without a title and trims strings", () => {
    const out = normalizeFeatureItems(
      [{ icon: "ri-home", title: "  ok  ", body: "  b  " }, { icon: "ri-home", title: "", body: "x" }],
      ICONS,
      "ri-home",
    );
    expect(out).toEqual([{ icon: "ri-home", title: "ok", body: "b" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/features.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export type FeatureItem = { icon: string; title: string; body: string };

/** Validate/clean raw model output into safe FeatureItems. */
export function normalizeFeatureItems(
  raw: unknown,
  iconNames: string[],
  fallbackIcon: string,
): FeatureItem[] {
  if (!Array.isArray(raw)) return [];
  const allow = new Set(iconNames);
  const out: FeatureItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const title = String((r as any).title ?? "").trim();
    if (!title) continue;
    const body = String((r as any).body ?? "").trim();
    const iconRaw = String((r as any).icon ?? "").trim();
    out.push({ icon: allow.has(iconRaw) ? iconRaw : fallbackIcon, title, body });
  }
  return out;
}

/** Build the DeepSeek prompt for feature generation. */
export function buildFeaturePrompt(brief: string, count: number, locale: "el" | "en", iconNames: string[]): string {
  const lang = locale === "el" ? "Greek" : "English";
  return [
    `You write website "feature" cards for a property-management SaaS.`,
    `From the brief, produce exactly ${count} features in ${lang}.`,
    `Return ONLY a JSON array of objects: {"icon","title","body"}.`,
    `"icon" MUST be one of: ${iconNames.join(", ")}.`,
    `"title": max 6 words. "body": 1 sentence, max 22 words.`,
    ``,
    `Brief: ${brief}`,
  ].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai/features.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/features.ts lib/ai/features.test.ts
git commit -m "feat(ai): feature-generation prompt + normalizer (C1)"
```

---

## Task 6: `generateFeatures` server action

**Files:**
- Modify: `lib/ai.ts` (export a JSON-returning DeepSeek helper)
- Create: `app/actions/ai-cms.ts`

- [ ] **Step 1: Export a raw DeepSeek text helper from `lib/ai.ts`**

Add near the other exports (reuses the existing private `deepseekRequest`):

```ts
export async function deepseekComplete(prompt: string): Promise<string> {
  const res = await deepseekRequest(prompt);
  if (!res.success || !res.content) throw new Error(res.error || "DeepSeek request failed");
  return res.content;
}
```

- [ ] **Step 2: Create the action**

```ts
// app/actions/ai-cms.ts
"use server";

import { auth } from "@/auth";
import { deepseekComplete } from "@/lib/ai";
import { ICON_NAMES } from "@/lib/cms/icon-registry";
import { buildFeaturePrompt, normalizeFeatureItems, type FeatureItem } from "@/lib/ai/features";

async function requireSuperAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

function extractJsonArray(text: string): unknown {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < 0 || end <= start) return [];
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
}

export async function generateFeatures(
  brief: string,
  count: number,
  locale: "el" | "en",
): Promise<FeatureItem[]> {
  await requireSuperAdmin();
  const n = Math.min(Math.max(Math.round(count) || 3, 1), 8);
  const fallbackIcon = ICON_NAMES[0] ?? "";
  const prompt = buildFeaturePrompt(brief.trim().slice(0, 1000), n, locale, ICON_NAMES);
  const text = await deepseekComplete(prompt);
  return normalizeFeatureItems(extractJsonArray(text), ICON_NAMES, fallbackIcon).slice(0, n);
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint app/actions/ai-cms.ts lib/ai.ts`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add lib/ai.ts app/actions/ai-cms.ts
git commit -m "feat(ai): generateFeatures server action via DeepSeek (C1)"
```

---

## Task 7: Shared `ItemsEditor` (structured, no JSON)

**Files:**
- Create: `components/cms/ItemsEditor.tsx`

Renders a `SortableList` of item cards; each card is composed of caller-provided fields. Manages add/remove/reorder/patch on an array of `{id, ...}` items in the parent's state.

- [ ] **Step 1: Implement**

```tsx
"use client";

import { ReactNode } from "react";
import { SortableList } from "@/components/cms/SortableList";
import { CmsButton } from "@/components/cms/ui";
import { RiAddLine, RiDeleteBinLine } from "react-icons/ri";

export type Item = { id: string } & Record<string, unknown>;

type Props<T extends Item> = {
  items: T[];
  onChange: (items: T[]) => void;
  newItem: () => T;
  addLabel: string;
  renderFields: (item: T, patch: (p: Partial<T>) => void) => ReactNode;
};

export function ItemsEditor<T extends Item>({ items, onChange, newItem, addLabel, renderFields }: Props<T>) {
  function patch(id: string, p: Partial<T>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }
  function remove(id: string) {
    onChange(items.filter((it) => it.id !== id));
  }
  function reorder(ids: string[]) {
    const byId = new Map(items.map((it) => [it.id, it]));
    onChange(ids.map((id) => byId.get(id)!).filter(Boolean) as T[]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SortableList
        items={items}
        onReorder={reorder}
        renderItem={(item) => (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              background: "var(--card)",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label="Remove"
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--destructive)" }}
              >
                <RiDeleteBinLine size={16} />
              </button>
            </div>
            {renderFields(item, (p) => patch(item.id, p))}
          </div>
        )}
      />
      <div>
        <CmsButton type="button" variant="secondary" onClick={() => onChange([...items, newItem()])}>
          <RiAddLine size={16} /> {addLabel}
        </CmsButton>
      </div>
    </div>
  );
}
```

Note: `CmsButton` prop names (`variant`, `onClick`, `type`) — read `components/cms/ui.tsx` and match its actual API; adjust if `variant` differs. Generate item ids client-side with `crypto.randomUUID()` inside each form's `newItem()`.

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint components/cms/ItemsEditor.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/cms/ItemsEditor.tsx
git commit -m "feat(cms): shared ItemsEditor (structured item lists) (C1)"
```

---

## Task 8: Full-page section editor route + form dispatch + landing index DnD

**Files:**
- Create: `app/(company)/super-admin/cms/landing/[type]/page.tsx`
- Create: `app/(company)/super-admin/cms/landing/[type]/SectionForm.tsx` (client dispatcher)
- Modify: `app/(company)/super-admin/cms/landing/page.tsx` (index → SortableList + Edit links)
- Create: `app/(company)/super-admin/cms/landing/LandingIndexClient.tsx`

- [ ] **Step 1: Landing index → DnD list with Edit links**

Create `LandingIndexClient.tsx` (client): receives `sections: {id,type,enabled,order}[]`, renders `SortableList`; each row shows the type label, an enabled toggle (calls `toggleSection`), and an "Edit" `Link` to `/super-admin/cms/landing/<type>`. On reorder call `reorderSections(ids)` in a `useTransition`.

```tsx
"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { SortableList } from "@/components/cms/SortableList";
import { reorderSections, toggleSection } from "@/app/actions/landing-cms";
import { CmsButton } from "@/components/cms/ui";
import { RiEditLine } from "react-icons/ri";

type Row = { id: string; type: string; enabled: boolean; order: number };

export function LandingIndexClient({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [, start] = useTransition();

  function onReorder(ids: string[]) {
    const byId = new Map(rows.map((r) => [r.id, r]));
    setRows(ids.map((id) => byId.get(id)!).filter(Boolean));
    start(() => reorderSections(ids));
  }
  function toggle(id: string) {
    setRows(rows.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
    start(() => toggleSection(id));
  }

  return (
    <SortableList
      items={rows}
      onReorder={onReorder}
      renderItem={(r) => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--card)", padding: "12px 14px" }}>
          <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{r.type}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted-foreground)" }}>
              <input type="checkbox" checked={r.enabled} onChange={() => toggle(r.id)} /> Ενεργό
            </label>
            <Link href={`/super-admin/cms/landing/${r.type}`}>
              <CmsButton type="button" variant="secondary"><RiEditLine size={15} /> Επεξεργασία</CmsButton>
            </Link>
          </div>
        </div>
      )}
    />
  );
}
```

Then in `landing/page.tsx` replace the up/down list rendering with `<LandingIndexClient initial={sections.map(s=>({id:s.id,type:s.type,enabled:s.enabled,order:s.order}))} />` (keep the SEO card). Read the current `landing/page.tsx` first and preserve the `CmsPage` wrapper + SEO editor.

- [ ] **Step 2: Full-page editor route**

```tsx
// app/(company)/super-admin/cms/landing/[type]/page.tsx
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CmsPage } from "@/components/cms/ui";
import { SectionForm } from "./SectionForm";
import { RiLayoutLine } from "react-icons/ri";

export default async function SectionEditPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const section = await db.landingSection.findUnique({ where: { type } });
  if (!section) notFound();
  return (
    <CmsPage icon={<RiLayoutLine size={20} />} title={`CMS — ${type}`} subtitle="Επεξεργασία ενότητας">
      <SectionForm section={JSON.parse(JSON.stringify(section))} />
    </CmsPage>
  );
}
```

- [ ] **Step 3: SectionForm dispatcher (client)**

```tsx
// app/(company)/super-admin/cms/landing/[type]/SectionForm.tsx
"use client";
import { HeroForm } from "./forms/HeroForm";
import { FeaturesForm } from "./forms/FeaturesForm";
import { TestimonialsForm } from "./forms/TestimonialsForm";
import { LogosForm } from "./forms/LogosForm";
import { CtaForm } from "./forms/CtaForm";
import { NewsForm } from "./forms/NewsForm";

type Section = { id: string; type: string; data: any };

export function SectionForm({ section }: { section: Section }) {
  switch (section.type) {
    case "HERO": return <HeroForm section={section} />;
    case "FEATURES": return <FeaturesForm section={section} />;
    case "TESTIMONIALS": return <TestimonialsForm section={section} />;
    case "LOGOS": return <LogosForm section={section} />;
    case "CTA": return <CtaForm section={section} />;
    case "NEWS": return <NewsForm section={section} />;
    case "PRICING": return <p style={{ color: "var(--muted-foreground)" }}>Τα πακέτα τιμών επεξεργάζονται στη σελίδα «Τιμές».</p>;
    default: return <p>Άγνωστος τύπος.</p>;
  }
}
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit` (the `forms/*` are added in Tasks 9–11; until then this will error on missing imports — implement Tasks 9–11 before building. For this task, verify only `landing/page.tsx`, the route, and index client compile by temporarily importing existing forms; simplest: do Tasks 9–11 in the same branch before the build check. Mark this task's build-check as deferred to Task 11 Step.)

- [ ] **Step 5: Commit**

```bash
git add "app/(company)/super-admin/cms/landing/page.tsx" "app/(company)/super-admin/cms/landing/LandingIndexClient.tsx" "app/(company)/super-admin/cms/landing/[type]/page.tsx" "app/(company)/super-admin/cms/landing/[type]/SectionForm.tsx"
git commit -m "feat(cms): full-page section editor route + landing index DnD (C1)"
```

---

## Task 9: Shared form scaffold + HeroForm (exemplar)

**Files:**
- Create: `app/(company)/super-admin/cms/landing/[type]/forms/formShared.tsx`
- Create: `app/(company)/super-admin/cms/landing/[type]/forms/HeroForm.tsx`

- [ ] **Step 1: formShared — bilingual state + save + locale tabs**

```tsx
// formShared.tsx
"use client";
import { useState, useTransition } from "react";
import { updateSection } from "@/app/actions/landing-cms";
import { autoTranslate } from "@/app/actions/translate";
import { LocaleTabs, SaveBar, CmsButton } from "@/components/cms/ui";
import { RiTranslate2 } from "react-icons/ri";

export type Locale = "el" | "en";
export function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v ?? {})); }
export function toBilingual(raw: any): { el: any; en: any } {
  if (raw && typeof raw === "object" && ("el" in raw || "en" in raw)) return { el: clone(raw.el ?? {}), en: clone(raw.en ?? {}) };
  return { el: clone(raw ?? {}), en: clone(raw ?? {}) };
}

/** Hook: bilingual editor state + save. */
export function useSectionForm(section: { id: string; data: any }) {
  const [data, setData] = useState<{ el: any; en: any }>(() => toBilingual(section.data));
  const [locale, setLocale] = useState<Locale>("el");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  function patch(p: Record<string, unknown>) {
    setData((d) => ({ ...d, [locale]: { ...d[locale], ...p } }));
    setSaved(false);
  }
  function setItems(key: string, items: unknown[]) {
    setData((d) => ({ ...d, [locale]: { ...d[locale], [key]: items } }));
    setSaved(false);
  }
  function save() {
    start(async () => { await updateSection(section.id, data); setSaved(true); });
  }
  return { data, cur: data[locale] ?? {}, locale, setLocale, patch, setItems, save, saved, pending };
}

export function FormChrome({
  locale, setLocale, save, saved, pending, children,
}: { locale: Locale; setLocale: (l: Locale) => void; save: () => void; saved: boolean; pending: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>
      <LocaleTabs value={locale} onChange={setLocale} />
      {children}
      <SaveBar onSave={save} saving={pending} saved={saved} />
    </div>
  );
}
```

Note: `LocaleTabs` and `SaveBar` prop names — read `components/cms/ui.tsx` and match exactly (value/onChange, onSave/saving/saved). Adjust the JSX props to the real API before finishing this step.

- [ ] **Step 2: HeroForm**

```tsx
// HeroForm.tsx
"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { useSectionForm, FormChrome } from "./formShared";

export function HeroForm({ section }: { section: { id: string; type: string; data: any } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Eyebrow"><CmsInput value={c.eyebrow ?? ""} onChange={(e) => f.patch({ eyebrow: e.target.value })} /></CmsField>
      <CmsField label="Τίτλος (H1)"><CmsInput value={c.title ?? ""} onChange={(e) => f.patch({ title: e.target.value })} /></CmsField>
      <CmsField label="Υπότιτλος"><CmsTextarea value={c.subtitle ?? ""} onChange={(e) => f.patch({ subtitle: e.target.value })} /></CmsField>
      <CmsField label="Primary CTA — κείμενο"><CmsInput value={c.primaryCta?.label ?? ""} onChange={(e) => f.patch({ primaryCta: { ...(c.primaryCta ?? {}), label: e.target.value } })} /></CmsField>
      <CmsField label="Primary CTA — σύνδεσμος"><CmsInput value={c.primaryCta?.href ?? ""} onChange={(e) => f.patch({ primaryCta: { ...(c.primaryCta ?? {}), href: e.target.value } })} /></CmsField>
      <CmsField label="Secondary CTA — κείμενο"><CmsInput value={c.secondaryCta?.label ?? ""} onChange={(e) => f.patch({ secondaryCta: { ...(c.secondaryCta ?? {}), label: e.target.value } })} /></CmsField>
      <CmsField label="Secondary CTA — σύνδεσμος"><CmsInput value={c.secondaryCta?.href ?? ""} onChange={(e) => f.patch({ secondaryCta: { ...(c.secondaryCta ?? {}), href: e.target.value } })} /></CmsField>
      <CmsField label="Κεντρική εικόνα"><MediaPicker value={c.imageUrl ?? ""} onChange={(v) => f.patch({ imageUrl: typeof v === "string" ? v : v[0] ?? "" })} accept="image" /></CmsField>
      <CmsField label="Όνομα ακινήτου (κάρτα)"><CmsInput value={c.propertyName ?? ""} onChange={(e) => f.patch({ propertyName: e.target.value })} /></CmsField>
      <CmsField label="Διεύθυνση (κάρτα)"><CmsInput value={c.propertyAddress ?? ""} onChange={(e) => f.patch({ propertyAddress: e.target.value })} /></CmsField>
      <CmsField label="Πληρότητα % (κάρτα)"><CmsInput value={c.occupancy ?? ""} onChange={(e) => f.patch({ occupancy: e.target.value })} /></CmsField>
    </FormChrome>
  );
}
```

- [ ] **Step 3: Make `HeroSection` read the dynamic fields (fallback to current constants)**

In `components/landing/sections/HeroSection.tsx`, change decorative bindings so authored values win, else fall back to `t.*`/constants: e.g. `{c.eyebrow ?? t.eyebrow}`, property name `{data.propertyName ?? "Astra Residences"}`, address `{data.propertyAddress ?? "Λ. Κηφισίας 124"}`, occupancy `{data.occupancy ?? "96%"}`. `data` already carries these once authored. Keep everything else. (The eyebrow/trust already come from `t`; wire `data.eyebrow` as the override.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit` (forms dir still incomplete → expect missing-import errors only for the not-yet-created forms; the Hero + shared files themselves must be error-free).

- [ ] **Step 5: Commit**

```bash
git add "app/(company)/super-admin/cms/landing/[type]/forms/formShared.tsx" "app/(company)/super-admin/cms/landing/[type]/forms/HeroForm.tsx" components/landing/sections/HeroSection.tsx
git commit -m "feat(cms): shared form scaffold + dynamic HeroForm (C1)"
```

---

## Task 10: FeaturesForm (items + AI generation) + Testimonials/Logos forms

**Files:**
- Create: `.../forms/FeaturesForm.tsx`, `.../forms/TestimonialsForm.tsx`, `.../forms/LogosForm.tsx`
- Create: `.../forms/IconPicker.tsx`

- [ ] **Step 1: IconPicker**

```tsx
// IconPicker.tsx
"use client";
import { ICON_NAMES, resolveIcon } from "@/lib/cms/icon-registry";
import { CmsField } from "@/components/cms/ui";

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const Icon = resolveIcon(value);
  return (
    <CmsField label="Εικονίδιο">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "flex", width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 8, background: "var(--primary)", color: "#fff" }}>
          <Icon size={18} />
        </span>
        <select value={value} onChange={(e) => onChange(e.target.value)} style={{ height: 36, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", padding: "0 10px" }}>
          {ICON_NAMES.map((n) => (<option key={n} value={n}>{n}</option>))}
        </select>
      </div>
    </CmsField>
  );
}
```

- [ ] **Step 2: FeaturesForm with AI panel + items**

```tsx
// FeaturesForm.tsx
"use client";
import { useState, useTransition } from "react";
import { CmsField, CmsInput, CmsTextarea, CmsButton } from "@/components/cms/ui";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { ItemsEditor } from "@/components/cms/ItemsEditor";
import { IconPicker } from "./IconPicker";
import { useSectionForm, FormChrome } from "./formShared";
import { generateFeatures } from "@/app/actions/ai-cms";
import { ICON_NAMES } from "@/lib/cms/icon-registry";
import { RiSparkling2Line } from "react-icons/ri";

type Item = { id: string; icon: string; title: string; body: string; imageUrl?: string };

export function FeaturesForm({ section }: { section: { id: string; type: string; data: any } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  const items: Item[] = Array.isArray(c.items) ? c.items : [];
  const [brief, setBrief] = useState("");
  const [count, setCount] = useState(4);
  const [aiPending, startAi] = useTransition();
  const [aiError, setAiError] = useState<string | null>(null);

  function runAi() {
    setAiError(null);
    startAi(async () => {
      try {
        const gen = await generateFeatures(brief, count, f.locale);
        const withIds: Item[] = gen.map((g) => ({ id: crypto.randomUUID(), ...g }));
        f.setItems("items", [...items, ...withIds]);
      } catch (e) {
        setAiError(e instanceof Error ? e.message : "Αποτυχία δημιουργίας");
      }
    });
  }

  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Επικεφαλίδα"><CmsInput value={c.heading ?? ""} onChange={(e) => f.patch({ heading: e.target.value })} /></CmsField>
      <CmsField label="Κεντρική εικόνα"><MediaPicker value={c.imageUrl ?? ""} onChange={(v) => f.patch({ imageUrl: typeof v === "string" ? v : v[0] ?? "" })} accept="image" /></CmsField>

      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--paper)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--foreground)" }}><RiSparkling2Line /> Δημιουργία με AI</div>
        <CmsField label="Σύντομη περιγραφή"><CmsTextarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="π.χ. πλατφόρμα διαχείρισης κοινοχρήστων για πολυκατοικίες…" /></CmsField>
        <CmsField label="Πλήθος"><CmsInput type="number" min={1} max={8} value={count} onChange={(e) => setCount(Number(e.target.value))} /></CmsField>
        {aiError && <p style={{ color: "var(--destructive)", fontSize: 13 }}>{aiError}</p>}
        <div><CmsButton type="button" variant="secondary" onClick={runAi} disabled={aiPending || !brief.trim()}>{aiPending ? "Δημιουργία…" : "Δημιουργία δυνατοτήτων"}</CmsButton></div>
      </div>

      <ItemsEditor<Item>
        items={items}
        onChange={(next) => f.setItems("items", next)}
        newItem={() => ({ id: crypto.randomUUID(), icon: ICON_NAMES[0] ?? "", title: "", body: "" })}
        addLabel="Προσθήκη δυνατότητας"
        renderFields={(item, patch) => (
          <>
            <IconPicker value={item.icon} onChange={(icon) => patch({ icon })} />
            <CmsField label="Τίτλος"><CmsInput value={item.title} onChange={(e) => patch({ title: e.target.value })} /></CmsField>
            <CmsField label="Περιγραφή"><CmsTextarea value={item.body} onChange={(e) => patch({ body: e.target.value })} /></CmsField>
            <CmsField label="Εικόνα (προαιρετικό)"><MediaPicker value={item.imageUrl ?? ""} onChange={(v) => patch({ imageUrl: typeof v === "string" ? v : v[0] ?? "" })} accept="image" /></CmsField>
          </>
        )}
      />
    </FormChrome>
  );
}
```

- [ ] **Step 3: TestimonialsForm**

Same shape as FeaturesForm minus the AI panel; item type `{ id; quote; author; role?; avatarUrl? }`; fields: heading (section), then ItemsEditor with `CmsTextarea` quote, `CmsInput` author, `CmsInput` role, `MediaPicker` avatar. `newItem` → `{ id: crypto.randomUUID(), quote: "", author: "", role: "" }`. addLabel "Προσθήκη μαρτυρίας".

```tsx
// TestimonialsForm.tsx
"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { ItemsEditor } from "@/components/cms/ItemsEditor";
import { useSectionForm, FormChrome } from "./formShared";

type Item = { id: string; quote: string; author: string; role?: string; avatarUrl?: string };

export function TestimonialsForm({ section }: { section: { id: string; type: string; data: any } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  const items: Item[] = Array.isArray(c.items) ? c.items : [];
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Επικεφαλίδα"><CmsInput value={c.heading ?? ""} onChange={(e) => f.patch({ heading: e.target.value })} /></CmsField>
      <ItemsEditor<Item>
        items={items}
        onChange={(next) => f.setItems("items", next)}
        newItem={() => ({ id: crypto.randomUUID(), quote: "", author: "", role: "" })}
        addLabel="Προσθήκη μαρτυρίας"
        renderFields={(item, patch) => (
          <>
            <CmsField label="Απόσπασμα"><CmsTextarea value={item.quote} onChange={(e) => patch({ quote: e.target.value })} /></CmsField>
            <CmsField label="Όνομα"><CmsInput value={item.author} onChange={(e) => patch({ author: e.target.value })} /></CmsField>
            <CmsField label="Ρόλος"><CmsInput value={item.role ?? ""} onChange={(e) => patch({ role: e.target.value })} /></CmsField>
            <CmsField label="Avatar"><MediaPicker value={item.avatarUrl ?? ""} onChange={(v) => patch({ avatarUrl: typeof v === "string" ? v : v[0] ?? "" })} accept="image" /></CmsField>
          </>
        )}
      />
    </FormChrome>
  );
}
```

- [ ] **Step 4: LogosForm**

```tsx
// LogosForm.tsx
"use client";
import { CmsField, CmsInput } from "@/components/cms/ui";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { ItemsEditor } from "@/components/cms/ItemsEditor";
import { useSectionForm, FormChrome } from "./formShared";

type Item = { id: string; label: string; imageUrl?: string };

export function LogosForm({ section }: { section: { id: string; type: string; data: any } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  const items: Item[] = Array.isArray(c.items) ? c.items : [];
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Επικεφαλίδα"><CmsInput value={c.heading ?? ""} onChange={(e) => f.patch({ heading: e.target.value })} /></CmsField>
      <ItemsEditor<Item>
        items={items}
        onChange={(next) => f.setItems("items", next)}
        newItem={() => ({ id: crypto.randomUUID(), label: "" })}
        addLabel="Προσθήκη λογοτύπου"
        renderFields={(item, patch) => (
          <>
            <CmsField label="Όνομα"><CmsInput value={item.label} onChange={(e) => patch({ label: e.target.value })} /></CmsField>
            <CmsField label="Λογότυπο (προαιρετικό)"><MediaPicker value={item.imageUrl ?? ""} onChange={(v) => patch({ imageUrl: typeof v === "string" ? v : v[0] ?? "" })} accept="image" /></CmsField>
          </>
        )}
      />
    </FormChrome>
  );
}
```

- [ ] **Step 5: Type-check + lint the new forms**

Run: `npx tsc --noEmit && npx eslint "app/(company)/super-admin/cms/landing/[type]/forms/"`
Expected: clean (NewsForm/CtaForm still missing → SectionForm import errors; create them in Task 11 before build).

- [ ] **Step 6: Commit**

```bash
git add "app/(company)/super-admin/cms/landing/[type]/forms/FeaturesForm.tsx" "app/(company)/super-admin/cms/landing/[type]/forms/TestimonialsForm.tsx" "app/(company)/super-admin/cms/landing/[type]/forms/LogosForm.tsx" "app/(company)/super-admin/cms/landing/[type]/forms/IconPicker.tsx"
git commit -m "feat(cms): Features(+AI)/Testimonials/Logos structured forms (C1)"
```

---

## Task 11: CtaForm + NewsForm + build

**Files:**
- Create: `.../forms/CtaForm.tsx`, `.../forms/NewsForm.tsx`

- [ ] **Step 1: CtaForm**

```tsx
// CtaForm.tsx
"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { useSectionForm, FormChrome } from "./formShared";

export function CtaForm({ section }: { section: { id: string; type: string; data: any } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Επικεφαλίδα"><CmsInput value={c.heading ?? ""} onChange={(e) => f.patch({ heading: e.target.value })} /></CmsField>
      <CmsField label="Κείμενο"><CmsTextarea value={c.body ?? ""} onChange={(e) => f.patch({ body: e.target.value })} /></CmsField>
      <CmsField label="CTA — κείμενο"><CmsInput value={c.cta?.label ?? ""} onChange={(e) => f.patch({ cta: { ...(c.cta ?? {}), label: e.target.value } })} /></CmsField>
      <CmsField label="CTA — σύνδεσμος"><CmsInput value={c.cta?.href ?? ""} onChange={(e) => f.patch({ cta: { ...(c.cta ?? {}), href: e.target.value } })} /></CmsField>
      <CmsField label="Εικόνα φόντου"><MediaPicker value={c.imageUrl ?? ""} onChange={(v) => f.patch({ imageUrl: typeof v === "string" ? v : v[0] ?? "" })} accept="image" /></CmsField>
    </FormChrome>
  );
}
```

- [ ] **Step 2: NewsForm**

```tsx
// NewsForm.tsx
"use client";
import { CmsField, CmsInput, CmsTextarea } from "@/components/cms/ui";
import { useSectionForm, FormChrome } from "./formShared";

export function NewsForm({ section }: { section: { id: string; type: string; data: any } }) {
  const f = useSectionForm(section);
  const c = f.cur;
  return (
    <FormChrome locale={f.locale} setLocale={f.setLocale} save={f.save} saved={f.saved} pending={f.pending}>
      <CmsField label="Επικεφαλίδα"><CmsInput value={c.heading ?? ""} onChange={(e) => f.patch({ heading: e.target.value })} /></CmsField>
      <CmsField label="Εισαγωγή"><CmsTextarea value={c.intro ?? ""} onChange={(e) => f.patch({ intro: e.target.value })} /></CmsField>
      <CmsField label="Πλήθος άρθρων"><CmsInput type="number" min={1} max={9} value={c.count ?? 3} onChange={(e) => f.patch({ count: Number(e.target.value) })} /></CmsField>
    </FormChrome>
  );
}
```

- [ ] **Step 3: Full build**

Run: `npx tsc --noEmit && npm run build`
Expected: compiles; `/super-admin/cms/landing/[type]` present.

- [ ] **Step 4: Commit**

```bash
git add "app/(company)/super-admin/cms/landing/[type]/forms/CtaForm.tsx" "app/(company)/super-admin/cms/landing/[type]/forms/NewsForm.tsx"
git commit -m "feat(cms): CTA + News structured forms; landing editors build (C1)"
```

---

## Task 12: Seed a NEWS section row

**Files:**
- Create: `prisma/seed-news-section.ts`

- [ ] **Step 1: Seed script**

```ts
import { db } from "../lib/db";

async function main() {
  const existing = await db.landingSection.findUnique({ where: { type: "NEWS" } });
  if (existing) { console.log("NEWS section exists"); return; }
  const max = await db.landingSection.aggregate({ _max: { order: true } });
  await db.landingSection.create({
    data: {
      type: "NEWS",
      enabled: false,
      order: (max._max.order ?? 0) + 1,
      data: {
        el: { heading: "Νέα & άρθρα", intro: "", count: 3 },
        en: { heading: "News & articles", intro: "", count: 3 },
      },
    },
  });
  console.log("Seeded NEWS section");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run seed**

Run: `npx tsx --env-file=.env prisma/seed-news-section.ts`
Expected: "Seeded NEWS section".

- [ ] **Step 3: Commit**

```bash
git add prisma/seed-news-section.ts
git commit -m "chore(cms): seed disabled NEWS landing section (C1)"
```

---

## Task 13: Pricing — tier reorder + feature reorder editor

**Files:**
- Read first: `app/(company)/super-admin/cms/pricing/page.tsx`, `PricingClient.tsx` (learn existing actions/props)
- Create: `app/actions/pricing-cms.ts` (if no pricing actions exist)
- Modify: `PricingClient.tsx` to use `SortableList` for tiers; add per-tier features `SortableList`

- [ ] **Step 1: Read the existing pricing admin**

Run: `sed -n '1,200p' "app/(company)/super-admin/cms/pricing/PricingClient.tsx"` and note how tiers are created/updated today and where the save actions live. Match those signatures; only ADD reorder + convert the tier list and the features list to `SortableList`.

- [ ] **Step 2: Add reorder actions**

Create `app/actions/pricing-cms.ts` (or append to the existing pricing actions file discovered in Step 1):

```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { applyReorder } from "@/lib/cms/reorder";

async function requireSuperAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

export async function reorderTiers(orderedIds: string[]): Promise<void> {
  await requireSuperAdmin();
  const rows = await db.pricingTier.findMany({ orderBy: { order: "asc" } });
  const updates = applyReorder(orderedIds, rows);
  await db.$transaction(updates.map((u) => db.pricingTier.update({ where: { id: u.id }, data: { order: u.order } })));
  revalidatePath("/");
  revalidatePath("/super-admin/cms/pricing");
}
```

- [ ] **Step 3: Convert tier list to SortableList + features list**

In `PricingClient.tsx`: wrap the tier cards in `SortableList` (onReorder → `reorderTiers`). Inside a tier's editor, render its `features: string[]` as a `SortableList` of `{ id: String(index)+feature }`-keyed rows with an input + remove + add; on reorder/edit, update the tier's `features` array in local state and persist via the existing tier-update action. Keep all existing create/update/delete behavior. (Features are strings; assign a stable client key by wrapping each as `{ id, value }` in local state, unwrap to `string[]` on save.)

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add app/actions/pricing-cms.ts "app/(company)/super-admin/cms/pricing/PricingClient.tsx"
git commit -m "feat(cms): pricing tier + feature drag-and-drop ordering (C1)"
```

---

## Task 14: FAQ — structured editor + reorder

**Files:**
- Read first: `app/(company)/super-admin/cms/faq/FaqClient.tsx` and its actions
- Create/Modify: FAQ reorder action; convert list to `SortableList`

- [ ] **Step 1: Read the existing FAQ admin**

Run: `sed -n '1,200p' "app/(company)/super-admin/cms/faq/FaqClient.tsx"` and locate the create/update/delete actions + the FAQ field names (`question`/`answer`, bilingual?). Match them.

- [ ] **Step 2: Add reorder action**

Append to the FAQ actions file (or create `app/actions/faq-cms.ts`):

```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { applyReorder } from "@/lib/cms/reorder";

async function requireSuperAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

export async function reorderFaqs(orderedIds: string[]): Promise<void> {
  await requireSuperAdmin();
  const rows = await db.fAQ.findMany({ orderBy: { order: "asc" } });
  const updates = applyReorder(orderedIds, rows);
  await db.$transaction(updates.map((u) => db.fAQ.update({ where: { id: u.id }, data: { order: u.order } })));
  revalidatePath("/faq");
  revalidatePath("/super-admin/cms/faq");
}
```

Verify the Prisma accessor casing (`db.fAQ`) against the schema (`model FAQ`) — Prisma lower-camel-cases: `fAQ`. Confirm by grepping existing usage in `FaqClient`'s page.

- [ ] **Step 3: Convert FAQ list to SortableList**

In `FaqClient.tsx`, wrap the FAQ rows in `SortableList` (onReorder → `reorderFaqs`), keeping the existing structured question/answer inputs and create/delete. Do not switch to JSON.

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add "app/(company)/super-admin/cms/faq/FaqClient.tsx" app/actions/faq-cms.ts
git commit -m "feat(cms): FAQ drag-and-drop ordering (C1)"
```

---

## Task 15: Manual verification pass

- [ ] **Step 1: Run the app**

Run: `npm run dev`. As SUPER_ADMIN visit `/super-admin/cms/landing`:
- Drag to reorder sections → reload → order persists.
- Open FEATURES editor → add item, drag reorder, pick icon, pick image → Save → check `/` reflects changes.
- FEATURES → "Δημιουργία με AI" with a short brief → items appear as editable drafts → edit → Save.
- Open HERO editor → change eyebrow/title/property name → Save → `/` hero updates.
- `/super-admin/cms/pricing`: reorder tiers + a tier's features → persists.
- `/super-admin/cms/faq`: reorder → persists.
- Enable the NEWS section, set count → `/` shows latest articles (or nothing if none published).
- Toggle EN in the switcher → authored `en` content shows (autotranslate where used).

- [ ] **Step 2: Confirm no regressions**

Run: `npm run build` (clean) and `npx vitest run lib/cms/reorder.test.ts lib/ai/features.test.ts` (green).

- [ ] **Step 3: Final commit (if fixes needed)**

```bash
git add -A && git commit -m "fix(cms): C1 verification fixes"
```

---

## Notes for the executor

- **Read before matching APIs:** `components/cms/ui.tsx` (LocaleTabs/SaveBar/CmsButton prop names), `lib/cms/blog.ts` (`localizedArticle` shape), the existing pricing/faq clients+actions. Where this plan's prop names differ from the real ones, match the real ones — the field/behavior intent is what matters.
- **No JSON textareas** anywhere in the new editors — that is the whole point of C1.
- **Orithon + hierarchy:** forms are single-column, max-width ~720px, grouped fields, sticky SaveBar; item cards use `--card`/`--border`/`--radius`; AI panel on `--paper`. Keep motion calm; the public sections already reveal via GSAP.
- **Light-only:** no `dark:` variants.
- **Bilingual:** everything edits under `{el,en}`; the existing `autoTranslate` can be wired into `FormChrome` later (C1 keeps manual per-locale authoring + the Features AI which generates per active locale).

## Out of scope (later plans)

- **C2:** AI auto-generate SEO/GEO per page.
- **C3:** DeepSeek article topic/draft suggestions in the blog admin.
