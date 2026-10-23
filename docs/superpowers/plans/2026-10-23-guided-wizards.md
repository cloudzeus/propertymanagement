# Guided Wizards (οδηγούμενη καταχώριση) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Κάθε αρχικοποίηση (πελάτης, ιδιοκτησία, κτήριο+μονάδες, χιλιοστά, κοινόχρηστος χώρος, υπηρεσία, πακέτο, συνεργάτης, + 4 υπάρχουσες ροές) γίνεται με wizard σε modal που τελειώνει με υπολογισμένο «Παράδειγμα εφαρμογής», video και οδηγό στο wiki/help.

**Architecture:** Ένα pure registry (`lib/wizards/registry.ts`) τροφοδοτεί `WizardHost` (deep link `?wizard=`), το μενού «Ενέργειες» κτηρίου (`wizard` πεδίο στο `lib/building-actions.ts`), το FAB και τα κουμπιά «Νέο…». Τα wizards είναι `GuidedFlow` v2 components που αποθηκεύουν με τα υπάρχοντα server actions (δύο νέα: `createBuildingWithUnits`, `applyMillesimesSetup`). Τα παραδείγματα είναι pure συναρτήσεις στο `lib/wizards/examples/`. Οι οδηγοί είναι `docs/wiki/guides/*.md` (`kind: guide`) με video URL που παράγεται από το motion-studio composition `Orithon-Guide-<Key>-16x9` και δημοσιεύεται στο Bunny.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Prisma 7 (χωρίς αλλαγή schema), Vitest, react-icons/ri, Remotion 4 (motion-studio), Bunny CDN (S3).

**Spec:** `docs/superpowers/specs/2026-10-23-guided-wizards-design.md`

## Global Constraints

- Ελληνικό UI παντού· react-icons/ri `*Line` μόνο· fluid typography `var(--fs-*)`· κανένα fixed `px` font-size.
- Mobile ≤767 px: τα modals είναι bottom sheets (υπάρχον CSS `.ui-modal`), στόχοι αφής ≥44 px.
- Καμία αλλαγή `prisma/schema.prisma`. Νέα server actions μόνο: `createBuildingWithUnits`, `applyMillesimesSetup`.
- Guards: `requireSuperAdmin` (customers/properties/buildings/services), `requireBuildingCap` (κτήριο), `requirePermission`/`can` (λοιπά). Ο client κρύβει, ο server αποφασίζει.
- Η τοπική ΒΔ είναι ΠΑΡΑΓΩΓΗ: browser έλεγχος μόνο μέχρι το βήμα «Παράδειγμα», ποτέ «Αποθήκευση».
- Shared checkout `main` με άλλες συνεδρίες: commit μόνο δικά σου αρχεία, ποτέ stash/reset/branch switch/push.
- Dev server: launch config `attach-3002` (τρέχει ήδη). Πριν από πλοήγηση στο pane: unregister του service worker (`navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()))`).
- Γνωστά προϋπάρχοντα: 9 tsc σφάλματα (auth.ts ×2, costs ×2, ForgotPasswordForm, otp.ts ×2, prisma.config.ts, seed.ts), ~339 eslint, 2 failing tests (`lib/building-caps.test.ts`, `lib/ai/assistant/actions.test.ts`). Κανένα νέο.
- Κάθε commit: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Σενάρια video: ονόματα/ποσά φανταστικά, ελληνικά για μη τεχνικούς, 60–90 s, 1280×720, muted.

## Review Focus

1. **Draft ανάκτηση με ξεπερασμένο σχήμα** — ένα draft που έχει πεδίο που δεν υπάρχει πια (ή λείπει νέο πεδίο) πρέπει να φορτώνει χωρίς crash και χωρίς `undefined` σε controlled inputs → test `draft.test.ts` «restore merges over defaults, ignores unknown keys» (Task 2).
2. **Μονάδες χωρίς τ.μ. στο παράδειγμα χιλιοστών** — το άθροισμα των υπολοίπων πρέπει να μένει 1000 και η μονάδα να εμφανίζεται «—» όχι 0 € σιωπηλά → test `millesimes.test.ts` «unit without area is reported, others still sum to 1000» (Task 10).
3. **Χειροκίνητα χιλιοστά που δεν αθροίζουν 1000** — το wizard μπλοκάρει το «Συνέχεια» με το ακριβές υπόλοιπο (π.χ. «Λείπουν 12,5‰») → test `millesimes.test.ts` `manualSumError` (Task 10).
4. **Deep link `?wizard=` χωρίς δικαίωμα ή με άγνωστο key** — αγνοείται σιωπηλά και το query αφαιρείται, δεν ανοίγει τίποτα, δεν πετάει → test `registry.test.ts` `allowedWizards` + `isWizardKey` (Task 1) και έλεγχος browser (Task 4).
5. **Κωδικός υπηρεσίας από ελληνικό όνομα** — «Καθαρισμός κοινοχρήστων» → `KATHARISMOS-KOINOCHRISTON`, μοναδικός έναντι υπαρχόντων (`-2`) → test `service.test.ts` `suggestServiceCode` (Task 12).

---

## Φάση 0 — Πλαίσιο

### Task 1: Registry wizards

**Files:**
- Create: `lib/wizards/registry.ts`
- Test: `lib/wizards/registry.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type WizardKey = "customer-new" | "property-new" | "building-new" | "millesimes-setup" | "common-area-new" | "service-new" | "package-setup" | "supplier-new" | "occupant-assign" | "task-new" | "announcement-new" | "assembly-new";
  export type WizardScope = "global" | "customer" | "property" | "building";
  export type WizardDef = { key: WizardKey; title: string; short: string; icon: string; scope: WizardScope; permission?: { module: string; action: "create" | "edit" }; cap?: keyof BuildingCaps; superAdminOnly?: boolean; videoKey: string; guideSlug: string; next?: WizardKey };
  export const WIZARDS: readonly WizardDef[];
  export const WIZARD_PARAM = "wizard";
  export type WizardCtx = { customerId?: string; propertyId?: string; buildingId?: string };
  export function isWizardKey(s: unknown): s is WizardKey;
  export function getWizard(key: WizardKey): WizardDef;
  export function wizardHref(base: string, key: WizardKey, ctx?: WizardCtx): string;   // `${base}?wizard=${key}` + `&customerId=…` κ.λπ. μόνο για όσα δόθηκαν
  export function allowedWizards(perms: Set<string>, role: string): WizardKey[];       // μόνο scope ≠ "building": can(perms, module, action) && (!superAdminOnly || role === "SUPER_ADMIN")
  export function nextWizard(key: WizardKey): WizardDef | null;
  ```
- Τιμές registry (spec §3.1/§4): `customer-new` {scope global, permission customers/create, superAdminOnly, videoKey "Customer", guideSlug "guide-customer", next property-new, icon RiUserAddLine} · `property-new` {customer, properties/create, superAdminOnly, "Property", "guide-property", next building-new, RiCommunityLine} · `building-new` {property, properties/create, superAdminOnly, "Building", "guide-building", next millesimes-setup, RiBuilding2Line} · `millesimes-setup` {building, cap editMillesimes, "Millesimes", "guide-millesimes", next package-setup, RiScales3Line} · `common-area-new` {building, cap manageManagedItems, "CommonArea", "guide-common-area", next package-setup, RiDoorOpenLine} · `service-new` {global, services/create, superAdminOnly, "Service", "guide-service", RiServiceLine} · `package-setup` {property, properties/edit, "Package", "guide-package", RiPriceTag3Line} · `supplier-new` {global, suppliers/create, "Supplier", "guide-supplier", RiTeamLine} · `occupant-assign` {building, cap editUnits, "Occupant", "guide-occupant", RiUserStarLine} · `task-new` {building, cap manageCalendar, "Task", "guide-task", RiCalendarTodoLine} · `announcement-new` {building, cap manageAnnouncements, "Announcement", "guide-announcement", RiMegaphoneLine} · `assembly-new` {building, cap manageAssemblies, "Assembly", "guide-assembly", RiGroupLine}.

- [ ] **Step 1: Write the failing tests** `lib/wizards/registry.test.ts`

