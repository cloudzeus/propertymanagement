# Spec: Role-aware AI assistant (RAG + actions) and per-page wiki/help

**Date:** 2026-10-20
**Status:** Approved (brainstorming)
**Builds on:** [2026-06-21-ai-agent-core-onboarding-wizard-design.md](2026-06-21-ai-agent-core-onboarding-wizard-design.md) (DeepSeek core, no Vercel SDK), dynamic RBAC, BuildingCaps, data-isolation rules.

## Σκοπός

1. Ένας γενικός βοηθός (chat drawer) διαθέσιμος σε **κάθε surface και ρόλο** — company (SUPER_ADMIN/ADMIN/MANAGER/EMPLOYEE), customer (PROPERTY_ADMIN/OWNER/RESIDENT/VIEWER), marketplace (COLLABORATOR). Ξέρει ποιος είναι ο χρήστης (effective session, View-as), πού βρίσκεται (route, building/unit/request ids) και απαντά **μόνο** με δεδομένα που ο ρόλος δικαιούται.
2. **RAG μνήμη**, υβριδική: ζωντανά δεδομένα χρήστη μέσω role-scoped Prisma read-tools (ποτέ embeddings προσωπικών δεδομένων), pgvector embeddings μόνο για το wiki/help, persisted ιστορικό συνομιλιών ανά χρήστη.
3. **Ενέργειες για λογαριασμό του χρήστη** με tool-calling πάνω στα ΥΠΑΡΧΟΝΤΑ server actions, με υποχρεωτικό preview → ρητή επιβεβαίωση (κάρτα με κουμπιά) → εκτέλεση → audit log.
4. **Wiki ανά σελίδα** (ένα άρθρο ανά σελίδα/λειτουργία, αντιστοίχιση route → άρθρο → ρόλοι), κουμπί «Βοήθεια» σε κάθε σελίδα, κεντρικός κόμβος με πλοήγηση ανά ρόλο και αναζήτηση. Τα άρθρα τροφοδοτούν το RAG.

## Αποφάσεις (locked)

| Θέμα | Απόφαση |
|---|---|
| Retrieval | Υβριδικό: Prisma read-tools για δεδομένα χρήστη· pgvector (ext `vector` 0.8.7, ήδη διαθέσιμο στον PostgreSQL 16) + Gemini `gemini-embedding-001` (768 dims) μόνο για wiki. Fallback σε keyword (ILIKE/pg_trgm) αν λείπει κλειδί ή extension. |
| Wiki source | Markdown αρχεία `docs/wiki/pages/<slug>.md` με frontmatter. Επέκταση του υπάρχοντος file-based `lib/help.ts`, όχι δεύτερο σύστημα. Ελληνικά μόνο (v1). |
| Confirm UX | Κάρτα προεπισκόπησης με «Επιβεβαίωση» / «Ακύρωση». Η εκτέλεση γίνεται ΜΟΝΟ από το κουμπί (server action με re-validation), ποτέ από κείμενο του μοντέλου. |
| Write tools v1 | Βλάβη (όλοι οι ρόλοι), Ανακοίνωση, Δαπάνη κτιρίου, Εργασία συντήρησης (recurring task), RFQ. |
| Μοντέλο | DeepSeek `deepseek-chat` για chat/tools (υπάρχων provider, cost-tracked). Gemini μόνο για embeddings. |
| Drawer | Δεξί drawer 420px (bottom sheet σε κινητό) από FAB κάτω-δεξιά. Οι quick actions μένουν κάτω-αριστερά. |
| Wizard | Ο υπάρχων onboarding wizard, το `/api/ai/agent`, το `useAiChat` μένουν ανέγγιχτα. |
| DB | Νέα migration με `migrate diff` + `migrate deploy` (ποτέ `migrate dev`). Η migration περιλαμβάνει `CREATE EXTENSION IF NOT EXISTS vector;` (ο DB user είναι superuser). |
| Τοπική δοκιμή | Το τοπικό DATABASE_URL είναι η παραγωγή: δοκιμάζονται ΜΟΝΟ reads + previews στον browser· η εκτέλεση write tools δοκιμάζεται σε Vitest με mocked actions. Καμία seed/test εγγραφή, κανένα notification. |

---

## 1. Δομή κώδικα

