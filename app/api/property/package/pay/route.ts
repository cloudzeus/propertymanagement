import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canManagePropertyViva } from "@/lib/property-access";
import { getProviderVivaConfig } from "@/lib/payments/provider-viva";
import { getPropertyPackage } from "@/lib/billing/service-amount";
import { createVivaOrderFor } from "@/lib/viva";

// Pay the property's monthly service package via the PROVIDER's own Viva account
// (the provider COLLECTS from the customer). Deliberately uses createVivaOrderFor
// — NOT the per-property κοινόχρηστα *With helpers, which route residents' money
// into each property's OWN account and must stay untouched.
//
// The amount is ALWAYS server-computed from getPropertyPackage; the client only
// supplies { propertyId } and never an amount.

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("unauthorized", { status: 401 });

  let body: { propertyId?: string };
  try {
    body = (await request.json()) as { propertyId?: string };
  } catch {
    return new Response("bad_json", { status: 400 });
  }
  const propertyId = body.propertyId;
  if (!propertyId) return Response.json({ error: "missing_propertyId" }, { status: 400 });

  if (!(await canManagePropertyViva(session.user.id as string, propertyId))) {
    return new Response("forbidden", { status: 403 });
  }

  // Provider-Viva gate: no configured provider account → 503, never a fallback.
  const cfg = await getProviderVivaConfig();
  if (!cfg) return Response.json({ error: "provider_viva_unconfigured" }, { status: 503 });

  const property = await db.property.findUnique({ where: { id: propertyId }, select: { customerId: true } });
  if (!property) return Response.json({ error: "property_not_found" }, { status: 404 });
  const customerId = property.customerId;

  const pkg = await getPropertyPackage(propertyId);
  const amountCents = pkg.totalCents;
  if (amountCents <= 0) return Response.json({ error: "nothing_due" }, { status: 400 });

  const period = currentPeriod();

  // Guard against re-paying an already-settled period.
  const existing = await db.serviceInvoice.findUnique({
    where: { customerId_period: { customerId, period } },
    select: { status: true },
  });
  if (existing?.status === "PAID") return Response.json({ error: "already_paid" }, { status: 400 });

  // Upsert the PENDING invoice from the server-computed package lines. On re-attempt
  // we refresh the amount + lines to the current package (the invoice is not PAID).
  const lineData = pkg.lines.map((l) => ({
    description: l.name,
    qty: l.qty,
    unitPrice: l.unitPrice,
    amount: l.amount,
  }));
  await db.serviceInvoice.upsert({
    where: { customerId_period: { customerId, period } },
    create: { customerId, period, amount: pkg.total, status: "PENDING", lines: { create: lineData } },
    update: { amount: pkg.total, status: "PENDING", lines: { deleteMany: {}, create: lineData } },
  });

  const merchantTrns = `pkg:${propertyId}:${customerId}:${period}`;
  const customerTrns = `Πακέτο υπηρεσιών ${period}`;

  try {
    const { checkoutUrl } = await createVivaOrderFor(cfg, { amountCents, customerTrns, merchantTrns });
    return Response.json({ checkoutUrl });
  } catch {
    // Never surface Viva error bodies (may echo credentials/PII).
    return Response.json({ error: "viva_order_failed" }, { status: 502 });
  }
}