```ts
it("has 12 unique keys, each with guideSlug and videoKey", () => { expect(new Set(WIZARDS.map(w => w.key)).size).toBe(12); for (const w of WIZARDS) { expect(w.guideSlug).toMatch(/^guide-/); expect(w.videoKey).toMatch(/^[A-Z][A-Za-z]+$/); } });
it("chain customer→property→building→millesimes→package", () => { expect(nextWizard("customer-new")?.key).toBe("property-new"); expect(nextWizard("building-new")?.key).toBe("millesimes-setup"); expect(nextWizard("millesimes-setup")?.key).toBe("package-setup"); expect(nextWizard("supplier-new")).toBeNull(); });
it("wizardHref appends only the given ctx ids", () => { expect(wizardHref("/super-admin/customers", "property-new", { customerId: "c1" })).toBe("/super-admin/customers?wizard=property-new&customerId=c1"); expect(wizardHref("/x", "service-new")).toBe("/x?wizard=service-new"); });
it("isWizardKey rejects unknown and non-strings", () => { expect(isWizardKey("service-new")).toBe(true); expect(isWizardKey("nope")).toBe(false); expect(isWizardKey(null)).toBe(false); });
it("allowedWizards honours perms and superAdminOnly, excludes building scope", () => {
  const perms = new Set(["customers:create", "services:create", "suppliers:create", "properties:edit"]);
  expect(allowedWizards(perms, "ADMIN")).toEqual(["package-setup", "supplier-new"]);
  expect(allowedWizards(perms, "SUPER_ADMIN")).toEqual(expect.arrayContaining(["customer-new", "service-new", "supplier-new", "package-setup"]));
  expect(allowedWizards(perms, "SUPER_ADMIN")).not.toContain("millesimes-setup");
});
```
(Μορφή perm string: δες `lib/rbac/permissions-core.ts` `can()` — χρησιμοποίησε την `can`, μην ξαναγράψεις τη λογική.)

- [ ] **Step 2: Run** `npx vitest run lib/wizards/registry.test.ts` → FAIL (module not found)
- [ ] **Step 3: Implement** `lib/wizards/registry.ts` με τις τιμές του Interfaces block· import type `BuildingCaps` από `@/lib/building-caps`, `can` από `@/lib/rbac/permissions-core`.
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** `feat(wizards): registry of guided flows (keys, scopes, permissions, chain)`

### Task 2: GuidedFlow v2 + draft storage

**Files:**
- Create: `lib/wizards/draft.ts`, `lib/wizards/draft.test.ts`
- Modify: `components/ui/guided-flow.tsx`
- Create: `components/ui/guided-flow-parts.tsx` (ExampleCard, ExampleTable, NumberField, DoneScreen)
- Create: `components/wizards/HelpVideoPlayer.tsx`

**Interfaces:**
- Produces (`lib/wizards/draft.ts`, pure, χωρίς React):
  ```ts
  export const DRAFT_TTL_MS = 7 * 24 * 3600 * 1000;
  export type Draft<T> = { value: T; savedAt: number; step: number };
  export function draftStorageKey(wizardKey: string, ctxId?: string | null): string; // `wizard-draft:${wizardKey}:${ctxId ?? "-"}`
  export function serializeDraft<T>(value: T, step: number, omit: (keyof T)[], now?: number): string;
  export function parseDraft<T extends object>(raw: string | null, defaults: T, now?: number): Draft<T> | null; // null αν άκυρο JSON ή ληγμένο· value = {...defaults, ...μόνο γνωστά keys}
  export function formatDraftAge(savedAt: number, now?: number): string; // «πριν από 5 λεπτά», «χθες», «πριν από 3 ημέρες»
  ```
- Produces (`components/ui/guided-flow.tsx`, συμβατό με τους 4 υπάρχοντες callers):
  ```ts
  export type FlowStep = { key: string; title: string; help?: ReactNode; render: () => ReactNode; validate?: () => string | null };
  export type WizardVideo = { src: string; poster?: string; seconds?: number; title: string };
  export type FlowExample = { title?: string; render: () => ReactNode; video?: WizardVideo | null; guideHref?: string };
  export type FlowDone = { title: string; lines?: string[]; next?: { label: string; onClick: () => void; icon?: string }[] };
  export type FlowDraft<T> = { key: string; ctxId?: string | null; value: T; restore: (v: T, step: number) => void; omit?: (keyof T)[] };
  export function GuidedFlow<T = unknown>(props: { title: string; steps: FlowStep[]; onClose: () => void; onFinish: () => Promise<{ error?: string | null; done?: FlowDone } | void>; finishLabel?: string; width?: number; onSimpleForm?: () => void; example?: FlowExample; draft?: FlowDraft<T>; dirty?: boolean }): JSX.Element;
  export { ChoiceCards, SummaryList }  // αμετάβλητα
  ```
  Συμπεριφορά: αν `example` → προστίθεται τελευταίο βήμα «Παράδειγμα εφαρμογής» (key `__example`) με το `finishLabel` κουμπί· η ράγα δείχνει «Βήμα i από n»· κλικ σε ολοκληρωμένο βήμα επιστρέφει· `draft`: στο mount διαβάζει `localStorage`, αν υπάρχει έγκυρο draft δείχνει κάρτα «Βρήκαμε μια μισοτελειωμένη καταχώριση ({age}). [Συνέχεια] [Από την αρχή]»· σε κάθε αλλαγή `value`/step γράφει (debounce 300 ms)· στο finish/«Από την αρχή» διαγράφει· κλείσιμο με `dirty` → ερώτηση «Να κρατηθεί πρόχειρο;» [Ναι] [Απόρριψη] [Πίσω]· `onFinish` που επιστρέφει `done` → `DoneScreen`· μεταβάσεις 180 ms opacity/translate, απενεργοποιημένες σε `prefers-reduced-motion`.
- Produces (`guided-flow-parts.tsx`): `ExampleCard({ title, children, tone?: "info"|"success"|"warn" })`, `ExampleTable({ columns: string[]; rows: ReactNode[][]; footer?: ReactNode[] })`, `NumberField({ value: string; onChange; unit?: "τ.μ."|"€"|"‰"|"%"; min?; step?; placeholder? })` (δέχεται κόμμα), `DoneScreen({ done: FlowDone; onClose })`.
- Produces (`HelpVideoPlayer.tsx`): `HelpVideoPlayer({ video: WizardVideo; compact?: boolean })` → κουμπί «Δείτε το video (m′ss″)» που ανοίγει inline `<video controls playsInline muted preload="metadata" poster>`· `compact` = μόνο το κουμπί.

- [ ] **Step 1: Write the failing tests** `lib/wizards/draft.test.ts`

```ts
it("key is namespaced per wizard and ctx", () => expect(draftStorageKey("customer-new", null)).toBe("wizard-draft:customer-new:-"));
it("serialize omits listed keys", () => expect(JSON.parse(serializeDraft({ name: "A", loginPassword: "x" }, 2, ["loginPassword"], 1000)).value).toEqual({ name: "A" }));
it("parse returns null for invalid json or expired", () => { expect(parseDraft("{", { a: 1 })).toBeNull(); expect(parseDraft(serializeDraft({ a: 2 }, 0, [], 0), { a: 1 }, DRAFT_TTL_MS + 1)).toBeNull(); });
it("restore merges over defaults, ignores unknown keys", () => { const d = parseDraft(JSON.stringify({ value: { a: 5, zzz: 1 }, savedAt: 10, step: 1 }), { a: 1, b: "x" }, 20)!; expect(d.value).toEqual({ a: 5, b: "x" }); expect(d.step).toBe(1); });
it("formats age in Greek", () => { expect(formatDraftAge(0, 5 * 60_000)).toBe("πριν από 5 λεπτά"); expect(formatDraftAge(0, 30 * 3600_000)).toBe("χθες"); expect(formatDraftAge(0, 3 * 86400_000)).toBe("πριν από 3 ημέρες"); });
```

