# Κοινόχρηστα Quick-Pay (Viva) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Flag-gated Viva quick-pay on the occupant control-center overview — per-unit payable buttons + pay-all, server-computed amounts, a re-fetch-verified callback that reconciles onto ExpenseAllocation. Disabled by default («Σύντομα διαθέσιμο») until Viva is verified.

**Architecture:** `lib/payments/koinochrista-pay.ts` (flag + server-side outstanding), `POST /api/koinochrista/pay` (intent → Viva order), `/api/koinochrista/callback` (verify-then-mark-paid), and a `QuickPayCard`/`QuickPayButtons` in the occupant overview. No schema migration (`ExpensePaymentMethod.VIVA` already exists; reconcile on `ExpenseAllocation`).

**Tech Stack:** Next.js 16 route handlers, Prisma 7, existing `lib/viva.ts` (`createVivaOrder`, `getAccessToken`, `vivaUrls`), realtime bus, Orithon tokens, vitest.

**Spec:** `docs/superpowers/specs/2026-07-19-koinochrista-quickpay-design.md`

Conventions: branch `main`; stage only touched files; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Ignore pre-existing failures: vitest `lib/cms/landing-types.test.ts`; tsc `app/actions/auth.ts`, `lib/otp.ts`, `prisma.config.ts`, `prisma/seed.ts`, `app/api/super-admin/costs/*`, `components/forms/ForgotPasswordForm.tsx`.

Facts: `ExpensePaymentMethod = CARD|CASH|VIVA|BANK_TRANSFER|CHECK|OTHER` (VIVA present). `ExpenseAllocation{ unitId, ownerUserId, ownerAmount, ownerPaid, ownerPaidAt, ownerPaymentMethod, tenantUserId, tenantAmount, tenantPaid, tenantPaidAt, tenantPaymentMethod, expense{ month, issuedMonth, building{ id, name } } }`. `getBuildingAccess(userId, buildingId)` → `{ viewer:"occupant"|..., ... }`. Existing wallet flow: `app/api/wallet/topup/{route,callback}.ts` (pattern to mirror + IMPROVE the callback verification). `lib/viva.ts` exports `createVivaOrder`, `getAccessToken`, `vivaUrls`. Realtime: `publishBuildingEvent(buildingId, "payment")` from `lib/realtime/bus`. Occupant page: `app/(customer)/building/[id]/page.tsx` (occupant branch renders `OccupantBuildingShell`).

---

### Task 1: Flag + server-side outstanding (TDD for the reducer)

**Files:** Create `lib/payments/koinochrista-pay.ts`; Test `lib/payments/koinochrista-pay.test.ts`.

- [ ] **Step 1:** Failing test for the pure reducer that picks the viewer's unpaid allocations:

```ts
import { describe, it, expect } from "vitest";
import { selectUnpaidForSide, type AllocForPay } from "./koinochrista-pay";

const a = (o: Partial<AllocForPay>): AllocForPay => ({
  id: "x", ownerUserId: "u", ownerAmount: 0, ownerPaid: false,
  tenantUserId: null, tenantAmount: 0, tenantPaid: false, ...o,
});

describe("selectUnpaidForSide", () => {
  it("owner side: sums unpaid owner amounts for the user, skips paid and other users", () => {
    const r = selectUnpaidForSide([
      a({ id: "1", ownerUserId: "me", ownerAmount: 10, ownerPaid: false }),
      a({ id: "2", ownerUserId: "me", ownerAmount: 5, ownerPaid: true }),   // paid → skip
      a({ id: "3", ownerUserId: "other", ownerAmount: 9, ownerPaid: false }), // other → skip
    ], "me");
    expect(r.amountCents).toBe(1000);
    expect(r.owner).toEqual(["1"]);
    expect(r.tenant).toEqual([]);
  });
  it("tenant side + both: sums both sides where the user is that side", () => {
    const r = selectUnpaidForSide([
      a({ id: "1", ownerUserId: "me", ownerAmount: 20, ownerPaid: false, tenantUserId: "me", tenantAmount: 3, tenantPaid: false }),
    ], "me");
    expect(r.amountCents).toBe(2300);
    expect(r.owner).toEqual(["1"]);
    expect(r.tenant).toEqual(["1"]);
  });
});
```

