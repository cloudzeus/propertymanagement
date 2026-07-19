import { db } from "@/lib/db";

/**
 * Feature flag for κοινόχρηστα online quick-pay via Viva. Default OFF: the flow
 * stays fully disabled (route → 503, UI → «Σύντομα διαθέσιμο») until Viva is
 * sandbox-verified and the env is explicitly turned on.
 */
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