- [ ] **Step 2: Run** `npx vitest run lib/wizards/draft.test.ts` → FAIL
- [ ] **Step 3: Implement** `lib/wizards/draft.ts`
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Extend** `components/ui/guided-flow.tsx` κατά το Interfaces block (κράτα `ChoiceCards`/`SummaryList` ως έχουν)· δημιούργησε `guided-flow-parts.tsx` και `HelpVideoPlayer.tsx`.
- [ ] **Step 6: Verify** `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 9 (μόνο τα γνωστά)· `npx vitest run lib/wizards` → PASS· οι 4 υπάρχοντες wizards (components/building/wizards) μεταγλωττίζονται χωρίς αλλαγή.
- [ ] **Step 7: Commit** `feat(ui): GuidedFlow v2 — progress rail, drafts, example step, done screen, video player`

### Task 3: Wiki «Οδηγοί βήμα-βήμα» + video στο help

**Files:**
- Modify: `lib/help/types.ts`, `lib/help/frontmatter.ts`, `lib/help/index.ts`, `lib/help/hub.ts`, `lib/help/coverage.test.ts`, `lib/help/frontmatter.test.ts`, `lib/help/hub.test.ts`
- Modify: `app/api/help/article/route.ts`, `components/help/HelpDrawer.tsx`, `components/help/HelpCenter.tsx`, `components/help/WikiNav.tsx`
- Create: `docs/wiki/guides/.gitkeep` (τα md έρχονται ανά wizard), `components/help/HelpVideo.tsx`

**Interfaces:**
- `WikiArticleMeta` += `kind: "page" | "guide"` (default "page"), `wizard?: string`, `video?: string`, `videoPoster?: string`, `minutes?: number`. `toArticleMeta`: για `kind: guide` το `route` είναι προαιρετικό (κενό string)· `surface` από `surface:` frontmatter ή "company".
- `GUIDES_DIR = path.join(process.cwd(), "docs", "wiki", "guides")`· `loadWikiIndex()` διαβάζει και τα δύο directories (slug = όνομα αρχείου).
- `AREA_LABELS.guides = "Οδηγοί βήμα-βήμα"`, πρώτο στο `AREA_ORDER`· τα guide άρθρα μπαίνουν σε area `guides` ανεξαρτήτως frontmatter.
- `articleForRoute` αγνοεί `kind: guide` (κενό route).
- API `/api/help/article` επιστρέφει επιπλέον `video`, `videoPoster`, `minutes`, `kind`.
- `HelpVideo({ src, poster, minutes, title })` server-safe component (`<video controls playsInline muted preload="metadata">` σε 16:9 πλαίσιο με λεζάντα «Video {m}′»)· αποδίδεται πάνω από το Markdown στο drawer και στο hub όταν υπάρχει `video`.

- [ ] **Step 1: Write the failing tests**

`lib/help/frontmatter.test.ts` +:
```ts
it("guide articles need no route and carry wizard/video", () => { const m = toArticleMeta("guide-x", { title: "Τ", kind: "guide", wizard: "customer-new", video: "https://cdn/x.mp4", videoPoster: "https://cdn/x.jpg", minutes: "2" })!; expect(m.kind).toBe("guide"); expect(m.route).toBe(""); expect(m.wizard).toBe("customer-new"); expect(m.minutes).toBe(2); expect(m.area).toBe("guides"); });
it("page articles default to kind page", () => expect(toArticleMeta("a", { title: "T", route: "/x" })!.kind).toBe("page"));
```
`lib/help/hub.test.ts` +:
```ts
it("guides group comes first", () => { const g = groupArticlesByArea([guide("g1"), page("p1", "core")], "ADMIN"); expect(g[0].area).toBe("guides"); expect(g[0].label).toBe("Οδηγοί βήμα-βήμα"); });
```
`lib/help/coverage.test.ts` (νέο describe «guides»):
```ts
it("guides are exempt from the route check and pages still covered", ...)   // φίλτραρε arts με kind==="page" στα υπάρχοντα it
it("every wizard has a guide and every guide names a wizard", () => { const guides = readGuides(); const bySlug = new Map(guides.map(g => [g.slug, g])); for (const w of WIZARDS) expect(bySlug.has(w.guideSlug), w.key).toBe(true); for (const g of guides) expect(WIZARDS.some(w => w.key === g.meta.wizard), g.slug).toBe(true); });
it("guide video urls, when present, are https and have a poster", ...)
```
Ο έλεγχος «every wizard has a guide» αποτυγχάνει μέχρι να γραφτούν οι 12 οδηγοί: δήλωσέ τον `it.skip` με σχόλιο `// enabled in Task 15` (ενεργοποιείται εκεί). Ο έλεγχος των video URL είναι `it` κανονικό — περνά όσο κανένας οδηγός δεν έχει `video:` (ελέγχει μόνο όσα υπάρχουν).

- [ ] **Step 2: Run** `npx vitest run lib/help` → FAIL
- [ ] **Step 3: Implement** types/frontmatter/index/hub/match αλλαγές· API πεδία· `HelpVideo`· drawer & hub rendering· `WikiNav` δείχνει εικονίδιο `RiPlayCircleLine` δίπλα σε άρθρα με video.
- [ ] **Step 4: Run** `npx vitest run lib/help` → PASS (εκτός των skipped)
- [ ] **Step 5: Commit** `feat(help): guide articles (kind: guide) with video, «Οδηγοί βήμα-βήμα» hub group`

### Task 4: WizardHost + deep link + FAB

**Files:**
- Create: `components/wizards/WizardHost.tsx`, `components/wizards/useWizardParam.ts`
- Modify: `components/admin/app-shell.tsx` (render `<WizardHost allowed={allowedWizards(resolved.perms, role)} />` δίπλα στο `<QuickActions>`), `lib/quick-actions.ts`, `lib/quick-actions.test.ts`

**Interfaces:**
- `useWizardParam(allowed: WizardKey[]): { active: { key: WizardKey; ctx: WizardCtx } | null; open: (key, ctx?) => void; close: () => void }` — διαβάζει `?wizard=`+ids μία φορά (state derived κατά το render, όπως `useBuildingActions`), `router.replace` χωρίς τα params `wizard|customerId|propertyId|buildingId`.
- `WizardHost({ allowed }: { allowed: WizardKey[] })` — switch ανά key → component (Tasks 7–14)· για scope `building` δεν αποδίδει τίποτα (τα χειρίζεται η σελίδα κτηρίου)· εκθέτει event `window.dispatchEvent(new CustomEvent("orithon:wizard", { detail: { key, ctx } }))` ως 2ο τρόπο ανοίγματος (για κουμπιά που δεν θέλουν navigation).
- `lib/quick-actions.ts`: νέες σταθερές `A.wizCustomer = { key: "wiz-customer", label: "Νέος πελάτης βήμα-βήμα", icon: "RiUserAddLine", href: "/super-admin/customers?wizard=customer-new" }`, `A.wizService` (`/super-admin/services?wizard=service-new`), `A.wizSupplier` (`/super-admin/suppliers?wizard=supplier-new`)· στο branch `/super-admin/customers|properties|units` το `A.onboarding` αντικαθίσταται από `A.wizCustomer` πρώτο· στο `/super-admin/services` branch (νέο): `[A.wizService, A.billing, A.customers]`· στο `/super-admin/suppliers` προστίθεται `A.wizSupplier` πρώτο. Το allowed-filter κρατά hrefs με query αν το path τους είναι στο allowed (όπως ήδη τα `?action=`).

- [ ] **Step 1: Write the failing tests** `lib/quick-actions.test.ts` +
```ts
it("customers page offers the customer wizard first", () => { const r = resolveQuickActions({ pathname: "/super-admin/customers", role: "SUPER_ADMIN", allowed: new Set([...allowed, "/super-admin/customers"]), canExpense: true }); expect(r[0].href).toBe("/super-admin/customers?wizard=customer-new"); });
it("services and suppliers pages offer their wizards", () => { ... "/super-admin/services?wizard=service-new" ... "/super-admin/suppliers?wizard=supplier-new" });
```
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** quick-actions, `useWizardParam`, `WizardHost` (προς το παρόν με `default: return null` — τα cases προστίθενται ανά Task), mount στο `app-shell.tsx`.
- [ ] **Step 4: Run** `npx vitest run lib/quick-actions.test.ts` → PASS· `npx tsc --noEmit` → 9 γνωστά.
- [ ] **Step 5: Browser**: `preview_start {name:"attach-3002"}`, άνοιξε `/super-admin/customers?wizard=nope` → το query φεύγει, τίποτα δεν ανοίγει, καμία κονσόλα error.
- [ ] **Step 6: Commit** `feat(wizards): WizardHost with ?wizard= deep link; FAB shortcuts to wizards`

