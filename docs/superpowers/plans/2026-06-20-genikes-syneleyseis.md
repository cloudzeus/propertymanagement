# Γενικές Συνελεύσεις (General Assemblies) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a module letting a manager schedule per-building general assemblies over Daily video, auto-record (audio-only) + transcribe (Deepgram/Greek), draft minutes (MOM) via DeepSeek, edit/approve/email them, and track every tool's cost per customer/building.

**Architecture:** Persistent Daily room per building. Server actions create assemblies, issue short-lived meeting tokens, and run DeepSeek. A Daily webhook drives the lifecycle (join/leave → participant-minutes, meeting.ended → transcribe, transcription done → auto-draft). All tool usage is logged to the existing `APIUsageLog` (extended with `buildingId`/`customerId`/`assemblyId`). UI follows the existing building-dashboard panel pattern.

**Tech Stack:** Next.js 16.2 (App Router, server components + server actions), Prisma 7 / PostgreSQL, Daily REST + `@daily-co/daily-react`, Deepgram (via Daily), DeepSeek (`lib/ai.ts` pattern), Mailgun (`lib/mailgun.ts`), Vitest.

**Reference patterns (read before starting):**
- `app/actions/announcements.ts` — server-action + `requireStaff` + calendar + email pattern.
- `lib/api-costs.ts` — `logAPIUsage`, `DEFAULT_API_COSTS`.
- `lib/ai.ts` — `deepseekRequest` (token logging via `data.usage.total_tokens`).
- `lib/mailgun.ts` — `sendAnnouncementEmail`, `sendEmailWithAttachments`.
- `app/(dashboard)/super-admin/buildings/[id]/AnnouncementsPanel.tsx` and `BuildingDashboard.tsx` (TABS array + panel switch).
- `components/ui/rich-text.tsx`, `components/ui/data-table.tsx`.

**Note on Prisma:** this project keeps generated model files under `lib/prisma/models/`. After editing `prisma/schema.prisma`, run `npx prisma generate` then `npm run db:migrate` to regenerate them and create a migration.

---

### Task 1: Schema — Assembly models + APIUsageLog granularity

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enum + models to `prisma/schema.prisma`** (append near the other domain models)

```prisma
enum AssemblyStatus {
  SCHEDULED
  LIVE
  ENDED
  TRANSCRIBING
  DRAFT_READY
  APPROVED
  SENT
  CANCELLED
}

model Assembly {
  id              String          @id @default(cuid())
  buildingId      String
  building        Building        @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  title           String
  scheduledAt     DateTime
  status          AssemblyStatus  @default(SCHEDULED)
  dailyRoomName   String
  dailySessionId  String?
  recordingUrl    String?
  transcriptRaw   String?         @db.Text
  minutesDraft    String?         @db.Text
  minutesFinal    String?         @db.Text
  approvedAt      DateTime?
  sentAt          DateTime?
  createdById     String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  participants    AssemblyParticipant[]

  @@index([buildingId])
  @@index([status])
}

model AssemblyParticipant {
  id              String    @id @default(cuid())
  assemblyId      String
  assembly        Assembly  @relation(fields: [assemblyId], references: [id], onDelete: Cascade)
  userId          String?
  unitId          String?
  displayName     String
  joinedAt        DateTime?
  leftAt          DateTime?
  durationSeconds Int       @default(0)
  invitedSentAt   DateTime?
  momSentAt       DateTime?

  @@index([assemblyId])
  @@index([userId])
}
```

- [ ] **Step 2: Add `dailyRoomName` to `Building`** — inside `model Building { ... }` add:

```prisma
  dailyRoomName   String?
  assemblies      Assembly[]
```

- [ ] **Step 3: Add granularity fields to `APIUsageLog`** — inside `model APIUsageLog { ... }`, after `userId`, add:

```prisma
  buildingId            String?
  customerId            String?
  assemblyId            String?

  @@index([buildingId])
  @@index([customerId])
  @@index([assemblyId])
```

(Place the three new `@@index` lines alongside the existing ones at the bottom of the model.)

- [ ] **Step 4: Generate + migrate**

Run: `npx prisma generate && npm run db:migrate -- --name assemblies_module`
Expected: migration created, `lib/prisma/models/Assembly.ts` / `AssemblyParticipant.ts` generated, no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/ lib/prisma/
git commit -m "feat(assemblies): schema for Assembly/AssemblyParticipant + APIUsageLog granularity"
```

---

### Task 2: Cost tracking — daily/deepgram rates + context fields

**Files:**
- Modify: `lib/api-costs.ts`
- Test: `lib/api-costs.test.ts` (create)

- [ ] **Step 1: Write failing test** — `lib/api-costs.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_API_COSTS } from "./api-costs";

