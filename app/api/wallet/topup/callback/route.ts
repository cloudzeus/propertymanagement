import { db } from "@/lib/db";
import { creditWallet } from "@/lib/wallet/ledger";
import { vivaUrls } from "@/lib/viva";

// Viva webhook receiver for wallet top-ups.
//
// SECURITY: verification here is minimal. This endpoint trusts the POSTed event
// body. Before production you MUST harden this — verify the event authenticity
// (e.g. re-fetch/validate the transaction against Viva, or verify a signature /
// the webhook token) so a forged POST cannot credit a wallet. Coded to Viva's
// documented webhook shapes; NOT yet verified against a live account.

/**
 * GET — Viva webhook URL verification handshake. Viva expects a JSON body
 * { "Key": "<verification-key>" }. The key is fetched from Viva using Basic auth
 * (VIVA_MERCHANT_ID:VIVA_API_KEY) at GET {api}/api/messages/config/token.
 *
 * VERIFY: confirm this endpoint + Basic-auth pair against a live Viva account.
 */
export async function GET() {
  try {
    const merchantId = process.env.VIVA_MERCHANT_ID;
    const apiKey = process.env.VIVA_API_KEY;
    if (!merchantId || !apiKey) throw new Error("Missing VIVA_MERCHANT_ID/VIVA_API_KEY");

    const { api } = vivaUrls();
    const basic = Buffer.from(`${merchantId}:${apiKey}`).toString("base64");
    const res = await fetch(`${api}/api/messages/config/token`, {
      headers: { Authorization: `Basic ${basic}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Viva ${res.status}`);
    const data = (await res.json()) as { Key?: string };
    return Response.json({ Key: data.Key ?? process.env.VIVA_WEBHOOK_KEY ?? "" });
  } catch {
    // Fallback to a manually-configured key so the handshake can still succeed.
    return Response.json({ Key: process.env.VIVA_WEBHOOK_KEY ?? "" });
  }
}

interface VivaWebhookEvent {
  EventTypeId?: number;
  EventData?: {
    MerchantTrns?: string;
    Amount?: number;
    TransactionId?: string;
    StatusId?: string;
  };
}

const MERCHANT_TRNS_RE = /^wallet-topup:([^:]+):([\d.]+)$/;

/**
 * POST — Viva "Transaction Payment Created" event (EventTypeId 1796).
 * Credits the customer wallet on a successful payment (StatusId "F").
 */
export async function POST(request: Request) {
  let event: VivaWebhookEvent;
  try {
    event = (await request.json()) as VivaWebhookEvent;
  } catch {
    return new Response("bad_json", { status: 400 });
  }

  const eventData = event.EventData;
  const merchantTrns = eventData?.MerchantTrns ?? "";
  const match = MERCHANT_TRNS_RE.exec(merchantTrns);
  if (!match) {
    // Not one of our top-up transactions (or another event type hit this URL).
    return new Response("ignored", { status: 200 });
  }

  const customerId = match[1];
  const amountStr = match[2];

  // StatusId "F" = finished/successful. Be lenient if StatusId is absent
  // (some sandbox events omit it), but log so it's visible.
  const statusId = eventData?.StatusId;
  if (statusId != null && statusId !== "F") {
    return new Response("ignored", { status: 200 });
  }
  if (statusId == null) {
    console.warn("[viva callback] crediting with missing StatusId", { merchantTrns });
  }

  const transactionId = eventData?.TransactionId;

  // Idempotency: skip if we already credited this Viva transaction (webhook retries).
  // NOTE: if TransactionId is undefined we cannot dedupe — we still credit, which
  // risks a double-credit on retry for such events. Harden once the live event
  // shape is confirmed to always carry TransactionId.
  if (transactionId) {
    const existing = await db.walletTransaction.findFirst({
      where: { refType: "viva", refId: transactionId },
      select: { id: true },
    });
    if (existing) return new Response("duplicate", { status: 200 });
  }

  await creditWallet({
    ownerType: "CUSTOMER",
    ownerId: customerId,
    type: "TOPUP",
    amountEur: Number(amountStr),
    description: "Viva top-up",
    refType: "viva",
    refId: transactionId ?? undefined,
  });

  return new Response("ok", { status: 200 });
}