### Task 5: `wizard` πεδίο στο registry κτηρίου

**Files:**
- Modify: `lib/building-actions.ts`, `lib/building-actions.test.ts`, `components/building/actions/BuildingActionHost.tsx`

**Interfaces:**
- `BuildingAction` += `wizard?: WizardKey` στις εγγραφές: `millesimes-calc`→`millesimes-setup`, `managed-item-new`→`common-area-new`, `task-new`→`task-new`, `announcement-new`→`announcement-new`, `assembly-new`→`assembly-new`, `occupant-assign`→`occupant-assign`. Το `managed-item-new` μένει `managedOnly` (spec: κοιν. χώρος + στοιχεία μόνο σε managed). Label του `managed-item-new` → «Νέος κοινόχρηστος χώρος & στοιχεία», hint «Χώρος + τι φροντίζουμε εκεί».
- `export function wizardForAction(key: BuildingActionKey): WizardKey | null`.
- `BuildingActionHost`: στα παραπάνω cases αποδίδει το wizard (Tasks 10, 11, 15)· μέχρι τότε κρατά το υπάρχον modal (ο switch αλλάζει ανά Task).

- [ ] **Step 1: Test** `lib/building-actions.test.ts` +
```ts
it("maps building actions to wizards", () => { expect(wizardForAction("millesimes-calc")).toBe("millesimes-setup"); expect(wizardForAction("managed-item-new")).toBe("common-area-new"); expect(wizardForAction("unit-new")).toBeNull(); });
it("every wizard-mapped action's cap equals the wizard's cap", () => { for (const a of BUILDING_ACTIONS) if (a.wizard) expect(getWizard(a.wizard).cap).toBe(a.cap); });
```
- [ ] **Step 2: Run** → FAIL · **Step 3: Implement** · **Step 4: Run** → PASS (και `npx vitest run lib/help lib/wizards`).
- [ ] **Step 5: Commit** `feat(building-actions): link actions to guided wizards`

### Task 6: motion-studio `Orithon-Guide` composition + script πίνακα videos

**Files (motion-studio `/Volumes/EXTERNALSSD/PROJECTS/motion-studio`):**
- Create: `src/projects/orithon/Guide/types.ts`, `scenes.tsx`, `videos.ts`, `index.tsx`
- Modify: `src/Root.tsx` (Folder «Orithon» += `Orithon-Guide-<Key>-16x9` ανά `GUIDE_VIDEOS`), `README.md` (γραμμή πίνακα + render/publish εντολές)

**Files (propertymanagement):**
- Create: `scripts/wizard-videos.mjs`, `lib/wizards/videos.ts` (αρχικά `export const WIZARD_VIDEOS: Record<string, WizardVideo> = {}`), `lib/wizards/videos.test.ts`

**Interfaces:**
- `types.ts`:
  ```ts
  type Base = { sec?: number; heading?: string; caption?: string };  // sec προαιρετικό: αλλιώς από το caption (0.4 s + 17 χαρ./s, min 3, max 9)
  export type Scene =
    | (Base & { type: "title"; kicker: string; title: string; sub?: string; icon: IconName })
    | (Base & { type: "why"; cards: { icon: IconName; title: string; body: string }[] })            // 3 κάρτες «γιατί»
    | (Base & { type: "flow"; steps: { icon: IconName; title: string; body?: string }[] })
    | (Base & { type: "form"; fields: { label: string; value: string; typed?: boolean }[]; title: string; stepLabel: string }) // mockup wizard + Cursor
    | (Base & { type: "split"; total: number; label: string; parts: { label: string; sub?: string; amount: number }[] })
    | (Base & { type: "table"; columns: string[]; rows: string[][]; highlightCol?: number })
    | (Base & { type: "tree"; nodes: { label: string; sub?: string; depth: number; icon?: IconName }[] })
    | (Base & { type: "points"; points: string[] })
    | (Base & { type: "end"; title: string; sub: string; where: string });                         // «Πού το βρίσκω μετά»
  export type GuideVideo = { key: string; title: string; summary: string; scenes: Scene[] };
  ```
- `index.tsx`: `OrithonGuide: React.FC<{ videoKey: string; posterFrame: number }>`, `FPS = 30`, `videoFrames(v)`, `posterOf(v)` (όπως dgespa), `GUIDE_VIDEOS` από `videos.ts`. Μέγεθος σύνθεσης 1280×720 (`u = width/1920` scale όπως dgespa για να ξαναχρησιμοποιηθούν οι συντεταγμένες).
- `videos.ts`: `export const GUIDE_VIDEOS: GuideVideo[]` — σε αυτό το Task **μόνο** το `Customer` (σενάριο στο Task 7)· τα υπόλοιπα προστίθενται ανά wizard. Σκηνές χρησιμοποιούν Orithon `ui.tsx`/`icons.tsx`/`brand.ts`· fonts `commissioner` (sans) + `ebGaramond` (τίτλοι).
- `scripts/wizard-videos.mjs` (propertymanagement): διαβάζει `/Volumes/EXTERNALSSD/PROJECTS/motion-studio/out/Orithon-Guide.publish.json` (output του `publish.mjs`: πίνακας `{ id, mp4?: url, poster?: url, seconds? }` — δες τι ακριβώς γράφει το publish.mjs και προσάρμοσε) και γράφει `lib/wizards/videos.ts` με `WIZARD_VIDEOS[videoKey] = { src, poster, seconds, title }` (title από `GUIDE_VIDEOS`). Ιδιότητα: ντετερμινιστικό output, ταξινομημένα keys.
- `lib/wizards/videos.test.ts`: `it("every WIZARD_VIDEOS entry has https src+poster and a registry videoKey")` — περνά και με κενό αντικείμενο.

- [ ] **Step 1: Test** `lib/wizards/videos.test.ts` → PASS με κενό map (γράψε το test πρώτα, μετά το κενό αρχείο).
- [ ] **Step 2: Implement** motion-studio `Guide/*` + Root + README· `npm run typecheck` στο motion-studio → καθαρό.
- [ ] **Step 3: Verify** `npx remotion compositions src/index.ts` στο motion-studio → η λίστα περιέχει `Orithon-Guide-Customer-16x9` (το `videos.ts` έχει εδώ μία εγγραφή `Customer` με ΜΟΝΟ title+end σκηνές· το πλήρες σενάριο μπαίνει στο Task 7, όπου γίνονται και τα stills).
- [ ] **Step 4: Commit** (motion-studio) `feat(orithon): data-driven Guide explainer composition` · (propertymanagement) `chore(wizards): videos registry + import script`

---

## Φάση 1 — Wizards (ένα Task ανά wizard: παράδειγμα → component → είσοδος → οδηγός → σενάριο video → commit)

Κοινό μοτίβο κάθε Task 7–14:
1. Pure παράδειγμα σε `lib/wizards/examples/<name>.ts` + test.
2. Component `components/wizards/<Name>Wizard.tsx` με `GuidedFlow` v2 (βήματα spec §4, `example`, `draft`, `done` με `next` από `nextWizard`), «Προτιμώ την απλή φόρμα» όπου υπάρχει απλή φόρμα.
3. Είσοδος: κουμπί «Νέο…» → wizard· case στο `WizardHost` (ή `BuildingActionHost`).
4. Οδηγός `docs/wiki/guides/<guideSlug>.md`: frontmatter (`title`, `kind: guide`, `wizard`, `roles`, `summary`, `prompts` ×3, `related`, `minutes`, χωρίς `video` ακόμη) + ενότητες «Γιατί», «Πριν ξεκινήσετε», «Βήμα-βήμα», «Παράδειγμα», Mermaid `flowchart`, «Συχνές ερωτήσεις», «Πού το βρίσκω μετά». Τα σχετικά άρθρα σελίδων παίρνουν `related: [..., <guideSlug>]` + πρόταση «Νέα καταχώριση; Ακολουθήστε τον οδηγό βήμα-βήμα.»
5. Σενάριο video: εγγραφή στο motion-studio `videos.ts` (6–8 σκηνές: title → why → flow → form → split/table/tree → points → end), στόχος 60–90 s (`node scripts/srt.mjs`-ισοδύναμο: πρόσθεσε `scripts/guide-duration.mjs` στο motion-studio στο Task 7 που τυπώνει διάρκεια ανά video).
6. Browser έλεγχος ως το βήμα «Παράδειγμα», screenshot στο scratchpad, **όχι Αποθήκευση**.
7. `npx vitest run lib/wizards lib/help lib/building-actions.test.ts lib/quick-actions.test.ts` + `npx tsc --noEmit` (9 γνωστά) + `npx eslint <αρχεία>` → commit.

