# Per-Property Viva Setup + Crypto Implementation Plan (sub-project 1+2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Secrets crypto helper + a per-property Viva credentials setup (role-gated SUPER_ADMIN/ADMIN/MANAGER) in a new manager-shell «Ρυθμίσεις» section and the super-admin property page; wire the quick-pay stubs to the property's creds; remove the wallet from owner/resident menus.

**Architecture:** `lib/crypto/secrets.ts` (AES-256-GCM), `lib/property-access.ts` + `app/actions/property-viva.ts` (guarded save/read, encrypt at rest, mask on read), replace the `createPropertyVivaOrder`/`getPropertyVivaTransaction` stubs with per-property-cred calls, `components/property/PropertyVivaSetup.tsx` mounted in both surfaces, RBAC wallet cleanup + reconcile.

**Tech Stack:** Next.js 16, Prisma 7, node:crypto, Orithon tokens, react-icons/ri, vitest.

**Spec:** `docs/superpowers/specs/2026-07-19-property-viva-setup-design.md`

Conventions: branch `main`; stage only touched files; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Ignore pre-existing failures: vitest `lib/cms/landing-types.test.ts`; tsc `app/actions/auth.ts`, `lib/otp.ts`, `prisma.config.ts`, `prisma/seed.ts`, `app/api/super-admin/costs/*`, `components/forms/ForgotPasswordForm.tsx`.

Facts: `Property{ vivaEnabled Boolean, vivaMerchantId String?, vivaApiKeyEnc String?, vivaSourceCode String?, buildings Building[] }`. `lib/payments/koinochrista-pay.ts` has `getPropertyVivaConfig`, `isPropertyVivaEnabled`, and the throwing `createPropertyVivaOrder`/`getPropertyVivaTransaction` stubs. `lib/rbac/registry.ts` grants `customer-wallet` to PROPERTY_OWNER + PROPERTY_RESIDENT (remove) + PROPERTY_ADMIN (keep). `prisma/reconcile-rbac.ts` syncs system roles. Manager shell sections in `components/building/manager-shell/sections.ts` + switch in `BuildingManagerShell.tsx`. `lib/building-access.ts` `managerBuildingIds` shows the assignment pattern.

---

### Task 1: Secrets crypto (TDD)

**Files:** Create `lib/crypto/secrets.ts`; Test `lib/crypto/secrets.test.ts`.

- [ ] **Step 1:** Failing test (use a fixed 32-byte test key via env in the test):

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => { process.env.SECRETS_ENCRYPTION_KEY = randomBytes(32).toString("base64"); });

describe("secrets crypto", () => {
  it("round-trips", async () => {
    const { encryptSecret, decryptSecret } = await import("./secrets");
    const enc = encryptSecret("viva-api-key-123");
    expect(enc).not.toContain("viva-api-key-123");
    expect(decryptSecret(enc)).toBe("viva-api-key-123");
  });
  it("rejects a tampered ciphertext", async () => {
    const { encryptSecret, decryptSecret } = await import("./secrets");
    const enc = encryptSecret("secret");
    const bad = enc.slice(0, -4) + (enc.endsWith("A") ? "B" : "A") + enc.slice(-3);
    expect(() => decryptSecret(bad)).toThrow();
  });
  it("masks", async () => {
    const { encryptSecret, maskSecret } = await import("./secrets");
    expect(maskSecret(encryptSecret("abcd1234"))).toMatch(/1234$/);
  });
});
```

- [ ] **Step 2:** Run → FAIL. Implement `lib/crypto/secrets.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) throw new Error("SECRETS_ENCRYPTION_KEY is not set");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("SECRETS_ENCRYPTION_KEY must be 32 bytes (base64)");
  return k;
}

/** AES-256-GCM → base64 "iv.tag.ciphertext". */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

export function decryptSecret(enc: string): string {
  const [ivB, tagB, ctB] = enc.split(".");
  if (!ivB || !tagB || !ctB) throw new Error("Malformed secret");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
}

/** "••••1234" — last 4 chars of the decrypted value, for display. */
export function maskSecret(enc: string): string {
  try { const v = decryptSecret(enc); return `••••${v.slice(-4)}`; } catch { return "••••"; }
}
```

- [ ] **Step 3:** Run → PASS. `npx tsc --noEmit 2>&1 | grep secrets` empty. Commit `feat(crypto): AES-256-GCM secrets helper for credential storage`.

---

### Task 2: Access helper + server action

**Files:** Create `lib/property-access.ts`; Create `app/actions/property-viva.ts`.

- [ ] **Step 1:** `lib/property-access.ts`:

```ts
import { db } from "@/lib/db";

