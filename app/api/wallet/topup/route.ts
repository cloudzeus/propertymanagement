import { currentCustomerId } from "@/lib/wallet/current-customer";
import { createVivaOrder } from "@/lib/viva";

/**
 * POST /api/wallet/topup — create a Viva Smart Checkout order for a wallet top-up
 * and return the hosted checkout URL.
 *
 * Isolation: the customer is derived from the session only, never from the body.
 */
export async function POST(request: Request) {
  const customerId = await currentCustomerId();
  if (!customerId) {
    return Response.json({ error: "no_customer" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const amountEur = Number((body as { amountEur?: unknown })?.amountEur);
  if (!Number.isFinite(amountEur) || amountEur <= 0) {
    return Response.json({ error: "invalid_amount" }, { status: 400 });
  }

  const merchantTrns = `wallet-topup:${customerId}:${amountEur}`;

  try {
    const { checkoutUrl } = await createVivaOrder({
      amountCents: Math.round(amountEur * 100),
      customerTrns: "Wallet top-up",
      merchantTrns,
    });
    return Response.json({ checkoutUrl });
  } catch (e) {
    // Surface misconfiguration/Viva errors as 502 so it is visible, not a bare 500.
    return Response.json(
      { error: "viva_unavailable", detail: String(e) },
      { status: 502 },
    );
  }
}
