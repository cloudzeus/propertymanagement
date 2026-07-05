# Announcements v2 + Per-Customer Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend announcements to target multiple properties/buildings/units, enforce per-customer isolation via `lib/scope.ts`, and personalize email (merge fields + branded sender).

**Architecture:** New `AnnouncementTarget` table records addressing intent; `Announcement` gains a denormalized `customerId` for isolation plus email-personalization fields. Pure helpers (merge substitution, recipient dedup, target-scope validation) are unit-tested; server actions become thin scope-aware wrappers over them. A new multi-target composer surfaces for company staff and (scoped) for `PROPERTY_ADMIN`.

**Tech Stack:** Next.js 16.2, Prisma 7 / PostgreSQL, Auth.js v5, Vitest, Mailgun, Tailwind 4.1 / shadcn.

**Reference (read before starting):**
- Spec: [docs/superpowers/specs/2026-07-05-announcements-v2-isolation-design.md](../specs/2026-07-05-announcements-v2-isolation-design.md)
- Isolation primitive: [lib/scope.ts](../../../lib/scope.ts) — `getScope`, `customerWhere`, `assertCustomer`
- Current actions: [app/actions/announcements.ts](../../../app/actions/announcements.ts)
- Email: [lib/mailgun.ts](../../../lib/mailgun.ts)
- Migrations are **not** applied with `prisma migrate dev` in this repo (Announcement drift → reset). Use `prisma migrate diff` to author SQL + `prisma migrate deploy`.

---

## File Structure

- Create `lib/announcements/merge.ts` — pure merge-field substitution.
- Create `lib/announcements/merge.test.ts` — its tests.
- Create `lib/announcements/recipients.ts` — pure recipient pooling/dedup by audience.
- Create `lib/announcements/recipients.test.ts` — its tests.
- Create `lib/announcements/targets.ts` — pure target→customer resolution + scope assertion.
- Create `lib/announcements/targets.test.ts` — its tests.
- Modify `prisma/schema.prisma` — `Announcement` fields, `AnnouncementTarget` model.
- Create `prisma/migrations/<ts>_announcements_v2/migration.sql`.
- Modify `lib/mailgun.ts` — `from`/`replyTo` on `EmailOptions`; branded + merge in `sendAnnouncementEmail`.
- Modify `app/actions/announcements.ts` — scope-aware, multi-target create + filtered reads.
- Create `app/(company)/announcements/AnnouncementComposer.tsx` — multi-target composer (client).
- Create `app/(company)/announcements/page.tsx` — company surface entry.
- Create `app/(customer)/portal/announcements/page.tsx` — PROPERTY_ADMIN entry (scoped).

---

## Task 1: Pure merge-field substitution

**Files:**
- Create: `lib/announcements/merge.ts`
- Test: `lib/announcements/merge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/announcements/merge.test.ts
import { describe, it, expect } from "vitest";
import { applyMergeFields, type MergeContext } from "./merge";

const ctx: MergeContext = { name: "Μαρία", building: "Κτ. Α", property: "Ακίνητο 1", unit: "Α1" };

describe("applyMergeFields", () => {
  it("substitutes all known tokens", () => {
    expect(applyMergeFields("Γεια {{name}} στο {{unit}} ({{building}}/{{property}})", ctx))
      .toBe("Γεια Μαρία στο Α1 (Κτ. Α/Ακίνητο 1)");
  });
  it("replaces every occurrence of a token", () => {
    expect(applyMergeFields("{{name}} {{name}}", ctx)).toBe("Μαρία Μαρία");
  });
  it("renders missing/empty fields as empty string, not the token", () => {
    expect(applyMergeFields("[{{unit}}]", { name: "X" })).toBe("[]");
  });
  it("ignores unknown tokens (leaves them verbatim)", () => {
    expect(applyMergeFields("{{balance}}", ctx)).toBe("{{balance}}");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/announcements/merge.test.ts`
Expected: FAIL — cannot find module `./merge`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/announcements/merge.ts
export type MergeContext = {
  name?: string | null;
  building?: string | null;
  property?: string | null;
  unit?: string | null;
};

const KNOWN = ["name", "building", "property", "unit"] as const;

/** Replace {{name}}/{{building}}/{{property}}/{{unit}} per recipient.
 *  Missing values → "". Unknown tokens are left untouched. */