```
lib/ai/assistant/
  context.ts        buildAssistantContext(eff, page) → AssistantContext (role, surface, perms, scope, page)
  page-context.ts   parsePageContext(pathname, search) → { path, buildingId?, requestId?, unitId?, tab? }  (pure)
  prompt.ts         buildSystemPrompt(ctx, wikiChunks) (pure)
  loop.ts           runAssistantTurn({ ctx, conversation, userText }) → SSE ReadableStream  (server-side tool loop)
  retrieval.ts      retrieveWiki(query, role, limit) → WikiChunk[]  (vector → keyword fallback)
  embeddings.ts     embedTexts(texts[]) via Gemini, logAPIUsage("gemini")
  indexer.ts        indexWiki() → chunks docs/wiki/**, hash, embed changed, upsert WikiChunk
  chunker.ts        chunkMarkdown(md, meta) (pure)
  conversations.ts  load/append/summarize conversation (Prisma)
  actions.ts        proposeAction / confirmAction / cancelAction (AiActionLog state machine)
lib/ai/tools/
  types.ts          AssistantTool<TArgs> = { name, description, kind: "read"|"write", roles: UserRole[], schema: ZodType, run | preview+execute }
  registry.ts       TOOLS[], toolsForRole(role, perms), toJsonSchema()
  read/*.ts         my-buildings, building-overview, faults, announcements, my-balance, expenses, calendar-tasks, wiki-search
  write/*.ts        create-fault, create-announcement, create-expense, create-recurring-task, create-rfq
app/api/ai/assistant/route.ts        POST { conversationId?, message, page }
app/actions/ai-assistant.ts          confirmAiAction, cancelAiAction, listMyConversations, deleteConversation, reindexWiki (super-admin)
hooks/useAssistantChat.ts
components/assistant/AssistantDrawer.tsx (+ MessageList, ConfirmCard, ToolChip, ConversationList, SuggestedPrompts)
components/help/HelpButton.tsx, HelpDrawer.tsx, WikiHub.tsx (επέκταση HelpCenter)
lib/help.ts (επέκταση) + lib/help/{frontmatter.ts, index.ts, match.ts, roles-filter.ts, coverage.ts}
docs/wiki/pages/*.md
scripts/index-wiki.ts, scripts/check-wiki-coverage.ts
```

Ό,τι είναι pure (page-context, prompt, chunker, frontmatter, match, roles-filter, registry filtering, state machine helpers) μπαίνει σε αρχεία χωρίς `server-only`/Prisma imports ώστε να τεστάρεται με Vitest (όπως `lib/rbac/permissions-core.ts`).

## 2. Context & isolation

`AssistantContext`:
```ts
{
  user: { id, name, email, role, roleId, customerId, companyId }, real: { id, role }, impersonating: boolean,
  surface: "company"|"customer"|"marketplace",
  perms: Set<string>,                                   // getEffectivePermissions()
  scope: { managerBuildingIds?: string[]; occupantUnits?: {unitId, buildingId, buildingName, unitNumber, role}[]; supplierId?: string|null; seesAllCustomers: boolean },
  page: { path, buildingId?, buildingName?, requestId?, unitId?, tab? },   // buildingId μόνο αν getBuildingAccess(user, id) != null
}
```
- Staff: `seesAllCustomers=true`, κανένα pre-loaded building· τα read tools δέχονται ids/ονόματα και επιστρέφουν bounded λίστες (≤20).
- PROPERTY_ADMIN: `managerBuildingIds()` + occupant units. OWNER/RESIDENT/VIEWER: μόνο occupant units (ίδιο query με το AppShell). COLLABORATOR: `supplierId`.
- Κάθε read tool: (α) δηλώνει `roles`, (β) η registry το αφαιρεί από τη λίστα του μοντέλου αν ο ρόλος δεν επιτρέπεται, (γ) μέσα του καλεί τους ίδιους guards με το UI (`requireBuildingView`, `canAccessRequest`, `customerWhere`, `requireBuildingCap(…, "viewLedger")`). Αποτυχία guard → tool result `{ error: "Δεν έχετε πρόσβαση" }` (όχι throw/redirect).
- Σε View-as: `eff.user` είναι ο impersonated χρήστης· τα tools τρέχουν ως αυτός. `AiConversation.actorId` κρατά τον πραγματικό super-admin.

