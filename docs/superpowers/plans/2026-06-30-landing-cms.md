# Public Landing + CMS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the hardcoded public landing into CMS-driven structured sections (Hero/Logos/Features/Pricing/Testimonials/CTA) with a super-admin admin UI to edit text/images/icons, reorder, and enable/disable each section.

**Architecture:** A `LandingSection` Prisma row per section (`type`, `enabled`, `order`, `data` JSON). TS-typed `data` shapes in `lib/cms/landing-types.ts`. `app/page.tsx` becomes a server component that fetches enabled sections (ordered) and renders them through a section-component registry; the header is a small client child (needs `useSession`). Icons are resolved through an allowlisted react-icons/ri registry. Admin UI lives under `/super-admin/cms/landing` with server actions. A seed creates the 6 sections from the current hardcoded content.

**Tech Stack:** Next.js 16.2 (custom build — read `node_modules/next/dist/docs/` before route work), Prisma 7 (`lib/db.ts`, migrate via diff+deploy — NOT `migrate dev`), Auth.js v5, Tailwind 4.1 + DG/Fluent tokens, react-icons/ri (linear, no emoji), Vitest.

**Existing facts (verified):**
- `PricingTier` model exists (`name, slug, description, monthlyPrice, annualPrice, features[], highlighted, order, published`); `/pricing` reads it via `db.pricingTier.findMany`.
- `app/page.tsx` is currently `'use client'` with `useSession`; the logged-in "Μετάβαση στον χώρο μου" CTA via `homePathForRole` already exists (keep it).
- Image upload helper `lib/bunnycdn.ts`; server-action upload pattern in `app/actions/brand.ts`.
- SUPER_ADMIN nav is `NAV_BY_ROLE.SUPER_ADMIN` in `components/admin/sidebar-nav.tsx`; group shape `{ id, label, icon, color, items }`, item `{ label, href, icon, iconActive, color }`.
- `/super-admin/*` is guarded SUPER_ADMIN-only by `proxy.ts`; super-admin pages live under `app/(company)/super-admin/`.

**Current hardcoded landing content (to seed):**
- Hero title: "Manage Your Properties Effortlessly"; subtitle: "The all-in-one platform for property managers to streamline operations, reduce costs, and improve tenant satisfaction."; CTAs: "Start Free Trial"→/register, "Request Demo"→/contact.
- Features (6): Property Management / Maintenance Tracking / Billing & Payments / Announcements / Role-Based Access / Multi-Language — with the descriptions in the current file (emoji icons replaced by ri names: RiBuildingLine, RiToolsLine, RiMoneyEuroCircleLine, RiMegaphoneLine, RiShieldUserLine, RiGlobalLine).
- CTA section: heading "Ready to transform your property management?"; body "Join hundreds of property managers who trust PropertyPro to streamline their operations."; cta "Start Your Free Trial Today"→/register.
- (Logos/Testimonials: seed with empty `items: []` + headings, disabled by default so the page looks clean until filled.)

---

## File Structure

**New**
- `lib/cms/landing-types.ts` — `SectionType` union, per-type `data` interfaces, `LANDING_SECTION_TYPES` array, default `data` per type.
- `lib/cms/landing-types.test.ts` — validation/default tests.
- `lib/cms/icon-registry.ts` — allowlisted `Record<string, IconComponent>` + `resolveIcon(name)`.
- `lib/cms/landing.ts` — `getLandingSections()` (enabled, ordered) + `getAllLandingSections()` (admin).
- `components/landing/landing-header.tsx` — client header (`useSession`, logged-in CTA).
- `components/landing/sections/{HeroSection,LogosSection,FeaturesSection,PricingSection,TestimonialsSection,CtaSection}.tsx`.
- `components/landing/section-registry.tsx` — maps `type` → component.
- `components/landing/landing-footer.tsx` — legal links footer.
- `app/actions/landing-cms.ts` — `updateSection`, `toggleSection`, `reorderSection` (SUPER_ADMIN-guarded).
- `app/(company)/super-admin/cms/landing/page.tsx` — admin list + edit UI.
- `app/(company)/super-admin/cms/landing/SectionEditor.tsx` — client editor form per type.
- `prisma/seed-landing.ts` — idempotent upsert of the 6 sections.

