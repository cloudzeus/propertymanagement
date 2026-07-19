import { getEffectiveSession } from "@/lib/auth-effective";
import { getBuildingAccess } from "@/lib/building-access";
import { isKoinochristaPayEnabled, getUnitOutstanding, getBuildingOutstanding } from "@/lib/payments/koinochrista-pay";
import { createVivaOrder } from "@/lib/viva";
import { db } from "@/lib/db";

/**
 * POST /api/koinochrista/pay — create a Viva Smart Checkout order for the
 * occupant's outstanding κοινόχρηστα and return the hosted checkout URL.
 *
 * SAFETY:
 *  - The amount is ALWAYS computed server-side from the caller's own unpaid
 *    ExpenseAllocation rows. The client never sends an amount.
 *  - The caller must be an "occupant" of the building AND (for a per-unit pay)
 *    own/rent the specific unit — getUnitOutstanding returns null otherwise → 403.
 *  - Flag-gated: disabled by default → 503.
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
