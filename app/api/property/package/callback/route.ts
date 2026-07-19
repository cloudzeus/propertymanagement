import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { vivaUrls, getVivaTransactionFor } from "@/lib/viva";
import { getProviderVivaConfig } from "@/lib/payments/provider-viva";

// Viva webhook receiver for property service-package payments (provider account).
//
// SECURITY: the POSTed body is NOT trusted. On every event we RE-FETCH the
// transaction from Viva (getVivaTransactionFor) and require: successful status +
// merchantTrns match + amount ≈ the stored invoice amount, before marking the
// ServiceInvoice PAID. Marking is idempotent (skip if already PAID). This handler
// never throws 500 — a forged/garbage POST is answered 200 "ignored".

/**
 * GET — Viva webhook URL verification handshake. Mirrors the wallet top-up
 * receiver: fetch the verification Key using the provider Viva merchant/api pair
 * (resolved atomically from ONE source), fall back to a manual key.
 */
export async function GET() {
  try {
    const cfg = await getProviderVivaConfig();
    const merchantId = cfg ? cfg.merchantId : (process.env.VIVA_MERCHANT_ID ?? null);
    const apiKey = cfg ? cfg.apiKey : (process.env.VIVA_API_KEY ?? null);
    if (!merchantId || !apiKey) throw new Error("Missing Viva merchant/api credentials");

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

const MERCHANT_TRNS_RE = /^pkg:([^:]+):([^:]+):(\d{4}-\d{2})$/;

export async function POST(request: Request) {
  try {
    let event: VivaWebhookEvent;
    try {
      event = (await request.json()) as VivaWebhookEvent;
    } catch {
      return new Response("bad_json", { status: 400 });
    }

    const eventData = event.EventData;
    const postedMerchantTrns = eventData?.MerchantTrns ?? "";
    const match = MERCHANT_TRNS_RE.exec(postedMerchantTrns);
    if (!match) return new Response("ignored", { status: 200 });

    const propertyId = match[1];
    const customerId = match[2];
    const period = match[3];

    const transactionId = eventData?.TransactionId;
    if (!transactionId) return new Response("ignored", { status: 200 });

    // Provider config resolves the same account used to create the order; without
    // it we cannot verify → ignore rather than trust the POST.
    const cfg = await getProviderVivaConfig();
    if (!cfg) return new Response("ignored", { status: 200 });

    // Re-fetch the transaction from Viva to verify authenticity/amount/status.
    let tx;
    try {
      tx = await getVivaTransactionFor(cfg, transactionId);
    } catch {
      return new Response("ignored", { status: 200 });
    }

    // Require a successful transaction whose merchantTrns matches ours exactly.
    if (tx.statusId != null && tx.statusId !== "F") return new Response("ignored", { status: 200 });
    if ((tx.merchantTrns ?? "") !== postedMerchantTrns) return new Response("ignored", { status: 200 });

    // Re-read the invoice; require it exists for this (customer, period).
    const invoice = await db.serviceInvoice.findUnique({
      where: { customerId_period: { customerId, period } },
      select: { id: true, status: true, amount: true },
    });
    if (!invoice) return new Response("ignored", { status: 200 });

    // Idempotent: already settled → nothing to do.
    if (invoice.status === "PAID") return new Response("duplicate", { status: 200 });

    // Amount check: Viva reports EUR major units; compare to the stored invoice
    // amount in cents with a 1-cent tolerance.
    const invoiceCents = Math.round(Number(invoice.amount) * 100);
    const txCents = typeof tx.amount === "number" ? Math.round(tx.amount * 100) : null;
    if (txCents == null || Math.abs(txCents - invoiceCents) > 1) {
      return new Response("ignored", { status: 200 });
    }

    // Mark PAID, recording the Viva transaction ref (idempotency guard on status).
    await db.serviceInvoice.updateMany({
      where: { id: invoice.id, status: { not: "PAID" } },
      data: { status: "PAID", paidAt: new Date(), vivaOrderRef: transactionId },
    });

    revalidatePath(`/super-admin/properties/${propertyId}`);
    const buildings = await db.building.findMany({ where: { propertyId }, select: { id: true } });
    for (const b of buildings) revalidatePath(`/building/${b.id}`);

    return new Response("ok", { status: 200 });
  } catch {
    // Never 500 on a webhook — Viva would retry endlessly.
    return new Response("ignored", { status: 200 });
  }
}