**Modified**
- `prisma/schema.prisma` — add `LandingSection`.
- `app/page.tsx` — server component rendering sections + header + footer.
- `components/admin/sidebar-nav.tsx` — add "CMS / Landing" to SUPER_ADMIN menu.

---

## Task 1: `LandingSection` Prisma model + migration

**Files:** Modify `prisma/schema.prisma`.

- [ ] **Step 1:** Add model:
```prisma
model LandingSection {
  id        String   @id @default(cuid())
  type      String   @unique  // one section per type (HERO, FEATURES, ...) — enables seed upsert
  enabled   Boolean  @default(true)
  order     Int      @default(0)
  data      Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([enabled, order])
}
```
- [ ] **Step 2:** `npx prisma generate` (confirm success).
- [ ] **Step 3:** Create migration via diff (NOT migrate dev), mirroring the existing `prisma/migrations/<timestamp>_<name>/migration.sql` structure:
```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > /tmp/landing_section.sql
```
Review it contains `CREATE TABLE "LandingSection"`, place it as `prisma/migrations/20260630010000_add_landing_section/migration.sql`.
- [ ] **Step 4:** `npx prisma migrate deploy`. If DB unreachable, leave SQL committed and report DONE_WITH_CONCERNS.
- [ ] **Step 5:** `npx tsc --noEmit 2>&1 | grep -i landingSection || echo "ok"` → expect no type errors; `db.landingSection` should exist.
- [ ] **Step 6:** Commit:
```bash
git add prisma/schema.prisma prisma/migrations/ lib/prisma 2>/dev/null
git commit -m "feat(landing-cms): LandingSection model + migration"
```

---

## Task 2: `lib/cms/landing-types.ts` — typed section shapes (TDD)

**Files:** Create `lib/cms/landing-types.ts`, `lib/cms/landing-types.test.ts`.

- [ ] **Step 1: Failing test** `lib/cms/landing-types.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { LANDING_SECTION_TYPES, defaultSectionData, isSectionType } from "./landing-types";

describe("landing section types", () => {
  it("lists the six section types in render order", () => {
    expect(LANDING_SECTION_TYPES).toEqual(["HERO", "LOGOS", "FEATURES", "PRICING", "TESTIMONIALS", "CTA"]);
  });
  it("isSectionType guards unknown values", () => {
    expect(isSectionType("HERO")).toBe(true);
    expect(isSectionType("NOPE")).toBe(false);
  });
  it("provides default data per type with required keys", () => {
    expect(defaultSectionData("HERO")).toMatchObject({ title: expect.any(String), primaryCta: { label: expect.any(String), href: expect.any(String) } });
    expect(defaultSectionData("FEATURES")).toMatchObject({ heading: expect.any(String), items: expect.any(Array) });
    expect(defaultSectionData("TESTIMONIALS").items).toEqual([]);
  });
});
```
- [ ] **Step 2:** `npm run test -- lib/cms/landing-types.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `lib/cms/landing-types.ts`:
```ts
export const LANDING_SECTION_TYPES = ["HERO", "LOGOS", "FEATURES", "PRICING", "TESTIMONIALS", "CTA"] as const;
export type SectionType = (typeof LANDING_SECTION_TYPES)[number];

export function isSectionType(v: string): v is SectionType {
  return (LANDING_SECTION_TYPES as readonly string[]).includes(v);
}

export interface Cta { label: string; href: string }
export interface HeroData { title: string; subtitle: string; primaryCta: Cta; secondaryCta: Cta; imageUrl: string }
export interface LogosData { heading: string; items: { label: string; imageUrl?: string }[] }
export interface FeatureItem { icon: string; title: string; body: string; imageUrl?: string }
export interface FeaturesData { heading: string; items: FeatureItem[] }
export interface PricingData { heading: string; subtitle: string }
export interface TestimonialItem { quote: string; author: string; role?: string; avatarUrl?: string }
export interface TestimonialsData { heading: string; items: TestimonialItem[] }
export interface CtaData { heading: string; body?: string; cta: Cta }

export type SectionData = HeroData | LogosData | FeaturesData | PricingData | TestimonialsData | CtaData;