- [ ] **Step 2:** Run → FAIL. Implement `lib/payments/koinochrista-pay.ts`:

```ts
import { db } from "@/lib/db";

export function isKoinochristaPayEnabled(): boolean {
  return process.env.VIVA_KOINOCHRISTA_ENABLED === "true"
    && !!process.env.VIVA_CLIENT_ID && !!process.env.VIVA_CLIENT_SECRET;
}

export type AllocForPay = {
  id: string;
  ownerUserId: string | null; ownerAmount: number; ownerPaid: boolean;
  tenantUserId: string | null; tenantAmount: number; tenantPaid: boolean;
};

/** Pure: pick the user's unpaid owner/tenant allocation ids + total cents. */
export function selectUnpaidForSide(rows: AllocForPay[], userId: string) {
  let cents = 0; const owner: string[] = []; const tenant: string[] = [];
  for (const r of rows) {
    if (r.ownerUserId === userId && !r.ownerPaid && r.ownerAmount > 0) { cents += Math.round(r.ownerAmount * 100); owner.push(r.id); }
    if (r.tenantUserId === userId && !r.tenantPaid && r.tenantAmount > 0) { cents += Math.round(r.tenantAmount * 100); tenant.push(r.id); }
  }
  return { amountCents: cents, owner, tenant };
}

type OwnedUnit = { id: string; unitNumber: string };

async function myUnits(userId: string, buildingId: string): Promise<OwnedUnit[]> {
  return db.unit.findMany({
    where: { buildingId, OR: [{ ownerId: userId }, { residentId: userId }, { occupancies: { some: { userId, endDate: null } } }] },
    orderBy: { unitNumber: "asc" }, select: { id: true, unitNumber: true },
  });
}

async function allocsForUnit(unitId: string): Promise<AllocForPay[]> {
  const rows = await db.expenseAllocation.findMany({
    where: { unitId },
    select: { id: true, ownerUserId: true, ownerAmount: true, ownerPaid: true, tenantUserId: true, tenantAmount: true, tenantPaid: true },
  });
  return rows.map((r) => ({
    id: r.id, ownerUserId: r.ownerUserId, ownerAmount: Number(r.ownerAmount), ownerPaid: r.ownerPaid,
    tenantUserId: r.tenantUserId, tenantAmount: Number(r.tenantAmount), tenantPaid: r.tenantPaid,
  }));
}

export async function getUnitOutstanding(userId: string, buildingId: string, unitId: string) {
  const units = await myUnits(userId, buildingId);
  if (!units.some((u) => u.id === unitId)) return null; // not the user's unit
  const sel = selectUnpaidForSide(await allocsForUnit(unitId), userId);
  return { unitId, ...sel };
}

export async function getBuildingOutstanding(userId: string, buildingId: string) {
  const units = await myUnits(userId, buildingId);
  const perUnit = await Promise.all(units.map(async (u) => {
    const sel = selectUnpaidForSide(await allocsForUnit(u.id), userId);
    return { unitId: u.id, unitNumber: u.unitNumber, amountCents: sel.amountCents, owner: sel.owner, tenant: sel.tenant };
  }));
  const totalCents = perUnit.reduce((s, u) => s + u.amountCents, 0);
  return { perUnit, totalCents };
}
```
Note: `ExpenseAllocation.ownerUserId/tenantUserId` may be null for older rows — the reducer matches on `=== userId` so nulls are safely skipped. If the schema uses a different owner/tenant user field name, adapt (grep the model).

- [ ] **Step 3:** Run test → PASS. `npx tsc --noEmit 2>&1 | grep koinochrista-pay` empty. Commit `feat(pay): κοινόχρηστα outstanding + Viva feature flag`.

---

### Task 2: Intent route

**Files:** Create `app/api/koinochrista/pay/route.ts`.

- [ ] **Step 1:** Implement (mirror `app/api/wallet/topup/route.ts` isolation — access from session, never trust client amount):