### Read tools (v1)
| name | roles | επιστρέφει |
|---|---|---|
| `listMyBuildings` | όλοι | κτήρια στο scope (staff: αναζήτηση με `q`, ≤20) |
| `getBuildingOverview` | όλοι με access | όνομα/διεύθυνση/μονάδες/διαχειριστής/θέρμανση· occupant → χωρίς οικονομικά τρίτων |
| `listFaults` | όλοι | βλάβες στο scope (occupant: δικές του + κοινόχρηστες του κτηρίου· collaborator: ανατεθειμένες), φίλτρα status/buildingId |
| `listAnnouncements` | όλοι | ανακοινώσεις κτηρίου (occupant: μόνο όσες τον αφορούν) |
| `getMyBalance` | OWNER/RESIDENT/PROPERTY_ADMIN(occupant) | υπόλοιπο & τελευταίες δόσεις ανά μονάδα (`lib/building/statement`) |
| `listExpenses` | staff, manager με viewLedger | δαπάνες κτηρίου ανά μήνα |
| `listCalendarTasks` | staff, manager, occupant (read) | recurring tasks/επόμενες συντηρήσεις κτηρίου |
| `searchWiki` | όλοι | top-5 chunks (ρόλος-φιλτραρισμένα) με link σελίδας |

## 3. RAG

- **Πίνακας `WikiChunk`**: `id, slug, title, heading, anchor, route, roles String[], surface, content Text, hash, embedding Unsupported("vector(768)")?, updatedAt`. Index HNSW cosine (`CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)`). Raw SQL (`$queryRaw`/`$executeRaw`) επιτρέπεται ΜΟΝΟ σε αυτόν τον πίνακα (δεν περιέχει προσωπικά δεδομένα).
- **Indexer**: διαβάζει `docs/wiki/pages/*.md` + τα υπάρχοντα manuals/flows, κόβει ανά H2 (max ~1200 chars, split σε H3 αν μεγαλύτερο), υπολογίζει sha256, embed μόνο τα chunks με νέο hash, διαγράφει τα ορφανά. Τρέχει: `npx tsx --env-file=.env scripts/index-wiki.ts` και κουμπί «Επανευρετηρίαση wiki» στο `/super-admin/ai-tools` (server action `reindexWiki`, super-admin only), που δείχνει πλήθος chunks/ενημερωμένα/κόστος.
- **Embeddings**: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents` (batch ≤100), `outputDimensionality: 768`, `taskType: RETRIEVAL_DOCUMENT` για chunks / `RETRIEVAL_QUERY` για ερωτήσεις. Κάθε κλήση → `logAPIUsage({ apiName: "gemini", endpoint: "/embedContent", model: "gemini-embedding-001", tokensUsed })`.
- **Ανάκτηση ανά turn**: embed της ερώτησης → `ORDER BY embedding <=> $1 LIMIT 5` με `roles && $2` → chunks στο system prompt ως «Γνώση από το wiki» με `route`. Αν `GEMINI_API_KEY` λείπει ή το extension δεν υπάρχει → `ILIKE` σε title/heading/content (unaccent-insensitive μέσω `lower()` + απλό tokenization).
- **Μνήμη συνομιλίας**: τα τελευταία 20 μηνύματα της συνομιλίας + `AiConversation.summary` (ανανεώνεται από το μοντέλο κάθε 10 μηνύματα, ξεχωριστή non-streaming κλήση). Λίστα συνομιλιών ανά χρήστη, resume, διαγραφή. Cross-conversation vector memory: v2.

## 4. Orchestration loop (`loop.ts`)

1. Route handler: auth (`getEffectiveSession`), wallet gate για customer roles (`eff.user.customerId` → `getWalletBalance` ≤0 → 402 `wallet_empty`), body `{ conversationId?, message, page }`.
2. Φόρτωση/δημιουργία `AiConversation` (ownership check: `userId === eff.user.id`), append `AiMessage(user)`.
3. `buildAssistantContext`, `retrieveWiki(message)`, `buildSystemPrompt`.
4. Loop (max 4 γύροι): κλήση DeepSeek με `stream:true` και `tools = toolsForRole(ctx)`. Tokens → SSE `token`. Tool calls (accumulate by index) → όταν ολοκληρωθεί η απάντηση:
   - read tool → SSE `tool_status {name, state:"running"}` → execute → SSE `tool_status {state:"done"}` → append `tool` message με JSON result → επόμενος γύρος.
   - write tool → zod parse + role check + `preview(args, ctx)` (ανάλυση ονομάτων→ids, π.χ. κτήριο από όνομα, κατηγορία δαπάνης) → `AiActionLog` PROPOSED → SSE `confirm { actionId, tool, title, summaryLines[], warnings[] }` → tool message «Η προεπισκόπηση εμφανίστηκε· περίμενε επιβεβαίωση του χρήστη» → το μοντέλο κλείνει τον γύρο με 1 πρόταση. Ένα write proposal ανά turn.
5. Τέλος: append `AiMessage(assistant)` (content + toolCalls JSON), SSE `meta {conversationId, messageId}`, `done`. Σφάλμα → SSE `error` + `done`.

Prompt κανόνες (ελληνικά): απάντα μόνο από tool results/wiki, ποτέ μην μαντεύεις ποσά ή ονόματα· αν λείπει δικαίωμα πες το καθαρά· για «πώς κάνω Χ» δώσε βήματα + link `route`· για ενέργεια κάλεσε το write tool με όλα τα γνωστά πεδία, ρώτα μόνο τα υποχρεωτικά που λείπουν· μην αφηγείσαι τις κλήσεις εργαλείων.

## 5. Write tools & επιβεβαίωση

Registry entry:
```ts
type WriteTool<A> = { name; description; kind: "write"; roles; schema: z.ZodType<A>;
  preview(args: A, ctx): Promise<{ title; summaryLines: string[]; warnings?: string[]; resolved: Record<string, unknown>; buildingId?: string }>;
  execute(resolved, ctx): Promise<{ ok: true; message: string; href?: string } | { ok: false; error: string }> }
