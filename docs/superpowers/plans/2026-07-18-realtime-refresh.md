# Real-time Auto-Refresh (SSE) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Building-scoped mutations push SSE events so signage/manager/portal/owner screens `router.refresh()` automatically.

**Architecture:** In-process `EventEmitter` bus (`globalThis`-cached), publish calls in the mutating server actions, an authorized SSE route per building, and a tiny client `AutoRefresh` component mounted on each surface. Pages stay server components.

**Tech Stack:** Next.js 16 route handlers (nodejs runtime, ReadableStream SSE), EventSource, vitest.

**Spec:** `docs/superpowers/specs/2026-07-18-realtime-refresh-design.md`

Conventions: branch `main`; stage only touched files; commit trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Pre-existing failures to ignore: vitest `lib/cms/landing-types.test.ts`; tsc `app/actions/auth.ts`, `lib/otp.ts`, `prisma.config.ts`, `prisma/seed.ts`, `app/api/super-admin/costs/*`, `components/forms/ForgotPasswordForm.tsx`.

---

### Task 1: Event bus (TDD)

**Files:**
- Create: `lib/realtime/bus.ts`
- Test: `lib/realtime/bus.test.ts`

- [ ] **Step 1: Failing test** `lib/realtime/bus.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { publishBuildingEvent, subscribeBuilding } from "./bus";

describe("realtime bus", () => {
  it("delivers events to subscribers of the same building only", () => {
    const a = vi.fn(); const b = vi.fn();
    const offA = subscribeBuilding("b1", a);
    const offB = subscribeBuilding("b2", b);
    publishBuildingEvent("b1", "payment");
    expect(a).toHaveBeenCalledWith({ type: "payment" });
    expect(b).not.toHaveBeenCalled();
    offA(); offB();
  });
  it("stops delivery after unsubscribe", () => {
    const fn = vi.fn();
    const off = subscribeBuilding("b1", fn);
    off();
    publishBuildingEvent("b1", "expense");
    expect(fn).not.toHaveBeenCalled();
  });
  it("publish never throws even with a throwing subscriber", () => {
    const off = subscribeBuilding("b1", () => { throw new Error("boom"); });
    expect(() => publishBuildingEvent("b1", "announcement")).not.toThrow();
    off();
  });
});
```

- [ ] **Step 2:** `npx vitest run lib/realtime/bus.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `lib/realtime/bus.ts`:

```ts
import { EventEmitter } from "node:events";

/** Building-scoped realtime notifications. In-process only — the deploy is a
 *  single Node instance; a Redis adapter replaces this if we ever scale out. */
export type BuildingEventType =
  | "payment" | "expense" | "announcement" | "maintenance" | "calendar"
  | "assembly" | "file" | "contact" | "koinochrista" | "unit";

export type BuildingEvent = { type: BuildingEventType };

const g = globalThis as unknown as { __rtBus?: EventEmitter };
const bus = (g.__rtBus ??= (() => {
  const e = new EventEmitter();
  e.setMaxListeners(500);
  return e;
})());

export function publishBuildingEvent(buildingId: string, type: BuildingEventType): void {
  try {
    bus.emit(`building:${buildingId}`, { type } satisfies BuildingEvent);
  } catch {
    // Notifications must never break the mutation that triggered them.
  }
}

export function subscribeBuilding(buildingId: string, listener: (e: BuildingEvent) => void): () => void {
  const channel = `building:${buildingId}`;
  const safe = (e: BuildingEvent) => { try { listener(e); } catch {} };
  bus.on(channel, safe);
  return () => bus.off(channel, safe);
}
```
Note: `emit` invokes listeners synchronously — a throwing listener propagates out of `emit`, so the safety wrap lives around the LISTENER (`safe`), and the `try` in publish is belt-and-braces.

- [ ] **Step 4:** test → PASS.
- [ ] **Step 5:** `npx tsc --noEmit 2>&1 | grep realtime` → empty. Commit `feat(realtime): in-process building event bus`.

---

### Task 2: SSE route

**Files:**
- Create: `app/api/realtime/route.ts`

- [ ] **Step 1: Implement** (reuse the access rules; read `lib/building-access.ts` and `lib/signage/data.ts` first):

```ts
import { NextRequest } from "next/server";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { subscribeBuilding } from "@/lib/realtime/bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STAFF = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"];

