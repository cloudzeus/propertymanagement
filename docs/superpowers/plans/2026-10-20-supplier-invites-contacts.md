# Supplier RFQ invite links, contacts with access, contract e-acceptance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Company roles send RFQs to registry suppliers by branded email with a one-time signed link; suppliers activate/log in from the link and offer; the company manages supplier contacts with optional marketplace access; suppliers e-accept contract B with name/IP/time.

**Architecture:** Two new Prisma models (`SupplierContact`, `SupplierInviteLink`) plus small columns on `RfqInvitation`/`WorkOrder`. A server-only `lib/supplier-invites.ts` owns token issue/resolve (sha256 at rest). The existing `app/actions/rfq.ts` flow is extended (recipients → links → emails); new actions file `app/actions/supplier-contacts.ts`; new pages `/staff/rfq` (company) and `/invite/[token]` (public, under `(auth)`). Emails are pure functions in `lib/emails/supplier-invites.ts` rendered through `renderEmail`.

**Tech Stack:** Next.js 16.2 (proxy.ts, server actions, `headers()`), Prisma 7/PostgreSQL (migrate diff + deploy), Auth.js v5 credentials, bcryptjs, vitest, react-icons/ri, `components/ui/data-table.tsx`, `components/ui/modal.tsx`.

**Spec:** `docs/superpowers/specs/2026-10-20-supplier-invites-contacts-design.md`

## Global Constraints

- Local `DATABASE_URL` is PRODUCTION; Mailgun live but `EMAIL_REDIRECT_TO` set. Never create test rows without user approval; never `prisma migrate dev` (use `migrate diff` → SQL file → `migrate deploy`).
- Greek UI, icons only `react-icons/ri` `*Line`, font sizes only `var(--fs-*)`, DataTable from `components/ui/data-table.tsx`, modals from `components/ui/modal.tsx`.
- Emails only via `renderEmail`/`renderText` (`lib/email-template.ts`) and `lib/mailgun.ts`; never a password in an email.
- RBAC via `requirePermission` / `can(perms, key, action)`; only ADD the `rfq` module to `lib/rbac/registry.ts` (parallel session reorganises that file).
- Token: 32 random bytes base64url; DB stores `sha256` hex only; expiry 14 days; activation one-use.
- One User per email (`project_customer_role_hierarchy`); never create a second User for an email.
- Known pre-existing failures to ignore: 2 tsc errors in `app/api/super-admin/costs/*`, `lib/building-caps.test.ts`, ~340 repo lint errors (lint only the files you touch).

## Review Focus

1. A supplier with NO email anywhere (no contacts, no `Supplier.email`): invite row must show «χωρίς email», no crash, no link issued — test in Task 5.
2. Same email invited twice for one invitation (resend): old link must resolve as `revoked`, new one `ok` — test in Task 2.
3. Activation link used after the user already set a password through another link: must redirect to login, not create a duplicate user — test in Task 8.
4. Contact email belonging to a PROPERTY_OWNER user: `saveSupplierContact(access:"invite")` must return the explicit error and create nothing — test in Task 9.
5. Expired RFQ deadline with invitation still `INVITED`: state must be ΕΛΗΞΕ and resend disabled — test in Task 4.

---

### Task 1: Prisma models, migration, RBAC key

**Files:**
- Modify: `prisma/schema.prisma` (Supplier, User, RfqInvitation, WorkOrder blocks; new models + enum)
- Create: `prisma/migrations/20261020150000_supplier_invites_contacts/migration.sql`
- Modify: `lib/rbac/registry.ts` (one module line + `rfq` in 4 role defaults)

**Interfaces:**
- Produces: `db.supplierContact`, `db.supplierInviteLink`, enum `SupplierInviteKind { RFQ_INVITE CONTACT_ACTIVATION }`, columns `RfqInvitation.lastEmailAt DateTime?`, `RfqInvitation.emailCount Int @default(0)`, `WorkOrder.supplierAcceptedIp/Ua/Name String?`, `User.contact SupplierContact?`, `Supplier.contactPeople SupplierContact[]`, `Supplier.inviteLinks SupplierInviteLink[]`, `RfqInvitation.links SupplierInviteLink[]`, `SupplierContact.links SupplierInviteLink[]`. RBAC module key `"rfq"`.