### Task 7: Πελάτης (`customer-new`)

**Files:** Create `lib/wizards/examples/customer.ts` + `.test.ts`, `components/wizards/CustomerWizard.tsx`, `docs/wiki/guides/guide-customer.md`; Modify `app/(company)/super-admin/customers/CustomersClient.tsx` (openAdd → `setWizard(true)`; «Προτιμώ την απλή φόρμα» → το υπάρχον Modal), `components/wizards/WizardHost.tsx`, `docs/wiki/pages/super-admin-customers.md`; motion-studio `videos.ts` (Customer), `scripts/guide-duration.mjs`.

**Interfaces:**
- `exampleForCustomer(input: { type: "INDIVIDUAL"|"COMPANY"; name: string; hasLogin: boolean; loginEmail: string | null; nextCode: string }): { headline: string; steps: { title: string; body: string }[]; loginLine: string | null }` — steps = «Ιδιοκτησία», «Κτήριο & μονάδες», «Χιλιοστά», «Πακέτο υπηρεσιών» με body που εξηγεί τι είναι το καθένα· `loginLine` = «Ο/Η {name} θα συνδέεται με {loginEmail} και θα βλέπει τα ακίνητά του/της, τα τιμολόγια και τα κοινόχρηστα.» ή null.
- `CustomerWizard({ managers, nextCode, onClose, onDone, onSimpleForm }: { managers: { id: string; name: string }[]; nextCode: string; onClose; onDone: (c: { id: string; name: string }) => void; onSimpleForm?: () => void })` — `nextCode` υπολογίζεται στον server (`page.tsx` → νέο export `peekNextCustomerCode()` στο `app/actions/customers.ts`, read-only, ξαναχρησιμοποιεί `nextCustomerCode`). Βήματα spec §4.1. ΑΦΜ: `isValidGreekAfm`/`normalizeAfm` από `lib/suppliers-shared` (ήδη εκεί). Draft omit: `loginPassword`.
- Αποθήκευση: `createCustomer(payload)`· done.next: «Νέα ιδιοκτησία για {name}» → `router.push(wizardHref("/super-admin/customers", "property-new", { customerId }))`.

- [ ] **Step 1: Test** `customer.test.ts`: `it("lists the four next steps in order")`, `it("loginLine null without login")`, `it("uses the customer name and email in loginLine")`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** `CustomerWizard`, `peekNextCustomerCode`, rewire `CustomersClient` (`addNewLabel` παραμένει «Νέος Πελάτης»), `WizardHost case "customer-new"`.
- [ ] **Step 6:** `guide-customer.md` + related στο `super-admin-customers.md`.
- [ ] **Step 7:** Σενάριο Customer στο `videos.ts` (title «Ο πελάτης: η ρίζα των πάντων» · why: τιμολόγηση/πρόσβαση/ιεραρχία · flow 5 βημάτων · form mockup · tree Πελάτης›Ιδιοκτησία›Κτήριο›Μονάδες · points · end «Πελάτες → κάρτα πελάτη»)· `node scripts/guide-duration.mjs` → 60–90 s· `node scripts/stills.mjs Orithon-Guide-Customer-16x9 <scratch>/stills 30 400 900 1500` → δες τα PNG (Read).
- [ ] **Step 8:** Browser `/super-admin/customers` → «Νέος Πελάτης» → wizard ως «Παράδειγμα» → screenshot· `?wizard=customer-new` deep link· κινητό 375 px (resize_window mobile) → bottom sheet.
- [ ] **Step 9:** Commit (2 repos) `feat(wizards): customer wizard with example step, guide and video script`

### Task 8: Ιδιοκτησία (`property-new`)

**Files:** Create `lib/wizards/examples/property.ts` + test, `components/wizards/PropertyWizard.tsx`, `docs/wiki/guides/guide-property.md`; Modify `CustomersClient.tsx` (όπου ανοίγει `AddPropertyModal` → `PropertyWizard`, με `onSimpleForm` → `AddPropertyModal`), `app/(company)/super-admin/properties/PropertiesClient.tsx` (ίδιο), `WizardHost.tsx`, `docs/wiki/pages/super-admin-properties.md`, `super-admin-customers-detail.md`; motion-studio `videos.ts` (Property).

**Interfaces:**
- `exampleForProperty(input: { customerName: string; name: string; address: string | null; managed: boolean; sameAddressBuilding: boolean; buildingName: string | null }): { tree: { label: string; sub?: string; depth: number }[]; managedLine: string; packageLine: string }` — tree 3 επιπέδων (πελάτης › ιδιοκτησία › κτήριο «{buildingName ?? name}» με «ίδια διεύθυνση» ή «διεύθυνση αργότερα»)· `managedLine` εξηγεί managed vs αυτοδιαχείριση (ποιος μπορεί να οριστεί διαχειριστής)· `packageLine` = «Το πακέτο υπηρεσιών και η μηνιαία χρέωση ορίζονται σε αυτή την ιδιοκτησία, όχι ανά κτήριο.»
- `PropertyWizard({ customer: { id: string; name: string } | null; customers?: { id: string; name: string }[]; onClose; onDone: (p: CreatedProperty) => void; onSimpleForm? })` — αν `customer` null: πρώτο βήμα «Για ποιον πελάτη;» με `FieldSelect`/αναζήτηση στη λίστα `customers` (ο `WizardHost` φορτώνει τη λίστα με νέο read action `listCustomerOptions()` στο `customers.ts`, super-admin). Χρησιμοποιεί `AddressAutocomplete` + geocode όπως το `AddPropertyModal` (εξήγαγε τη `geocode` λογική σε `lib/geo/geocode-client.ts` για να μην διπλασιαστεί). Αποθήκευση `createProperty`. done.next «Κτήριο & μονάδες» → `wizardHref("/super-admin/properties", "building-new", { propertyId })`.

- [ ] Steps όπως Task 7 (tests: tree depth/labels, managedLine ανά managed, sameAddress sub). Σενάριο video: title «Η ιδιοκτησία: ένα ακίνητο, πολλά κτήρια» · why · flow · form · tree · points · end.
- [ ] Commit `feat(wizards): property wizard, guide, video script`

### Task 9: Κτήριο + μονάδες (`building-new`) + `createBuildingWithUnits`

**Files:** Create `lib/wizards/examples/building.ts` + test, `lib/wizards/units-generator.ts` + test, `components/wizards/BuildingWizard.tsx`, `components/wizards/UnitsGrid.tsx`, `docs/wiki/guides/guide-building.md`; Modify `app/actions/buildings.ts` (+ `createBuildingWithUnits`, test `app/actions/buildings-create-with-units.test.ts` με mocked `db`), `app/(company)/super-admin/customers/CustomerTree.tsx` («Νέο Κτήριο» → `BuildingWizard`, `onSimpleForm` → `BuildingModal`), `WizardHost.tsx`, `docs/wiki/pages/super-admin-properties-detail.md`, `super-admin-buildings-detail.md`; motion-studio `videos.ts` (Building).