const STAFF = ["SUPER_ADMIN", "ADMIN"];

/** SUPER_ADMIN/ADMIN → any property; PROPERTY_ADMIN → property they're assigned to
 *  (directly or via a building under it). MANAGER (company) also → any. */
export async function canManagePropertyViva(userId: string, propertyId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return false;
  if (STAFF.includes(user.role) || user.role === "MANAGER") return true;
  if (user.role !== "PROPERTY_ADMIN") return false;
  const a = await db.managementAssignment.findFirst({
    where: { userId, OR: [{ propertyId }, { building: { propertyId } }] },
    select: { id: true },
  });
  return !!a;
}
```
(Verify `ManagementAssignment` has a `building` relation with `propertyId`; if only `buildingId`, resolve buildings of the property first.)

- [ ] **Step 2:** `app/actions/property-viva.ts` ("use server"):

```ts
"use server";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { encryptSecret, maskSecret } from "@/lib/crypto/secrets";
import { canManagePropertyViva } from "@/lib/property-access";

export type PropertyVivaView = {
  vivaEnabled: boolean; vivaMerchantId: string | null; vivaSourceCode: string | null;
  apiKeyMask: string | null; hasApiKey: boolean;
};

async function requireAccess(propertyId: string): Promise<string> {
  const s = await getEffectiveSession();
  if (!s?.user?.id) throw new Error("Unauthorized");
  const uid = s.user.id as string;
  if (!(await canManagePropertyViva(uid, propertyId))) throw new Error("Forbidden");
  return uid;
}

export async function getPropertyVivaForEdit(propertyId: string): Promise<PropertyVivaView> {
  await requireAccess(propertyId);
  const p = await db.property.findUnique({ where: { id: propertyId }, select: { vivaEnabled: true, vivaMerchantId: true, vivaSourceCode: true, vivaApiKeyEnc: true } });
  if (!p) throw new Error("Not found");
  return {
    vivaEnabled: p.vivaEnabled, vivaMerchantId: p.vivaMerchantId, vivaSourceCode: p.vivaSourceCode,
    apiKeyMask: p.vivaApiKeyEnc ? maskSecret(p.vivaApiKeyEnc) : null, hasApiKey: !!p.vivaApiKeyEnc,
  };
}

export async function savePropertyViva(propertyId: string, input: {
  vivaEnabled: boolean; vivaMerchantId: string | null; vivaSourceCode: string | null; apiKey?: string | null;
}): Promise<PropertyVivaView> {
  await requireAccess(propertyId);
  const data: Record<string, unknown> = {
    vivaEnabled: input.vivaEnabled,
    vivaMerchantId: input.vivaMerchantId?.trim() || null,
    vivaSourceCode: input.vivaSourceCode?.trim() || null,
  };
  if (input.apiKey !== undefined) {
    data.vivaApiKeyEnc = input.apiKey && input.apiKey.trim() ? encryptSecret(input.apiKey.trim()) : null;
  }
  await db.property.update({ where: { id: propertyId }, data });
  const buildings = await db.building.findMany({ where: { propertyId }, select: { id: true } });
  revalidatePath(`/super-admin/properties/${propertyId}`);
  for (const b of buildings) revalidatePath(`/building/${b.id}`);
  return getPropertyVivaForEdit(propertyId);
}
```

- [ ] **Step 3:** `npx tsc --noEmit 2>&1 | grep -E "property-viva|property-access"` empty. Commit `feat(pay): guarded per-property Viva credential save/read (encrypted at rest)`.

---

### Task 3: Wire quick-pay to per-property creds

**Files:** `lib/payments/koinochrista-pay.ts`, `lib/viva.ts`.

- [ ] **Step 1:** `lib/viva.ts` — add per-property variants that take explicit creds instead of env:
  `createVivaOrderWith(creds: { merchantId: string; apiKey: string; sourceCode?: string }, input)` and
  `getVivaTransactionWith(creds, transactionId)`. Use the property's `merchantId`/`apiKey` for auth
  (Basic `merchantId:apiKey` per Viva's REST, OR OAuth if that's what the account uses — keep the
  in-code VERIFY-in-sandbox note; do NOT read global env creds in these functions).
- [ ] **Step 2:** `lib/payments/koinochrista-pay.ts` — replace the throwing stubs: `createPropertyVivaOrder(cfg, input)` decrypts `cfg.vivaApiKeyEnc` via `decryptSecret` and calls `createVivaOrderWith({ merchantId: cfg.vivaMerchantId!, apiKey: decrypted, sourceCode: cfg.vivaSourceCode ?? undefined }, input)`; `getPropertyVivaTransaction(cfg, txId)` likewise. Keep the doc comment that these need sandbox verification; the `vivaEnabled` + master gate still guard activation.
- [ ] **Step 3:** `npx tsc --noEmit 2>&1 | grep -E "koinochrista-pay|lib/viva"` empty; `npm run build`; `npx vitest run` (only pre-existing failure). Commit `feat(pay): route κοινόχρηστα orders through the property's own Viva credentials`.