```ts
import { getEffectiveSession } from "@/lib/auth-effective";
import { getBuildingAccess } from "@/lib/building-access";
import { isKoinochristaPayEnabled, getUnitOutstanding, getBuildingOutstanding } from "@/lib/payments/koinochrista-pay";
import { createVivaOrder } from "@/lib/viva";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id as string;

  let body: { buildingId?: string; unitId?: string };
  try { body = await request.json(); } catch { body = {}; }
  const buildingId = String(body.buildingId ?? "");
  if (!buildingId) return Response.json({ error: "bad_request" }, { status: 400 });

  const access = await getBuildingAccess(userId, buildingId);
  if (!access || access.viewer !== "occupant") return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isKoinochristaPayEnabled()) return Response.json({ error: "disabled" }, { status: 503 });

  const building = await db.building.findUnique({ where: { id: buildingId }, select: { name: true } });
  let amountCents = 0, scope = "all";
  if (body.unitId) {
    const o = await getUnitOutstanding(userId, buildingId, String(body.unitId));
    if (!o) return Response.json({ error: "forbidden" }, { status: 403 });
    amountCents = o.amountCents; scope = String(body.unitId);
  } else {
    amountCents = (await getBuildingOutstanding(userId, buildingId)).totalCents;
  }
  if (amountCents <= 0) return Response.json({ error: "nothing_due" }, { status: 400 });

  const merchantTrns = `koino:${buildingId}:${userId}:${scope}`;
  try {
    const { checkoutUrl } = await createVivaOrder({
      amountCents,
      customerTrns: `Κοινόχρηστα ${building?.name ?? ""}`.trim(),
      merchantTrns,
    });
    return Response.json({ checkoutUrl });
  } catch (e) {
    return Response.json({ error: "viva_unavailable", detail: String(e) }, { status: 502 });
  }
}
```

- [ ] **Step 2:** `npx tsc --noEmit 2>&1 | grep "koinochrista/pay"` empty; `npm run build`. Commit `feat(pay): κοινόχρηστα Viva intent route (flag-gated, server-computed amount)`.

---

### Task 3: Verified callback → reconcile allocations

**Files:** Create `app/api/koinochrista/callback/route.ts`; extend `lib/viva.ts` with `getVivaTransaction`.

- [ ] **Step 1:** `lib/viva.ts` — add:

```ts
export interface VivaTransaction { statusId?: string; amount?: number; merchantTrns?: string; }
/** Re-fetch a transaction to verify authenticity/amount before acting on a webhook. */
export async function getVivaTransaction(transactionId: string): Promise<VivaTransaction> {
  const token = await getAccessToken();
  const { api } = vivaUrls();
  const res = await fetch(`${api}/checkout/v2/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!res.ok) throw new Error(`Viva ${res.status}: ${await res.text()}`);
  return (await res.json()) as VivaTransaction;
}
```
(Confirm the transaction endpoint path against Viva docs in the code comment; it stays behind the flag until sandbox-verified.)

- [ ] **Step 2:** `app/api/koinochrista/callback/route.ts` — GET handshake identical to the wallet callback (reuse the key logic). POST:
  - parse the event; require `EventData.MerchantTrns` matching `^koino:([^:]+):([^:]+):(.+)$` → buildingId, userId, scope; require `TransactionId`.
  - **verify**: `const tx = await getVivaTransaction(TransactionId)`; require `tx.statusId === "F"` (success) and `tx.merchantTrns === MerchantTrns`; recompute the outstanding server-side (`getUnitOutstanding`/`getBuildingOutstanding`) and require `tx.amount`'s cents ≈ recomputed (±1 cent). On any mismatch → 400/401, do NOT mark paid.
  - mark paid: for the selected allocation ids, `db.expenseAllocation.updateMany` — owner ids → `{ ownerPaid: true, ownerPaidAt: now, ownerPaymentMethod: "VIVA" }`, tenant ids → `{ tenantPaid: true, tenantPaidAt: now, tenantPaymentMethod: "VIVA" }`. Idempotent (only currently-unpaid ids are selected, so a replay marks nothing new). `revalidatePath("/building/${buildingId}")`; `publishBuildingEvent(buildingId, "payment")`. Return 200.
  - Wrap all in try/catch → 200 for benign/duplicate, 4xx for verification failure (never 500 that Viva retries forever).

- [ ] **Step 3:** `npx tsc --noEmit 2>&1 | grep -E "koinochrista/callback|lib/viva"` empty; `npm run build`. Commit `feat(pay): verified κοινόχρηστα Viva callback reconciling allocations`.

---

### Task 4: Overview quick-pay UI

**Files:** Create `components/building/occupant-shell/QuickPayCard.tsx`; modify `components/building/occupant-shell/OccupantBuildingShell.tsx`; modify `app/(customer)/building/[id]/page.tsx`; modify `lib/building/occupant-data.ts` (add outstanding + payEnabled to the payload, OR pass separately from the page).

- [ ] **Step 1:** Page: after building the occupant `data`, also fetch `const outstanding = await getBuildingOutstanding(userId, id);` and `const payEnabled = isKoinochristaPayEnabled();` and pass to `OccupantBuildingShell` as `quickPay={{ perUnit: outstanding.perUnit.map(u=>({unitId:u.unitId,unitNumber:u.unitNumber,amountCents:u.amountCents})), totalCents: outstanding.totalCents, enabled: payEnabled }}`.
- [ ] **Step 2:** `QuickPayCard` (client): props `{ buildingId, perUnit, totalCents, enabled }`. Card «Γρήγορη πληρωμή κοινοχρήστων». For each unit with `amountCents>0`: row «Μονάδα {n} — {€}» + button «Πληρωμή με Viva» (disabled + «Σύντομα διαθέσιμο» tooltip when `!enabled`). When >1 owing unit: «Πληρωμή όλων {€total}». Buttons POST `/api/koinochrista/pay` `{ buildingId, unitId? }`; on `{checkoutUrl}` → `window.location.href = checkoutUrl`; on 503 → inline «Οι online πληρωμές δεν είναι ακόμη διαθέσιμες»; on other error → toast/inline message. Units with 0 → «Εξοφλημένο» chip. If total 0 → card shows «Δεν υπάρχουν εκκρεμείς οφειλές». tabular-nums, Orithon tokens, Ri Line icons (RiBankCardLine/RiSecurePaymentLine).
- [ ] **Step 3:** OccupantBuildingShell: render `<QuickPayCard …/>` at the top of the Επισκόπηση section (above the current overview content). Thread the `quickPay` prop through.
- [ ] **Step 4:** `.env` (gitignored — just note in the report; do not commit secrets): document `VIVA_KOINOCHRISTA_ENABLED=false`.
- [ ] **Step 5:** `npx tsc --noEmit 2>&1 | grep -E "QuickPay|OccupantBuilding|building/\[id\]|occupant-data"` empty; `npm run build`; `npx vitest run` (only pre-existing failure). Commit `feat(pay): quick-pay card on the occupant overview (flag-gated)`.

---

### Task 5: Verification + security review + ship

- [ ] `npx vitest run`; `npx tsc --noEmit`; `npm run build` — green modulo documented.
- [ ] Dev smoke (flag OFF, the default): `/building/[id]` occupant overview shows the quick-pay card with amounts and disabled «Σύντομα διαθέσιμο» buttons; `curl -X POST /api/koinochrista/pay -d '{"buildingId":"x"}'` unauthenticated → 401; authenticated occupant → 503 (disabled).
- [ ] Live tsx check for Λυδία: `getBuildingOutstanding` returns her per-unit unpaid owner totals; amounts match the statement's unpaid ΠΛΗΡΩΤΕΟ.
- [ ] **Security review agent** on the money flow: amount never trusted from client; callback verifies via re-fetch + amount match + merchantTrns match; idempotent; occupant-only; no cross-unit settlement; flag default OFF; no secrets committed.
- [ ] Update memory ([[project_viva_payments]]); push to GitHub main. Note in the final message: the live path requires sandbox verification of Viva + confirming the transaction endpoint before setting `VIVA_KOINOCHRISTA_ENABLED=true`.