**Interfaces:**
- `generateUnits(spec: { floors: number; basements: number; apartmentsPerFloor: number; groundFloorShops: number; groundFloorApartments: number; defaultAreaSqm: number | null; numbering: "floor-letter" | "sequential" }): UnitDraft[]` όπου `UnitDraft = { unitNumber: string; floor: number | null; areaSqm: number | null; unitType: "APARTMENT"|"SHOP"|"PARKING"|"OTHER" }`· `floor-letter` → «1Α, 1Β, … 2Α», καταστήματα «Κ1, Κ2» στο ισόγειο (floor 0), υπόγεια parking «P-1»… μόνο αν `basements>0` ΚΑΙ ο χρήστης το ζητήσει (παράμετρος `parkingPerBasement: number`).
- `exampleForBuilding(input: { units: UnitDraft[]; hasElevator: boolean; elevatorSurchargePerFloor: number; elevatorExemptGroundFloor: boolean; heatingShared: boolean }): { rows: { unitNumber: string; floor: number | null; areaSqm: number | null; general: number | null; elevator: number | null; heating: number | null }[]; totals: { general: number; elevator: number; heating: number }; missingArea: string[] }` — μέσω `buildOnboardingPayload` (import από `@/app/actions/building-onboarding-payload`, είναι pure) με `heatingType` = `heatingShared ? "CENTRAL" : "GAS"` (δες `HEATING_TYPES`).
- `createBuildingWithUnits(propertyId: string, building: BuildingInput & { elevatorSurchargePerFloor?: number; elevatorExemptGroundFloor?: boolean; heatingShared?: boolean }, units: UnitDraft[]): Promise<{ buildingId: string } | { error: string }>` — `requireSuperAdmin`, Zod (`unitNumber` μοναδικά, ≥1 μονάδα), `buildOnboardingPayload` για τα 3 σετ, `$transaction` (building + `unit.createMany` + `unitsCount`), `touchBuildingDistance`, `revalidatePath` property/building, `publishBuildingEvent(buildingId, "unit")`.
- `UnitsGrid({ units: UnitDraft[]; onChange: (u: UnitDraft[]) => void; floors: number; basements: number })` — επεξεργάσιμος πίνακας (αριθμός, όροφος select, τ.μ. `NumberField`, τύπος select, διαγραφή γραμμής, «+ Προσθήκη μονάδας»), ζωντανή στήλη «Γενικά ‰» από `distributeWeights`.
- `BuildingWizard({ property: { id: string; name: string; address: string | null; city: string | null; postalCode: string | null; country: string | null; lat: number | null; lng: number | null; customerId: string } | null; properties?: …[]; onClose; onDone: (b: { id: string }) => void; onSimpleForm? })` — βήμα 1 έχει κουμπί «Περιγράψτε το στον βοηθό (AI)» → `router.push(`/super-admin/customers/${customerId}/onboarding`)`. done.next «Χιλιοστά» → `buildingActionHref(`/super-admin/buildings/${id}`, "millesimes-calc")`.

- [ ] **Tests**: `units-generator.test.ts` (`it("3 floors × 2 apartments + 2 shops → 8 units, shops on floor 0 named Κ1/Κ2")`, `it("sequential numbering 1..n")`, `it("unit numbers unique")`)· `building.test.ts` (`it("sets sum to 1000 each")`, `it("ground floor elevator 0 when exempt")`, `it("no heating set when individual heating")`, `it("missingArea lists units without sqm")`)· `buildings-create-with-units.test.ts` (mock `@/lib/db`: `it("rejects duplicate unit numbers")`, `it("creates building then units with computed millesimes in one transaction")`).
- [ ] Implement, rewire, guide (`guide-building.md` με Mermaid: όροφοι → μονάδες → χιλιοστά), video Building (title «Το κτήριο και οι μονάδες του» · why: κοινόχρηστα/βλάβες/πρόσβαση · flow · form · table μονάδων με ‰ · points · end).
- [ ] Browser: `/super-admin/customers` → δέντρο → «Νέο Κτήριο» → ως Παράδειγμα· έλεγξε ότι ο «βοηθός AI» σύνδεσμος οδηγεί στο onboarding με σωστό customerId (μόνο hover/URL, μην δημιουργήσεις).
- [ ] Commit `feat(wizards): building wizard with units generator, createBuildingWithUnits, guide, video script`

### Task 10: Χιλιοστά (`millesimes-setup`) + `applyMillesimesSetup`

**Files:** Create `lib/wizards/examples/millesimes.ts` + test, `components/wizards/MillesimesWizard.tsx`, `docs/wiki/guides/guide-millesimes.md`; Modify `app/actions/building-millesimes.ts` (+ `applyMillesimesSetup`, test `app/actions/building-millesimes.test.ts` mocked db), `components/building/actions/BuildingActionHost.tsx` (case `millesimes-calc` → `MillesimesWizard`, `onSimpleForm` → `MillesimesModal`), `CustomerTree.tsx` (modal kind `millesimes` → wizard), `docs/wiki/pages/super-admin-buildings-detail.md`, `building-detail.md`; motion-studio `videos.ts` (Millesimes).

**Interfaces:**
- ```ts
  export type MillesimesPlan = {
    general: "AUTO" | { unitId: string; value: number | null }[];
    elevator: { enabled: boolean; surchargePerFloor: number; exemptGroundFloor: boolean; manual: { unitId: string; value: number | null }[] | null };
    heating: { basis: "HEATING_MILLESIMES" | "METERED_70_30" | "EQUAL_PER_UNIT" | "NONE"; manual: { unitId: string; value: number | null }[] | null };
  };
  export function previewMillesimes(units: { id: string; unitNumber: string; areaSqm: number | null; floor: number | null }[], plan: MillesimesPlan): { rows: { unitId: string; unitNumber: string; general: number | null; elevator: number | null; heating: number | null }[]; totals: { general: number; elevator: number; heating: number } };
  export function manualSumError(values: { value: number | null }[]): string | null;  // null αν |Σ−1000| < 0.01, αλλιώς «Λείπουν 12,5‰» / «Περισσεύουν 3‰»
  export function exampleForMillesimes(units, plan, expenses: { label: string; amount: number; set: "general"|"elevator"|"heating" }[]): { perUnit: { unitNumber: string; amounts: (number | null)[] }[]; legal: Record<"general"|"elevator"|"heating", string>; missingArea: string[] }  // μέσω computeAllocation με weight = το σετ
  ```
  Default expenses στο wizard: Καθαρισμός 1.000 € (general), Συντήρηση ανελκυστήρα 600 € (elevator), Πετρέλαιο 2.000 € (heating). `legal`: general «Ν.3741/1929, ΑΚ 1002/1117», elevator «ΚΥΑ 20.8.1997», heating «Ν.1512/1985 (ωρομετρητές: ΠΔ 27.9.1985, 70/30)».
- `applyMillesimesSetup(buildingId: string, plan: MillesimesPlan): Promise<{ ok: true; updated: number } | { error: string }>` — `requireBuildingCap(editMillesimes)`· `$transaction`: building elevator params· ανά μονάδα `millesimes`/`millesimesSource` (AUTO→υπολογισμένο & source AUTO, manual→τιμή & MANUAL), ίδιο για elevator (enabled=false → όλα null/AUTO), heating (basis NONE → `millesimesHeating` null σε όλες τις μονάδες· HEATING_MILLESIMES → υπολογισμένα από τ.μ. και διαγραφή override· METERED_70_30 ή EQUAL_PER_UNIT → όπως ο AI onboarding, `building-onboarding.ts:79-87`: `tx.expenseCategory.findFirst({ where: { defaultBasis: { in: ["HEATING_MILLESIMES", "METERED_70_30"] } } })` και upsert `buildingCategoryOverride` με `distributionBasis` = η επιλεγμένη βάση, `tenantPct/ownerPct` από την κατηγορία)· `revalidatePath` ×3, `publishBuildingEvent`.
- `MillesimesWizard({ buildingId, units: { id; unitNumber; floor; areaSqm; millesimes; millesimesElevator; millesimesHeating }[], building: { hasElevator; elevatorSurchargePerFloor; elevatorExemptGroundFloor; heatingMeterUnit: string | null }, onClose, onDone, onSimpleForm? })` — βήματα spec §4.4· manual πίνακες με `NumberField unit="‰"` και ζωντανό άθροισμα/`manualSumError`.

- [ ] **Tests** `millesimes.test.ts`: `it("AUTO general from area sums to 1000")`, `it("unit without area is reported, others still sum to 1000")`, `it("manualSumError reports missing/excess in Greek with comma decimals")`, `it("exampleForMillesimes splits 1000 € by general set, 600 € by elevator with exempt ground floor = 0")`, `it("heating NONE yields null amounts")`. `building-millesimes.test.ts`: `it("writes MANUAL source for manual values and AUTO for computed")`, `it("elevator disabled clears elevator millesimes")`.
- [ ] Implement, rewire (`BuildingActionHost`, `CustomerTree`), guide (Mermaid: έχετε κανονισμό; → ναι/όχι → 3 σετ → δαπάνη → ποσά), video Millesimes (title «Χιλιοστά: πώς μοιράζεται κάθε ευρώ» · why · flow · split 1.000 € · table 3 σετ · points νομική βάση · end).
- [ ] Browser: `/super-admin/buildings/<id>?action=millesimes-calc` → wizard ως Παράδειγμα (χωρίς Εφαρμογή)· screenshot.
- [ ] Commit `feat(wizards): millesimes wizard (3 sets, auto-by-law or manual), applyMillesimesSetup, guide, video script`