export function defaultSectionData(type: SectionType): any {
  switch (type) {
    case "HERO": return { title: "", subtitle: "", primaryCta: { label: "Δοκιμή", href: "/register" }, secondaryCta: { label: "Επικοινωνία", href: "/contact" }, imageUrl: "" };
    case "LOGOS": return { heading: "", items: [] };
    case "FEATURES": return { heading: "", items: [] };
    case "PRICING": return { heading: "", subtitle: "" };
    case "TESTIMONIALS": return { heading: "", items: [] };
    case "CTA": return { heading: "", body: "", cta: { label: "Δοκιμή", href: "/register" } };
  }
}
```
- [ ] **Step 4:** `npm run test -- lib/cms/landing-types.test.ts` → PASS.
- [ ] **Step 5:** Commit:
```bash
git add lib/cms/landing-types.ts lib/cms/landing-types.test.ts
git commit -m "feat(landing-cms): typed section data shapes"
```

---

## Task 3: `lib/cms/icon-registry.ts` — allowlisted ri icons (TDD)

**Files:** Create `lib/cms/icon-registry.ts`, `lib/cms/icon-registry.test.ts`.

- [ ] **Step 1: Failing test**:
```ts
import { describe, it, expect } from "vitest";
import { resolveIcon, ICON_NAMES } from "./icon-registry";

describe("icon registry", () => {
  it("resolves known icons to a component", () => {
    expect(typeof resolveIcon("RiBuildingLine")).toBe("function");
  });
  it("returns a fallback component (never null) for unknown icon names", () => {
    expect(typeof resolveIcon("RiTotallyFake")).toBe("function");
  });
  it("exposes the allowlist names for the editor dropdown", () => {
    expect(ICON_NAMES).toContain("RiBuildingLine");
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(8);
  });
});
```
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** `lib/cms/icon-registry.ts`:
```ts
import {
  RiBuildingLine, RiToolsLine, RiMoneyEuroCircleLine, RiMegaphoneLine,
  RiShieldUserLine, RiGlobalLine, RiDashboardLine, RiFileList3Line,
  RiTeamLine, RiBarChartBoxLine,
} from "react-icons/ri";
import type { IconType } from "react-icons";

const REGISTRY: Record<string, IconType> = {
  RiBuildingLine, RiToolsLine, RiMoneyEuroCircleLine, RiMegaphoneLine,
  RiShieldUserLine, RiGlobalLine, RiDashboardLine, RiFileList3Line,
  RiTeamLine, RiBarChartBoxLine,
};

export const ICON_NAMES = Object.keys(REGISTRY);

export function resolveIcon(name: string): IconType {
  return REGISTRY[name] ?? RiBuildingLine;
}
```
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** Commit:
```bash
git add lib/cms/icon-registry.ts lib/cms/icon-registry.test.ts
git commit -m "feat(landing-cms): allowlisted ri icon registry"
```

---

## Task 4: `lib/cms/landing.ts` — data fetchers

**Files:** Create `lib/cms/landing.ts`.

- [ ] **Step 1: Implement** (no unit test — DB-backed):
```ts
import "server-only";
import { db } from "@/lib/db";

export async function getLandingSections() {
  return db.landingSection.findMany({ where: { enabled: true }, orderBy: { order: "asc" } });
}

export async function getAllLandingSections() {
  return db.landingSection.findMany({ orderBy: { order: "asc" } });
}
```
- [ ] **Step 2:** `npx tsc --noEmit 2>&1 | grep -i "cms/landing.ts" || echo ok` → no errors.
- [ ] **Step 3:** Commit:
```bash
git add lib/cms/landing.ts
git commit -m "feat(landing-cms): landing section fetchers"
```

---

## Task 5: Seed the 6 sections from current content

**Files:** Create `prisma/seed-landing.ts`.

- [ ] **Step 1: Implement** an idempotent seed. `LandingSection.type` is `@unique` (Task 1), so use `upsert` keyed on `type`:
```ts
import { db } from "@/lib/db";

