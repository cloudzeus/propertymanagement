import { db } from "@/lib/db";
import {
  createVivaOrderWith,
  getVivaTransactionWith,
  type CreateVivaOrderInput,
  type CreateVivaOrderResult,
  type VivaTransaction,
} from "@/lib/viva";
import { decryptSecret } from "@/lib/crypto/secrets";

// ─────────────────────────────────────────────────────────────────────────────
// MONEY ROUTING — κοινόχρηστα must go to the PROPERTY's OWN Viva account.
//
// A resident's κοινόχρηστα belong to their property/building, NOT to us (the
// provider). Therefore this flow must create the Viva order against, and verify
// it against, the *property's* Viva merchant credentials
// (Property.vivaMerchantId / decrypted Property.vivaApiKeyEnc /
// Property.vivaSourceCode) — never the global provider VIVA_* credentials used
// by lib/viva.ts `createVivaOrder` (that is the wallet/top-up flow, which bills
// OUR customers into OUR account). Using the global creds here would misroute
// residents' money to the provider. That must be impossible.
//
// REMAINING PRE-GO-LIVE BUILD (all required before setting a property's
// vivaEnabled=true and the master switch VIVA_KOINOCHRISTA_ENABLED="true"):
//   1. A crypto helper to encrypt/decrypt Property.vivaApiKeyEnc (none exists in
//      the repo today — vivaApiKeyEnc is currently unused everywhere).
//   2. A super-admin UI to set a property's viva* fields (merchantId, encrypted
//      apiKey, sourceCode) and toggle vivaEnabled.
//   3. Real `createPropertyVivaOrder` / `getPropertyVivaTransaction` that resolve
//      Viva Smart Checkout v2 auth for the property's merchant and target its
//      vivaMerchantId / vivaSourceCode (both stubbed below to THROW today).
//   4. Sandbox verification of the Viva order-create + transaction-retrieve calls
//      against a real property-scoped Viva account.
// Until all four ship, both stubs throw → the intent route returns 503 and the
// callback stays inert (marks nothing paid). No property has viva* set today and
// there is no UI to set them, so the whole feature is off everywhere → the UI
// shows «Σύντομα διαθέσιμο», which is correct.
// ─────────────────────────────────────────────────────────────────────────────

export type PropertyVivaConfig = {
  vivaEnabled: boolean;
  vivaMerchantId: string | null;
  vivaApiKeyEnc: string | null;
  vivaSourceCode: string | null;
};

/** Load the owning property's Viva merchant config for a building (null if gone). */
export async function getPropertyVivaConfig(buildingId: string): Promise<PropertyVivaConfig | null> {
  const building = await db.building.findUnique({
    where: { id: buildingId },
    select: {
      property: {
        select: { vivaEnabled: true, vivaMerchantId: true, vivaApiKeyEnc: true, vivaSourceCode: true },
      },
    },
  });
  return building?.property ?? null;
}

/**
 * Global master kill-switch. The whole κοινόχρηστα quick-pay feature is OFF
 * unless this env is exactly "true" — a second gate on top of the per-property
 * config so the feature can be disabled fleet-wide instantly. Default OFF.
 */
export function isKoinochristaMasterEnabled(): boolean {
  return process.env.VIVA_KOINOCHRISTA_ENABLED === "true";
}

/**
 * Per-property gate: the property must have its OWN Viva account fully configured
 * (enabled + merchant id + encrypted api key + source code). Pure — no env.
 */
export function isPropertyVivaEnabled(cfg: PropertyVivaConfig | null): boolean {
  return cfg?.vivaEnabled === true
    && !!cfg.vivaMerchantId && !!cfg.vivaApiKeyEnc && !!cfg.vivaSourceCode;
}

/**
 * Combined gate used by the routes AND the UI: BOTH the global master switch AND
 * the property's own Viva config must be on. Default OFF everywhere today.
 */
export function isKoinochristaPayEnabled(cfg: PropertyVivaConfig | null): boolean {
  return isKoinochristaMasterEnabled() && isPropertyVivaEnabled(cfg);
}

/**
 * Create a Viva order against the PROPERTY's OWN merchant account. Decrypts the
 * property's stored api key and authenticates with the property's own
 * merchantId/apiKey/sourceCode via createVivaOrderWith — NEVER the global
 * provider createVivaOrder (that would route residents' money to us).
 *
 * VERIFY: the underlying createVivaOrderWith endpoint/auth must be confirmed
 * against a real property-scoped Viva account (sandbox) before go-live; the
 * per-property vivaEnabled flag + the master switch still gate activation.
 * Throws if the config is incomplete (should be pre-checked by isPropertyVivaEnabled).
 */
export async function createPropertyVivaOrder(
  cfg: PropertyVivaConfig,
  input: CreateVivaOrderInput,
): Promise<CreateVivaOrderResult> {
  if (!cfg.vivaMerchantId || !cfg.vivaApiKeyEnc) {
    throw new Error("property_viva_config_incomplete");
  }
  return createVivaOrderWith(
    {
      merchantId: cfg.vivaMerchantId,
      apiKey: decryptSecret(cfg.vivaApiKeyEnc),
      sourceCode: cfg.vivaSourceCode ?? undefined,
    },
    input,
  );
}

/**
 * Verify a transaction against the PROPERTY's OWN merchant account before
 * reconciling. Same rule: the property's own decrypted merchant creds, never the
 * global provider's.
 *
 * VERIFY: confirm getVivaTransactionWith endpoint/auth/response shape in sandbox
 * before go-live. Throws if the config is incomplete.
 */
export async function getPropertyVivaTransaction(
  cfg: PropertyVivaConfig,
  transactionId: string,
): Promise<VivaTransaction> {
  if (!cfg.vivaMerchantId || !cfg.vivaApiKeyEnc) {
    throw new Error("property_viva_config_incomplete");
  }
  return getVivaTransactionWith(
    {
      merchantId: cfg.vivaMerchantId,
      apiKey: decryptSecret(cfg.vivaApiKeyEnc),
      sourceCode: cfg.vivaSourceCode ?? undefined,
    },
    transactionId,
  );
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