### Task 11: Κοινόχρηστος χώρος + στοιχεία (`common-area-new`)

**Files:** Create `lib/wizards/examples/common-area.ts` + test, `components/wizards/CommonAreaWizard.tsx`, `docs/wiki/guides/guide-common-area.md`; Modify `BuildingActionHost.tsx` (case `managed-item-new` → wizard, `onSimpleForm` → `ManagedItemModal`), `components/building/ManagedItemsPanel.tsx` («Νέο στοιχείο» → wizard), `CustomerTree.tsx` (modal kind `commonArea` → wizard), `docs/wiki/pages/super-admin-managed-items.md`, `super-admin-buildings-detail.md`; motion-studio `videos.ts` (CommonArea).

**Interfaces:**
- `COMMON_AREA_TYPES: { value: string; label: string; icon: string; suggestedItems: string[] }[]` (κλιμακοστάσιο, είσοδος, λεβητοστάσιο, ταράτσα, αυλή/κήπος, πάρκινγκ, αποθήκη, άλλο — `suggestedItems` = ονόματα `ManagedItemType` που προεπιλέγονται αν υπάρχουν στον κατάλογο, π.χ. κλιμακοστάσιο → «Αλλαγή λαμπτήρων», «Καθαρισμός»).
- `exampleForCommonArea(input: { name: string; type: string; items: { typeName: string; quantity: number }[]; perCommonAreaServices: { name: string; price: number; enabled: boolean }[]; currentCommonAreas: number }): { costLines: { service: string; before: number; after: number }[]; itemLines: string[] }` — `after = price × (currentCommonAreas + 1)` μόνο για enabled PER_COMMON_AREA υπηρεσίες.
- `CommonAreaWizard({ buildingId, itemTypes: ManagedItemTypeOption[], floorOptions: string[], perCommonAreaServices, currentCommonAreas, onClose, onDone, onSimpleForm? })` — αποθήκευση: `createCommonArea` → `createManagedItem` ×N με `commonAreaId` (σειριακά, σταματά στο πρώτο σφάλμα και το αναφέρει). Οι `perCommonAreaServices` έρχονται από το `BuildingDashboardData` (πρόσθεσε `packageServices: { name; price; pricingModel; enabled }[]` στο `dashboard-data.ts` μέσω `getPropertyPackage(propertyId)` — μόνο για managed κτήρια).

- [ ] Tests: `it("cost after = price × (n+1) for enabled per-common-area services only")`, `it("itemLines read «3 × Αλλαγή λαμπτήρων»")`.
- [ ] Implement, rewire, guide, video CommonArea (title «Κοινόχρηστοι χώροι: τι φροντίζουμε και τι κοστίζει»).
- [ ] Browser ως Παράδειγμα· commit `feat(wizards): common area + managed items wizard, guide, video script`

### Task 12: Υπηρεσία καταλόγου (`service-new`) + εξαγωγή `lineFor`

**Files:** Create `lib/wizards/examples/package.ts` + test (κοινό για Tasks 12–13), `lib/wizards/examples/service.ts` + test, `components/wizards/ServiceWizard.tsx`, `docs/wiki/guides/guide-service.md`; Modify `components/property/PropertyPackages.tsx` (`lineFor` → import από `lib/wizards/examples/package.ts`), `app/(company)/super-admin/services/ServicesClient.tsx` («Νέα υπηρεσία» → wizard, `onSimpleForm` → υπάρχον Modal), `WizardHost.tsx`, `docs/wiki/pages/super-admin-services.md`; motion-studio `videos.ts` (Service).

**Interfaces:**
- `package.ts`: `export type PkgCounts = { units: number; buildings: number; commonAreas: number }`, `export type PkgServiceLike = { pricingModel: string; price: number; zonePrices?: Record<string, number> | null }`, `export function lineFor(s: PkgServiceLike, c: PkgCounts, zoneCodes?: string[]): { qty: number | null; amount: number; detail: string | null }` (ίδια λογική με το σημερινό `lineFor` του component· PER_ZONE με `zoneCodes` → Σ zonePrices[code]), `export function packageTotal(services: (PkgServiceLike & { enabled: boolean })[], c: PkgCounts, zoneCodes?: string[]): number`.
- `service.ts`: `PRICING_MODELS: { value: ServicePricingModel; label: string; description: string; icon: string }[]` (6 μοντέλα με επεξήγηση για μη τεχνικούς), `suggestServiceCode(name: string, taken: string[]): string` (ελληνικά → λατινικά κεφαλαία, κενά → `-`, μέγ. 24 χαρ., μοναδικό με `-2`, `-3`), `exampleForService(s: PkgServiceLike, zones: DistanceZone[]): { scenarios: { label: string; counts: PkgCounts; line: ReturnType<typeof lineFor> }[] }` με τα 2 σενάρια του spec (5/1/2 και 12/2/4).
- `ServiceWizard({ zones: DistanceZone[]; takenCodes: string[]; onClose; onDone: (s) => void; onSimpleForm? })`.

- [ ] Tests: `package.test.ts` (`it("PER_UNIT 5 units × 3 € = 15 €")`, `it("PER_ZONE sums the zone prices of the given codes")`, `it("METERED_PREPAID has qty null and amount 0")`)· `service.test.ts` (`it("suggestServiceCode transliterates and dedupes", () => { expect(suggestServiceCode("Καθαρισμός κοινοχρήστων", [])).toBe("KATHARISMOS-KOINOCHRISTON"); expect(suggestServiceCode("Καθαρισμός κοινοχρήστων", ["KATHARISMOS-KOINOCHRISTON"])).toBe("KATHARISMOS-KOINOCHRISTON-2"); })`, `it("two scenarios with expected amounts")`).
- [ ] Implement, εξαγωγή `lineFor` (το component τεστάρεται έμμεσα — βεβαιώσου ότι `/super-admin/properties/<id>` tab «Πακέτο» αποδίδει ίδια ποσά), rewire, guide, video Service (title «Υπηρεσίες: τι πουλάμε και πώς το χρεώνουμε»).
- [ ] Commit `feat(wizards): service wizard, pricing example lib, guide, video script`

### Task 13: Πακέτο ιδιοκτησίας (`package-setup`)

**Files:** Create `components/wizards/PackageWizard.tsx`, `docs/wiki/guides/guide-package.md`; Modify `app/(company)/super-admin/properties/[id]/PropertyDetailClient.tsx` (κουμπί «Ρύθμιση πακέτου βήμα-βήμα» πάνω από το `PackageTab`), `WizardHost.tsx` (φορτώνει `listPropertyPackage(propertyId)` + `listCustomerPropertyOptions` αν λείπει propertyId), `docs/wiki/pages/super-admin-properties-detail.md`, `manager-properties-detail.md`; motion-studio `videos.ts` (Package). Test: `lib/wizards/examples/package.test.ts` += `packageTotal` cases.

**Interfaces:**
- `PackageWizard({ propertyId, view: Awaited<ReturnType<typeof listPropertyPackage>>, onClose, onDone })` — βήματα spec §4.7· αποθήκευση: για κάθε υπηρεσία με αλλαγή `setPropertyService(propertyId, serviceId, enabled)`, μετά `addPrepaidMinutes` αν δόθηκαν· παράδειγμα = `packageTotal` + «Πρώτο τιμολόγιο: περίοδος {view.period}, {total} €».
- Permission: `properties:edit` (PROPERTY_ADMIN της ιδιοκτησίας μπαίνει από `/building/[id]` → μόνο αν το manager shell το προσφέρει· εκτός πεδίου εδώ — spec §3.6 αφορά τη super-admin σελίδα ιδιοκτησίας).