const SECTIONS = [
  { type: "HERO", order: 0, enabled: true, data: {
    title: "Διαχειριστείτε τα ακίνητά σας εύκολα",
    subtitle: "Η ολοκληρωμένη πλατφόρμα για διαχειριστές ακινήτων — λιγότερο κόστος, καλύτερη εξυπηρέτηση ενοίκων.",
    primaryCta: { label: "Δωρεάν δοκιμή", href: "/register" },
    secondaryCta: { label: "Ζητήστε demo", href: "/contact" },
    imageUrl: "",
  }},
  { type: "LOGOS", order: 1, enabled: false, data: { heading: "Μας εμπιστεύονται", items: [] } },
  { type: "FEATURES", order: 2, enabled: true, data: {
    heading: "Δυνατότητες",
    items: [
      { icon: "RiBuildingLine", title: "Διαχείριση ακινήτων", body: "Διαχειριστείτε πολλά ακίνητα και μονάδες από ένα dashboard." },
      { icon: "RiToolsLine", title: "Παρακολούθηση συντήρησης", body: "Αιτήματα συντήρησης με real-time παρακολούθηση και προγραμματισμό." },
      { icon: "RiMoneyEuroCircleLine", title: "Χρεώσεις & πληρωμές", body: "Αυτόματες χρεώσεις, είσπραξη και οικονομικές αναφορές." },
      { icon: "RiMegaphoneLine", title: "Ανακοινώσεις", body: "Μοιραστείτε ενημερώσεις και ψηφιακή σήμανση με τους ενοίκους." },
      { icon: "RiShieldUserLine", title: "Ρόλοι & δικαιώματα", body: "Διαφορετικοί τύποι ρόλων με παραμετροποιήσιμα δικαιώματα." },
      { icon: "RiGlobalLine", title: "Πολυγλωσσικό", body: "Πλήρης υποστήριξη Ελληνικών και Αγγλικών." },
    ],
  }},
  { type: "PRICING", order: 3, enabled: true, data: { heading: "Τιμολόγηση", subtitle: "Διαφανή πλάνα για κάθε μέγεθος." } },
  { type: "TESTIMONIALS", order: 4, enabled: false, data: { heading: "Τι λένε οι πελάτες μας", items: [] } },
  { type: "CTA", order: 5, enabled: true, data: {
    heading: "Έτοιμοι να αναβαθμίσετε τη διαχείριση των ακινήτων σας;",
    body: "Εκατοντάδες διαχειριστές εμπιστεύονται την πλατφόρμα μας.",
    cta: { label: "Ξεκινήστε τη δωρεάν δοκιμή", href: "/register" },
  }},
];

