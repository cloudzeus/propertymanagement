# AI Assistant (RAG + confirmed actions) & per-page Wiki — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A role-aware Greek assistant drawer on every surface that answers from role-scoped Prisma reads + a pgvector-indexed wiki, persists conversations, and performs five write actions through existing server actions only after an explicit in-chat confirmation, plus a wiki article for every page with a Help button and hub.

**Architecture:** New `lib/ai/assistant/*` runs a server-side tool loop against DeepSeek (plain fetch, streaming SSE to the client); `lib/ai/tools/*` is a registry of read/write tools that reuse the app's guards (`getBuildingAccess`, `requireBuildingCap`, `can`, `customerWhere`). Wiki articles are Markdown files with frontmatter under `docs/wiki/pages`, indexed into a `WikiChunk` table with Gemini embeddings (keyword fallback). UI = one `AssistantDrawer` + `HelpButton` mounted in `AppShell`, and the three existing help pages become the hub.

**Tech Stack:** Next.js 16.2 (App Router, route handlers, server actions), Prisma 7 (custom client in `lib/prisma`, pgvector via `Unsupported("vector(768)")` + raw SQL on `WikiChunk` only), zod 4 (`z.toJSONSchema`), DeepSeek chat completions, Gemini `gemini-embedding-001`, react-markdown (existing `Markdown` component), Vitest, react-icons/ri.

**Spec:** `docs/superpowers/specs/2026-10-20-ai-assistant-wiki-design.md`

## Global Constraints