- [ ] Tests `packageTotal`: `it("sums enabled lines only")`, `it("CORE counted once")`.
- [ ] Implement, rewire, guide (Mermaid: κατάλογος → επιλογή → counts → μηνιαίο σύνολο → τιμολόγιο → Viva), video Package (title «Το πακέτο της ιδιοκτησίας: τι πληρώνει ο πελάτης κάθε μήνα»).
- [ ] Browser ως Παράδειγμα· commit `feat(wizards): property package wizard, guide, video script`

### Task 14: Συνεργάτης (`supplier-new`)

**Files:** Create `lib/wizards/examples/supplier.ts` + test, `components/wizards/SupplierWizard.tsx`, `docs/wiki/guides/guide-supplier.md`; Modify `app/(company)/super-admin/suppliers/SuppliersClient.tsx` («Νέος συνεργάτης» → wizard, `onSimpleForm` → `SupplierFormModal`), `WizardHost.tsx`, `docs/wiki/pages/super-admin-suppliers.md`; motion-studio `videos.ts` (Supplier).

**Interfaces:**
- `exampleForSupplier(input: { name: string; categories: string[]; baseKm: number | null; zones: DistanceZone[]; siteSurveyFee: number | null; surveyZoneFees: Record<string, number> }): { timeline: { title: string; body: string }[]; zoneLine: string | null; surveyLine: string | null }` — timeline 5 βημάτων (Βλάβη → RFQ → Προσφορά {name} → Αποδοχή → Σύμβαση back-to-back: τιμή προμηθευτή / τιμή πελάτη)· `zoneLine` μέσω `zoneForKm`/`zoneLabel`.
- `SupplierWizard({ categories: CategoryOption[]; zones: DistanceZone[]; scope: "company" | "private"; onClose; onDone; onSimpleForm? })` — βήματα spec §4.8· αποθήκευση `createSupplier(input, scope)`· «Πρόσκληση χρήστη» = checkbox που μετά το create ανοίγει το υπάρχον invite flow (δες `app/actions/invite.ts` — αν χρειάζεται supplierId, κάνε το ως `done.next` κουμπί «Πρόσκληση χρήστη» → `/super-admin/suppliers/${id}?tab=team`).

- [ ] Tests: `it("timeline has 5 steps and names the supplier")`, `it("zoneLine null without base km")`.
- [ ] Implement, rewire, guide, video Supplier (title «Συνεργάτες: από το αίτημα προσφοράς στη σύμβαση»).
- [ ] Commit `feat(wizards): supplier wizard, guide, video script`

### Task 15: Μεταφορά των 4 υπαρχόντων wizards στο v2

**Files:** Modify `components/building/wizards/{OccupantWizard,MaintenanceTaskWizard,AnnouncementWizard,AssemblyWizard}.tsx`; Create `lib/wizards/examples/{occupant,task,announcement,assembly}.ts` + tests, `docs/wiki/guides/guide-{occupant,task,announcement,assembly}.md`; Modify `BuildingActionHost.tsx` (`task-new`/`announcement-new`/`assembly-new`/`occupant-assign` ήδη ανοίγουν τα wizards — πρόσθεσε μόνο `example`/`draft`), `docs/wiki/pages/building-detail.md`, `super-admin-buildings-detail.md`; motion-studio `videos.ts` (Occupant, Task, Announcement, Assembly).

**Interfaces:**
- `nextOccurrences(frequency: TaskFrequency, from: string | null, n = 3): string[]` (ISO dates· CUSTOM → μόνο η δοθείσα), `reminderDate(due: string, daysBefore: number): string`.
- `exampleForOccupant({ role, name, splitTenantPct, splitOwnerPct })`: τι βλέπει στο /portal ή /owner, πώς μοιράζονται 100 € καθαρισμού.
- `exampleForAnnouncement({ title, channels })`: preview κάρτα + ποιοι ειδοποιούνται.
- `exampleForAssembly({ date, units: { unitNumber; millesimes }[]; prepaidMinutes; participants })`: απαρτία ‰ παρόντων, κατανάλωση person-minutes (διάρκεια 60′ × participants).
- Κάθε wizard: `draft` (ctxId = buildingId/unitId), `example`, `done` με επιστροφή στη σελίδα.

- [ ] Tests: `task.test.ts` (`it("MONTHLY from 2026-01-31 → 2026-02-28, 2026-03-31, 2026-04-30")`, `it("reminder 7 days before")`), `assembly.test.ts` (`it("quorum = Σ millesimes of present")`, `it("consumption = minutes × participants")`), `occupant.test.ts`, `announcement.test.ts`.
- [ ] Implement, guides ×4, video scripts ×4.
- [ ] `npx vitest run lib/help` → ενεργοποίησε το skipped `it` «every wizard has a guide» → PASS (όλοι οι 12 οδηγοί υπάρχουν).
- [ ] Commit `feat(wizards): example step, drafts and guides for occupant/task/announcement/assembly wizards`

---

## Φάση 2 — Videos, επαλήθευση, παράδοση

### Task 16: Render, δημοσίευση, σύνδεση videos

**Files:** motion-studio `out/` (artifacts, όχι commit)· propertymanagement `lib/wizards/videos.ts` (γεννημένο), `docs/wiki/guides/*.md` (`video:`/`videoPoster:` frontmatter — γράφονται από το `scripts/wizard-videos.mjs` αν περάσεις `--write-guides`), `lib/help/coverage.test.ts` (ενεργοποίηση ελέγχου video).

- [ ] **Step 1:** motion-studio: `node scripts/guide-duration.mjs` → όλα 60–90 s (διόρθωσε `sec`/κείμενα όπου όχι).
- [ ] **Step 2:** `node scripts/stills.mjs Orithon-Guide-<Key>-16x9 <scratch>/stills/<Key> 30 300 900 1500` για κάθε Key → Read τα PNG, διόρθωσε overflow/επικαλύψεις.
- [ ] **Step 3:** `MAX_MB=4 npm run render -- Orithon-Guide --only=mp4,poster` (background, ~12 × 1–3 min)· `node scripts/verify.mjs` αν υπάρχει για τα Orithon-Guide.
- [ ] **Step 4:** `node scripts/publish.mjs --project /Volumes/EXTERNALSSD/propertymanagement --filter Orithon-Guide --folder "Οδηγοί" --dry-run` → έλεγξε στόχο Bunny + MediaFile· μετά χωρίς `--dry-run`.
- [ ] **Step 5:** `node scripts/wizard-videos.mjs --write-guides` → `lib/wizards/videos.ts` + frontmatter· `npx vitest run lib/wizards lib/help` → PASS (όλα τα video checks ενεργά).
- [ ] **Step 6:** Browser: help drawer σε `/super-admin/customers` → κουμπί βοήθειας → άρθρο σελίδας → «Σχετικοί οδηγοί» → `guide-customer` στο hub με player· wizard Πελάτη → βήμα Παράδειγμα → «Δείτε το video» παίζει (poster φορτώνει, mp4 200).
- [ ] **Step 7:** Commit `feat(wizards): published guide videos wired into wizards, wiki guides and help`· motion-studio commit `docs: Orithon guide videos rendered & published`.

### Task 17: Τελικός έλεγχος, review, μνήμη, hand-over

- [ ] `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 9· `npx vitest run` → μόνο οι 2 γνωστές αποτυχίες· `npx eslint` στα νέα/αλλαγμένα αρχεία → 0 errors.
- [ ] Screenshots όλων των wizards (βήμα Παράδειγμα) + help hub «Οδηγοί βήμα-βήμα» + mobile → scratchpad `shots/`.
- [ ] Fresh review (superpowers:requesting-code-review) σε όλο το εύρος `815c859..HEAD`· διόρθωσε τα critical/major με TDD· κατέγραψε deferred minors.
- [ ] Memory: `~/.claude/projects/-Volumes-EXTERNALSSD-propertymanagement/memory/project_wizards.md` (τι χτίστηκε, πώς προστίθεται wizard = registry + component + guide + video script, gotchas) + γραμμή στο `MEMORY.md`.
- [ ] Hand-over note: `/Users/kozyris/Library/Application Support/Claude/side-session-notes/local_d495e2b3-12a3-4067-8413-158ebae5f72d/guided-wizards-handover.md` (commits, πού βρίσκεται τι, εκκρεμότητες, οδηγίες για ⌘K session: διάβασε `WIZARDS`).
- [ ] Commit `docs(wizards): plan complete, review fixes, memory`.