- [ ] **Step 1: Add schema per spec §3** (`SupplierContact` fields: name, position?, phone?, mobile?, email?, isPrimary, receivesRfq, active, notes? @db.Text, userId? @unique, createdById?, timestamps; `SupplierInviteLink` fields: tokenHash @unique, kind, supplierId, email, rfqInvitationId?, contactId?, expiresAt, sentAt, sentCount, openedAt?, usedAt?, revokedAt?, createdById?; indexes as spec). Relation name on Supplier: `contactPeople` (the existing `contacts Contact[]` stays).
- [ ] **Step 2: Generate SQL**
  Run: `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script > prisma/migrations/20261020150000_supplier_invites_contacts/migration.sql`
  Expected: SQL with CREATE TYPE, 2 CREATE TABLE, ALTER TABLE for RfqInvitation/WorkOrder. Append the backfill:
  ```sql
  INSERT INTO "SupplierContact" ("id","supplierId","name","email","phone","mobile","isPrimary","receivesRfq","active","userId","createdAt","updatedAt")
  SELECT 'sc_' || substr(md5(u."id"), 1, 24), u."supplierId", COALESCE(u."name", u."email"), u."email", u."phone", u."mobile", u."isSupplierAdmin", true, u."status" = 'ACTIVE', u."id", now(), now()
  FROM "User" u WHERE u."role" = 'COLLABORATOR' AND u."supplierId" IS NOT NULL;
  ```
- [ ] **Step 3: Apply + generate**
  Run: `npx prisma migrate deploy && npx prisma generate`
  Expected: "1 migration applied"; `npx prisma migrate status` → up to date.
- [ ] **Step 4: Registry** — add after the `work-orders` line:
  `{ key: "rfq", label: "Αιτήματα προσφοράς", surface: "company", menu: { href: "/staff/rfq", icon: "RiMailSendLine", group: "operations" }, actions: [...CRUD] },`
  and `"rfq"` inside the `crud(...)` list of ADMIN, MANAGER, EMPLOYEE (SUPER_ADMIN gets `all()`).
- [ ] **Step 5: Backfill roles** Run: `npx tsx --env-file=.env prisma/seed-rbac.ts` Expected: `backfilled ADMIN: [rfq]`, same for MANAGER, EMPLOYEE.
- [ ] **Step 6: Commit** `git add prisma lib/rbac/registry.ts && git commit -m "feat(suppliers): SupplierContact + SupplierInviteLink models, rfq RBAC module"`

### Task 2: Invite link core (`lib/supplier-invites.ts`)

**Files:**
- Create: `lib/supplier-invites.ts`, `lib/supplier-invites-shared.ts` (pure: `hashInviteToken`, `INVITE_TTL_DAYS = 14`, `inviteUrl(token, siteUrl)`), `lib/supplier-invites.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type InviteKind = "RFQ_INVITE" | "CONTACT_ACTIVATION";
  export async function issueInviteLink(i: { kind: InviteKind; supplierId: string; email: string; rfqInvitationId?: string | null; contactId?: string | null; createdById?: string | null }): Promise<{ linkId: string; url: string; expiresAt: Date }>;
  export type ResolvedInvite = { status: "invalid" | "expired" | "revoked" | "used" } | { status: "ok"; link: { id: string; kind: InviteKind; email: string; supplierId: string; rfqId: string | null; contactId: string | null; expiresAt: Date }; supplierName: string };
  export async function resolveInviteLink(token: string, opts?: { markOpened?: boolean }): Promise<ResolvedInvite>;
  export async function markInviteUsed(linkId: string): Promise<void>;
  export async function revokeInviteLinks(where: { rfqInvitationId?: string; contactId?: string; email?: string }): Promise<void>;
  ```
  Uses `absoluteUrl` from `lib/email-template.ts` for the base; `getEmailBrand()` for siteUrl.