async function canListen(userId: string, role: string, buildingId: string): Promise<boolean> {
  if (STAFF.includes(role)) return true;
  if (role === "PROPERTY_ADMIN" || role === "PROPERTY_VIEWER") {
    const b = await db.building.findUnique({ where: { id: buildingId }, select: { propertyId: true } });
    if (!b) return false;
    const a = await db.managementAssignment.findFirst({
      where: { userId, OR: [{ buildingId }, { propertyId: b.propertyId }] }, select: { id: true },
    });
    return !!a;
  }
  if (role === "PROPERTY_OWNER" || role === "PROPERTY_RESIDENT") {
    const u = await db.unit.findFirst({
      where: {
        buildingId,
        OR: [{ ownerId: userId }, { residentId: userId }, { occupancies: { some: { userId, endDate: null } } }],
      },
      select: { id: true },
    });
    return !!u;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) return new Response("Unauthorized", { status: 401 });
  const buildingId = req.nextUrl.searchParams.get("building");
  if (!buildingId) return new Response("Missing building", { status: 400 });
  const allowed = await canListen(eff.user.id as string, eff.user.role as string, buildingId);
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (text: string) => {
        try { controller.enqueue(encoder.encode(text)); } catch {}
      };
      send(`: connected\n\n`);
      const off = subscribeBuilding(buildingId, (e) => send(`data: ${JSON.stringify(e)}\n\n`));
      const heartbeat = setInterval(() => send(`: hb\n\n`), 25000);
      const close = () => {
        clearInterval(heartbeat);
        off();
        try { controller.close(); } catch {}
      };
      req.signal.addEventListener("abort", close);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

- [ ] **Step 2:** `npx tsc --noEmit 2>&1 | grep "api/realtime"` → empty; `npm run build` includes `/api/realtime`.
- [ ] **Step 3:** Dev smoke: with dev server, `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/realtime?building=x"` → 401 (or 307 if proxy intercepts — inspect; API routes normally bypass the login redirect, confirm in proxy.ts matcher).
- [ ] **Step 4:** Commit `feat(realtime): authorized SSE stream per building`.

---

### Task 3: Publishers in server actions

**Files (add `import { publishBuildingEvent } from "@/lib/realtime/bus";` and one call after each successful mutation, right where the existing `revalidatePath('/building/…')` twin sits):**

| File | Mutations → event |
|---|---|
| `app/actions/koinochrista.ts` | setAllocationPaid, setAllocationsPaid → `"payment"`; includeExpensesInIssuance / issuance mutations → `"koinochrista"` |
| `app/actions/building-expenses.ts` | create/update/delete expense, uploadExpensePayment → `"expense"` |
| `app/actions/announcements.ts` | createAnnouncement (per target buildingId), deleteAnnouncement (when buildingId) → `"announcement"` |
| `app/actions/maintenance-requests.ts` | createMaintenanceRequest, changeRequestStatus (and other mutations passing buildingId to revalidateAll) → `"maintenance"` — cleanest: publish inside `revalidateAll(requestId, buildingId)` when buildingId present |
| `app/actions/maintenance-logs.ts` | completeMaintenance → `"maintenance"` |
| `app/actions/recurring-tasks.ts` | create/update/markTaskDone/delete → `"calendar"` |
| `app/actions/assemblies.ts` | createAssembly, endAssembly, approveAndSendMinutes → `"assembly"` |
| `app/actions/building-files.ts` | upload/delete → `"file"` |
| `app/actions/contacts.ts` | create/update/delete → `"contact"` |
| `app/actions/unit-occupants.ts` + unit CRUD in `app/actions/buildings.ts` | assign/clear/create occupant, unit create/update/delete → `"unit"` |

- [ ] **Step 1:** Apply the table (grep each file for `revalidatePath(\`/building/` to find the exact sites; one publish per mutation, after DB success).
- [ ] **Step 2:** `npx tsc --noEmit 2>&1 | grep app/actions` → empty; `npx vitest run` → only pre-existing failure; `npm run build` OK.
- [ ] **Step 3:** Commit `feat(realtime): publish building events from mutating actions`.

---

### Task 4: AutoRefresh component + mounts

**Files:**
- Create: `components/realtime/AutoRefresh.tsx`
- Modify: `components/signage/SignageBoard.tsx` (mount + demote 60 s polling to 5 min fallback)
- Modify: `components/building/manager-shell/BuildingManagerShell.tsx` (mount)
- Modify: `app/(customer)/portal/page.tsx`, `app/(customer)/owner/page.tsx` (mount per building, cap 5)

- [ ] **Step 1:** `components/realtime/AutoRefresh.tsx`:

```tsx
"use client";

import { useEffect, useRef, startTransition } from "react";
import { useRouter } from "next/navigation";

/** Subscribes to the building's SSE stream and refreshes the RSC payload on events. */
export function AutoRefresh({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/realtime?building=${encodeURIComponent(buildingId)}`);
    es.onmessage = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        startTransition(() => router.refresh());
      }, 2000);
    };
    return () => {
      es.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [buildingId, router]);

  return null;
}
```

- [ ] **Step 2:** SignageBoard: render `<AutoRefresh buildingId={data.building.id} />` and change the existing `router.refresh()` interval from 60_000 to 300_000 (fallback).
- [ ] **Step 3:** BuildingManagerShell: render `<AutoRefresh buildingId={building.id} />` at the top of the shell.
- [ ] **Step 4:** `/portal` page: after fetching the dashboard, derive resident building ids (already have unit) — render `<AutoRefresh>` for the (single) unit's building when present. `/owner` page: `getOwnerBuildingIds(userId)` → `.slice(0, 5).map(id => <AutoRefresh key={id} buildingId={id} />)`.
- [ ] **Step 5:** `npx tsc --noEmit` filtered clean; `npm run build`; dev smoke: open two terminals — `curl -N` the stream (authenticated via cookie is awkward; instead verify by grepping dev-server logs) OR simply verify no runtime errors on `/signage` render. Commit `feat(realtime): auto-refresh surfaces on building events`.

---

### Task 5: Verification

- [ ] `npx vitest run` (bus tests green; only pre-existing landing-types failure).
- [ ] `npx tsc --noEmit` — only documented pre-existing errors.
- [ ] `npm run build` — success.
- [ ] Live E2E (dev server + two sessions): script with tsx that calls `publishBuildingEvent` is NOT possible cross-process — instead verify end-to-end by: logging in is manual, so at minimum `curl -s -N "http://localhost:3000/api/realtime?building=<id>"` unauthenticated → 401, and a code-trace review that a mutation → publish → subscriber → SSE frame chain is connected. Full visual E2E happens post-deploy by making a payment and watching the signage refresh.
- [ ] Final review, memory, push (user pre-authorized push to GitHub main).
