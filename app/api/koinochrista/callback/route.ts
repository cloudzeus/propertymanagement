import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { vivaUrls } from "@/lib/viva";
import {
  isKoinochristaPayEnabled,
  getPropertyVivaConfig,
  getPropertyVivaTransaction,
  getUnitOutstanding,
  getBuildingOutstanding,
} from "@/lib/payments/koinochrista-pay";
import { publishBuildingEvent } from "@/lib/realtime/bus";

// Viva webhook receiver for κοινόχρηστα quick-pay.
//
// SECURITY (money flow): unlike the wallet callback, this endpoint does NOT
// trust the POSTed event body, and it verifies against the PROPERTY's OWN Viva
// account (never the global provider account). It re-fetches the transaction via
// getPropertyVivaTransaction(cfg, …) and requires:
//   1. the transaction succeeded (statusId "F"),
//   2. its merchantTrns matches the event's MerchantTrns (our koino:… token),
//   3. its amount matches the server-recomputed outstanding for that
//      user/building/unit (±1 cent).
// Only then are the specific ExpenseAllocation rows marked paid. Because the
// recompute selects ONLY currently-unpaid ids, a webhook replay settles nothing
// new (idempotent). It never returns 500 (Viva would retry forever): benign /
// duplicate / unverified → 200, verification failure → 4xx.
//
// INERT TODAY: getPropertyVivaTransaction is a stub that throws until per-property
// Viva routing ships (see lib/payments/koinochrista-pay.ts), and no property has
// Viva configured, so the gate fails and/or verification throws → the callback
// marks NOTHING paid.

/**
 * GET — Viva webhook URL verification handshake. Identical to the wallet
 * callback: Viva expects a JSON body { "Key": "<verification-key>" }, fetched
 * from Viva with Basic auth (VIVA_MERCHANT_ID:VIVA_API_KEY).
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

const MERCHANT_TRNS_RE = /^koino:([^:]+):([^:]+):(.+)$/;

/**
 * POST — Viva "Transaction Payment Created" event. Verifies then reconciles the
 * occupant's unpaid ExpenseAllocation rows for the paid scope.
 */
export async function POST(request: Request) {
  try {
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
      // Not one of our κοινόχρηστα transactions (or another event type hit this URL).
      return new Response("ignored", { status: 200 });
    }
    const buildingId = match[1];
    const userId = match[2];
    const scope = match[3]; // unitId or "all"

    const transactionId = eventData?.TransactionId;
    if (!transactionId) return new Response("missing_transaction_id", { status: 400 });

    // ── Resolve the PROPERTY's own Viva config; gate on it (+ master switch) ─────
    // Reconciliation must ONLY happen through the property's own verified
    // transaction. If the property isn't Viva-enabled, the callback is inert.
    const vivaConfig = await getPropertyVivaConfig(buildingId);
    if (!isKoinochristaPayEnabled(vivaConfig)) {
      return new Response("disabled_ignored", { status: 200 });
    }

    // ── VERIFY: re-fetch via the PROPERTY's merchant creds (never trust the body) ─
    // Stub throws today → treated as "unverified" below → 200, marks nothing paid.
    let tx;
    try {
      tx = await getPropertyVivaTransaction(vivaConfig!, transactionId);
    } catch {
      // Cannot verify against the property's account (routing not wired yet, or a
      // transient re-fetch failure). Do NOT reconcile. 200 so Viva does not retry
      // forever; a genuinely-settled payment is reconciled once routing ships.
      return new Response("unverified_ignored", { status: 200 });
    }
    if (tx.statusId !== "F") {
      // Not a completed payment — benign (Viva may resend on completion).
      return new Response("not_settled", { status: 200 });
    }
    if ((tx.merchantTrns ?? "") !== merchantTrns) {
      return new Response("merchant_trns_mismatch", { status: 401 });
    }

    // ── Recompute the outstanding server-side (authoritative amount) ────────────
    const outstanding = scope === "all"
      ? await (async () => {
          const b = await getBuildingOutstanding(userId, buildingId);
          return {
            amountCents: b.totalCents,
            owner: b.perUnit.flatMap((u) => u.owner),
            tenant: b.perUnit.flatMap((u) => u.tenant),
          };
        })()
      : await (async () => {
          const u = await getUnitOutstanding(userId, buildingId, scope);
          return u ? { amountCents: u.amountCents, owner: u.owner, tenant: u.tenant } : null;
        })();

    if (!outstanding) {
      // scope is a unit the user no longer owns/rents — do not settle.
      return new Response("no_access", { status: 403 });
    }

    // Idempotency / replay: nothing currently unpaid → already reconciled → benign.
    if (outstanding.amountCents <= 0) {
      return new Response("duplicate", { status: 200 });
    }

    // Amount must match the re-fetched Viva amount (EUR major units) within ±1 cent.
    const txCents = Math.round((tx.amount ?? 0) * 100);
    if (Math.abs(txCents - outstanding.amountCents) > 1) {
      return new Response("amount_mismatch", { status: 400 });
    }

    // ── Reconcile: mark only the selected currently-unpaid allocations paid ─────
    const now = new Date();
    if (outstanding.owner.length > 0) {
      await db.expenseAllocation.updateMany({
        where: { id: { in: outstanding.owner }, ownerPaid: false },
        data: { ownerPaid: true, ownerPaidAt: now, ownerPaymentMethod: "VIVA" },
      });
    }
    if (outstanding.tenant.length > 0) {
      await db.expenseAllocation.updateMany({
        where: { id: { in: outstanding.tenant }, tenantPaid: false },
        data: { tenantPaid: true, tenantPaidAt: now, tenantPaymentMethod: "VIVA" },
      });
    }

    revalidatePath(`/building/${buildingId}`);
    publishBuildingEvent(buildingId, "payment");
    return new Response("ok", { status: 200 });
  } catch (e) {
    // Verification could not complete (e.g. Viva re-fetch failed). Do NOT mark
    // paid and do NOT 500 (Viva would retry forever). Surface as 400 so it is
    // visible; a genuinely-settled payment can be reconciled manually.
    return new Response(`verification_failed: ${String(e)}`, { status: 400 });
  }
}