- [ ] **Step 1: Tests** (mock `@/lib/db` with `vi.mock`, in-memory array):
  `issueInviteLink revokes earlier active links for the same target+email`, `resolveInviteLink returns expired when expiresAt < now`, `returns revoked for revoked link`, `returns used when usedAt set`, `ok marks openedAt once and sets RfqInvitation.viewedAt for RFQ_INVITE`, `token never stored in plain form (tokenHash === sha256(token))`.
- [ ] **Step 2: Run** `npx vitest run lib/supplier-invites.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** per Interfaces. `rfqId` on resolve comes from `link.rfqInvitation.rfqId`.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(suppliers): signed one-time invite links`.

### Task 3: Branded emails

**Files:**
- Create: `lib/emails/supplier-invites.ts`, `lib/emails/supplier-invites.test.ts`
- Modify: `lib/mailgun.ts` (add `sendBrandedEmail`)

**Interfaces:**
- Produces (pure, client-safe except brand lookup done by caller):
  ```ts
  export type Mail = { subject: string; html: string; text: string };
  export function rfqInvitationEmail(p: { brand: EmailBrand; supplierName: string; title: string; buildingLabel: string; deadlineAt: Date | null; surveyRequired: boolean; url: string; recipientHasAccount: boolean }): Mail;
  export function contactInvitationEmail(p: { brand: EmailBrand; supplierName: string; contactName: string; url: string }): Mail;
  export function contractSignedStaffEmail(p: { brand: EmailBrand; woNumber: string; title: string; supplierName: string; signatory: string; url: string }): Mail;
  export function contractSignedSupplierEmail(p: { brand: EmailBrand; woNumber: string; title: string; signatory: string; url: string }): Mail;
  ```
  `lib/mailgun.ts`: `export async function sendBrandedEmail(to: string, mail: Mail, tags: string[]): Promise<EmailResponse>` (uses `brandedFrom(brand.name)`).
  Copy fixed by spec: eyebrow «Αίτημα προσφοράς»; CTA «Δείτε το αίτημα & προσφορά»; afterCta «Το link ισχύει 14 ημέρες και είναι προσωπικό.»; contact CTA «Ορισμός κωδικού»; contact title «Πρόσβαση στο περιβάλλον συνεργατών {{brand.name}}».
- [ ] **Step 1: Tests**: each mail contains `url` in html and text; `rfqInvitationEmail` text contains the deadline formatted `el-GR`; no mail contains the word «κωδικός» followed by a value (assert `!/κωδικός:\s*\S/.test(html)`); subject for RFQ = `Αίτημα προσφοράς: {title}`.
- [ ] **Step 2–5:** run FAIL → implement → PASS → commit `feat(emails): supplier invite and contract e-mails`.

### Task 4: Shared RFQ state + candidate list

**Files:**
- Modify: `lib/rfq-shared.ts` (`invitationState`, `INVITATION_STATE_LABELS/COLORS`, `RfqCandidateDTO`, `RfqInvitationRowDTO`), `lib/rfq-shared.test.ts`
- Create: `lib/rfq-candidates.ts` (server-only), `lib/rfq-candidates.test.ts` (tests the pure filter)