async function main() {
  for (const s of SECTIONS) {
    await db.landingSection.upsert({ where: { type: s.type }, update: {}, create: s });
  }
  console.log("Landing sections seeded.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```
- [ ] **Step 2:** Run it: `npx tsx prisma/seed-landing.ts` (or the repo's TS runner — check `package.json`/`prisma.config.ts` for how existing seeds run; mirror that). Confirm 6 rows. If DB unreachable, report DONE_WITH_CONCERNS and leave the script committed.
- [ ] **Step 3:** Commit:
```bash
git add prisma/seed-landing.ts prisma/schema.prisma prisma/migrations/ lib/prisma 2>/dev/null
git commit -m "feat(landing-cms): seed sections from current landing content"
```

---

## Task 6: Section components + registry

**Files:** Create `components/landing/sections/*.tsx`, `components/landing/section-registry.tsx`, `components/landing/landing-footer.tsx`.

- [ ] **Step 1:** Implement one server component per section type, styled with Tailwind + DG/Fluent (light, professional; primary accent via existing app tokens — inspect `app/globals.css`/existing components for the accent class, do NOT hardcode the old blue-600 if a token exists; if unsure use a neutral slate + a single accent). Each takes a typed `data` prop. Use `resolveIcon` for feature icons. Examples (Hero shown; mirror structure for the rest):
```tsx
// components/landing/sections/HeroSection.tsx
import Link from "next/link";
import type { HeroData } from "@/lib/cms/landing-types";

export function HeroSection({ data }: { data: HeroData }) {
  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{data.title}</h1>
          <p className="mt-4 text-lg text-gray-600">{data.subtitle}</p>
          <div className="mt-8 flex gap-3">
            <Link href={data.primaryCta.href} className="px-6 py-3 rounded-lg bg-gray-900 text-white font-semibold">{data.primaryCta.label}</Link>
            <Link href={data.secondaryCta.href} className="px-6 py-3 rounded-lg border font-semibold">{data.secondaryCta.label}</Link>
          </div>
        </div>
        <div className="aspect-video rounded-xl bg-gray-100 overflow-hidden">
          {data.imageUrl ? <img src={data.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
        </div>
      </div>
    </section>
  );
}
```
- `FeaturesSection`: grid of items, each `const Icon = resolveIcon(item.icon)` then `<Icon className="..." />`.
- `PricingSection`: fetch `db.pricingTier.findMany({ where: { published: true }, orderBy: { order: "asc" } })` and render cards (mirror `/pricing` markup), with `data.heading`/`data.subtitle` above.
- `LogosSection` / `TestimonialsSection`: render `data.items`; render nothing visual-heavy when empty.
- `CtaSection`: heading/body + button.
- `landing-footer.tsx`: links to /pricing /faq /contact /privacy /terms /cookie-policy.

- [ ] **Step 2:** `section-registry.tsx`:
```tsx
import { HeroSection } from "./sections/HeroSection";
import { LogosSection } from "./sections/LogosSection";
import { FeaturesSection } from "./sections/FeaturesSection";
import { PricingSection } from "./sections/PricingSection";
import { TestimonialsSection } from "./sections/TestimonialsSection";
import { CtaSection } from "./sections/CtaSection";

export function renderSection(type: string, data: any, key: string) {
  switch (type) {
    case "HERO": return <HeroSection key={key} data={data} />;
    case "LOGOS": return <LogosSection key={key} data={data} />;
    case "FEATURES": return <FeaturesSection key={key} data={data} />;
    case "PRICING": return <PricingSection key={key} data={data} />;
    case "TESTIMONIALS": return <TestimonialsSection key={key} data={data} />;
    case "CTA": return <CtaSection key={key} data={data} />;
    default: return null;
  }
}
```
(`PricingSection` is async — `renderSection` returns the element; since it's a server component tree, an async child is fine when rendered in a server component. If the build complains about async in `renderSection`, render the registry inline in `app/page.tsx` via a map+switch instead.)

- [ ] **Step 3:** `npx tsc --noEmit` clean for these files; `npm run build` succeeds.
- [ ] **Step 4:** Commit:
```bash
git add components/landing
git commit -m "feat(landing-cms): section components + registry + footer"
```

---

## Task 7: `landing-header.tsx` (client) + convert `app/page.tsx` to server

**Files:** Create `components/landing/landing-header.tsx`; rewrite `app/page.tsx`.

- [ ] **Step 1:** `components/landing/landing-header.tsx` — move the current header JSX here as a `'use client'` component using `useSession()` and the existing logged-in CTA (`homePathForRole`). Nav links: Home/Pricing/FAQ/Contact; Login/«Δοκιμή» when logged-out; «Μετάβαση στον χώρο μου» when logged-in. Use DG/Fluent styling, react-icons/ri where icons are used.
- [ ] **Step 2:** Rewrite `app/page.tsx` as a server component:
```tsx
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { getLandingSections } from "@/lib/cms/landing";
import { renderSection } from "@/components/landing/section-registry";

export default async function Home() {
  const sections = await getLandingSections();
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <main>
        {sections.map((s) => renderSection(s.type, s.data, s.id))}
      </main>
      <LandingFooter />
    </div>
  );
}
```
If `renderSection` can't host the async `PricingSection`, inline the switch here in an `await Promise.all(sections.map(...))` or render `PricingSection` specially. Implementer: choose the approach that builds; document it.
- [ ] **Step 3:** `npm run build` → success; visit `/` renders seeded sections. `npx tsc --noEmit` clean for `app/page.tsx`.
- [ ] **Step 4:** Commit:
```bash
git add app/page.tsx components/landing/landing-header.tsx
git commit -m "feat(landing-cms): CMS-driven server landing page + client header"
```

---

## Task 8: Admin server actions

**Files:** Create `app/actions/landing-cms.ts`.

- [ ] **Step 1: Implement** (SUPER_ADMIN-guarded; validates type):
```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isSectionType } from "@/lib/cms/landing-types";

async function requireSuperAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

export async function updateSection(id: string, data: unknown): Promise<void> {
  await requireSuperAdmin();
  await db.landingSection.update({ where: { id }, data: { data: data as any } });
  revalidatePath("/");
  revalidatePath("/super-admin/cms/landing");
}

export async function toggleSection(id: string): Promise<void> {
  await requireSuperAdmin();
  const row = await db.landingSection.findUnique({ where: { id } });
  if (!row) throw new Error("Not found");
  await db.landingSection.update({ where: { id }, data: { enabled: !row.enabled } });
  revalidatePath("/");
  revalidatePath("/super-admin/cms/landing");
}

export async function reorderSection(id: string, dir: "up" | "down"): Promise<void> {
  await requireSuperAdmin();
  const all = await db.landingSection.findMany({ orderBy: { order: "asc" } });
  const i = all.findIndex((s) => s.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= all.length) return;
  await db.$transaction([
    db.landingSection.update({ where: { id: all[i].id }, data: { order: all[j].order } }),
    db.landingSection.update({ where: { id: all[j].id }, data: { order: all[i].order } }),
  ]);
  revalidatePath("/");
  revalidatePath("/super-admin/cms/landing");
}
```
- [ ] **Step 2:** `npx tsc --noEmit` clean.
- [ ] **Step 3:** Commit:
```bash
git add app/actions/landing-cms.ts
git commit -m "feat(landing-cms): admin server actions (update/toggle/reorder)"
```

---

## Task 9: Admin UI page + editor

**Files:** Create `app/(company)/super-admin/cms/landing/page.tsx`, `app/(company)/super-admin/cms/landing/SectionEditor.tsx`.

- [ ] **Step 1:** `page.tsx` (server): fetch `getAllLandingSections()`, render a list — each row shows `type`, enabled badge, up/down buttons (forms calling `reorderSection.bind(null, id, dir)`), a toggle (form → `toggleSection.bind(null, id)`), and the `<SectionEditor section={...} />`.
- [ ] **Step 2:** `SectionEditor.tsx` (`'use client'`): renders a type-appropriate form. For object/array `data` keep it pragmatic: render fields for known keys (title/subtitle/heading/body, CTA label+href) and a JSON `<textarea>` for the `items` arrays (FEATURES/LOGOS/TESTIMONIALS) with parse+validate on submit. Icon fields offer a `<select>` from `ICON_NAMES`. On submit, call `updateSection(id, parsedData)`. Show a save status. Keep it functional, not fancy.
- [ ] **Step 3:** Build; manually verify at `/super-admin/cms/landing`: edit Hero title → save → `/` reflects it; toggle LOGOS on/off; reorder FEATURES vs PRICING.
- [ ] **Step 4:** Commit:
```bash
git add "app/(company)/super-admin/cms/landing"
git commit -m "feat(landing-cms): super-admin landing CMS admin UI"
```

---

## Task 10: Add CMS menu entry for SUPER_ADMIN

**Files:** Modify `components/admin/sidebar-nav.tsx`.

- [ ] **Step 1:** In `NAV_BY_ROLE.SUPER_ADMIN`, add a group or item linking to `/super-admin/cms/landing` labeled "CMS / Landing", icon `RiLayoutLine`/`RiLayoutFill` (add to the ri import; follow the file's Line/Fill convention). Match the exact NavGroup/NavItem shape (`{ id, label, icon, color, items }` / `{ label, href, icon, iconActive, color }`).
- [ ] **Step 2:** `npx tsc --noEmit` clean; `npm run build` success; the link appears in the super-admin sidebar.
- [ ] **Step 3:** Commit:
```bash
git add components/admin/sidebar-nav.tsx
git commit -m "feat(landing-cms): super-admin CMS menu entry"
```

---

## Task 11: Final verification

- [ ] **Step 1:** `npm run test` → all pass; `npm run build` → success.
- [ ] **Step 2:** Manual: `/` renders seeded sections in order, no emoji, logged-in shows workspace CTA; disabled sections (LOGOS/TESTIMONIALS) hidden. As SUPER_ADMIN, the CMS page edits/toggles/reorders and changes reflect on `/` after save (revalidatePath).
- [ ] **Step 3:** Confirm no stray type errors introduced in the new files (`npx tsc --noEmit 2>&1 | grep -iE "landing|cms" || echo ok`).
- [ ] **Step 4:** Commit any fixes.

---

## Out of scope (future)
- en/multilingual content (JSON structure allows it later).
- Image upload UI beyond URL fields (optional stretch via lib/bunnycdn.ts).
- Editing /pricing /faq /contact /legal (unchanged).
- Drag-and-drop block builder.