---

### Task 4: UI + manager «Ρυθμίσεις» section + super-admin card

**Files:** Create `components/property/PropertyVivaSetup.tsx`; modify `components/building/manager-shell/sections.ts` + `BuildingManagerShell.tsx`; modify `app/(company)/super-admin/properties/[id]/page.tsx` (+ its client if needed).

- [ ] **Step 1:** `PropertyVivaSetup` (client): props `{ propertyId }`. On mount, `getPropertyVivaForEdit`. Form: «Ενεργό» switch, Merchant ID, Source Code, API Key (password input; shows current mask + «Αλλαγή» to replace; leaving blank keeps existing → send `apiKey: undefined`). Save → `savePropertyViva`, success/error inline. Read-only status line: «Οι online πληρωμές ενεργοποιούνται όταν οριστούν τα στοιχεία, επαληθευτεί το Viva (sandbox) και ανοίξει ο γενικός διακόπτης.» Orithon tokens, Ri Line icons, no secret echoed to console.
- [ ] **Step 2:** Manager shell: add section `{ key: "settings", label: "Ρυθμίσεις", tabs: [{ key: "viva", label: "Viva πληρωμές" }] }` to `sections.ts` (visible only when the viewer manages the property — since the occupant shell is separate and the manager shell is PROPERTY_ADMIN-only, always visible there). In `BuildingManagerShell.tsx` route `settings/viva` → `<PropertyVivaSetup propertyId={building.propertyId} />` (thread `propertyId` — the shell has `building.propertyId`? if not, pass it from the page/data). 
- [ ] **Step 3:** Super-admin property page `/super-admin/properties/[id]`: add a «Viva πληρωμές» card rendering `<PropertyVivaSetup propertyId={id} />` (read the page first; add where other property settings live).
- [ ] **Step 4:** `npx tsc --noEmit 2>&1 | grep -E "PropertyVivaSetup|manager-shell|properties/\[id\]"` empty; `npm run build`. Commit `feat(pay): property Viva setup UI in manager Ρυθμίσεις + super-admin property page`.

---

### Task 5: Wallet cleanup for owners/residents

**Files:** `lib/rbac/registry.ts`; run `prisma/reconcile-rbac.ts`.

- [ ] **Step 1:** Remove `customer-wallet` from `PROPERTY_OWNER` and `PROPERTY_RESIDENT` in `DEFAULT_PERMISSIONS` (keep it in `PROPERTY_ADMIN`). 
- [ ] **Step 2:** Run `npx tsx --env-file=.env prisma/reconcile-rbac.ts` (report both runs; second all +0 −0 for the changed roles → −1 each first run).
- [ ] **Step 3:** `npx tsc --noEmit` clean; `npm run build`; `npx vitest run`. Commit `feat(rbac): remove wallet from owner/resident menus (manager buys AI/API for the property)`.

---

### Task 6: Verify + review + ship

- [ ] `npx vitest run`; `npx tsc --noEmit`; `npm run build` — green modulo documented.
- [ ] `.env` note (do NOT commit): `SECRETS_ENCRYPTION_KEY=` (generate `openssl rand -base64 32`).
- [ ] Dev smoke: manager shell shows «Ρυθμίσεις → Viva πληρωμές» with the form; super-admin property page shows the card; owner/resident sidebar no longer has «Πορτοφόλι» (reconcile ran).
- [ ] Security review agent: crypto correctness (GCM tag verified, key length enforced), decrypted key never returned to client (mask only), action guarded by role + property assignment (manager can't touch other properties; owner/resident Forbidden), no plaintext logged, quick-pay still per-property-gated.
- [ ] Update memory ([[project_koinochrista_quickpay]], [[project_viva_payments]]); push to GitHub main. Note follow-ups: sub-project 3 (provider Viva config) + 4 (package selection + payment).