**Interfaces:**
```ts
export type InvitationState = "NO_EMAIL" | "SENT" | "OPENED" | "OFFERED" | "DECLINED" | "EXPIRED";
export function invitationState(i: { status: string; viewedAt: string | null; emailCount: number; hasRecipient: boolean }, rfq: { status: string; deadlineAt: string | null }, now?: Date): InvitationState;
export type RfqCandidateDTO = { id: string; name: string; categories: string[]; categoryIds: string[]; distanceKm: number | null; ratingAvg: number | null; ratingCount: number; score: number; reasons: string[]; hasAccounts: boolean; recipientEmail: string | null; emergency24h: boolean };
export function filterCandidates(rows: RfqCandidateDTO[], f: { q?: string; categoryId?: string | null; maxKm?: number | null; minRating?: number | null; withAccount?: boolean }): RfqCandidateDTO[];
// lib/rfq-candidates.ts
export async function listRfqCandidates(maintenanceRequestId: string): Promise<{ candidates: RfqCandidateDTO[]; categories: { id: string; name: string }[]; defaultCategoryId: string | null }>;
export async function recipientsForSupplier(supplierId: string): Promise<{ email: string; userId: string | null; contactId: string | null }[]>;
```
`recipientsForSupplier` = active COLLABORATOR users ∪ active contacts with `receivesRfq && email` ∪ `Supplier.email` ∪ `Supplier.contactEmail`, lowercased, deduped (first occurrence wins so userId/contactId are kept).
- [ ] **Step 1: Tests** for `invitationState` (6 cases from spec §5.4 incl. Review Focus 5: deadline yesterday + INVITED → EXPIRED) and `filterCandidates` (maxKm keeps null-distance rows out when a limit is set; minRating excludes unrated).
- [ ] **Step 2–5:** FAIL → implement (ranking via `rankSuppliers`, same candidate build as `app/(company)/admin/maintenance/[id]/page.tsx:34-62`, moved here and reused by that page) → PASS → commit `feat(rfq): invitation state and ranked candidate list with filters`.

### Task 5: RFQ actions — send with links, resend, add suppliers

**Files:**
- Modify: `app/actions/rfq.ts` (`actor`, `createRfq`, new `resendRfqInvitation`, `addRfqSuppliers`; `cancelRfq` gate), `lib/rfq.ts` (`rfqInclude` adds `links`, `rfqToDTO` adds `emailCount`, `lastEmailAt`, `recipients`; new `listRfqInvitationRows()`), `lib/rfq-shared.ts` (`RfqDTO.invitations[]` fields).
- Create: `lib/rfq-send.ts` (server-only `sendRfqInvitations(rfqId, supplierIds, actorId)`), `lib/rfq-send.test.ts`.

**Interfaces:**
```ts
// lib/rfq-send.ts
export async function sendRfqInvitations(rfqId: string, supplierIds: string[], actorId: string): Promise<{ sent: number; noEmail: string[] }>;
// app/actions/rfq.ts
export async function createRfq(input: CreateRfqInput): Promise<{ id: string } | { error: string }>;   // unchanged signature, now calls sendRfqInvitations
export async function resendRfqInvitation(invitationId: string): Promise<{ ok: true; sent: number } | { error: string }>;
export async function addRfqSuppliers(rfqId: string, supplierIds: string[]): Promise<{ ok: true; sent: number } | { error: string }>;
// lib/rfq.ts
export async function listRfqInvitationRows(): Promise<RfqInvitationRowDTO[]>;  // all invitations, newest first, for /staff/rfq
```
Gate: `isCompany(a) = COMPANY_ROLES.includes(a.role)`; `createRfq`/`addRfqSuppliers` need `can(perms,"rfq","create")`, resend/cancel need `rfq:edit`. Keep `suppliers:edit` only for `forwardOffer`.
- [ ] **Step 1: Test `sendRfqInvitations`** (mock db + `issueInviteLink` + `sendBrandedEmail`): one link+email per recipient; supplier with no recipients → in `noEmail`, `emailCount` stays 0 (Review Focus 1); `emailCount` increments per send.
- [ ] **Step 2–5:** FAIL → implement → PASS → commit `feat(rfq): invitations go out as branded e-mails with personal links; resend and add suppliers`.

### Task 6: SupplierPicker + RfqPanel integration