- Local `.env` `DATABASE_URL` is PRODUCTION. No seed/test rows, no notification triggers, no clicking «Επιβεβαίωση» locally. Write-tool `execute` is exercised only in Vitest with mocked actions.
- Prisma: never `prisma migrate dev`. Author SQL with `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script`, write a migration folder, apply with `npx prisma migrate deploy` ONLY after the user approves (Task 1 step 7 gates), then `npx prisma generate`. Enums import from `@/lib/prisma/enums`.
- Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `07-mutating-data.md` before writing route handlers / server actions.
- UI: Greek copy everywhere; icons only `react-icons/ri` `*Line`; font sizes only `var(--fs-*)` tokens (never px); touch targets ≥ 44px; inputs on phones `font-size: max(1rem, 1em)`.
- Pure modules (no `server-only`, no `@/lib/db`, no `next/*` imports) for everything unit-tested; server modules import `getEffectiveSession` only inside functions when they also must be importable in tests (pattern: `lib/rbac/permissions.ts`).
- Every tool result/body sent to the model is capped: tool JSON ≤ 6 000 chars (truncate arrays, append `"…και N ακόμη"`), user message ≤ 4 000 chars.
- All DeepSeek/Gemini calls go through `logAPIUsage` with `userId` (and `customerId` when known).
- Data isolation: a building/unit/request id coming from the client or the model is used only after a guard confirms access for the effective user; failures return `{ ok:false, error:"Δεν έχετε πρόσβαση" }` — never throw to the client, never redirect.
- Existing wizard (`lib/ai/agent.ts`, `lib/ai/agents/*`, `app/api/ai/agent/route.ts`, `hooks/useAiChat.ts`) stays behaviourally unchanged (only additive changes to `lib/ai/sse.ts`).
- Dev server: `http://localhost:3002` (launch config `dev-3002`). Never kill ports 3000/3001.
- Commit after every task (`git add` only the task's files; conventional messages; trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`).

## Review Focus

1. **Model-supplied building id outside the user's scope** (e.g. an owner asks about «κτήριο X» and the model guesses an id): every read/write tool must answer «Δεν έχετε πρόσβαση» and leak nothing. → Task 6 tests `listFaults` / `getBuildingOverview` with a foreign id.
2. **Confirm clicked twice / after reload / by another user / after 15 min**: second click must return the first result or «Η πρόταση έληξε», never execute twice. → Task 9 `canConfirm` + `confirmAction` idempotency tests.
3. **View-as**: a super-admin viewing as an owner must get the OWNER's scope and the log must record `actorId` = super-admin. → Task 5 context test with `impersonatorId`, Task 9 log test.
4. **Wiki article missing for a route or role**: Help drawer must fall back to the role manual, never 500; a page without an article fails the coverage test so it cannot ship. → Task 13 `articleForRoute` null case, Task 17 coverage test.
5. **DeepSeek returns a tool call with malformed JSON or an unknown tool name**: loop must send a tool error back to the model once and still finish the turn with text. → Task 11 loop tests.

---

## File map

| Path | Responsibility |
|---|---|
| `prisma/schema.prisma` | + `AiConversation`, `AiMessage`, `AiActionLog`, `WikiChunk` |
| `prisma/migrations/20261020090000_ai_assistant_wiki/migration.sql` | extension + tables + HNSW index |
| `lib/help/types.ts`, `frontmatter.ts`, `match.ts`, `roles-filter.ts`, `slug.ts` | pure wiki metadata helpers |
| `lib/help/index.ts` | server: load/caches articles from `docs/wiki/pages`, search, grouping |
| `lib/help.ts` | existing manuals + re-exports hub helpers |
| `lib/ai/assistant/page-context.ts`, `prompt.ts`, `chunker.ts`, `rate-limit.ts`, `actions-core.ts`, `truncate.ts` | pure |
| `lib/ai/assistant/context.ts`, `retrieval.ts`, `embeddings.ts`, `indexer.ts`, `conversations.ts`, `actions.ts`, `loop.ts` | server |
| `lib/ai/deepseek.ts` | server: `streamChat` (tool-call aware, used by the loop) |
| `lib/ai/sse.ts` | + events `tool_status`, `confirm`, `meta` |
| `lib/ai/tools/types.ts`, `registry.ts`, `resolve.ts`, `read/*.ts`, `write/*.ts` | tool registry |
| `app/api/ai/assistant/route.ts` | POST chat turn (SSE) |
| `app/api/help/article/route.ts` | GET article for a path (role-filtered) |
| `app/actions/ai-assistant.ts` | confirm/cancel/conversations/reindex |
| `hooks/useAssistantChat.ts` | client hook |
| `components/assistant/*` | drawer UI |
| `components/help/HelpButton.tsx`, `HelpDrawer.tsx`, `HelpCenter.tsx` (extend), `WikiNav.tsx` | help UI |
| `components/admin/app-shell.tsx` | mounts `AssistantDrawer` + `HelpButton` |
| `app/help/page.tsx` | redirect to the role's hub |
| `app/(company)/super-admin/ai-tools/page.tsx` + `AssistantAdminPanel.tsx` | reindex button + action log table |
| `scripts/index-wiki.ts` | CLI indexer |
| `docs/wiki/pages/*.md` | one article per page |

---

### Task 1: Prisma models + migration (gated apply)

**Files:**
- Modify: `prisma/schema.prisma` (append after `model ContractTemplate`)
- Create: `prisma/migrations/20261020090000_ai_assistant_wiki/migration.sql`

**Interfaces:**
- Produces: Prisma models `AiConversation { id, userId, actorId?, role, surface, title?, summary?, pagePath?, createdAt, updatedAt, lastMessageAt, messages[], actions[] }`, `AiMessage { id, conversationId, role ("user"|"assistant"|"tool"), content, toolCalls Json?, toolName?, createdAt }`, `AiActionLog { id, conversationId?, userId, actorId?, toolName, argsJson, previewJson, resultJson?, status ("PROPOSED"|"EXECUTED"|"FAILED"|"CANCELLED"|"EXPIRED"), error?, buildingId?, createdAt, expiresAt, executedAt? }`, `WikiChunk { id, slug, title, heading?, anchor, route?, surface?, roles String[], content, hash, embedding Unsupported("vector(768)")?, updatedAt; @@unique([slug, anchor]) }`.
- `User` gets back-relations `aiConversations AiConversation[]`, `aiActions AiActionLog[]`.

- [ ] **Step 1: Add the four models + `User` relations to `prisma/schema.prisma`** (indexes: `AiConversation @@index([userId, lastMessageAt])`, `AiMessage @@index([conversationId, createdAt])`, `AiActionLog @@index([userId, createdAt]) @@index([status, expiresAt])`, `WikiChunk @@index([slug])`; `AiMessage.conversation` and `AiActionLog.conversation` `onDelete: Cascade`; `AiActionLog.user` / `AiConversation.user` `onDelete: Cascade`).
- [ ] **Step 2: Generate SQL**

Run: `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script > /tmp/ai.sql` (use the scratchpad dir). Expected: SQL containing `CREATE TABLE "WikiChunk"` with `"embedding" vector(768)`.

- [ ] **Step 3: Write the migration file** = `CREATE EXTENSION IF NOT EXISTS vector;` + the generated SQL + `CREATE INDEX "WikiChunk_embedding_idx" ON "WikiChunk" USING hnsw ("embedding" vector_cosine_ops);`
- [ ] **Step 4: Validate**: `npx prisma validate` → "The schema is valid".
- [ ] **Step 5: Generate client**: `npx prisma generate` → `lib/prisma` updated; `npx tsc --noEmit` passes.
- [ ] **Step 6: Commit** schema + migration + generated client: `feat(ai): prisma models for assistant conversations, action log and wiki chunks`.
- [ ] **Step 7: GATE — ask the user** (blocking, production DB): «Να εφαρμόσω τη migration `20261020090000_ai_assistant_wiki` στην παραγωγική βάση (CREATE EXTENSION vector + 4 νέοι πίνακες, χωρίς αλλαγές σε υπάρχοντες);». Only on yes: `npx prisma migrate deploy` → "1 migration applied". Record the answer in the task notes; later tasks that hit the DB (indexer run, browser verification) depend on it.

### Task 2: Wiki frontmatter, slug, route matching, role blocks (pure)

**Files:**
- Create: `lib/help/types.ts`, `lib/help/frontmatter.ts`, `lib/help/slug.ts`, `lib/help/match.ts`, `lib/help/roles-filter.ts`
- Test: `lib/help/frontmatter.test.ts`, `lib/help/match.test.ts`, `lib/help/roles-filter.test.ts`

**Interfaces:**
- Produces:
  - `type WikiArticleMeta = { slug: string; title: string; route: string; roles: string[]; surface: "company"|"customer"|"marketplace"|"standalone"; area: string; summary: string; prompts: string[]; related: string[] }`
  - `parseFrontmatter(raw: string): { meta: Record<string, string | string[]>; body: string }` — supports `key: value`, `key: [a, b]`, `key: ["a b", "c"]`, ignores blank/comment lines; no frontmatter → `{ meta: {}, body: raw }`.
  - `toArticleMeta(slug: string, meta: Record<string, string|string[]>): WikiArticleMeta | null` (null when `title` or `route` missing; `roles` default `[]` = everyone; `prompts`/`related` default `[]`; `area` default `"other"`; `surface` derived from route prefix when absent: `/super-admin|/admin|/manager|/staff|/announcements` → company, `/building|/owner|/portal` → customer, `/marketplace` → marketplace, else standalone).
  - `slugForRoute(route: string): string` — `/` → `-`, strip leading, `[id]|[slug]` → `detail`, `[assemblyId]` → `assembly`, `[type]` → `type`, `[side]` → `side`, `[doc]` → `doc`, `[token]` → `token`; roots: `/super-admin`→`super-admin-home`, `/admin`→`admin-home`, `/manager`→`manager-home`, `/staff`→`staff-home`, `/building`→`building-home`, `/owner`→`owner-home`, `/portal`→`portal-home`, `/marketplace`→`marketplace-home`, `/report`→`report`, `/print`→`print-hub`, `/signage`→`signage`.
  - `matchRoute(pattern: string, pathname: string): boolean` — segment-wise, `[x]` matches one non-empty segment, trailing slash ignored.
  - `articleForRoute(articles: WikiArticleMeta[], pathname: string, role: string): WikiArticleMeta | null` — candidates = matching pattern AND (`roles.length===0` or includes role); pick max static-segment count, tie → longer pattern.
  - `filterRoleBlocks(md: string, role: string): string` — removes `:::roles A,B … :::` blocks whose list excludes `role` (list is comma/space separated, case-insensitive), unwraps the others; unmatched opener → leave text as is.

- [ ] **Step 1: Write failing tests**
  - `frontmatter.test.ts`: parses the three value forms; body excludes the fence; `toArticleMeta` null without title; surface derivation for `/portal/payments` = `customer`.
  - `match.test.ts`: `matchRoute("/building/[id]", "/building/abc")` true, `"/building"` false, `"/building/abc/x"` false; `articleForRoute` prefers `/admin/maintenance/settings` over `/admin/maintenance/[id]` for `/admin/maintenance/settings`; role exclusion returns null; `slugForRoute("/super-admin/buildings/[id]/assemblies/[assemblyId]") === "super-admin-buildings-detail-assemblies-assembly"`.
  - `roles-filter.test.ts`: block kept for listed role (fence lines removed), removed for other role, text outside untouched, two blocks.
- [ ] **Step 2: Run** `npx vitest run lib/help` → FAIL (modules missing).
- [ ] **Step 3: Implement the five modules.**
- [ ] **Step 4: Run** `npx vitest run lib/help` → PASS.
- [ ] **Step 5: Commit** `feat(help): wiki article metadata, route matching and role-block filtering`.

### Task 3: Wiki index (server) + hub helpers

**Files:**
- Create: `lib/help/index.ts`
- Modify: `lib/help.ts` (re-export `AREA_LABELS`, keep MANUALS)
- Test: `lib/help/search.test.ts` (pure search over in-memory articles)

**Interfaces:**
- Produces (server, `import "server-only"` at top of `index.ts`):
  - `type WikiArticle = WikiArticleMeta & { body: string }`
  - `loadWikiIndex(): Promise<WikiArticle[]>` — reads `docs/wiki/pages/*.md`, slug = filename without `.md`, cached in a module `Map` keyed by mtime in production, re-read every call in development.
  - `getArticle(slug: string, role: string): Promise<{ meta: WikiArticleMeta; markdown: string } | null>` — null when role excluded; `markdown = filterRoleBlocks(body, role)`.
  - `findArticleForPath(pathname: string, role: string): Promise<WikiArticleMeta | null>`.
  - `listArticlesForRole(role: string): Promise<{ area: string; label: string; articles: WikiArticleMeta[] }[]>` ordered by `AREA_ORDER`.
  - `hubHrefForRole(role: string): string` — company → `/staff/help`, customer → `/portal/help`, marketplace → `/marketplace/help`.
  - `openHref(route: string, firstBuildingId: string | null): string` (pure, in `lib/help/match.ts`): `[id]` after `building`/`buildings` → replaced with `firstBuildingId` if present, otherwise and for any other `[…]` → prefix before the first `[` (trailing slash stripped; `/building/[id]` with no building → `/building`).
  - Pure `searchArticles(articles: WikiArticleMeta[], q: string, role: string): WikiArticleMeta[]` in `lib/help/match.ts` — token AND-match over lowercased title+summary+slug, role-filtered, max 20.
  - `AREA_LABELS: Record<string,string>` and `AREA_ORDER: string[]` in `lib/help/types.ts`: `core` «Αρχική & επισκόπηση», `management` «Πελάτες, ακίνητα, κτήρια», `operations` «Βλάβες, συντηρήσεις, ανακοινώσεις», `financials` «Οικονομικά & τιμολόγηση», `settings` «Ρυθμίσεις», `cms` «Δημόσιο site (CMS)», `assets` «Τα ακίνητά μου», `services` «Λογαριασμοί & αιτήματα», `business` «Η επιχείρησή μου», `tasks` «Αναθέσεις & προσφορές», `other` «Λοιπά».

- [ ] **Step 1: Write failing test** `search.test.ts`: two-token query matches title+summary, role filter excludes, `openHref("/building/[id]", "b1") === "/building/b1"`, `openHref("/admin/maintenance/[id]", null) === "/admin/maintenance"`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run lib/help` → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(help): wiki index loader, search and hub helpers`.

### Task 4: Page context, chunker, truncation, rate limit (pure)

**Files:**
- Create: `lib/ai/assistant/page-context.ts`, `chunker.ts`, `truncate.ts`, `rate-limit.ts`
- Test: `lib/ai/assistant/page-context.test.ts`, `chunker.test.ts`, `truncate.test.ts`, `rate-limit.test.ts`

**Interfaces:**
- `type PageContext = { path: string; buildingId?: string; requestId?: string; tab?: string }`
- `parsePageContext(pathname: string, search: string): PageContext` — buildingId from `/building/[id]`, `/super-admin/buildings/[id]`; requestId from `/admin/maintenance/[id]`, `/portal/maintenance/[id]`, `/portal/requests/[id]`, `/marketplace/requests/[id]`; `tab` = `s` param else `tab` param; ignores `/admin/maintenance/settings` (not an id).
- `type WikiChunkInput = { slug; title; heading: string | null; anchor: string; route: string | null; surface: string | null; roles: string[]; content: string; hash: string }`
- `chunkMarkdown(md: string, meta: Pick<WikiArticleMeta,"slug"|"title"|"route"|"surface"|"roles">): WikiChunkInput[]` — split on `## ` headings (preamble = anchor `intro`), split a section > 1 200 chars on `### ` then by paragraphs; anchor = slugified heading (Greek kept, spaces→`-`, lowercase) + `-2`,`-3` for continuation; `content` = `${title} › ${heading}\n\n${text}` (strip `:::roles` fences but keep their text); hash = sha256 hex of content (`node:crypto`).
- `planChunkSync(existing: { anchor: string; hash: string }[], next: WikiChunkInput[]): { toEmbed: WikiChunkInput[]; unchanged: string[]; toDelete: string[] }`.
- `truncateToolResult(data: unknown, maxChars = 6000): string` — JSON; if longer, arrays are cut to the first N items that fit and a `"_note": "…και N ακόμη"` field is added.
- `class RateLimiter { constructor(limit: number, windowMs: number); allow(key: string, now = Date.now()): boolean }` sliding window in a Map.

- [ ] **Step 1: Write failing tests** (one file each): the pattern cases above; chunker produces deterministic anchors/hashes, splits long sections, `planChunkSync` classifies changed/unchanged/orphans; truncate keeps JSON parseable and ≤ max; limiter allows 30 then denies within the window and allows after it.
- [ ] **Step 2: Run** `npx vitest run lib/ai/assistant` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(ai): page context, wiki chunker, result truncation, rate limiter`.

### Task 5: Assistant context (server) + prompt builder (pure)

**Files:**
- Create: `lib/ai/tools/types.ts`, `lib/ai/assistant/context.ts`, `lib/ai/assistant/prompt.ts`
- Test: `lib/ai/assistant/prompt.test.ts`, `lib/ai/assistant/context.test.ts` (mock `@/lib/db` and `@/lib/building-access` with `vi.mock`)

**Interfaces:**
- `lib/ai/tools/types.ts` (pure):
  ```ts
  export type AssistantCtx = {
    user: { id: string; name: string | null; email: string; role: string; customerId: string | null; companyId: string | null };
    real: { id: string; role: string }; impersonating: boolean;
    surface: "company" | "customer" | "marketplace";
    perms: Set<string>;
    scope: { seesAllCustomers: boolean; managerBuildingIds: string[]; occupantUnits: { unitId: string; unitNumber: string; buildingId: string; buildingName: string; role: "OWNER" | "RESIDENT" }[]; supplierId: string | null };
    page: PageContext & { buildingName?: string };
    now: Date;
  };
  export type ToolResult = { ok: true; data: unknown; note?: string } | { ok: false; error: string };
  export type ReadTool<A> = { name: string; description: string; kind: "read"; roles: readonly string[]; schema: z.ZodType<A>; label: string; run(args: A, ctx: AssistantCtx): Promise<ToolResult> };
  export type WritePreview = { title: string; summaryLines: string[]; warnings: string[]; resolved: Record<string, unknown>; buildingId: string | null };
  export type ExecuteResult = { ok: true; message: string; href?: string } | { ok: false; error: string };
  export type WriteTool<A> = { name: string; description: string; kind: "write"; roles: readonly string[]; requiredPerm?: string; schema: z.ZodType<A>; label: string; preview(args: A, ctx: AssistantCtx): Promise<WritePreview | { error: string }>; execute(resolved: Record<string, unknown>, ctx: AssistantCtx): Promise<ExecuteResult> };
  export type AssistantTool = ReadTool<any> | WriteTool<any>;
  ```
- `buildAssistantContext(eff: EffectiveSession, page: PageContext): Promise<AssistantCtx>` — `perms` from `getEffectivePermissions()`; `managerBuildingIds` via `managerBuildingIds(userId)` for PROPERTY_ADMIN; `occupantUnits` via the AppShell unit query (owner/resident/open occupancy) for PROPERTY_ADMIN/OWNER/RESIDENT/VIEWER; `supplierId` from `db.user` for COLLABORATOR; `page.buildingId` kept only if `getBuildingAccess(userId, id)` non-null (then `buildingName` filled); `page.requestId` kept only if `canAccessRequest(userId, role, id)`.
- `buildSystemPrompt(ctx: AssistantCtx, wiki: WikiHit[]): string` where `type WikiHit = { slug: string; title: string; heading: string | null; route: string | null; content: string; score?: number }` — Greek prompt containing: identity (name/role label from `ROLE_LABELS`), View-as note when impersonating, surface + page path + known building/request, scope summary (occupant units list; manager building count; collaborator), the rules block (answer only from tools/wiki; never guess numbers/names; say when permission is missing; for «πώς» give steps + `route` link as Markdown link; for actions call the write tool with all known fields and ask only for missing required ones; never narrate tool calls; max 2 short paragraphs or a list), then `## Γνώση από το wiki` with each hit as `### {title} › {heading} ({route})\n{content}`. Date in Athens `toLocaleDateString("el-GR")`.

- [ ] **Step 1: Write failing tests**: `prompt.test.ts` — contains role label, page path, each wiki title/route, contains «Δεν έχετε» rule sentence, impersonation line only when `impersonating`. `context.test.ts` — with mocked db: owner gets occupantUnits and no managerBuildingIds; `page.buildingId` dropped when `getBuildingAccess` mock returns null; `impersonating` true when `eff.impersonatorId` set.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run lib/ai/assistant` → PASS.
- [ ] **Step 5: Commit** `feat(ai): assistant context builder and system prompt`.

### Task 6: Tool registry + read tools

**Files:**
- Create: `lib/ai/tools/registry.ts`, `lib/ai/tools/resolve.ts`, `lib/ai/tools/read/my-buildings.ts`, `building-overview.ts`, `faults.ts`, `announcements.ts`, `my-balance.ts`, `expenses.ts`, `calendar-tasks.ts`, `wiki-search.ts`
- Test: `lib/ai/tools/registry.test.ts`, `lib/ai/tools/read/faults.test.ts`, `lib/ai/tools/read/building-overview.test.ts` (mock `@/lib/db`, `@/lib/building-access`, `@/lib/maintenance-requests`)

**Interfaces:**
- `registry.ts`: `TOOLS: AssistantTool[]` (reads + writes from Task 7), `toolsForRole(role: string, perms: Set<string>): AssistantTool[]` (keeps a tool when `roles.length === 0 || roles.includes(role)` and `!requiredPerm || can(perms, module, action)` using `can` from `lib/rbac/permissions-core`), `toAgentTools(tools): AgentTool[]` (`{ name, description, parameters: z.toJSONSchema(schema) }`), `findTool(name): AssistantTool | undefined`, `TOOL_LABELS` for UI chips.
- `resolve.ts` (server): `resolveBuilding(ctx, q: { buildingId?: string; buildingName?: string }): Promise<{ id: string; name: string } | { error: string }>` — order: explicit id (must pass `getBuildingAccess`), name (staff: `db.building.findMany({ where: { name: { contains, mode: "insensitive" } }, take: 5 })`; others: filter scope buildings by name) → exactly one else `error` listing candidates («Βρήκα 3 κτήρια: …»), page.buildingId, single-scope building; else `error: "Σε ποιο κτήριο αναφέρεστε;"`. `resolveRequest(ctx, q: { requestId?: string; requestTitle?: string })` same idea (staff: title search in `db.maintenanceRequest`; others: among their accessible requests), access via `canAccessRequest`.
- Read tools (names are the model-facing names): `listMyBuildings { q? }`, `getBuildingOverview { buildingId?, buildingName? }`, `listFaults { buildingId?, status?: FaultStatus, limit?: 1..20 }`, `listAnnouncements { buildingId?, buildingName?, limit? }`, `getMyBalance {}` (roles PROPERTY_ADMIN/OWNER/RESIDENT), `listExpenses { buildingId?, buildingName?, month?: "YYYY-MM" }` (roles company + PROPERTY_ADMIN; guard `requireBuildingCap(id,"viewLedger")` in try/catch), `listCalendarTasks { buildingId?, buildingName? }` (guard `requireBuildingView`), `searchWiki { query }` (uses `retrieveWiki` from Task 8).
- Scoping decisions: `listFaults` — staff: any (optional building); PROPERTY_ADMIN: `buildingId in managerBuildingIds OR reportedById = user`; OWNER/RESIDENT/VIEWER: `reportedById = user OR (buildingId in occupant buildings AND unitId = null)`; COLLABORATOR: `supplierId = ctx.scope.supplierId`. Rows: `{ id, title, status, statusLabel (STATUS_LABELS), priority, building, createdAt, href }` with href `/admin/maintenance/{id}` for company, `/portal/requests/{id}` for customer roles, `/marketplace/requests/{id}` for collaborator. `listAnnouncements` — company/PROPERTY_ADMIN: `listAnnouncements(buildingId)` action; occupants: `db.announcement.findMany({ where: { buildingId, recipients: { some: { userId } } } })`; rows `{ id, title, publishedAt, excerpt(200 chars, HTML stripped) }`. `getMyBalance` — for each distinct occupant building call `getOccupantControlCenter(buildingId, userId)` and map `statementsByUnit` → `{ building, unitNumber, selectedMonth, total, paid, due }` (read the loader's statement shape; pick total/paid/outstanding fields it exposes). `getBuildingOverview` — `getBuildingAccess` required; returns `{ name, address, city, postalCode, floors, hasElevator, managed, propertyName, unitsCount, managerNames }`, `managerNames` only for staff/manager viewers.

- [ ] **Step 1: Write failing tests**: `registry.test.ts` — every tool has unique name + JSON schema with `type:"object"`; `toolsForRole("PROPERTY_RESIDENT", new Set())` contains `listFaults`, `getMyBalance` and no `listExpenses`/`createRfq`; `toolsForRole("MANAGER", new Set(["suppliers:edit"]))` contains `createRfq`, without the perm it does not. `faults.test.ts` — resident where clause includes `reportedById` and common-area OR; foreign `buildingId` for a resident → `{ ok:false, error:"Δεν έχετε πρόσβαση" }` (mock `getBuildingAccess` → null). `building-overview.test.ts` — occupant result has no `managerNames`.
- [ ] **Step 2: Run** `npx vitest run lib/ai/tools` → FAIL. **Step 3: Implement** (write tools array empty until Task 7). **Step 4: Run** → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(ai): tool registry, entity resolvers and role-scoped read tools`.

### Task 7: Write tools (5)

**Files:**
- Create: `lib/ai/tools/write/create-fault.ts`, `create-announcement.ts`, `create-expense.ts`, `create-recurring-task.ts`, `create-rfq.ts`
- Modify: `lib/ai/tools/registry.ts` (add to `TOOLS`)
- Test: `lib/ai/tools/write/write-tools.test.ts` (mock `@/app/actions/*`, `@/lib/db`, `@/lib/building-access`, `@/lib/ai/tools/resolve`)

**Interfaces (zod schemas = model-facing args):**
- `createFaultReport` roles all: `{ buildingId?, buildingName?, unitNumber?: string, title: string(min 3), description: string(min 5), category?: string, priority?: "LOW"|"NORMAL"|"HIGH"|"URGENT", restrictedAccess?: boolean }`. `preview`: `resolveBuilding`; unit: occupants may only pick one of their own `occupantUnits` in that building (unitNumber match, else `error`), staff/manager any unit of the building (`db.unit.findFirst`); category → `db.maintenanceCategory.findFirst({ where: { active: true, name: { contains, mode:"insensitive" } } })`; `handledBy = await resolveResponsibility(buildingId, categoryId)`; summaryLines: «Κτήριο: …», «Μονάδα: … / Κοινόχρηστος χώρος», «Τίτλος: …», «Περιγραφή: …», «Κατηγορία: …», «Προτεραιότητα: …», «Αναλαμβάνει: εταιρεία διαχείρισης | διαχειριστής»; `resolved = { buildingId, unitId, title, description, categoryId, priority, restrictedAccess }`. `execute`: `createMaintenanceRequest(resolved)` → `{ ok:true, message:"Η βλάβη δηλώθηκε.", href }`; `{ error }` from the action → `{ ok:false, error }`.
- `createAnnouncement` roles company + PROPERTY_ADMIN: `{ buildingId?, buildingName?, title: string, content: string, audience: "ALL"|"OWNERS"|"RESIDENTS" }`. preview: `requireBuildingCap(id,"manageAnnouncements")` in try/catch → error «Δεν έχετε δικαίωμα ανακοινώσεων σε αυτό το κτήριο»; recipients = `listAnnouncementTargets(buildingId)` filtered by audience → count; warning «Θα σταλεί email σε N παραλήπτες». execute: `createAnnouncement({ title, content: "<p>" + escapeHtml(content).replace(/\n+/g,"</p><p>") + "</p>", audience, targets: [{ scopeType:"BUILDING", scopeId: buildingId }], publishedAt: new Date().toISOString() })`; href company `/admin/announcements`, manager `/building/{id}?s=communication`.
- `createBuildingExpense` roles company + PROPERTY_ADMIN: `{ buildingId?, buildingName?, month: /^\d{4}-\d{2}$/, categoryName: string, totalAmount: number > 0, netAmount?, vatAmount?, supplierName?, supplierVat?, documentNumber?, documentDate?: /^\d{4}-\d{2}-\d{2}$/, description?, tenantPct?: 0..100, paid?: boolean, paymentMethod?: "CARD"|"CASH"|"VIVA"|"BANK_TRANSFER"|"CHECK"|"OTHER" }`. preview: `requireBuildingCap(id,"manageExpenses")`; category from `getBuildingCategorySplits(buildingId)` by name (contains, insensitive; ambiguity → error with names); `tenantPct` default = split's tenantPct; lines incl. «Κατανομή: ενοικιαστής X% / ιδιοκτήτης Y%». execute: `createBuildingExpense(buildingId, { fileId:null, categoryId, month, totalAmount, netAmount, vatAmount, supplierName, supplierVat, documentNumber, documentDate, description, tenantPct, ownerPct: 100 - tenantPct, paid, paymentMethod })`; thrown `Error` → `{ ok:false, error: e.message }`; href staff `/super-admin/buildings/{id}`, manager `/building/{id}?s=finance`.
- `createRecurringTask` roles company + PROPERTY_ADMIN: `{ buildingId?, buildingName?, title, frequency: "WEEKLY"|"MONTHLY"|"QUARTERLY"|"SEMIANNUAL"|"ANNUAL", nextDueDate?: YYYY-MM-DD, kind?: "GENERAL"|"ELEVATOR"|"BOILER"|"FIRE_SAFETY"|"HVAC"|"ELECTRICAL"|"PLUMBING"|"OTHER", vendor?, notes?, reminderDaysBefore?: int 0..90 }`; preview guard `manageCalendar`; execute `createRecurringTask(buildingId, {...})` → `{ task }` ok / `{ error }`; href staff `/super-admin/buildings/{id}`, manager `/building/{id}?s=maintenance`.
- `createRfq` roles SUPER_ADMIN/ADMIN/MANAGER, `requiredPerm: "suppliers:edit"`: `{ requestId?, requestTitle?, supplierNames: string[] (min 1), deadlineAt?: YYYY-MM-DD, surveyRequired?: boolean, notes? }`; preview: `resolveRequest`; suppliers `db.supplier.findMany({ where: { customerId: null, isPlatform: false, isActive: true, name: { contains, mode:"insensitive" } } })` per name, each must resolve to exactly one; warning «Θα ειδοποιηθούν N συνεργάτες»; execute `createRfq({ maintenanceRequestId, supplierIds, deadlineAt: deadlineAt ? deadlineAt + "T23:59:00" : null, surveyRequired, notes })`; href `/admin/maintenance/{requestId}`.

- [ ] **Step 1: Write failing tests** (`write-tools.test.ts`): each tool's schema rejects a bad payload (missing title / amount ≤ 0 / bad month); `createFaultReport.preview` for a resident with a foreign unitNumber → `{ error }`; `createAnnouncement.preview` → warning with recipient count from mocked `listAnnouncementTargets`; `createBuildingExpense.execute` calls mocked action with `ownerPct === 100 - tenantPct`; `createRfq.execute` passes resolved `supplierIds`; a thrown `Error("dup")` from the mocked expense action → `{ ok:false, error:"dup" }`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run lib/ai/tools` → PASS; registry test from Task 6 still passes with the 5 write tools present.
- [ ] **Step 5: Commit** `feat(ai): five confirmable write tools over existing server actions`.

### Task 8: Embeddings, retrieval, indexer, CLI

**Files:**
- Create: `lib/ai/assistant/embeddings.ts`, `lib/ai/assistant/retrieval.ts`, `lib/ai/assistant/indexer.ts`, `scripts/index-wiki.ts`
- Test: `lib/ai/assistant/retrieval.test.ts` (mock `@/lib/db` `$queryRaw`, mock embeddings)

**Interfaces:**
- `embedTexts(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY", meta?: { userId?: string }): Promise<number[][] | null>` — null when `env.GEMINI_API_KEY` missing; POST `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=…` with `requests: texts.map(t => ({ model: "models/gemini-embedding-001", content: { parts: [{ text: t }] }, taskType, outputDimensionality: 768 }))` in batches of 100; each call → `logAPIUsage({ apiName:"gemini", endpoint:"/batchEmbedContents", model:"gemini-embedding-001", tokensUsed: approx sum(text.length/4), status })`.
- `retrieveWiki(query: string, role: string, limit = 5): Promise<WikiHit[]>` — try vector: `embedTexts([query],"RETRIEVAL_QUERY")`; if non-null → `db.$queryRaw` ``SELECT slug,title,heading,route,content, 1 - (embedding <=> ${vec}::vector) AS score FROM "WikiChunk" WHERE embedding IS NOT NULL AND (cardinality(roles)=0 OR ${role} = ANY(roles)) ORDER BY embedding <=> ${vec}::vector LIMIT ${limit}`` (vector literal built as `"[" + nums.join(",") + "]"` string parameter cast in SQL); on null/any error → keyword fallback `db.wikiChunk.findMany({ where: { AND: tokens.map(t => ({ content: { contains: t, mode:"insensitive" } })), OR:[{ roles:{ isEmpty:true } },{ roles:{ has: role } }] }, take: limit })` (tokens = words ≥ 3 chars, max 5). Fallback logged once per process.
- `indexWiki(): Promise<{ articles: number; chunks: number; embedded: number; deleted: number; keywordOnly: boolean }>` — sources: `loadWikiIndex()` pages (roles/route/surface from meta) + the existing `MANUALS` files (slug = manual key, route null, roles = `manualsForRole` inverse: list roles whose `manualsForRole(role)` includes the key) ; for each: `chunkMarkdown`, `planChunkSync` against `db.wikiChunk.findMany({ where:{ slug }, select:{ anchor, hash } })`, embed `toEmbed` contents (DOCUMENT), upsert rows (`$executeRaw` for the vector column: `UPDATE "WikiChunk" SET embedding = ${vec}::vector WHERE id = ${id}` after a Prisma `upsert` of the scalar fields), delete orphans, delete slugs no longer present.
- `scripts/index-wiki.ts`: `npx tsx --env-file=.env scripts/index-wiki.ts` → prints the result JSON.

- [ ] **Step 1: Write failing test** `retrieval.test.ts`: with embeddings mocked null → `findMany` called with token filters and role OR; with embeddings mocked → `$queryRaw` used and hits mapped `{slug,title,heading,route,content,score}`; `$queryRaw` throwing → falls back to keyword.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(ai): gemini embeddings, pgvector retrieval with keyword fallback, wiki indexer`.

### Task 9: Action proposals (state machine) + conversations persistence + server actions

**Files:**
- Create: `lib/ai/assistant/actions-core.ts`, `lib/ai/assistant/actions.ts`, `lib/ai/assistant/conversations.ts`, `app/actions/ai-assistant.ts`
- Test: `lib/ai/assistant/actions-core.test.ts`, `lib/ai/assistant/actions.test.ts` (mock db + registry tool)

**Interfaces:**
- `actions-core.ts` (pure): `PROPOSAL_TTL_MS = 15 * 60 * 1000`; `canConfirm(log: { userId: string; status: string; expiresAt: Date }, userId: string, now: Date): { ok: true } | { ok: false; reason: "not_owner" | "not_proposed" | "expired"; message: string }` (messages: «Η πρόταση δεν σας ανήκει.», «Η ενέργεια έχει ήδη εκτελεστεί ή ακυρωθεί.», «Η πρόταση έληξε — ζητήστε την ξανά από τον βοηθό.»); `type ConfirmCard = { actionId: string; tool: string; title: string; summaryLines: string[]; warnings: string[] }`.
- `actions.ts` (server): `proposeAction(ctx: AssistantCtx, tool: WriteTool<any>, rawArgs: unknown, conversationId: string): Promise<{ card: ConfirmCard } | { error: string }>` — zod `safeParse` (error → Greek message listing invalid fields), role/perm re-check via `toolsForRole`, `tool.preview`, insert `AiActionLog { status:"PROPOSED", argsJson: parsed, previewJson: preview, expiresAt: now+TTL, userId: ctx.user.id, actorId: ctx.impersonating ? ctx.real.id : null, buildingId: preview.buildingId }`. `confirmAction(actionId: string, eff: EffectiveSession): Promise<ExecuteResult>` — load log, `canConfirm`, `findTool(log.toolName)` must be write, rebuild ctx via `buildAssistantContext(eff, { path: conversation.pagePath ?? "/" })`, re-run `preview(argsJson, ctx)` (error → mark FAILED, return), `execute(preview.resolved, ctx)`, update log (`EXECUTED` + `resultJson`/`executedAt` or `FAILED` + `error`), append `AiMessage { role:"tool", toolName, content: ok ? "✔ " + message : "✖ " + error }` to the conversation; concurrency: `updateMany({ where: { id, status:"PROPOSED" }, data: { status:"EXECUTING" } })` must return `count === 1` else return «Η ενέργεια εκτελείται ήδη.». `cancelAction(actionId, eff)` → CANCELLED (same ownership rules). `expireStale()` → `updateMany` PROPOSED past `expiresAt` → EXPIRED (called at the start of each assistant turn).
- `conversations.ts` (server): `getOrCreateConversation(eff, input: { conversationId?: string; surface: string; pagePath: string }): Promise<{ id: string; isNew: boolean }>` (ownership: `userId === eff.user.id`, else create new); `appendMessage(conversationId, m: { role: "user"|"assistant"|"tool"; content: string; toolCalls?: unknown; toolName?: string }): Promise<{ id: string }>` (also bumps `lastMessageAt`; sets `title` = first 60 chars of the first user message); `loadHistory(conversationId, limit = 20): Promise<AgentMessage[]>` (user/assistant rows only, oldest→newest, plus a leading `assistant` «Περίληψη προηγούμενης συζήτησης: …» when `summary` exists); `maybeSummarize(conversationId)`: when message count % 10 === 0 → non-streaming DeepSeek call (via `lib/ai.ts` `deepseekRequest`-style helper or `streamChat` without tools) producing ≤ 600 chars, saved to `summary`.
- `app/actions/ai-assistant.ts` (`"use server"`): `confirmAiAction(actionId: string): Promise<ExecuteResult>`, `cancelAiAction(actionId: string): Promise<{ ok: boolean }>`, `listMyConversations(): Promise<{ id: string; title: string | null; lastMessageAt: string }[]>` (effective user, 30 latest), `getConversationMessages(id): Promise<{ id: string; role: string; content: string; createdAt: string }[]>` (ownership check), `deleteConversation(id)`, `reindexWiki(): Promise<ReturnType<typeof indexWiki>>` (real role must be SUPER_ADMIN), `listAiActions(limit = 100)` (SUPER_ADMIN; rows with user name/email, tool, status, building, createdAt, executedAt, error).

- [ ] **Step 1: Write failing tests**: `actions-core.test.ts` — the three failure reasons + ok. `actions.test.ts` — `proposeAction` rejects invalid args with a Greek message and writes nothing; valid args insert PROPOSED with `actorId` when impersonating; `confirmAction` executes once (mocked `updateMany` returns count 1 then 0 → second call returns «ήδη»), marks FAILED when execute returns error, refuses foreign user.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run lib/ai/assistant` → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(ai): action proposals with confirmation, conversation persistence, assistant server actions`.

### Task 10: DeepSeek streaming client with tool-call assembly + SSE event additions

**Files:**
- Create: `lib/ai/deepseek.ts`
- Modify: `lib/ai/sse.ts` (additive), `lib/ai/agent.ts` (export `AgentMessage` extended with optional `tool_calls`)
- Test: `lib/ai/deepseek.test.ts` (mock global `fetch` with a hand-built SSE body), `lib/ai/sse.test.ts` (extend)

**Interfaces:**
- `AgentMessage` gains `tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[]` (assistant) — existing callers unaffected.
- `streamChat(opts: { system: string; messages: AgentMessage[]; tools?: AgentTool[]; model?: string; userId?: string; customerId?: string; onToken?: (delta: string) => void }): Promise<{ content: string; toolCalls: { id: string; name: string; args: string }[]; usage: number }>` — same request body as `buildRequestBody`; assembles tool calls keyed by `index` (id from the first delta); logs `logAPIUsage` with `userId`/`customerId`; throws `Error("deepseek_unavailable")` when key missing, `Error("DeepSeek error <status>")` on HTTP failure.
- `lib/ai/sse.ts`: `AgentEvent` union adds `{ type: "tool_status"; name: string; label: string; state: "running" | "done" | "error" }`, `{ type: "confirm"; card: ConfirmCard }`, `{ type: "meta"; conversationId: string; messageId: string }`; `parseAgentSse` emits them.

- [ ] **Step 1: Write failing tests**: `deepseek.test.ts` — a mocked stream with two tool-call deltas for index 0 and content tokens yields `toolCalls[0].args === '{"a":1}'`, `content === "Γεια"`, `onToken` called twice; HTTP 500 → throws. `sse.test.ts` — the three new events parse with their fields.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run lib/ai` → PASS (wizard tests untouched).
- [ ] **Step 5: Commit** `feat(ai): tool-call-aware DeepSeek stream client; assistant SSE events`.

### Task 11: Assistant loop + route handler

**Files:**
- Create: `lib/ai/assistant/loop.ts`, `app/api/ai/assistant/route.ts`
- Test: `lib/ai/assistant/loop.test.ts` (mock `@/lib/ai/deepseek`, registry, retrieval, conversations, actions)

**Interfaces:**
- `runAssistantTurn(input: { eff: EffectiveSession; ctx: AssistantCtx; conversationId: string; userText: string }): ReadableStream<Uint8Array>` — SSE `event:` names `token | tool_status | confirm | meta | error | done`. Algorithm: `expireStale()`; `appendMessage(user)`; `wiki = retrieveWiki(userText, role, 5)`; `system = buildSystemPrompt(ctx, wiki)`; `messages = loadHistory` + user; `tools = toAgentTools(toolsForRole(...))`; up to `MAX_ROUNDS = 4`: `streamChat` (tokens → `token`); if no toolCalls → finish; else append assistant message with `tool_calls`; for each call: `findTool` (unknown → tool message `{"error":"Άγνωστο εργαλείο"}`), `JSON.parse` args (fail → `{"error":"Μη έγκυρα ορίσματα"}`), read → emit `tool_status running/done`, `run`, tool message `truncateToolResult(result)`; write → `proposeAction` → emit `confirm` (or tool message with the error) and tool message «Η προεπισκόπηση εμφανίστηκε στον χρήστη· περίμενε την επιβεβαίωσή του, μην ξανακαλέσεις το εργαλείο» and set `stopAfterRound = true`; after the round with a write proposal, one more `streamChat` without tools for the closing sentence. End: `appendMessage(assistant, { content, toolCalls })`, `maybeSummarize`, `meta`, `done`. Any thrown error → `error` (message «Ο βοηθός δεν είναι διαθέσιμος αυτή τη στιγμή.» for `deepseek_unavailable`, else `e.message`) then `done`.
- Route `POST /api/ai/assistant`: body `{ conversationId?: string; message: string; page: { path: string; search?: string } }`; 401 no session; 400 bad JSON / empty message / > 4000 chars; 429 when `RateLimiter(30, 60_000).allow(userId)` false; 402 `{ error:"wallet_empty" }` when role is a customer role, `eff.user.customerId` set and `getWalletBalance("CUSTOMER", customerId) <= 0`; else `getOrCreateConversation`, `buildAssistantContext(eff, parsePageContext(path, search))`, stream response with headers as in `app/api/ai/agent/route.ts`.

- [ ] **Step 1: Write failing tests** (`loop.test.ts`, collect the stream into parsed events with `parseAgentSse`): (a) no tool calls → `token`s, `meta`, `done`, `appendMessage(assistant)` called; (b) one read tool call then text → `tool_status running`+`done`, second `streamChat` receives a `tool` message; (c) write tool call → `confirm` event with the card and no `execute` call; (d) unknown tool name / malformed args → turn still ends with `done` and the error text was sent as a tool message; (e) `streamChat` throwing → `error` then `done`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement loop + route.** **Step 4: Run** `npx vitest run lib/ai/assistant` → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Smoke (reads only, dev server)**: `curl -s -N http://localhost:3002/api/ai/assistant -X POST -H 'content-type: application/json' -d '{}'` → `401`. (Authenticated check happens in Task 12 via the browser.)
- [ ] **Step 6: Commit** `feat(ai): assistant turn loop with server-side tools and SSE route`.

### Task 12: Client hook + Assistant drawer, mounted in AppShell

**Files:**
- Create: `hooks/useAssistantChat.ts`, `components/assistant/AssistantDrawer.tsx`, `components/assistant/MessageList.tsx`, `components/assistant/ConfirmCard.tsx`, `components/assistant/ConversationList.tsx`, `components/assistant/SuggestedPrompts.tsx`, `components/assistant/assistant.css` (imported from the drawer; phone bottom-sheet rules)
- Modify: `components/admin/app-shell.tsx` (render `<AssistantDrawer role={role} />` after `QuickActions`)
- Test: `hooks/useAssistantChat.test.ts` is NOT required (hook is thin); pure reducer `components/assistant/reducer.ts` + `reducer.test.ts` IS required.

**Interfaces:**
- `reducer.ts` (pure): `type AssistantMessage = { id: string; role: "user" | "assistant" | "tool"; content: string; tools: { name: string; label: string; state: "running" | "done" | "error" }[]; confirm?: ConfirmCard & { state: "pending" | "executed" | "cancelled" | "failed"; resultMessage?: string; href?: string } }`; `type ChatState = { conversationId: string | null; messages: AssistantMessage[]; streaming: boolean; error: string | null }`; `reduce(state, action)` with actions `start_turn(userText, assistantId)`, `sse(event: AgentEvent, assistantId)`, `confirm_result(actionId, result)`, `cancelled(actionId)`, `load(conversationId, messages)`, `reset()`, `fail(message)`.
- `useAssistantChat(opts: { page: { path: string; search: string } })` → `{ state, input, setInput, send(text?), confirm(actionId), cancel(actionId), newConversation(), loadConversation(id), conversations, refreshConversations() }`; `send` POSTs to `/api/ai/assistant`, parses with `parseAgentSse`, dispatches `sse`; `confirm` calls `confirmAiAction` then `confirm_result`; 402 → `fail("Το πορτοφόλι του πελάτη δεν έχει υπόλοιπο για AI.")`, 429 → `fail("Πολλά μηνύματα — δοκιμάστε σε λίγο.")`.
- `AssistantDrawer({ role }: { role: string })` (client): FAB `position:absolute; right:20px; bottom:20px; z-index:60` with `RiRobot2Line`, drawer `position:fixed; right:0; top:0; height:100dvh; width:420px; max-width:100vw` (≤767px: `top:auto; bottom:0; height:85dvh; width:100%; border-radius:16px 16px 0 0`); header «Βοηθός Orithon» + `RiHistoryLine` (toggles `ConversationList`), `RiAddLine` (new), `RiCloseLine`; Escape closes; `SuggestedPrompts` fetched from `GET /api/help/article?path=…` (`prompts`) when the conversation is empty; `MessageList` renders assistant content through `Markdown`, tool chips (`RiLoader4Line` spinning / `RiCheckLine`), `ConfirmCard` (title, lines, warnings in amber, buttons «Επιβεβαίωση» primary / «Ακύρωση», after result a green/red line + link «Άνοιγμα»); input `<textarea rows=2>` Enter sends, Shift+Enter newline; a disclaimer line «Ο βοηθός εκτελεί ενέργειες μόνο μετά από επιβεβαίωση.». Page context from `usePathname()`/`useSearchParams()`.
- Exposes a global opener for the Help drawer: `window.dispatchEvent(new CustomEvent("orithon:assistant", { detail: { prompt?: string } }))` opens the drawer and pre-fills `prompt`.

- [ ] **Step 1: Write failing test** `reducer.test.ts`: `start_turn` adds user+empty assistant; `token` appends; `tool_status` running→done updates the chip; `confirm` attaches a pending card; `confirm_result` ok → `executed` with message/href; `error` sets `error` and stops streaming.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement reducer, hook, components, mount in AppShell.** **Step 4: Run** `npx vitest run components/assistant` (add `components/**/*.test.ts` to `vitest.config.ts` include) → PASS; `npx tsc --noEmit`, `npm run lint` clean.
- [ ] **Step 5: Browser check (preview `dev-3002`, reads only)**: as the logged-in super-admin open `/super-admin`, click the FAB, ask «Ποια κτήρια υπάρχουν;» → streamed answer with a tool chip; via `/super-admin/view-as` as a PROPERTY_RESIDENT open `/portal`, ask «Τι χρωστάω;» → answer only for their units; ask «Δήλωσε βλάβη: τρέχει το καζανάκι στο μπάνιο» → a ConfirmCard appears — DO NOT click «Επιβεβαίωση»; click «Ακύρωση» → card shows «Ακυρώθηκε». Screenshot each. `read_console_messages` shows no errors.
- [ ] **Step 6: Commit** `feat(assistant): chat drawer with streaming, tool chips, confirm cards and history on all surfaces`.

### Task 13: Help API + HelpButton + HelpDrawer

**Files:**
- Create: `app/api/help/article/route.ts`, `components/help/HelpButton.tsx`, `components/help/HelpDrawer.tsx`
- Modify: `components/admin/app-shell.tsx` (render `<HelpButton />` left of the assistant FAB: `right: 84px`)

**Interfaces:**
- `GET /api/help/article?path=/admin/maintenance&s=` → 200 `{ slug, title, route, markdown, prompts, related: { slug, title }[], hubHref, openInHub: hubHref + "?a=" + slug }` (role from `getEffectiveSession`, 401 without); 404 `{ fallback: { title: MANUALS[manualForRole(role)].title, hubHref } }` when `findArticleForPath` is null.
- `HelpButton()` (client): FAB `RiQuestionLine`, title «Βοήθεια για αυτή τη σελίδα»; opens `HelpDrawer`.
- `HelpDrawer({ open, onClose })` (client): fetches the article for `usePathname()` + `useSearchParams()`; renders title, `Markdown` (Mermaid works), related links (open in hub), buttons «Άνοιγμα στο Wiki» (link) and «Ρώτα τον βοηθό» (dispatches `orithon:assistant` with prompt «Πώς χρησιμοποιώ τη σελίδα «{title}»;»); fallback state shows «Δεν υπάρχει ακόμη οδηγός για αυτή τη σελίδα» + link to the role manual. Same drawer geometry as the assistant (width 420, phone bottom sheet); only one of the two drawers open at a time (opening one closes the other via the same CustomEvent bus: `orithon:help`).

- [ ] **Step 1: Implement route + components + mount.** (No new pure logic; `findArticleForPath` is tested in Task 2/3.)
- [ ] **Step 2: Verify**: `curl -s 'http://localhost:3002/api/help/article?path=/portal'` → `401`; browser as super-admin on `/super-admin/customers` → HelpButton opens the drawer showing «Δεν υπάρχει ακόμη οδηγός…» (articles arrive in Tasks 15–18) — screenshot; `tsc`/`lint` clean.
- [ ] **Step 3: Commit** `feat(help): per-page help button and drawer backed by the wiki index`.

### Task 14: Hub (HelpCenter extension), /help redirect, super-admin AI panel

**Files:**
- Modify: `components/help/HelpCenter.tsx` (new props `article?: string; q?: string; firstBuildingId: string | null`), the three help pages (`app/(company)/staff/help/page.tsx`, `app/(customer)/portal/help/page.tsx`, `app/(marketplace)/marketplace/help/page.tsx`) to pass `sp.a`, `sp.q` and a first building id in scope (`listManageableBuildings()[0]?.id` for staff/manager, first occupant building for occupants, null otherwise)
- Create: `components/help/WikiNav.tsx` (server, accordion by area with `<details>`), `app/help/page.tsx` (server redirect to `hubHrefForRole(role)`, `/login` without session), `app/(company)/super-admin/ai-tools/AssistantAdminPanel.tsx` (client), modify `app/(company)/super-admin/ai-tools/page.tsx` to load `listAiActions(100)` + `db.wikiChunk.count()` and render the panel under `AiToolsClient`.

**Interfaces:**
- HelpCenter aside order: search form (`<input name="q">` GET to `base`), «Οδηγός ανά σελίδα» (`WikiNav` with `listArticlesForRole(role)`; current `a` highlighted), «Εγχειρίδια» (existing), support box. Main: when `q` → results list (title, summary, «Άνοιγμα οδηγού», «Άνοιγμα σελίδας» = `openHref(route, firstBuildingId)`); when `a` → article (`getArticle(a, role)`, 404-ish «Δεν βρέθηκε» card), header with «Άνοιγμα σελίδας» button + related chips; else existing manual behaviour.
- `AssistantAdminPanel({ actions, chunkCount })`: card «Wiki & RAG» with chunk count + button «Επανευρετηρίαση wiki» calling `reindexWiki()` and showing the result; `DataTable` (`clientSide`, `storageKey:"ai-actions"`) columns: date, user, tool label, status badge, building, error; `expandedContent` shows `previewJson.summaryLines` and `resultJson`.

- [ ] **Step 1: Implement.** **Step 2: Verify in browser**: `/staff/help?q=βλάβη` lists results (once articles exist, Task 15+; before that shows «Δεν βρέθηκαν οδηγοί»), `/help` redirects per role (View-as owner → `/portal/help`), `/super-admin/ai-tools` shows the panel; `tsc`/`lint` clean.
- [ ] **Step 3: Commit** `feat(help): wiki hub with search and per-area navigation; /help redirect; AI admin panel`.

### Task 15: Wiki articles — company surface (super-admin pages)

**Files:** Create `docs/wiki/pages/<slug>.md` for every route below (slug = `slugForRoute(route)`); roles `[SUPER_ADMIN]` unless noted; `surface: company`.

| route | area | title |
|---|---|---|
| /super-admin | core | Αρχική Super Admin |
| /super-admin/reports | core | Αναφορές |
| /super-admin/onboarding | management | Νέα πολυκατοικία με AI |
| /super-admin/customers | management | Πελάτες |
| /super-admin/customers/[id] | management | Καρτέλα πελάτη |
| /super-admin/customers/[id]/onboarding | management | Οδηγός νέας πολυκατοικίας (AI) |
| /super-admin/properties | management | Ιδιοκτησίες |
| /super-admin/properties/[id] | management | Καρτέλα ιδιοκτησίας |
| /super-admin/buildings/[id] | management | Καρτέλα κτηρίου (όλες οι καρτέλες: Επισκόπηση, Μονάδες, Ένοικοι, Διαχειριστές, Αρχεία, Ημερολόγιο, Επαφές, Εγκαταστάσεις, Διαχειριζόμενα στοιχεία, Έξοδα, Ενδείξεις, Ρυθμίσεις κατανομής, Χιλιοστά, Κοινόχρηστα, Πληρωμές, Αιτήματα βλαβών, Συντηρήσεις, Ανακοινώσεις, Συνελεύσεις — one `##` per tab) |
| /super-admin/buildings/[id]/assemblies/[assemblyId] | operations | Ηλεκτρονική συνέλευση |
| /super-admin/units | management | Μονάδες |
| /super-admin/users | management | Χρήστες |
| /super-admin/managed-items | management | Στοιχεία διαχείρισης |
| /super-admin/managed-buildings | management | Διαχειριζόμενα κτήρια & υποχρεώσεις |
| /super-admin/suppliers | management | Συνεργάτες & προμηθευτές |
| /super-admin/suppliers/[id] | management | Καρτέλα συνεργάτη |
| /super-admin/suppliers/catalog | management | Κατάλογος υπηρεσιών |
| /super-admin/roles | settings | Ρόλοι & δικαιώματα |
| /super-admin/services | financials | Υπηρεσίες |
| /super-admin/billing | financials | Τιμολόγηση |
| /super-admin/billing/company-wallet | financials | Πορτοφόλι εταιρείας |
| /super-admin/ai-tools | settings | AI εργαλεία, βοηθός & wiki |
| /super-admin/integrations | settings | Ενσωματώσεις |
| /super-admin/settings | settings | Ρυθμίσεις (κόμβος) |
| /super-admin/settings/company | settings | Στοιχεία εταιρείας |
| /super-admin/settings/brand | settings | Brand & λογότυπα |
| /super-admin/settings/payments | settings | Πληρωμές Viva (πάροχος) |
| /super-admin/settings/costs | financials | Κόστη API & tokens |
| /super-admin/settings/contracts | settings | Προσφορές & συμβάσεις |
| /super-admin/settings/cron | settings | Αυτόματες εργασίες |
| /super-admin/settings/expense-categories | settings | Κατηγορίες εξόδων |
| /super-admin/view-as | core | Προβολή ως χρήστης (View-as) |
| /super-admin/preview | core | Προεπισκόπηση ρόλων |
| /super-admin/design-preview | settings | Προεπισκόπηση σχεδιασμού |
| /super-admin/cms/landing, /cms/landing/[type], /cms/pages, /cms/pages/[slug], /cms/site-pages, /cms/site-pages/[slug], /cms/pricing, /cms/faq, /cms/seo, /cms/settings, /cms/translations, /cms/media, /cms/articles, /cms/articles/[id], /cms/authors, /cms/newsletter | cms | one short article each («CMS: …») |

Article template (every file): frontmatter (title, route, roles, surface, area, summary ≤ 160 chars, prompts 2–3 questions a user of that page would ask the assistant, related slugs) → `## Τι βλέπετε εδώ` → `## Βήμα-βήμα` (numbered, exact button labels in «…», read them from the page's components before writing) → optional `## Συχνές ερωτήσεις`. Length: list/CRUD pages ≥ 150 words; tab-heavy pages one `##` per tab; CMS pages ≥ 80 words. Write like `docs/wiki/roles/*.md` (non-technical, «Πού το βρίσκω»).

- [ ] **Step 1: For each route, open its `page.tsx` + main client component, note the real labels, write the article.**
- [ ] **Step 2: Verify**: `npx vitest run lib/help` passes; temporary check `npx tsx -e "import('./lib/help/index.ts')…"` is not needed — instead run the coverage script from Task 17 once it exists; until then `ls docs/wiki/pages | wc -l` ≥ 52.
- [ ] **Step 3: Commit** `docs(wiki): per-page guides for the super-admin surface`.

### Task 16: Wiki articles — company surface (admin/manager/staff) + standalone

Roles: `/admin/*` → `[SUPER_ADMIN, ADMIN]`; `/manager/*` → `[SUPER_ADMIN, ADMIN, MANAGER]`; `/staff/*` and `/announcements` → company roles; standalone as noted.

| route | area | title | roles |
|---|---|---|---|
| /admin | core | Αρχική διαχείρισης εταιρείας | |
| /admin/announcements | operations | Ανακοινώσεις (εταιρεία) | |
| /announcements | operations | Σύνθεση ανακοίνωσης | company |
| /admin/costs | financials | Κόστη & χρεώσεις | |
| /admin/customer-wallets | financials | Πορτοφόλια πελατών | |
| /admin/metered-plans | financials | Πακέτα χρεώσεων | |
| /admin/maintenance | operations | Βλάβες & συντηρήσεις | |
| /admin/maintenance/[id] | operations | Καρτέλα βλάβης (ανάθεση, ραντεβού, RFQ) | |
| /admin/maintenance/settings | operations | Ρυθμίσεις βλαβών (κατηγορίες, SLA, κάλυψη) | |
| /admin/maintenance-program | operations | Ετήσιο πρόγραμμα συντηρήσεων | |
| /admin/properties, /admin/properties/[id] | management | Ιδιοκτησίες (admin) | |
| /admin/residents | management | Ένοικοι & ιδιοκτήτες | |
| /admin/work-orders | operations | Συμβάσεις έργου | |
| /admin/work-orders/[id]/contract/[side] | operations | Εκτύπωση σύμβασης έργου | |
| /manager | core | Αρχική υπευθύνου | |
| /manager/properties, /manager/properties/[id] | management | Ιδιοκτησίες (υπεύθυνος) | |
| /staff | core | Αρχική στελέχους | |
| /staff/calendar | operations | Ημερολόγιο συντηρήσεων | |
| /staff/support | operations | Αιτήματα υποστήριξης | |
| /staff/help | core | Βοήθεια & εγχειρίδια | |
| /report | operations | Δήλωση βλάβης με φωτογραφία | `[]` (all) , surface standalone |
| /print | operations | Εκτυπωτικά (κόμβος) | company + PROPERTY_ADMIN |
| /print/[doc] | operations | Εκτύπωση εγγράφου | company + PROPERTY_ADMIN |
| /signage | assets | Πίνακας ανακοινώσεων (TV) | `[]` |
| /announcements/[token] | assets | Επιβεβαίωση ανακοίνωσης | `[]` |

- [ ] **Step 1: Write the articles (same template/standards as Task 15).** **Step 2:** `ls docs/wiki/pages | wc -l` ≥ 78. **Step 3: Commit** `docs(wiki): per-page guides for admin/manager/staff and standalone pages`.

### Task 17: Wiki articles — customer surface + coverage test

Roles: `/building*` → `[PROPERTY_ADMIN, PROPERTY_OWNER, PROPERTY_RESIDENT, PROPERTY_VIEWER]` (`/building/suppliers` → `[PROPERTY_ADMIN]`); `/owner/*` → `[PROPERTY_ADMIN, PROPERTY_OWNER]`; `/portal/*` → `[PROPERTY_ADMIN, PROPERTY_OWNER, PROPERTY_RESIDENT]`.

| route | area | title |
|---|---|---|
| /building | core | Τα κτήριά μου |
| /building/[id] | assets | Το κτήριο (διαχειριστής & ένοικοι) — `##` per manager section (Επισκόπηση, Οικονομικά, Κτήριο, Άνθρωποι, Συντήρηση, Επικοινωνία, Ρυθμίσεις) with `:::roles PROPERTY_ADMIN` for manager-only steps and a `## Ως ιδιοκτήτης/ένοικος` section |
| /building/suppliers | operations | Οι προμηθευτές μου |
| /owner | core | Αρχική ιδιοκτήτη |
| /owner/units | assets | Οι μονάδες μου |
| /owner/payments | services | Λογαριασμοί ιδιοκτήτη |
| /owner/requests | services | Τα αιτήματά μου (ιδιοκτήτης) |
| /owner/announcements | assets | Ανακοινώσεις (ιδιοκτήτης) |
| /portal | core | Αρχική ενοίκου |
| /portal/requests, /portal/requests/new, /portal/requests/[id] | services | Αιτήσεις βλάβης |
| /portal/maintenance, /portal/maintenance/[id] | services | Συντηρήσεις του κτηρίου |
| /portal/payments | services | Λογαριασμοί κοινοχρήστων |
| /portal/files | services | Αρχεία του κτηρίου |
| /portal/announcements | services | Ανακοινώσεις |
| /portal/wallet | services | Πορτοφόλι |
| /portal/work-orders/[id]/contract | services | Σύμβαση έργου (πελάτης) |
| /portal/help | core | Βοήθεια & οδηγίες |

**Coverage test** `lib/help/coverage.test.ts`: walk `app/**/page.tsx` with `node:fs` (skip `[locale]`, `(auth)`, `api`, `app/page.tsx`), route = path with route groups `(x)` removed and `/page.tsx` stripped; read every `docs/wiki/pages/*.md` frontmatter; assert each route has an article whose `route` equals it (print the missing list on failure). Also assert every article's `route` exists as a page (no stale articles) and every `related` slug exists.

- [ ] **Step 1: Write the coverage test, run it → FAIL listing marketplace routes (Task 18) and any gap.**
- [ ] **Step 2: Write the customer articles.** **Step 3: Run** `npx vitest run lib/help/coverage` → only `/marketplace/*` missing. **Step 4: Commit** `docs(wiki): per-page guides for owners, residents and building managers; coverage test`.

### Task 18: Wiki articles — marketplace surface + index run

Roles `[COLLABORATOR]`, `surface: marketplace`.

| route | area | title |
|---|---|---|
| /marketplace | core | Αρχική συνεργάτη |
| /marketplace/onboarding | business | Πρώτα βήματα συνεργάτη |
| /marketplace/requests, /marketplace/requests/[id] | tasks | Αναθέσεις εργασιών |
| /marketplace/rfq, /marketplace/rfq/[id] | tasks | Αιτήματα προσφοράς & υποβολή προσφοράς |
| /marketplace/work-orders, /marketplace/work-orders/[id], /marketplace/work-orders/[id]/contract | tasks | Συμβάσεις έργου (συνεργάτης) |
| /marketplace/catalog | business | Υπηρεσίες & τιμές |
| /marketplace/team | business | Ομάδα |
| /marketplace/profile | business | Προφίλ & ωράρια |
| /marketplace/help | core | Βοήθεια (συνεργάτης) |

- [ ] **Step 1: Write the articles.** **Step 2: Run** `npx vitest run lib/help/coverage` → PASS.
- [ ] **Step 3: GATE — ask the user** before the first index run (writes `WikiChunk` rows to the production DB and calls Gemini): «Να τρέξω την ευρετηρίαση του wiki (≈N chunks, Gemini embeddings);». On yes: `npx tsx --env-file=.env scripts/index-wiki.ts` → prints `{ articles, chunks, embedded, deleted, keywordOnly:false }`; `npx tsx --env-file=.env -e` check `select count(*) from "WikiChunk" where embedding is not null` > 0 (via a one-off script in the scratchpad).
- [ ] **Step 4: Commit** `docs(wiki): per-page guides for the collaborator surface`.

### Task 19: End-to-end verification, docs, memory

**Files:**
- Modify: `docs/wiki/README.md` (document `pages/` frontmatter, `:::roles`, indexer, help button/hub), `lib/rbac/registry.ts` is NOT changed (no new modules needed; help modules exist).
- Create: memory file `/Users/kozyris/.claude/projects/-Volumes-EXTERNALSSD-propertymanagement/memory/project_ai_assistant.md` + line in `MEMORY.md`; update `project_ai_onboarding_wizard.md` «Future extensions» line to point at the assistant.

- [ ] **Step 1:** `npx tsc --noEmit` → no output; `npm run lint` → clean; `npm run test` → all green (count tests).
- [ ] **Step 2: Browser tour (reads/previews only)** on `localhost:3002`: (a) super-admin `/admin/maintenance`: Help drawer shows «Βλάβες & συντηρήσεις», «Ρώτα τον βοηθό» opens the assistant with the prompt; (b) ask «Πώς στέλνω αίτημα προσφοράς;» → steps + link to `/admin/maintenance/[id]` article/page; (c) View-as PROPERTY_ADMIN on `/building/<id>`: Help drawer shows the building guide with manager blocks; ask «Ποιες ανακοινώσεις έστειλα τον τελευταίο μήνα;» → only that manager's building; (d) View-as COLLABORATOR `/marketplace`: assistant answers about their RFQs only; (e) phone viewport (`resize_window` mobile): both drawers are bottom sheets, FABs not overlapping the quick-actions button; (f) `/staff/help?q=κοινόχρηστα` returns results with working «Άνοιγμα σελίδας». Screenshots saved; no console errors.
- [ ] **Step 3: Write docs + memory.** **Step 4: Commit** `docs: wiki authoring guide for per-page articles; assistant memory notes`.
- [ ] **Step 5: Report** to the parent session: commits, what was verified, what was intentionally not executed locally (write confirmations), and the two gates' outcomes.