export function applyMergeFields(input: string, ctx: MergeContext): string {
  let out = input;
  for (const key of KNOWN) {
    const value = (ctx[key] ?? "") as string;
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/announcements/merge.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/announcements/merge.ts lib/announcements/merge.test.ts
git commit -m "feat(announcements): pure merge-field substitution helper"
```

---

## Task 2: Pure recipient pooling + dedup by audience

**Files:**
- Create: `lib/announcements/recipients.ts`
- Test: `lib/announcements/recipients.test.ts`

Reuses the current audience semantics from [app/actions/announcements.ts:72-88](../../../app/actions/announcements.ts) but over people pooled from many buildings.

- [ ] **Step 1: Write the failing test**

```ts
// lib/announcements/recipients.test.ts
import { describe, it, expect } from "vitest";
import { resolveRecipients, type Person } from "./recipients";

const people: Person[] = [
  { id: "u1", name: "A", email: "a@x.gr", role: "OWNER",    buildingId: "b1", unit: "Α1" },
  { id: "u1", name: "A", email: "a@x.gr", role: "RESIDENT", buildingId: "b1", unit: "Α1" }, // same user, both roles
  { id: "u2", name: "B", email: "b@x.gr", role: "RESIDENT", buildingId: "b2", unit: "Β2" },
  { id: "u3", name: "C", email: "c@x.gr", role: "OWNER",    buildingId: "b2", unit: "Β3" },
];

describe("resolveRecipients", () => {
  it("ALL dedups by user id across buildings", () => {
    const r = resolveRecipients(people, "ALL").map((p) => p.id).sort();
    expect(r).toEqual(["u1", "u2", "u3"]);
  });
  it("OWNERS keeps only owners", () => {
    expect(resolveRecipients(people, "OWNERS").map((p) => p.id).sort()).toEqual(["u1", "u3"]);
  });
  it("RESIDENTS keeps only residents", () => {
    expect(resolveRecipients(people, "RESIDENTS").map((p) => p.id).sort()).toEqual(["u1", "u2"]);
  });
  it("CUSTOM keeps only the given ids (and dedups)", () => {
    expect(resolveRecipients(people, "CUSTOM", ["u2", "u2"]).map((p) => p.id)).toEqual(["u2"]);
  });
  it("keeps the first-seen unit/building for a deduped user", () => {
    expect(resolveRecipients(people, "ALL").find((p) => p.id === "u1")?.unit).toBe("Α1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/announcements/recipients.test.ts`
Expected: FAIL — cannot find module `./recipients`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/announcements/recipients.ts
export type Audience = "ALL" | "OWNERS" | "RESIDENTS" | "CUSTOM";

export type Person = {
  id: string;
  name: string | null;
  email: string;
  role: "OWNER" | "RESIDENT";
  buildingId: string;
  unit: string | null;
};

export type Recipient = {
  id: string;
  name: string | null;
  email: string;
  buildingId: string;
  unit: string | null;
};

/** Filter pooled people by audience, then dedup by user id (first-seen wins). */
export function resolveRecipients(people: Person[], audience: Audience, customIds?: string[]): Recipient[] {
  let pool = people;
  if (audience === "OWNERS") pool = people.filter((p) => p.role === "OWNER");
  else if (audience === "RESIDENTS") pool = people.filter((p) => p.role === "RESIDENT");
  else if (audience === "CUSTOM") {
    const set = new Set(customIds ?? []);
    pool = people.filter((p) => set.has(p.id));
  }
  const map = new Map<string, Recipient>();
  for (const p of pool) {
    if (!map.has(p.id)) map.set(p.id, { id: p.id, name: p.name, email: p.email, buildingId: p.buildingId, unit: p.unit });
  }
  return [...map.values()];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/announcements/recipients.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/announcements/recipients.ts lib/announcements/recipients.test.ts
git commit -m "feat(announcements): pure recipient pooling + dedup by audience"
```

---

## Task 3: Pure target→customer resolution + scope assertion

**Files:**
- Create: `lib/announcements/targets.ts`
- Test: `lib/announcements/targets.test.ts`

This is the isolation core as a pure function: given the `customerId` of each selected target and the caller's scope, decide the announcement's owning `customerId` — or reject.

- [ ] **Step 1: Write the failing test**

```ts
// lib/announcements/targets.test.ts
import { describe, it, expect } from "vitest";
import { resolveAnnouncementCustomer } from "./targets";

const staff = { seesAllCustomers: true, customerId: null } as const;
const admin = { seesAllCustomers: false, customerId: "cA" } as const;

describe("resolveAnnouncementCustomer", () => {
  it("single-customer targets → that customer for staff", () => {
    expect(resolveAnnouncementCustomer(staff, ["cA", "cA"])).toEqual({ ok: true, customerId: "cA" });
  });
  it("multi-customer targets → null (broadcast) for staff", () => {
    expect(resolveAnnouncementCustomer(staff, ["cA", "cB"])).toEqual({ ok: true, customerId: null });
  });
  it("PROPERTY_ADMIN targeting only their customer → ok", () => {
    expect(resolveAnnouncementCustomer(admin, ["cA", "cA"])).toEqual({ ok: true, customerId: "cA" });
  });
  it("PROPERTY_ADMIN targeting another customer → rejected", () => {
    expect(resolveAnnouncementCustomer(admin, ["cA", "cB"])).toEqual({ ok: false, reason: "cross-customer" });
  });
  it("no targets → rejected", () => {
    expect(resolveAnnouncementCustomer(staff, [])).toEqual({ ok: false, reason: "no-targets" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/announcements/targets.test.ts`
Expected: FAIL — cannot find module `./targets`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/announcements/targets.ts
export type ScopeLike = { seesAllCustomers: boolean; customerId: string | null };

export type ResolveResult =
  | { ok: true; customerId: string | null }
  | { ok: false; reason: "no-targets" | "cross-customer" };

/** Decide an announcement's owning customerId from its targets' customerIds.
 *  Staff may span customers (→ null broadcast). A customer-side caller must own
 *  every target, else cross-customer is rejected. */
export function resolveAnnouncementCustomer(scope: ScopeLike, targetCustomerIds: string[]): ResolveResult {
  if (targetCustomerIds.length === 0) return { ok: false, reason: "no-targets" };
  const distinct = [...new Set(targetCustomerIds)];

  if (!scope.seesAllCustomers) {
    const foreign = distinct.some((c) => c !== scope.customerId);
    if (foreign || scope.customerId == null) return { ok: false, reason: "cross-customer" };
    return { ok: true, customerId: scope.customerId };
  }

  return { ok: true, customerId: distinct.length === 1 ? distinct[0] : null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/announcements/targets.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/announcements/targets.ts lib/announcements/targets.test.ts
git commit -m "feat(announcements): pure target→customer scope resolution"
```

---

## Task 4: Schema changes + migration

**Files:**
- Modify: `prisma/schema.prisma` (Announcement block ~1271, add AnnouncementTarget)
- Create: `prisma/migrations/20260705120000_announcements_v2/migration.sql`

- [ ] **Step 1: Edit `Announcement` model**

In `prisma/schema.prisma`, change `buildingId String` → nullable and add fields. The block becomes:

```prisma
model Announcement {
  id                    String   @id @default(cuid())

  buildingId            String?
  building              Building? @relation(fields: [buildingId], references: [id], onDelete: Cascade)

  customerId            String?
  customer              Customer? @relation("customerAnnouncements", fields: [customerId], references: [id], onDelete: Cascade)

  title                 String
  content               String   @db.Text   // rich text (HTML)
  imageUrl              String?  // BunnyCDN URL

  status                String   @default("ACTIVE") // ACTIVE, DRAFT, ARCHIVED
  audience              String   @default("ALL") // ALL, OWNERS, RESIDENTS, CUSTOM
  origin                String   @default("STAFF") // STAFF | MANAGER

  emailSubject          String?
  emailPreview          String?
  senderName            String?
  senderReplyTo         String?

  publishedAt           DateTime?
  expiresAt             DateTime?

  recurringTaskId       String?  // optional linked calendar entry

  createdById           String?
  createdBy             User?    @relation("announcementCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

  recipients            Announcement_User[]
  targets               AnnouncementTarget[]

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([buildingId])
  @@index([customerId])
  @@index([status])
}

model AnnouncementTarget {
  id             String       @id @default(cuid())
  announcementId String
  announcement   Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  scopeType      String       // PROPERTY | BUILDING | UNIT | USER
  scopeId        String

  @@index([announcementId])
  @@index([scopeType, scopeId])
}
```

- [ ] **Step 2: Add the back-relation on `Customer`**

In the `Customer` model (~line 545, near other relations) add:

```prisma
  announcements         Announcement[] @relation("customerAnnouncements")
```

- [ ] **Step 3: Author the migration SQL via diff**

Run:
```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > /tmp/ann_v2.sql
```
Note: if the diff-from-datasource errors due to drift, instead diff from the last migration state:
```bash
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > /tmp/ann_v2.sql
```
Then create `prisma/migrations/20260705120000_announcements_v2/migration.sql` containing the generated SQL. Expected statements: `ALTER TABLE "Announcement" ALTER COLUMN "buildingId" DROP NOT NULL`, `ADD COLUMN "customerId"`, `"origin"`, `"emailSubject"`, `"emailPreview"`, `"senderName"`, `"senderReplyTo"`; `CREATE TABLE "AnnouncementTarget"`; new indexes + FKs.

- [ ] **Step 4: Apply + regenerate client**

Run:
```bash
npx prisma migrate deploy && npx prisma generate
```
Expected: migration `20260705120000_announcements_v2` applied; client regenerated.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (existing `app/actions/announcements.ts` still compiles — `buildingId` nullable does not break `where: { buildingId }`).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260705120000_announcements_v2
git commit -m "feat(announcements): schema — multi-target + customer denorm + email fields"
```

---

## Task 5: Email — branded sender + merge + subject/preview

**Files:**
- Modify: `lib/mailgun.ts` (`EmailOptions` ~4-11, `sendEmail` ~19-27, `sendAnnouncementEmail` ~213-239)

- [ ] **Step 1: Add `from`/`replyTo` to `EmailOptions` and honor them in `sendEmail`**

In `lib/mailgun.ts`, extend the interface:

```ts
interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;      // full "Name <email>" override
  replyTo?: string;
  tags?: string[];
}
```

In `sendEmail`, replace the fixed from line:

```ts
    form.append("from", options.from ?? env.MAILGUN_FROM_EMAIL);
```

- [ ] **Step 2: Add a branded-from builder + preheader, rewrite `sendAnnouncementEmail`**

Replace the existing `sendAnnouncementEmail` (lines ~213-239) with a version that accepts branding + already-substituted subject/body (merge is applied by the caller, per recipient):

```ts
/** Build a Mailgun `from` that keeps the verified domain but shows a brand name. */
export function brandedFrom(senderName?: string | null): string {
  if (!senderName) return env.MAILGUN_FROM_EMAIL;
  // MAILGUN_FROM_EMAIL may be "Something <no-reply@domain>" or a bare address.
  const match = env.MAILGUN_FROM_EMAIL.match(/<([^>]+)>/);
  const address = match ? match[1] : env.MAILGUN_FROM_EMAIL;
  return `${senderName} <${address}>`;
}

export async function sendAnnouncementEmail(
  email: string,
  recipientName: string | null,
  headingLabel: string,      // e.g. building/property name for the eyebrow line
  subject: string,           // already merge-substituted
  htmlBody: string,          // already merge-substituted
  ackUrl: string,
  opts?: { senderName?: string | null; replyTo?: string | null; preview?: string | null },
  ctx?: { buildingId?: string; customerId?: string; assemblyId?: string; companyId?: string; userId?: string }
): Promise<EmailResponse> {
  const greeting = recipientName ? `Αγαπητέ/ή ${recipientName},` : "Αγαπητέ/ή ένοικε,";
  const preheader = opts?.preview
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preview}</div>`
    : "";
  const html = `
    ${preheader}
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <p style="font-size: 13px; color: #666; margin: 0 0 4px;">Ανακοίνωση — ${headingLabel}</p>
      <h2 style="margin: 0 0 16px;">${subject}</h2>
      <p style="margin: 0 0 12px;">${greeting}</p>
      <div style="border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; background: #fafafa; font-size: 14px; line-height: 1.6;">
        ${htmlBody}
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${ackUrl}" style="display: inline-block; background: #c50f1f; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px;">Έλαβα γνώση</a>
      </div>
      <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">Πατώντας το κουμπί επιβεβαιώνετε ότι λάβατε γνώση αυτής της ανακοίνωσης.</p>
    </div>
  `;
  const text = `Ανακοίνωση — ${headingLabel}\n\n${subject}\n\n${greeting}\n\nΓια να δηλώσετε ότι λάβατε γνώση, επισκεφθείτε:\n${ackUrl}`;
  return sendEmail({
    to: email,
    subject,
    html,
    text,
    from: brandedFrom(opts?.senderName),
    replyTo: opts?.replyTo ?? undefined,
    tags: ["announcement"],
  }, ctx);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL only in `app/actions/announcements.ts` (old call signature) — fixed in Task 6. Confirm no other file references `sendAnnouncementEmail`.

Run: `grep -rn "sendAnnouncementEmail" app lib`
Expected: only `lib/mailgun.ts` (def) + `app/actions/announcements.ts` (caller).

- [ ] **Step 4: Commit**

```bash
git add lib/mailgun.ts
git commit -m "feat(announcements): branded sender, preheader, pre-substituted email body"
```

---

## Task 6: Scope-aware multi-target server actions

**Files:**
- Modify: `app/actions/announcements.ts` (full rewrite of guards, targets, create, reads)

- [ ] **Step 1: Replace `requireStaff` with a scope-based guard**

At the top of `app/actions/announcements.ts`, replace `requireStaff` (lines ~9-15) with:

```ts
import { getScope, type Scope } from "@/lib/scope";
import { resolveRecipients, type Person } from "@/lib/announcements/recipients";
import { applyMergeFields } from "@/lib/announcements/merge";
import { resolveAnnouncementCustomer } from "@/lib/announcements/targets";
import { brandedFrom } from "@/lib/mailgun"; // (already exported from mailgun)

const ORIGINATOR_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "PROPERTY_ADMIN"];

async function requireOriginator(): Promise<Scope> {
  const scope = await getScope();
  if (!ORIGINATOR_ROLES.includes(scope.role)) throw new Error("Forbidden");
  return scope;
}
```

- [ ] **Step 2: Add a scoped target-selection type + a people loader across many buildings**

Add near the top (after imports):

```ts
export type TargetInput = { scopeType: "PROPERTY" | "BUILDING" | "UNIT" | "USER"; scopeId: string };

/** Resolve target selections to concrete building ids the caller may see,
 *  asserting every touched building/unit belongs to an allowed customer. */
async function resolveBuildingIds(scope: Scope, targets: TargetInput[]): Promise<{ buildingIds: string[]; customerIds: string[]; userIds: string[] }> {
  const buildingIds = new Set<string>();
  const customerIds = new Set<string>();
  const userIds = new Set<string>();

  for (const t of targets) {
    if (t.scopeType === "PROPERTY") {
      const bs = await db.building.findMany({ where: { propertyId: t.scopeId }, select: { id: true, customerId: true } });
      for (const b of bs) { buildingIds.add(b.id); customerIds.add(b.customerId); }
    } else if (t.scopeType === "BUILDING") {
      const b = await db.building.findUnique({ where: { id: t.scopeId }, select: { id: true, customerId: true } });
      if (b) { buildingIds.add(b.id); customerIds.add(b.customerId); }
    } else if (t.scopeType === "UNIT") {
      const u = await db.unit.findUnique({ where: { id: t.scopeId }, select: { buildingId: true, customerId: true } });
      if (u) { buildingIds.add(u.buildingId); customerIds.add(u.customerId); }
    } else if (t.scopeType === "USER") {
      const u = await db.user.findUnique({ where: { id: t.scopeId }, select: { id: true, customerId: true } });
      if (u?.customerId) { userIds.add(u.id); customerIds.add(u.customerId); }
    }
  }
  return { buildingIds: [...buildingIds], customerIds: [...customerIds], userIds: [...userIds] };
}

/** Current owners/residents across many buildings, flattened for resolveRecipients. */
async function peopleForBuildings(buildingIds: string[]): Promise<Person[]> {
  if (buildingIds.length === 0) return [];
  const units = await db.unit.findMany({
    where: { buildingId: { in: buildingIds } },
    select: {
      buildingId: true, unitNumber: true,
      owner: { select: { id: true, name: true, email: true } },
      resident: { select: { id: true, name: true, email: true } },
    },
  });
  const out: Person[] = [];
  for (const u of units) {
    if (u.owner) out.push({ ...u.owner, role: "OWNER", buildingId: u.buildingId, unit: u.unitNumber });
    if (u.resident) out.push({ ...u.resident, role: "RESIDENT", buildingId: u.buildingId, unit: u.unitNumber });
  }
  return out;
}
```

Note: confirm `Unit.unitNumber` and `Building.propertyId` field names via `grep -n "unitNumber\|propertyId" prisma/schema.prisma`; adjust selects if they differ.

- [ ] **Step 3: Rewrite `createAnnouncement` for multi-target + scope + branded/merge email**

Replace `createAnnouncement` (lines ~131-182). New signature takes `targets` instead of a single `buildingId`:

```ts
export type MultiAnnouncementInput = {
  title: string;
  content: string;               // HTML
  emailSubject?: string;         // optional override; defaults to title
  emailPreview?: string;
  publishedAt?: string | null;
  audience: Audience;
  targets: TargetInput[];
  recipientUserIds?: string[];   // for CUSTOM
};

export async function createAnnouncement(data: MultiAnnouncementInput) {
  const scope = await requireOriginator();
  if (!data.title.trim()) return { error: "Το θέμα είναι υποχρεωτικό" };
  if (!data.content || data.content.replace(/<[^>]*>/g, "").trim() === "") return { error: "Το κείμενο είναι υποχρεωτικό" };
  if (!data.targets?.length) return { error: "Επιλέξτε τουλάχιστον έναν παραλήπτη" };

  const { buildingIds, customerIds, userIds } = await resolveBuildingIds(scope, data.targets);

  // Isolation: decide the owning customer (or reject cross-customer for managers).
  const resolved = resolveAnnouncementCustomer(
    { seesAllCustomers: scope.seesAllCustomers, customerId: scope.customerId },
    customerIds,
  );
  if (!resolved.ok) {
    return { error: resolved.reason === "cross-customer"
      ? "Δεν επιτρέπεται αποστολή σε άλλον πελάτη"
      : "Δεν βρέθηκαν έγκυροι παραλήπτες" };
  }

  // Pool people; USER targets are added directly (must be within an allowed customer).
  let people = await peopleForBuildings(buildingIds);
  if (userIds.length) {
    const directUsers = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
    for (const u of directUsers) people.push({ ...u, role: "RESIDENT", buildingId: "", unit: null });
  }
  const recipients = resolveRecipients(people, data.audience, data.recipientUserIds);
  if (recipients.length === 0) return { error: "Δεν βρέθηκαν παραλήπτες για την επιλεγμένη ομάδα" };

  // Branded sender snapshot (single-customer only; broadcast keeps defaults).
  let senderName: string | null = null, senderReplyTo: string | null = null;
  if (resolved.customerId) {
    const c = await db.customer.findUnique({ where: { id: resolved.customerId }, select: { name: true, email: true } });
    senderName = c?.name ?? null; senderReplyTo = c?.email ?? null;
  }

  // Building/property label for the email eyebrow (best-effort).
  const firstBuilding = buildingIds.length === 1
    ? await db.building.findUnique({ where: { id: buildingIds[0] }, select: { name: true } })
    : null;

  const publishedAt = data.publishedAt ? new Date(data.publishedAt) : new Date();
  const subjectTemplate = (data.emailSubject?.trim() || data.title.trim());

  const announcement = await db.announcement.create({
    data: {
      buildingId: buildingIds.length === 1 ? buildingIds[0] : null,
      customerId: resolved.customerId,
      origin: scope.seesAllCustomers ? "STAFF" : "MANAGER",
      title: data.title.trim(),
      content: data.content,
      emailSubject: data.emailSubject?.trim() || null,
      emailPreview: data.emailPreview?.trim() || null,
      senderName, senderReplyTo,
      audience: data.audience, publishedAt, createdById: scope.userId,
      targets: { create: data.targets.map((t) => ({ scopeType: t.scopeType, scopeId: t.scopeId })) },
      recipients: { create: recipients.map((r) => ({ userId: r.id, sentAt: new Date() })) },
    },
    select: { id: true, recipients: { select: { token: true, userId: true } } },
  });

  // Per-recipient personalized email (best-effort).
  const recipMeta = new Map(recipients.map((r) => [r.id, r]));
  const tokenByUser = new Map(announcement.recipients.map((r) => [r.userId, r.token]));
  const headingLabel = firstBuilding?.name ?? senderName ?? "Διαχείριση";
  await Promise.allSettled(
    recipients.map((r) => {
      const token = tokenByUser.get(r.id);
      if (!token) return Promise.resolve();
      const meta = recipMeta.get(r.id);
      const mergeCtx = { name: r.name, unit: meta?.unit ?? null, building: firstBuilding?.name ?? null, property: null };
      const ackUrl = `${env.NEXT_PUBLIC_APP_URL}/announcements/${token}`;
      return sendAnnouncementEmail(
        r.email, r.name, headingLabel,
        applyMergeFields(subjectTemplate, mergeCtx),
        applyMergeFields(data.content, mergeCtx),
        ackUrl,
        { senderName, replyTo: senderReplyTo, preview: data.emailPreview ?? null },
        { customerId: resolved.customerId ?? undefined, userId: scope.userId },
      );
    })
  );

  revalidatePath(`/announcements`);
  return { ok: true, id: announcement.id, sent: recipients.length };
}
```

- [ ] **Step 4: Make reads scope-filtered**

Replace `listAnnouncements` guard/where (lines ~90-94). Change signature to optional `buildingId` and always filter by scope's customer:

```ts
export async function listAnnouncements(buildingId?: string): Promise<AnnouncementRow[]> {
  const scope = await requireOriginator();
  const rows = await db.announcement.findMany({
    where: {
      ...(buildingId ? { buildingId } : {}),
      ...(scope.seesAllCustomers ? {} : { customerId: scope.customerId ?? "__no_customer__" }),
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { /* unchanged select block */ },
  });
  // ... rest unchanged, but drop the buildingId-based role lookup when buildingId is absent:
  // guard people/roleOf so it only runs when a single buildingId is present.
}
```

Keep the recipient role-labelling only when `buildingId` is provided; otherwise label recipients `"OTHER"` (multi-building view). Concretely, replace the `buildingPeople(buildingId)` call with:

```ts
  const roleOf = new Map<string, "OWNER" | "RESIDENT">();
  if (buildingId) {
    const people = await peopleForBuildings([buildingId]);
    for (const p of people) if (!roleOf.has(p.id)) roleOf.set(p.id, p.role);
  }
```

- [ ] **Step 5: Update `listAnnouncementTargets` + `deleteAnnouncement` guards**

- `listAnnouncementTargets(buildingId)`: change `await requireStaff()` → `const scope = await requireOriginator();` then after loading the building assert scope: load `building.customerId` and call `assertCustomer(scope, building.customerId)` (import `assertCustomer` from `@/lib/scope`). Keep using `peopleForBuildings([buildingId])` instead of the removed `buildingPeople`.
- `deleteAnnouncement(id)`: change guard to `const scope = await requireOriginator();`, and after loading the announcement (add `customerId` to its select) call `assertCustomer(scope, a.customerId)` before delete.

Remove the now-unused `buildingPeople` and old local `resolveRecipients` (superseded by the imported pure helper).

- [ ] **Step 6: Update the existing caller in `AnnouncementsPanel`**

`app/(company)/super-admin/buildings/[id]/AnnouncementsPanel.tsx` calls `createAnnouncement(buildingId, {...})`. Update it to the new signature:

```ts
await createAnnouncement({
  title, content, audience,
  publishedAt,
  recipientUserIds,
  targets: [{ scopeType: "BUILDING", scopeId: buildingId }],
});
```

Run: `grep -n "createAnnouncement\|listAnnouncements\|listAnnouncementTargets" app/(company)/super-admin/buildings/[id]/AnnouncementsPanel.tsx` and adjust each call to the new signatures (`listAnnouncements(buildingId)` and `listAnnouncementTargets(buildingId)` are unchanged in shape). Also remove the now-defunct `addToCalendar` usage if present, or keep the calendar behavior by re-adding an `addToCalendar` field to `MultiAnnouncementInput` and porting the `recurringTask.create` block into `createAnnouncement` guarded by `buildingIds.length === 1`.

- [ ] **Step 7: Typecheck + run the pure tests**

Run: `npx tsc --noEmit && npx vitest run lib/announcements`
Expected: PASS. Fix any field-name mismatches surfaced by tsc (`propertyId`, `unitNumber`).

- [ ] **Step 8: Commit**

```bash
git add app/actions/announcements.ts "app/(company)/super-admin/buildings/[id]/AnnouncementsPanel.tsx"
git commit -m "feat(announcements): scope-aware multi-target create + isolated reads"
```

---

## Task 7: Multi-target composer UI (company surface)

**Files:**
- Create: `app/(company)/announcements/page.tsx`
- Create: `app/(company)/announcements/AnnouncementComposer.tsx`

Follow the existing `AnnouncementsPanel.tsx` for the rich-text editor + audience controls (reuse the same editor component it imports). Check it first:

Run: `grep -n "import" "app/(company)/super-admin/buildings/[id]/AnnouncementsPanel.tsx" | head -30`

- [ ] **Step 1: Server page loads scoped target options**

```tsx
// app/(company)/announcements/page.tsx
import { getScope } from "@/lib/scope";
import { db } from "@/lib/db";
import { customerWhere } from "@/lib/scope";
import AnnouncementComposer from "./AnnouncementComposer";

export default async function AnnouncementsPage() {
  const scope = await getScope();
  const buildings = await db.building.findMany({
    where: customerWhere(scope),
    select: { id: true, name: true, propertyId: true, property: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  return <AnnouncementComposer buildings={buildings.map((b) => ({ id: b.id, name: b.name, propertyId: b.propertyId, propertyName: b.property?.name ?? null }))} />;
}
```

- [ ] **Step 2: Client composer**

Create `AnnouncementComposer.tsx` (client component) with: a hierarchical checkbox tree grouped by property → building, an audience `<select>` (ALL/OWNERS/RESIDENTS), title input, email-subject + preview inputs, the same rich-text editor used by `AnnouncementsPanel`, and a merge-field insert toolbar (`{{name}} {{building}} {{property}} {{unit}}`). On submit call the server action:

```tsx
"use client";
import { useState } from "react";
import { createAnnouncement, type Audience, type TargetInput } from "@/app/actions/announcements";

type B = { id: string; name: string; propertyId: string | null; propertyName: string | null };

export default function AnnouncementComposer({ buildings }: { buildings: B[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [preview, setPreview] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setMsg(null);
    const targets: TargetInput[] = [...selected].map((id) => ({ scopeType: "BUILDING", scopeId: id }));
    const res = await createAnnouncement({ title, content, emailSubject: subject, emailPreview: preview, audience, targets });
    setBusy(false);
    setMsg(res.error ?? `Στάλθηκε σε ${(res as any).sent} παραλήπτες`);
  }

  const byProperty = new Map<string, B[]>();
  for (const b of buildings) {
    const key = b.propertyName ?? "—";
    byProperty.set(key, [...(byProperty.get(key) ?? []), b]);
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold">Νέα ανακοίνωση</h1>
      {/* target tree */}
      <div className="border rounded-lg p-3 space-y-2 max-h-64 overflow-auto">
        {[...byProperty.entries()].map(([prop, bs]) => (
          <div key={prop}>
            <div className="text-sm font-medium text-neutral-500">{prop}</div>
            {bs.map((b) => (
              <label key={b.id} className="flex items-center gap-2 pl-3 py-1 text-sm">
                <input type="checkbox" checked={selected.has(b.id)} onChange={(e) => {
                  const next = new Set(selected);
                  e.target.checked ? next.add(b.id) : next.delete(b.id);
                  setSelected(next);
                }} />
                {b.name}
              </label>
            ))}
          </div>
        ))}
      </div>
      <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className="border rounded px-2 py-1">
        <option value="ALL">Όλοι</option>
        <option value="OWNERS">Ιδιοκτήτες</option>
        <option value="RESIDENTS">Ένοικοι</option>
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Θέμα" className="w-full border rounded px-3 py-2" />
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Θέμα email (προαιρετικό)" className="w-full border rounded px-3 py-2" />
      <input value={preview} onChange={(e) => setPreview(e.target.value)} placeholder="Preview text (προαιρετικό)" className="w-full border rounded px-3 py-2" />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Κείμενο (HTML). Πεδία: {{name}} {{building}} {{property}} {{unit}}" className="w-full border rounded px-3 py-2 h-40" />
      <button disabled={busy || !selected.size} onClick={submit} className="bg-[#c50f1f] text-white px-4 py-2 rounded disabled:opacity-50">Αποστολή</button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
```

Note: if `AnnouncementsPanel` uses a dedicated rich-text editor component, swap the `<textarea>` for it. Keep the merge-field hint text.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/(company)/announcements"
git commit -m "feat(announcements): multi-target composer on company surface"
```

---

## Task 8: PROPERTY_ADMIN portal entry (scoped)

**Files:**
- Create: `app/(customer)/portal/announcements/page.tsx`

- [ ] **Step 1: Reuse the composer, scoped by `customerWhere`**

```tsx
// app/(customer)/portal/announcements/page.tsx
import { getScope, customerWhere } from "@/lib/scope";
import { db } from "@/lib/db";
import AnnouncementComposer from "@/app/(company)/announcements/AnnouncementComposer";

export default async function PortalAnnouncementsPage() {
  const scope = await getScope();
  if (scope.role !== "PROPERTY_ADMIN") {
    return <div className="p-6 text-sm text-neutral-500">Δεν έχετε πρόσβαση.</div>;
  }
  const buildings = await db.building.findMany({
    where: customerWhere(scope),
    select: { id: true, name: true, propertyId: true, property: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return <AnnouncementComposer buildings={buildings.map((b) => ({ id: b.id, name: b.name, propertyId: b.propertyId, propertyName: b.property?.name ?? null }))} />;
}
```

The server action already re-derives scope and asserts customer ownership, so the portal cannot escape its customer even if the building list were tampered with.

- [ ] **Step 2: Verify + manual isolation check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS (all suites).

Manual: sign in as a `PROPERTY_ADMIN`, open `/portal/announcements`, confirm only own-customer buildings appear; attempt (via crafted call) a foreign building id → action returns "Δεν επιτρέπεται αποστολή σε άλλον πελάτη".

- [ ] **Step 3: Commit**

```bash
git add "app/(customer)/portal/announcements/page.tsx"
git commit -m "feat(announcements): scoped composer entry in PROPERTY_ADMIN portal"
```

---

## Self-Review Notes

- **Spec §1 (data model):** Tasks 4. ✓
- **Spec §2 (isolation):** Tasks 3 (pure), 6 (wired: `resolveAnnouncementCustomer`, `assertCustomer`, `customerWhere`). ✓
- **Spec §3 (recipient resolution):** Tasks 2 + 6. ✓
- **Spec §4 (email personalization):** Tasks 1 (merge) + 5 (branded/preheader) + 6 (per-recipient send). ✓
- **Spec §5 (UI):** Tasks 7 (company) + 8 (portal); building panel retained (Task 6 step 6). ✓
- **Spec §6 (testing):** Tasks 1–3 unit tests. ✓
- **Type consistency:** `Audience`, `TargetInput`, `MultiAnnouncementInput`, `Person`, `Recipient`, `resolveAnnouncementCustomer` result shape are used identically across tasks.
- **Assumption to verify at Task 6 step 2:** field names `Building.propertyId`, `Unit.unitNumber`, `User.customerId` (all confirmed present in schema during planning).