**Files:**
- Create: `components/suppliers/SupplierPicker.tsx`
- Modify: `components/maintenance/rfq-panel.tsx` (`NewRfqForm` uses picker; invitation chips get state chip + «ξανά» button calling `resendRfqInvitation`; «Προσθήκη συνεργατών» button on OPEN/OFFERED RFQs), `app/(company)/admin/maintenance/[id]/page.tsx` (pass `candidates`, `categories`, `defaultCategoryId` from `listRfqCandidates`; show panel when `can(perms,"rfq","view")`).

**Interfaces:**
```tsx
export function SupplierPicker(p: { candidates: RfqCandidateDTO[]; categories: { id: string; name: string }[]; defaultCategoryId: string | null; selected: Set<string>; onChange: (s: Set<string>) => void; excludeIds?: string[] }): JSX.Element;
```
Filters per spec §5.2 (search, category, km 5/10/25/50/—, rating 3/4/4.5/—, «μόνο με λογαριασμό»); rows show recipient email or «χωρίς email» in `var(--destructive)`.
- [ ] **Step 1: Implement** picker (client, uses `filterCandidates`). **Step 2:** wire RfqPanel. **Step 3:** `npx tsc --noEmit` clean for touched files; `npx eslint components/suppliers/SupplierPicker.tsx components/maintenance/rfq-panel.tsx`. **Step 4:** Commit `feat(rfq): supplier picker with category/distance/rating filters`.

### Task 7: `/staff/rfq` page

**Files:**
- Create: `app/(company)/staff/rfq/page.tsx`, `app/(company)/staff/rfq/RfqInvitationsClient.tsx`
- Modify: `lib/rfq.ts` (`listOpenFaultsForRfq(): Promise<{ id: string; title: string; building: string; createdAt: string }[]>`), `app/actions/rfq.ts` (`loadRfqCandidatesAction(maintenanceRequestId)` wrapper gated by `rfq:create` so the modal can fetch candidates after picking a fault).

- [ ] **Step 1: Page**: `requirePermission("rfq","view")`, loads rows + open faults + perms (`canCreate`, `canEdit`, `isAdminPlus` for fault links).
- [ ] **Step 2: Client**: DataTable `storageKey="staff-rfq"`, `clientSide`, columns per spec §5.5, row actions (resend when state ∈ SENT/OPENED/NO_EMAIL and rfq OPEN/OFFERED; add suppliers; cancel), `expandedContent` = recipients list, toolbar «Νέο αίτημα προσφοράς» → Modal (fault select → `loadRfqCandidatesAction` → `SupplierPicker` → deadline/survey/notes → `createRfq`).
- [ ] **Step 3:** tsc + eslint on the two files. **Step 4:** Commit `feat(rfq): /staff/rfq invitations board for all company roles`.

### Task 8: `/invite/[token]` + activation

**Files:**
- Create: `app/(auth)/invite/[token]/page.tsx`, `app/(auth)/invite/[token]/ActivateForm.tsx`, `app/actions/invite.ts`, `lib/invite-rate-limit.ts` (reuse the limiter pattern from `lib/ai/rate-limit.ts` if generic, else a 30-line sliding window), `app/actions/invite.test.ts`
- Modify: `proxy.ts` (add `"/invite"` to `authPublicPaths`), `components/forms/LoginForm.tsx` (initial email from `?email=`).

**Interfaces:**
```ts
export type InviteView = { kind: "invalid" | "expired" | "used" } | { kind: "login"; loginUrl: string } | { kind: "foreign" } | { kind: "activate"; token: string; email: string; name: string; supplierName: string; target: "rfq" | "marketplace" };
export async function inviteView(token: string): Promise<InviteView>;         // app/actions/invite.ts (server-only helper exported for the page)
export async function activateInvite(token: string, input: { name: string; password: string; confirm: string; agreed: boolean }): Promise<{ error: string } | never>; // redirects on success
```
Decision table = spec §6. `activateInvite` runs `signIn("credentials", { email, password, redirectTo })` from `@/auth`; on `AuthError` return `{ error }`.
- [ ] **Step 1: Tests** (mock db/`resolveInviteLink`/`signIn`): no user → creates COLLABORATOR with `supplierId`, `isSupplierAdmin` true when supplier has no users, links contact, calls `markInviteUsed`; existing same-supplier user with password → view `login` with `callbackUrl=/marketplace/rfq/<id>` (Review Focus 3: and `activateInvite` returns error «Ο λογαριασμός υπάρχει — συνδεθείτε» without creating); PROPERTY_OWNER email → `foreign`; password < 8 → error; mismatch → error.
- [ ] **Step 2–5:** FAIL → implement (page renders card states; ActivateForm uses `components/ui/*` like LoginForm) → PASS → commit `feat(auth): /invite/[token] activation and login hand-off for supplier links`.