```
| tool | roles | server action | preview δείχνει |
|---|---|---|---|
| `createFaultReport` | όλοι | `createMaintenanceRequest` | κτήριο, μονάδα/κοινόχρηστος χώρος, τίτλος, περιγραφή, κατηγορία, προτεραιότητα, ποιος αναλαμβάνει (resolveResponsibility) |
| `createAnnouncement` | staff, PROPERTY_ADMIN | `createAnnouncement` | κτήριο(α), κοινό (ALL/OWNERS/RESIDENTS), θέμα, κείμενο, πλήθος παραληπτών, «θα σταλεί email» |
| `createBuildingExpense` | staff, PROPERTY_ADMIN με manageExpenses | `createBuildingExpense` | κτήριο, μήνας, κατηγορία, ποσό, προμηθευτής, split ενοικιαστή/ιδιοκτήτη, πληρωμένο; (χωρίς αρχείο/OCR) |
| `createRecurringTask` | staff, PROPERTY_ADMIN με manageCalendar | `createRecurringTask` | κτήριο, τίτλος, συχνότητα, επόμενη ημερομηνία, είδος, υπενθύμιση |
| `createRfq` | SUPER_ADMIN/ADMIN/MANAGER με suppliers:edit | `createRfq` | βλάβη, συνεργάτες (ονόματα→ids από registry, ενεργοί), προθεσμία, «θα ειδοποιηθούν Ν συνεργάτες» |

Κατάσταση `AiActionLog.status`: `PROPOSED → EXECUTED | FAILED | CANCELLED | EXPIRED` (15 λεπτά). `confirmAiAction(actionId)`: effective session, `log.userId === eff.user.id`, status PROPOSED, όχι ληγμένο → re-parse args με zod → re-run `preview` (τα ids ξαναεπαληθεύονται με τους guards) → `execute` (καλεί το υπάρχον action, που επιβάλλει τα δικά του RBAC/caps/notifications) → ενημέρωση log (`resultJson`, `executedAt`, `actorId`) → append `AiMessage(tool)` «✔ Δημιουργήθηκε … [href]» → επιστρέφει το μήνυμα στο UI. `cancelAiAction` → CANCELLED. Ο audit είναι ο ίδιος ο πίνακας: `userId`, `actorId` (View-as), `conversationId`, `toolName`, `argsJson`, `previewJson`, `resultJson`, `error`, `buildingId`, χρόνοι. Εμφανίζεται ως read-only DataTable στο `/super-admin/ai-tools` («Ενέργειες βοηθού»).

## 6. UI

- `AssistantDrawer` (client, mounted μία φορά στο `AppShell`): FAB κάτω-δεξιά (`RiRobot2Line`), drawer 420px (`position:fixed; right:0`, ≤767px: bottom sheet 85vh). Header: τίτλος «Βοηθός Orithon», κουμπιά «Νέα συνομιλία», «Ιστορικό» (`RiHistoryLine`), κλείσιμο. Σώμα: μηνύματα (markdown μέσω `Markdown`), chips εργαλείων («Αναζήτηση στο wiki…», «Ανάγνωση βλαβών…»), `ConfirmCard` (τίτλος, γραμμές, warnings, κουμπιά Επιβεβαίωση/Ακύρωση· μετά: αποτέλεσμα + link), `SuggestedPrompts` από το άρθρο της τρέχουσας σελίδας (`prompts` frontmatter) όταν η συνομιλία είναι κενή. Input + αποστολή με Enter. Escape κλείνει. Το page context στέλνεται με κάθε μήνυμα (`parsePageContext(usePathname(), useSearchParams())`).
- `useAssistantChat({ conversationId })`: όπως `useAiChat` αλλά με events `token | tool_status | confirm | meta | error | done`, `confirm(actionId)` / `cancel(actionId)` μέσω server actions, `loadConversation(id)`, `newConversation()`.
- Mobile: touch targets ≥44px, input `font-size:max(1rem,1em)`. Icons μόνο `react-icons/ri` *Line. Fluid `--fs-*`.

## 7. Wiki ανά σελίδα + help

- **Αρχείο ανά σελίδα**: `docs/wiki/pages/<slug>.md`
  ```md
  ---
  title: Βλάβες & συντηρήσεις (εταιρεία)
  route: /admin/maintenance            # pattern· δυναμικά segments ως [id]; tab σελίδες: /building/[id]?s=maintenance
  roles: [SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE]
  surface: company
  area: operations                     # ομάδα στο hub (core/management/financials/operations/settings/cms/assets/services/…)
  summary: Μία πρόταση για τη λίστα και το RAG.
  prompts: ["Ποιες βλάβες είναι ανοιχτές σήμερα;", "Δήλωσε βλάβη στο …"]
  related: [admin-maintenance-detail, staff-calendar]
  ---
  ## Τι βλέπετε εδώ
  ## Βήμα-βήμα
  :::roles PROPERTY_ADMIN
  (κείμενο μόνο για διαχειριστές)
  :::
  ## Συχνές ερωτήσεις
  ```
  Συμβάσεις γραφής όπως στο `docs/wiki/README.md` (ονόματα κουμπιών σε εισαγωγικά, «Πού το βρίσκω», χωρίς τεχνικούς όρους). Κάλυψη: ΟΛΕΣ οι σελίδες των app/(company), app/(customer), app/(marketplace), app/print, app/(signage), app/report (≈100 άρθρα). Οι σελίδες με tabs (`/building/[id]?s=…`, `/super-admin/buildings/[id]`) έχουν ένα άρθρο με ενότητα ανά tab και anchor.
- **`lib/help`**: `loadWikiIndex()` (parse frontmatter όλων των pages, cache ανά process, invalidate σε dev), `articleForRoute(pathname, search, role)` (pattern match με `[id]`, πιο ειδικό πρώτα, φίλτρο ρόλου, `?s=` → anchor), `searchArticles(q, role)` (title/summary/headings, client-side αρκετό), `filterRoleBlocks(md, role)` (αφαιρεί `:::roles` blocks που δεν περιλαμβάνουν τον ρόλο, πριν το render), `listArticlesForRole(role)` ομαδοποιημένα ανά surface/area.
- **Help button**: `HelpButton` (client) δίπλα στο assistant FAB (κάτω-δεξιά, αριστερά του) → `HelpDrawer` που φορτώνει `GET /api/help/article?path=…&s=…` (role-filtered markdown) και δείχνει: τίτλο, περιεχόμενο (Markdown+Mermaid), «Άνοιγμα στο Wiki» (hub με `?a=slug`), «Ρώτα τον βοηθό» (ανοίγει το drawer με prompt). Αν δεν υπάρχει άρθρο για τη διαδρομή → fallback στο εγχειρίδιο ρόλου + αναζήτηση.
- **Hub**: τα τρία `/staff/help`, `/portal/help`, `/marketplace/help` αποκτούν (α) αριστερά: «Οδηγός ανά σελίδα» (accordion ανά area, φιλτραρισμένο στον ρόλο) + «Εγχειρίδια» (τα υπάρχοντα) + «Ροές», (β) αναζήτηση (`?q=`), (γ) άρθρο με κουμπί «Άνοιγμα σελίδας» (η `route` με `[id]` → το πρώτο κτήριο/αντικείμενο στο scope αν υπάρχει, αλλιώς η λίστα-γονέας). Νέο `app/help/page.tsx` κάνει redirect στο hub του ρόλου.
- **Coverage test** `lib/help/coverage.test.ts`: σαρώνει `app/**/page.tsx` (εκτός `[locale]`, `(auth)`, `api`) και αποτυγχάνει αν λείπει άρθρο με αντίστοιχο `route`.
- Ο indexer ευρετηριάζει pages + manuals + flows· το `searchWiki` tool και το αυτόματο retrieval επιστρέφουν `route` ώστε ο βοηθός να λέει «πώς» με link.

## 8. Prisma

```prisma
model AiConversation { id String @id @default(cuid()); userId String; actorId String?; role String; surface String; title String?; summary String? @db.Text; pagePath String?; createdAt DateTime @default(now()); updatedAt DateTime @updatedAt; lastMessageAt DateTime @default(now()); messages AiMessage[]; actions AiActionLog[]; user User @relation(...) ; @@index([userId, lastMessageAt]) }
model AiMessage { id String @id @default(cuid()); conversationId String; role String; content String @db.Text; toolCalls Json?; toolName String?; createdAt DateTime @default(now()); conversation AiConversation @relation(..., onDelete: Cascade); @@index([conversationId, createdAt]) }
model AiActionLog { id String @id @default(cuid()); conversationId String?; userId String; actorId String?; toolName String; argsJson Json; previewJson Json; resultJson Json?; status String @default("PROPOSED"); error String?; buildingId String?; createdAt DateTime @default(now()); expiresAt DateTime; executedAt DateTime?; @@index([userId, createdAt]); @@index([status, expiresAt]) }
model WikiChunk { id String @id @default(cuid()); slug String; title String; heading String?; anchor String?; route String?; surface String?; roles String[]; content String @db.Text; hash String; embedding Unsupported("vector(768)")?; updatedAt DateTime @updatedAt; @@unique([slug, anchor]); @@index([slug]) }
```
Migration SQL = `migrate diff` + χειροκίνητη προσθήκη `CREATE EXTENSION IF NOT EXISTS vector;` στην αρχή και του HNSW index στο τέλος. Εφαρμογή με `migrate deploy` **μόνο αφού ο χρήστης το εγκρίνει** (παραγωγή).

## 9. Κόστος & όρια

- Ανά turn: 1 embedding (Gemini, αμελητέο) + 1–4 DeepSeek κλήσεις. Όλα μέσω `logAPIUsage` με `userId`/`customerId` ώστε να φαίνονται στο `/super-admin/settings/costs` και στα πορτοφόλια (wallet gate για customer roles).
- Μήνυμα χρήστη ≤ 4.000 chars· tool results ≤ ~6 KB (περικοπή με «… και Ν ακόμη»).
- Rate limit: 30 turns/λεπτό/χρήστη (in-memory, όπως το realtime bus· single-instance).

## 10. Error handling

- Χωρίς `DEEPSEEK_API_KEY` → SSE error «Ο βοηθός δεν είναι διαθέσιμος». Χωρίς `GEMINI_API_KEY` → keyword fallback σιωπηλά (log once).
- Tool error/guard → tool result με `error`, το μοντέλο το εξηγεί· ποτέ 500.
- Confirm σε ληγμένο/ξένο/μη-PROPOSED proposal → `{ error }`, η κάρτα δείχνει «Η πρόταση έληξε — ζητήστε την ξανά».
- Action που ρίχνει `Error` → status FAILED με `error`, μήνυμα στον χρήστη.

## 11. Testing & verification

- Vitest (pure): `page-context`, `prompt` (περιέχει κανόνες + chunks), `chunker` (κοπή/hash σταθερό), `frontmatter`+`match` (ειδικότητα, `[id]`, `?s=`), `roles-filter`, `registry` (`toolsForRole` αφαιρεί write tools χωρίς perm, zod errors), `actions` state machine (mocked db + mocked action: PROPOSED→EXECUTED, expired, wrong user, cancel), `sse` νέα events, `coverage`.
- `npx tsc --noEmit`, `npm run lint`, `npm run test` καθαρά.
- Browser (localhost:3002, View-as για κάθε ρόλο): drawer ανοίγει σε company/customer/marketplace, ερώτηση δεδομένων επιστρέφει μόνο scope του ρόλου, ερώτηση «πώς» επιστρέφει βήματα + link, write tool δείχνει κάρτα (ΔΕΝ πατιέται Επιβεβαίωση τοπικά), help button ανοίγει το σωστό άρθρο σε ≥6 σελίδες, hub αναζήτηση + «Άνοιγμα σελίδας».

## 12. Εκτός scope (v2)

Cross-conversation vector memory, en μεταφράσεις wiki, voice, επεξεργασία/διαγραφή εγγραφών μέσω βοηθού, upload αρχείων στο chat, streaming του summary, Redis rate-limit για multi-instance.