describe("DEFAULT_API_COSTS", () => {
  it("has per-minute pricing for daily and deepgram", () => {
    expect(DEFAULT_API_COSTS.daily.costModel).toBe("per_minute");
    expect(DEFAULT_API_COSTS.deepgram.costModel).toBe("per_minute");
    expect(typeof DEFAULT_API_COSTS.daily.basePrice).toBe("number");
    expect(typeof DEFAULT_API_COSTS.deepgram.basePrice).toBe("number");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run lib/api-costs.test.ts`
Expected: FAIL — `daily`/`deepgram` undefined.

- [ ] **Step 3: Add entries to `DEFAULT_API_COSTS`** in `lib/api-costs.ts` (use placeholder rates; SUPER_ADMIN tunes via `APICostConfig`):

```ts
  daily: { costModel: "per_minute", basePrice: 0.004, freeQuota: 0 },     // EUR per participant-minute
  deepgram: { costModel: "per_minute", basePrice: 0.0043, freeQuota: 0 }, // EUR per audio-minute
```

- [ ] **Step 4: Add `per_minute` to the cost switch** in `logAPIUsage` (after the `per_token` case):

```ts
      case "per_minute":
        totalCost = (params.requestCount || 0) * config.basePrice; // requestCount carries minutes
        break;
```

- [ ] **Step 5: Extend `LogAPIUsageParams` + the `db.aPIUsageLog.create` data** in `lib/api-costs.ts`:

In the interface add:
```ts
  buildingId?: string;
  customerId?: string;
  assemblyId?: string;
```
In the `create({ data: { ... } })` object add:
```ts
        buildingId: params.buildingId,
        customerId: params.customerId,
        assemblyId: params.assemblyId,
```

- [ ] **Step 6: Run test, verify pass**

Run: `npx vitest run lib/api-costs.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/api-costs.ts lib/api-costs.test.ts
git commit -m "feat(assemblies): per-minute cost model + per customer/building/assembly logging"
```

---

### Task 3: Env vars — Daily + Deepgram keys

**Files:**
- Modify: `lib/env.ts`

- [ ] **Step 1: Add to `optionalEnvVars` array**

```ts
  "DAILY_API_KEY",
  "DEEP_GRAM_API_KEY",
```

- [ ] **Step 2: Add to the exported `env` object** (under the AI Services block):

```ts
  // Assemblies (Daily + Deepgram)
  DAILY_API_KEY: process.env.DAILY_API_KEY,
  DEEP_GRAM_API_KEY: process.env.DEEP_GRAM_API_KEY,
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/env.ts
git commit -m "feat(assemblies): add DAILY_API_KEY + DEEP_GRAM_API_KEY env"
```

---

### Task 4: Daily REST client — `lib/daily.ts`

**Files:**
- Create: `lib/daily.ts`
- Test: `lib/daily.test.ts`

- [ ] **Step 1: Write failing test** — `lib/daily.test.ts` (pure helpers only; network calls are not unit-tested)

```ts
import { describe, it, expect } from "vitest";
import { roomNameForBuilding, transcriptionSettings } from "./daily";

describe("daily helpers", () => {
  it("derives a stable room name from building id", () => {
    expect(roomNameForBuilding("bldg_123")).toBe("assembly-bldg_123");
  });
  it("defaults transcription to Greek nova-3", () => {
    const s = transcriptionSettings();
    expect(s.language).toBe("el");
    expect(s.model).toBe("nova-3");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npx vitest run lib/daily.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/daily.ts`**

```ts
import { env } from "./env";

const BASE = "https://api.daily.co/v1";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.DAILY_API_KEY ?? ""}`,
  };
}

export function roomNameForBuilding(buildingId: string): string {
  return `assembly-${buildingId}`;
}

export function transcriptionSettings() {
  return { language: "el", model: "nova-3", punctuate: true } as const;
}

/** Get-or-create a persistent, audio-recording-enabled room for a building. */
export async function ensureRoom(buildingId: string): Promise<string> {
  const name = roomNameForBuilding(buildingId);
  const get = await fetch(`${BASE}/rooms/${name}`, { headers: authHeaders(), cache: "no-store" });
  if (get.ok) return name;

  const res = await fetch(`${BASE}/rooms`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      name,
      privacy: "private",
      properties: {
        enable_recording: "cloud",
        // audio-only recording layout
        recordings_template: "{room_name}/{date}",
      },
    }),
  });
  if (!res.ok) throw new Error(`Daily ensureRoom failed: ${res.status} ${await res.text()}`);
  return name;
}

/** Short-lived meeting token scoped to one room + participant. */
export async function createMeetingToken(opts: {
  room: string;
  userName: string;
  userId: string;
  isOwner: boolean;
  expEpochSeconds: number;
}): Promise<string> {
  const res = await fetch(`${BASE}/meeting-tokens`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      properties: {
        room_name: opts.room,
        user_name: opts.userName,
        user_id: opts.userId,
        is_owner: opts.isOwner,
        exp: opts.expEpochSeconds,
        start_cloud_recording: false,
      },
    }),
  });
  if (!res.ok) throw new Error(`Daily token failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { token: string };
  return data.token;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run lib/daily.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/daily.ts lib/daily.test.ts
git commit -m "feat(assemblies): Daily REST client (ensureRoom, meeting tokens, transcription settings)"
```

---

### Task 5: Minutes generation — `lib/assemblies/minutes.ts`

**Files:**
- Create: `lib/assemblies/minutes.ts`
- Test: `lib/assemblies/minutes.test.ts`

- [ ] **Step 1: Write failing test** — `lib/assemblies/minutes.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildMinutesPrompt } from "./minutes";

describe("buildMinutesPrompt", () => {
  it("includes the transcript and asks for Greek HTML minutes", () => {
    const p = buildMinutesPrompt("Συμμετέχοντες: ...", "Πολυκατοικία Α");
    expect(p).toContain("Συμμετέχοντες: ...");
    expect(p).toContain("Πολυκατοικία Α");
    expect(p.toLowerCase()).toContain("html");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npx vitest run lib/assemblies/minutes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/assemblies/minutes.ts`**

```ts
import { env } from "@/lib/env";
import { logAPIUsage } from "@/lib/api-costs";

export function buildMinutesPrompt(transcript: string, buildingName: string): string {
  return [
    `Είσαι γραμματέας γενικής συνέλευσης πολυκατοικίας ("${buildingName}").`,
    `Με βάση το παρακάτω απομαγνητοφωνημένο κείμενο, σύνταξε επίσημα ΠΡΑΚΤΙΚΑ (MOM) στα ελληνικά.`,
    `Δομή: Θέματα Ημερήσιας Διάταξης, Συζήτηση ανά θέμα, Αποφάσεις, Εκκρεμότητες.`,
    `Επέστρεψε ΜΟΝΟ έγκυρο HTML (χωρίς markdown, χωρίς code fences), έτοιμο για email.`,
    ``,
    `--- TRANSCRIPT ---`,
    transcript,
  ].join("\n");
}

export type MinutesResult = { success: boolean; html?: string; tokens: number; error?: string };

/** Calls DeepSeek and logs token cost against the assembly's customer/building. */
export async function generateMinutesHtml(args: {
  transcript: string;
  buildingName: string;
  ctx: { companyId?: string; customerId?: string; buildingId?: string; assemblyId?: string; userId?: string };
}): Promise<MinutesResult> {
  if (!env.DEEPSEEK_API_KEY) return { success: false, tokens: 0, error: "DeepSeek key missing" };

  const model = "deepseek-chat";
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: buildMinutesPrompt(args.transcript, args.buildingName) }],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    await logAPIUsage({ apiName: "deepseek", endpoint: "/chat/completions", model, status: "FAILED", errorMessage: `HTTP ${res.status}`, ...args.ctx });
    return { success: false, tokens: 0, error: `DeepSeek ${res.status}` };
  }

  const data = (await res.json()) as any;
  const tokens = data.usage?.total_tokens ?? 0;
  await logAPIUsage({ apiName: "deepseek", endpoint: "/chat/completions", model, tokensUsed: tokens, status: "SUCCESS", ...args.ctx });

  return { success: true, html: data.choices?.[0]?.message?.content ?? "", tokens };
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run lib/assemblies/minutes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/assemblies/minutes.ts lib/assemblies/minutes.test.ts
git commit -m "feat(assemblies): DeepSeek minutes generation with token cost logging"
```

---

### Task 6: Participant-minute aggregation helper

**Files:**
- Create: `lib/assemblies/billing.ts`
- Test: `lib/assemblies/billing.test.ts`

- [ ] **Step 1: Write failing test** — `lib/assemblies/billing.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { addSession, totalParticipantMinutes } from "./billing";

describe("participant minutes", () => {
  it("accumulates seconds across join/leave then rounds up to minutes", () => {
    let secs = 0;
    secs = addSession(secs, 0, 90);    // 90s
    secs = addSession(secs, 100, 160); // +60s = 150s
    expect(secs).toBe(150);
    expect(totalParticipantMinutes([150, 30])).toBe(4); // ceil(150/60)+ceil(30/60)=3+1
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npx vitest run lib/assemblies/billing.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/assemblies/billing.ts`**

```ts
/** Add one join→leave session (epoch seconds) onto an accumulated total. */
export function addSession(accumulatedSeconds: number, joinedAt: number, leftAt: number): number {
  return accumulatedSeconds + Math.max(0, leftAt - joinedAt);
}

/** Sum of each participant's minutes, rounded up per participant. */
export function totalParticipantMinutes(perParticipantSeconds: number[]): number {
  return perParticipantSeconds.reduce((sum, s) => sum + Math.ceil(s / 60), 0);
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run lib/assemblies/billing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/assemblies/billing.ts lib/assemblies/billing.test.ts
git commit -m "feat(assemblies): participant-minute aggregation helpers"
```

---

### Task 7: Server actions — `app/actions/assemblies.ts`

**Files:**
- Create: `app/actions/assemblies.ts`

> Mirror `app/actions/announcements.ts`: `"use server"`, `requireStaff()`, `db` from `@/lib/db`, `revalidatePath`, email via `@/lib/mailgun`.

- [ ] **Step 1: Implement the action file**

```ts
"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { revalidatePath } from "next/cache";
import { ensureRoom, createMeetingToken } from "@/lib/daily";
import { generateMinutesHtml } from "@/lib/assemblies/minutes";
import { sendAnnouncementEmail } from "@/lib/mailgun";

async function requireStaff(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const u = await db.user.findUnique({ where: { id: session.user.id as string }, select: { id: true, role: true } });
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "PROPERTY_ADMIN"].includes(u?.role ?? "")) throw new Error("Forbidden");
  return u!.id;
}

/** Owners of a building (users with an OWNER occupancy on any of its units). */
async function buildingOwners(buildingId: string) {
  const occ = await db.unitOccupancy.findMany({
    where: { unit: { buildingId }, role: "OWNER", endDate: null },
    select: { userId: true, unitId: true, user: { select: { id: true, name: true, email: true } } },
  });
  // de-dupe by user (UnitOccupancy.user is required/non-null)
  const seen = new Map<string, { userId: string; unitId: string; name: string | null; email: string }>();
  for (const o of occ) {
    if (o.user.email && !seen.has(o.user.id)) {
      seen.set(o.user.id, { userId: o.user.id, unitId: o.unitId, name: o.user.name, email: o.user.email });
    }
  }
  return [...seen.values()];
}

export async function createAssembly(input: { buildingId: string; title: string; scheduledAt: string }) {
  const userId = await requireStaff();
  const building = await db.building.findUnique({ where: { id: input.buildingId }, select: { id: true, name: true, dailyRoomName: true } });
  if (!building) throw new Error("Building not found");

  const roomName = building.dailyRoomName ?? (await ensureRoom(building.id));
  if (!building.dailyRoomName) {
    await db.building.update({ where: { id: building.id }, data: { dailyRoomName: roomName } });
  }

  const assembly = await db.assembly.create({
    data: {
      buildingId: building.id,
      title: input.title,
      scheduledAt: new Date(input.scheduledAt),
      status: "SCHEDULED",
      dailyRoomName: roomName,
      createdById: userId,
    },
  });

  // Invite owners (email with link to OUR page) + participant rows.
  const owners = await buildingOwners(building.id);
  const link = `${env.NEXT_PUBLIC_APP_URL}/super-admin/buildings/${building.id}/assemblies/${assembly.id}`;
  for (const o of owners) {
    await db.assemblyParticipant.create({
      data: { assemblyId: assembly.id, userId: o.userId, unitId: o.unitId, displayName: o.name ?? o.email, invitedSentAt: new Date() },
    });
    await sendAnnouncementEmail(
      o.email,
      o.name,
      building.name,
      `Πρόσκληση σε Γενική Συνέλευση: ${input.title}`,
      `<p>Καλείστε σε Γενική Συνέλευση στις <strong>${new Date(input.scheduledAt).toLocaleString("el-GR")}</strong>.</p>
       <p>Πατήστε το κουμπί για να συμμετάσχετε.</p>`,
      link,
    );
  }

  revalidatePath(`/super-admin/buildings/${building.id}`);
  return { id: assembly.id };
}

/** Issue a short-lived Daily token for the current user (owner or staff of this building). */
export async function getAssemblyToken(assemblyId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const userId = session.user.id as string;

  const assembly = await db.assembly.findUnique({
    where: { id: assemblyId },
    select: { id: true, dailyRoomName: true, scheduledAt: true, building: { select: { id: true } } },
  });
  if (!assembly) throw new Error("Assembly not found");

  const me = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true } });
  const isStaff = ["SUPER_ADMIN", "ADMIN", "MANAGER", "PROPERTY_ADMIN"].includes(me?.role ?? "");
  const participant = await db.assemblyParticipant.findFirst({ where: { assemblyId, userId } });
  if (!isStaff && !participant) throw new Error("Forbidden");

  const exp = Math.floor(Date.now() / 1000) + 4 * 60 * 60; // 4h window
  const token = await createMeetingToken({
    room: assembly.dailyRoomName,
    userName: me?.name ?? "Συμμετέχων",
    userId,
    isOwner: isStaff,
    expEpochSeconds: exp,
  });
  return { token, roomName: assembly.dailyRoomName };
}

/** Core minutes generation WITHOUT auth — callable by the webhook. */
export async function runMinutes(assemblyId: string) {
  const a = await db.assembly.findUnique({
    where: { id: assemblyId },
    select: { id: true, transcriptRaw: true, buildingId: true, building: { select: { name: true, companyId: true, property: { select: { customerId: true } } } } },
  });
  if (!a?.transcriptRaw) throw new Error("No transcript yet");

  const result = await generateMinutesHtml({
    transcript: a.transcriptRaw,
    buildingName: a.building.name,
    ctx: { companyId: a.building.companyId ?? undefined, customerId: a.building.property?.customerId ?? undefined, buildingId: a.buildingId, assemblyId },
  });
  if (!result.success) throw new Error(result.error ?? "DeepSeek failed");

  await db.assembly.update({ where: { id: assemblyId }, data: { minutesDraft: result.html, status: "DRAFT_READY" } });
  revalidatePath(`/super-admin/buildings/${a.buildingId}/assemblies/${assemblyId}`);
  return { html: result.html };
}

/** Staff-facing wrapper: auth-gate then run. */
export async function generateMinutes(assemblyId: string) {
  await requireStaff();
  return runMinutes(assemblyId);
}

export async function approveAndSendMinutes(assemblyId: string, finalHtml: string) {
  await requireStaff();
  const a = await db.assembly.findUnique({
    where: { id: assemblyId },
    select: { id: true, title: true, buildingId: true, building: { select: { name: true } }, participants: { select: { id: true, userId: true } } },
  });
  if (!a) throw new Error("Assembly not found");

  await db.assembly.update({ where: { id: assemblyId }, data: { minutesFinal: finalHtml, status: "SENT", approvedAt: new Date(), sentAt: new Date() } });

  const link = `${env.NEXT_PUBLIC_APP_URL}/super-admin/buildings/${a.buildingId}/assemblies/${assemblyId}`;
  const owners = await buildingOwners(a.buildingId);
  for (const o of owners) {
    await sendAnnouncementEmail(
      o.email,
      o.name,
      a.building.name,
      `Πρακτικά Γενικής Συνέλευσης — ${a.title}`,
      finalHtml,
      link,
    );
  }
  await db.assemblyParticipant.updateMany({ where: { assemblyId }, data: { momSentAt: new Date() } });

  revalidatePath(`/super-admin/buildings/${a.buildingId}/assemblies/${assemblyId}`);
  return { sent: owners.length };
}

/** Cost breakdown for one assembly (groups APIUsageLog by apiName). */
export async function getAssemblyCost(assemblyId: string) {
  await requireStaff();
  const rows = await db.aPIUsageLog.groupBy({
    by: ["apiName"],
    where: { assemblyId },
    _sum: { totalCost: true, tokensUsed: true, requestCount: true },
  });
  const total = rows.reduce((s, r) => s + (r._sum.totalCost ?? 0), 0);
  return { total, byApi: rows.map((r) => ({ apiName: r.apiName, cost: r._sum.totalCost ?? 0, tokens: r._sum.tokensUsed ?? 0, units: r._sum.requestCount ?? 0 })) };
}
```

> **Note for executor:** confirm `Building` has `customerId` and `companyId` selectable. If the field names differ (e.g. via a relation), adjust the `select` and `ctx` mapping. Run `npx prisma generate` output / grep `model Building` in `prisma/schema.prisma` to verify before finalizing.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Fix any field-name mismatches surfaced against the real `Building`/`UnitOccupancy` schema.

- [ ] **Step 3: Commit**

```bash
git add app/actions/assemblies.ts
git commit -m "feat(assemblies): server actions (create, token, minutes, approve+send, cost)"
```

---

### Task 8: Daily webhook — `app/api/webhooks/daily/route.ts`

**Files:**
- Create: `app/api/webhooks/daily/route.ts`

> Verify signature on raw body BEFORE parsing (global rule). Daily signs webhooks with an HMAC; the secret is shown once when the webhook is created — store it as `DAILY_WEBHOOK_SECRET`. Add it to `lib/env.ts` optional vars (same pattern as Task 3).

- [ ] **Step 1: Add `DAILY_WEBHOOK_SECRET` to `lib/env.ts`** (optional vars + env object), commit-free for now.

- [ ] **Step 2: Implement the route**

```ts
import { NextRequest } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logAPIUsage } from "@/lib/api-costs";
import { generateMinutes } from "@/app/actions/assemblies";

function verify(raw: string, signature: string | null): boolean {
  const secret = env.DAILY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function findAssembly(roomName?: string) {
  if (!roomName) return null;
  return db.assembly.findFirst({
    where: { dailyRoomName: roomName, status: { in: ["SCHEDULED", "LIVE", "ENDED", "TRANSCRIBING"] } },
    orderBy: { scheduledAt: "desc" },
    select: { id: true, buildingId: true, building: { select: { companyId: true, property: { select: { customerId: true } } } } },
  });
}

export async function POST(req: NextRequest) {
  const raw = await req.text(); // raw FIRST
  if (!verify(raw, req.headers.get("x-daily-signature"))) {
    return new Response("invalid signature", { status: 401 });
  }
  const evt = JSON.parse(raw) as { type: string; payload?: any };
  const p = evt.payload ?? {};
  const assembly = await findAssembly(p.room ?? p.room_name);

  switch (evt.type) {
    case "meeting.started": {
      if (assembly) await db.assembly.update({ where: { id: assembly.id }, data: { status: "LIVE", dailySessionId: p.session_id ?? null } });
      break;
    }
    case "participant.joined": {
      if (assembly) {
        await db.assemblyParticipant.updateMany({
          where: { assemblyId: assembly.id, userId: p.user_id ?? undefined },
          data: { joinedAt: new Date() },
        });
      }
      break;
    }
    case "participant.left": {
      if (assembly && p.duration) {
        // accumulate seconds + bill participant-minutes
        await db.assemblyParticipant.updateMany({
          where: { assemblyId: assembly.id, userId: p.user_id ?? undefined },
          data: { leftAt: new Date(), durationSeconds: { increment: Math.round(p.duration) } },
        });
        await logAPIUsage({
          apiName: "daily",
          requestCount: Math.ceil(p.duration / 60), // minutes
          buildingId: assembly.buildingId,
          customerId: assembly.building.property?.customerId ?? undefined,
          companyId: assembly.building.companyId ?? undefined,
          assemblyId: assembly.id,
        });
      }
      break;
    }
    case "meeting.ended": {
      if (assembly) await db.assembly.update({ where: { id: assembly.id }, data: { status: "TRANSCRIBING" } });
      break;
    }
    case "recording.ready-to-download": {
      if (assembly && p.download_link) await db.assembly.update({ where: { id: assembly.id }, data: { recordingUrl: p.download_link } });
      break;
    }
    case "batch-processor.job-finished": {
      // transcription complete — p.output / p.transcription holds text or a fetch URL
      if (assembly) {
        const transcript: string = p.transcription?.text ?? p.output?.text ?? "";
        const minutes = Math.ceil((p.duration ?? 0) / 60);
        await db.assembly.update({ where: { id: assembly.id }, data: { transcriptRaw: transcript } });
        if (minutes > 0) {
          await logAPIUsage({
            apiName: "deepgram",
            requestCount: minutes,
            buildingId: assembly.buildingId,
            customerId: assembly.building.property?.customerId ?? undefined,
            companyId: assembly.building.companyId ?? undefined,
            assemblyId: assembly.id,
          });
        }
        if (transcript) await generateMinutes(assembly.id).catch((e) => console.error("auto-minutes failed", e));
      }
      break;
    }
  }

  return new Response("ok", { status: 200 });
}
```

> **Note for executor:** Daily webhook event names and payload field names (`p.room`, `p.duration`, `p.download_link`, transcription output shape) must be confirmed against current Daily docs (https://docs.daily.co/reference/rest-api/webhooks). Adjust field access accordingly. `generateMinutes` is called server-side here but it calls `requireStaff()` — extract its core into an internal helper `runMinutes(assemblyId)` without the auth guard, called by both the action and the webhook. Add that refactor: in Task 7 split `generateMinutes` into `runMinutes(assemblyId)` (no auth) + `generateMinutes` (auth → `runMinutes`), and import `runMinutes` here.

- [ ] **Step 3: Apply the `runMinutes` refactor** in `app/actions/assemblies.ts` (extract no-auth core; webhook imports `runMinutes`).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/daily/route.ts app/actions/assemblies.ts lib/env.ts
git commit -m "feat(assemblies): Daily webhook (lifecycle, participant/transcription billing, auto-draft)"
```

---

### Task 9: Install Daily React + AssembliesPanel

**Files:**
- Modify: `package.json` (deps)
- Create: `app/(dashboard)/super-admin/buildings/[id]/AssembliesPanel.tsx`

- [ ] **Step 1: Install client deps**

Run: `npm install @daily-co/daily-js @daily-co/daily-react jotai`
Expected: added to `package.json` (daily-react peer-deps `jotai`).

- [ ] **Step 2: Implement `AssembliesPanel.tsx`** — follow `AnnouncementsPanel.tsx` structure (client component, fetch list via a server action or props, DataTable, "Νέα Συνέλευση" modal calling `createAssembly`). Include columns: τίτλος, ημ/νία (`toLocaleString("el-GR")`), status badge, #συμμετεχόντων, κόστος. Each row links to `/super-admin/buildings/${buildingId}/assemblies/${id}`.

> Add a server action `listAssemblies(buildingId)` to `app/actions/assemblies.ts` returning `{ id, title, scheduledAt, status, participantCount, cost }[]` (cost via `getAssemblyCost` per row or a single grouped query). Mirror the `AnnouncementRow` typing approach.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app/\(dashboard\)/super-admin/buildings/\[id\]/AssembliesPanel.tsx app/actions/assemblies.ts
git commit -m "feat(assemblies): AssembliesPanel + listAssemblies action + daily-react deps"
```

---

### Task 10: Assembly page — embed, editor, cost card

**Files:**
- Create: `app/(dashboard)/super-admin/buildings/[id]/assemblies/[assemblyId]/page.tsx` (server component)
- Create: `app/(dashboard)/super-admin/buildings/[id]/assemblies/[assemblyId]/AssemblyRoom.tsx` (client — Daily embed)
- Create: `app/(dashboard)/super-admin/buildings/[id]/assemblies/[assemblyId]/MinutesEditor.tsx` (client — rich-text + approve)

- [ ] **Step 1: `page.tsx` (server component)** — load assembly + participants + `getAssemblyCost`; pass to children. Show:
  - if status ∈ {SCHEDULED, LIVE}: `<AssemblyRoom assemblyId=... />`
  - if status ∈ {DRAFT_READY, APPROVED, SENT} and `minutesDraft`: `<MinutesEditor assemblyId=... initialHtml=... readonly={status==="SENT"} />`
  - always: cost breakdown card (total + per-api rows from `getAssemblyCost`).

- [ ] **Step 2: `AssemblyRoom.tsx` (client)** — uses `@daily-co/daily-react`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { DailyProvider, useDaily, useTranscription } from "@daily-co/daily-react";
import { getAssemblyToken } from "@/app/actions/assemblies";

// On mount: const { token, roomName } = await getAssemblyToken(assemblyId);
// join `https://<your-daily-domain>.daily.co/${roomName}` with token, audio-only,
// then call daily.startTranscription({ language: "el", model: "nova-3", punctuate: true }).
// Render participant tiles + live transcription panel (useTranscription()).
// Manager-only "Λήξη" button → daily.leave() / stopRecording.
```

> Executor: wire the join URL from the Daily domain (add `NEXT_PUBLIC_DAILY_DOMAIN` env). Keep audio-only by not requesting camera. Reference: https://docs.daily.co/docs/daily-react/docs/transcription.

- [ ] **Step 3: `MinutesEditor.tsx` (client)** — `components/ui/rich-text.tsx` editor seeded with `initialHtml`; "Δημιουργία ξανά" → `generateMinutes(assemblyId)`; "Έγκριση & Αποστολή" → `approveAndSendMinutes(assemblyId, html)`. Disable when `readonly`.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/super-admin/buildings/[id]/assemblies"
git commit -m "feat(assemblies): assembly page with Daily embed, live transcription, minutes editor, cost card"
```

---

### Task 11: Wire the tab into BuildingDashboard

**Files:**
- Modify: `app/(dashboard)/super-admin/buildings/[id]/BuildingDashboard.tsx`

- [ ] **Step 1: Import the panel** (with the other panel imports ~line 17):

```ts
import { AssembliesPanel } from "./AssembliesPanel";
```

- [ ] **Step 2: Add a TABS entry** — find the `TABS` array (icons from `react-icons/ri`, e.g. `RiGroupLine`) and add:

```ts
  { key: "assemblies", label: "Συνελεύσεις", icon: RiGroupLine },
```

(Import `RiGroupLine` from `react-icons/ri` if not already imported.)

- [ ] **Step 3: Add the panel to the switch** (after the `ann` branch ~line 160):

```tsx
        ) : tab === "assemblies" ? (
          <AssembliesPanel buildingId={building.id} />
```

- [ ] **Step 4: Typecheck + build + run lint of tests**

Run: `npx tsc --noEmit && npx vitest run lib/`
Expected: no errors, tests pass.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/super-admin/buildings/[id]/BuildingDashboard.tsx"
git commit -m "feat(assemblies): add Συνελεύσεις tab to building dashboard"
```

---

## Manual verification (after Task 11)

1. **Daily setup:** in Daily dashboard, set domain Deepgram key (`DEEP_GRAM_API_KEY`), create a webhook → `https://property.dgsmart.gr/api/webhooks/daily`, copy its secret into Coolify as `DAILY_WEBHOOK_SECRET`. Set `DAILY_API_KEY`, `NEXT_PUBLIC_DAILY_DOMAIN`.
2. Create an assembly on a building with at least one OWNER user → owner receives email with link.
3. Open the assembly page as staff → join, speak Greek → live transcription panel shows Greek text.
4. End meeting → status TRANSCRIBING → webhook fills transcript → status DRAFT_READY with DeepSeek minutes.
5. Edit minutes → Έγκριση & Αποστολή → owners receive HTML MOM.
6. Cost card shows non-zero `daily`, `deepgram`, `deepseek`, `mailgun` rows; confirm rows in `APIUsageLog` carry `buildingId`/`customerId`/`assemblyId`.

## Post-implementation follow-ups (from final code review)

Fixed during implementation: mailgun cost attribution, transcript persistence on end + auto-draft, participant-row creation on join.

Still open — require confirming Daily's live webhook contract / are hardening items:
- **Daily webhook signature scheme (verify before go-live):** `app/api/webhooks/daily/route.ts` currently HMACs the raw body with `DAILY_WEBHOOK_SECRET` and reads header `x-daily-signature`. Daily's real scheme (header names + whether the signing string is `timestamp + "." + body`) must be confirmed against current Daily docs and adjusted, or all real events will be rejected.
- **Replay protection (spec §6):** persist Daily's event/delivery id with TTL and drop duplicates with 200 — otherwise a replayed `participant.left` re-bills `daily` minutes.
- **Per-recipient email failure handling:** `createAssembly` / `approveAndSendMinutes` send in a serial loop with no per-recipient try/catch; one failure aborts the rest. Collect failures and report.
- **Dedicated MOM email template:** MOM currently reuses `sendAnnouncementEmail`'s "Έλαβα γνώση" acknowledgment framing; a formal-minutes template is more appropriate.
- **DeepSeek input/output token split:** cost uses a flat blended per-1K rate; refine if precise billing matters.

## Future / Out of scope (do NOT build now)

- Module activation + monthly billing via existing `Service`/`PropertyService`/`ServiceInvoice`.
- Pre-purchased minute packages (`AssemblyMinuteBalance`) decremented by the already-tracked `daily` participant-minutes.