### Task 9: Supplier contacts (actions + UI)

**Files:**
- Create: `app/actions/supplier-contacts.ts`, `app/actions/supplier-contacts.test.ts`, `components/suppliers/ContactsEditor.tsx`
- Modify: `lib/suppliers-shared.ts` (`SupplierContactDTO`, `SupplierContactInput`), `lib/suppliers.ts` (`loadSupplierFull` returns `contacts`), `app/(company)/super-admin/suppliers/[id]/page.tsx` (ContactsEditor replaces TeamEditor), `app/(marketplace)/marketplace/team/page.tsx` (same), `app/actions/suppliers.ts` (`updateSupplierUser` mirrors name/phone/status to the contact).

**Interfaces:**
```ts
export type SupplierContactDTO = { id: string; name: string; position: string | null; phone: string | null; mobile: string | null; email: string | null; isPrimary: boolean; receivesRfq: boolean; active: boolean; notes: string | null; user: { id: string; status: string; isSupplierAdmin: boolean; hasPassword: boolean; lastLoginAt: string | null } | null; pendingInvite: { sentAt: string; expiresAt: string; openedAt: string | null } | null };
export type SupplierContactInput = { name: string; position?: string | null; phone?: string | null; mobile?: string | null; email?: string | null; isPrimary?: boolean; receivesRfq?: boolean; notes?: string | null; access: "none" | "invite" | "password"; password?: string | null; isSupplierAdmin?: boolean };
export async function saveSupplierContact(supplierId: string, id: string | null, input: SupplierContactInput): Promise<{ id: string; invited?: boolean } | { error: string }>;
export async function deactivateSupplierContact(supplierId: string, id: string): Promise<{ ok: true } | { error: string }>;
export async function reactivateSupplierContact(supplierId: string, id: string): Promise<{ ok: true } | { error: string }>;
export async function resendContactInvite(supplierId: string, id: string): Promise<{ ok: true } | { error: string }>;
export async function removeSupplierContact(supplierId: string, id: string): Promise<{ ok: true } | { error: string }>;
export function ContactsEditor(p: { supplierId: string; contacts: SupplierContactDTO[]; canEdit: boolean; selfUserId: string | null; storageKey: string }): JSX.Element;
```
Error copy: foreign email → «Το email ανήκει ήδη σε λογαριασμό άλλου τύπου (π.χ. ιδιοκτήτη/διαχειριστή). Χρησιμοποιήστε άλλο email.»; other supplier → «Το email ανήκει σε λογαριασμό άλλου συνεργάτη.»
- [ ] **Step 1: Tests**: `access:"invite"` with free email issues CONTACT_ACTIVATION link + email, no User created; `access:"password"` creates User with bcrypt hash and result has no password field; PROPERTY_OWNER email → error, nothing created (Review Focus 4); `isPrimary` clears other primaries; deactivate sets `User.status=INACTIVE`; remove refuses when `userId` set.
- [ ] **Step 2–5:** FAIL → implement actions, DTO loading, ContactsEditor (DataTable clientSide; modal with access radio; chips) and page swaps → PASS, tsc/eslint on touched files → commit `feat(suppliers): contacts with optional marketplace access (invite link or hashed password)`.

### Task 10: Contract e-acceptance

