import { getEffectiveSession } from "@/lib/auth-effective";
import { getBuildingAccess } from "@/lib/building-access";
import {
  isKoinochristaPayEnabled,
  getPropertyVivaConfig,
  createPropertyVivaOrder,
  getUnitOutstanding,
  getBuildingOutstanding,
} from "@/lib/payments/koinochrista-pay";
import { db } from "@/lib/db";

/**
 * POST /api/koinochrista/pay — create a Viva Smart Checkout order for the
 * occupant's outstanding κοινόχρηστα and return the hosted checkout URL.
 *
 * SAFETY:
 *  - MONEY ROUTING: the order is created against the PROPERTY's OWN Viva merchant
 *    account (via createPropertyVivaOrder). This route deliberately does NOT
 *    import or call the global provider `createVivaOrder` — residents'
 *    κοινόχρηστα must never be routed to the provider's account.
 *  - The amount is ALWAYS computed server-side from the caller's own unpaid
 *    ExpenseAllocation rows. The client never sends an amount.
 *  - The caller must be an "occupant" of the building AND (for a per-unit pay)
 *    own/rent the specific unit — getUnitOutstanding returns null otherwise → 403.
 *  - Gated by BOTH the per-property Viva config AND the master switch → 503 when
 *    off (off everywhere today). Per-property order creation is not wired yet
 *    (stub throws) → 503 { coming_soon }, so no order is ever created today.
 */
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

  // Per-property gate (the property's own Viva account must be configured) + master switch.
  const vivaConfig = await getPropertyVivaConfig(buildingId);
  if (!isKoinochristaPayEnabled(vivaConfig)) return Response.json({ error: "disabled" }, { status: 503 });

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
    // Routes to the PROPERTY's OWN merchant. Stub throws until per-property Viva
    // routing is built — caught below → 503, so no provider-account order exists.
    const { checkoutUrl } = await createPropertyVivaOrder(vivaConfig!, {
      amountCents,
      customerTrns: `Κοινόχρηστα ${building?.name ?? ""}`.trim(),
      merchantTrns,
    });
    return Response.json({ checkoutUrl });
  } catch {
    return Response.json({ error: "coming_soon" }, { status: 503 });
  }
}