**Files:**
- Modify: `app/actions/rfq.ts` (`supplierAcceptWorkOrder(woId, input: { signatoryName: string; agreed: boolean })`), `lib/contracts.ts` (acceptance line + `{{supplier.signatory}}`), `app/(marketplace)/marketplace/work-orders/[id]/contract/page.tsx` + create `app/(marketplace)/marketplace/work-orders/[id]/contract/AcceptContract.tsx`, `app/(marketplace)/marketplace/work-orders/[id]/WorkOrderActions.tsx` (step 1 links to the contract page instead of accepting inline), `components/contracts/ContractView.tsx` (print CSS `@page{margin:18mm}`, `children` slot under the document), `lib/rfq.ts` (`listSupplierWorkOrders` exposes `supplierAcceptedName`).
- Test: `lib/contracts.test.ts` (acceptance line text given a WO with `supplierAcceptedName`, mocked db).

- [ ] **Step 1: Test** `renderContract("WO_SUPPLIER")` html contains `Αποδοχή Συνεργάτη: Γιάννης Παπάς` and `IP 1.2.3.4` when set; «Εκκρεμεί» otherwise.
- [ ] **Step 2–3:** FAIL → implement action (name ≥ 3 chars, `agreed` required, IP/UA via `headers()`, send `contractSignedStaffEmail` to `companyStaffIds()` emails and `contractSignedSupplierEmail` to the signatory), contract page card «Ηλεκτρονική αποδοχή» (name prefilled with `ctx.userName`, checkbox «Διάβασα και αποδέχομαι τους όρους της σύμβασης {number}-B», button «Αποδοχή & υπογραφή»; non-admin sees «Μόνο ο διαχειριστής της επιχείρησής σας μπορεί να υπογράψει»).
- [ ] **Step 4:** PASS, tsc/eslint → commit `feat(contracts): supplier e-acceptance with signatory name, IP and time; staff notified by e-mail`.

### Task 11: Wiki

**Files:**
- Create: `docs/wiki/pages/staff-rfq.md` (route `/staff/rfq`, roles `[SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE]`, area `operations`)
- Modify: `docs/wiki/pages/super-admin-suppliers-detail.md`, `marketplace-team.md`, `marketplace-work-orders-detail-contract.md`, `marketplace-rfq.md`, `marketplace-rfq-detail.md`, `admin-maintenance-detail.md`, `docs/wiki/flows/suppliers.md`.
- [ ] **Step 1:** Write/extend articles using the exact UI labels from Tasks 6–10. **Step 2:** `npx vitest run lib/help` → PASS. **Step 3:** reindex if the project exposes a CLI (`grep -rn "reindex\|wiki:index" package.json`), else skip. **Step 4:** Commit `docs(wiki): RFQ invitations board, supplier contacts, contract e-acceptance`.

### Task 12: Verification + memory

- [ ] **Step 1:** `npx tsc --noEmit 2>&1 | grep -v "api/super-admin/costs"` → no lines. `npm test` → all green except the known `lib/building-caps.test.ts`. `npx eslint` on every file touched → clean.
- [ ] **Step 2: Browser (dev-3002, super admin):** /staff/rfq renders with DataTable and «Νέο αίτημα προσφοράς» modal (do not submit); /super-admin/suppliers/[existing id] shows «Επαφές & πρόσβαση» (do not create); /invite/not-a-token shows «Ο σύνδεσμος δεν ισχύει»; View-as a COLLABORATOR: /marketplace/team, /marketplace/rfq, a work order contract page shows the acceptance card state. Screenshots as proof. If the user approves a disposable test supplier, run the full e2e and delete it afterwards.
- [ ] **Step 3:** Update `~/.claude/projects/-Volumes-EXTERNALSSD-propertymanagement/memory/project_suppliers_program.md` (Φ2b shipped: models, pages, link mechanism, decisions 1–4) and the MEMORY.md hook line.
- [ ] **Step 4:** Final `git status` clean for our files; leave `.planning/`, `.claude/`, `docs/marketing/` untouched; do NOT push.
