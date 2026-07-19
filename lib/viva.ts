// Viva Smart Checkout v2 client. Coded to Viva's documented API; NOT yet verified
// against a live/sandbox account. Set VIVA_* env + verify in sandbox before enabling.

import { getProviderVivaConfig, type ProviderVivaConfig } from "@/lib/payments/provider-viva";

type VivaEnv = "sandbox" | "production";

function vivaEnv(): VivaEnv {
  return process.env.VIVA_ENV === "production" ? "production" : "sandbox";
}

/** Base URLs by environment. */
export function vivaUrls() {
  const prod = vivaEnv() === "production";
  return {
    accounts: prod
      ? "https://accounts.vivapayments.com"
      : "https://demo-accounts.vivapayments.com",
    api: prod ? "https://api.vivapayments.com" : "https://demo-api.vivapayments.com",
    checkoutBase: prod
      ? "https://www.vivapayments.com/web/checkout"
      : "https://demo.vivapayments.com/web/checkout",
  };
}

async function resolveProviderViva(): Promise<ProviderVivaConfig> {
  const cfg = await getProviderVivaConfig();
  if (!cfg) throw new Error("Provider Viva is not configured (no DB config and no VIVA_CLIENT_ID/SECRET env)");
  return cfg;
}

/**
 * OAuth2 client-credentials token for Smart Checkout v2, against an EXPLICIT
 * provider client id/secret pair (DB- or env-resolved by the caller).
 * POST {accounts}/connect/token with HTTP Basic auth (client id:secret).
 */
export async function getAccessTokenFor(cfg: { clientId: string; clientSecret: string }): Promise<string> {
  const { accounts } = vivaUrls();
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");

  const res = await fetch(`${accounts}/connect/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Viva ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Viva token response missing access_token");
  return data.access_token;
}

/**
 * OAuth2 client-credentials token using the resolved provider config
 * (DB-first, env fallback). Thin wrapper so existing callers keep working.
 */
export async function getAccessToken(): Promise<string> {
  return getAccessTokenFor(await resolveProviderViva());
}

export interface CreateVivaOrderInput {
  amountCents: number; // integer minor units (EUR cents)
  customerTrns: string;
  merchantTrns: string;
  sourceCode?: string;
}

export interface CreateVivaOrderResult {
  orderCode: number;
  checkoutUrl: string;
}

/**
 * Create a Smart Checkout v2 payment order against an EXPLICIT provider config
 * (DB- or env-resolved). Uses cfg.clientId/secret for OAuth and cfg.sourceCode
 * as the default source code.
 * POST {api}/checkout/v2/orders with a Bearer token.
 */
export async function createVivaOrderFor(
  cfg: ProviderVivaConfig,
  input: CreateVivaOrderInput,
): Promise<CreateVivaOrderResult> {
  const token = await getAccessTokenFor(cfg);
  const { api, checkoutBase } = vivaUrls();

  const res = await fetch(`${api}/checkout/v2/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountCents,
      customerTrns: input.customerTrns,
      merchantTrns: input.merchantTrns,
      sourceCode: input.sourceCode ?? cfg.sourceCode ?? undefined,
      paymentTimeout: 300,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Viva ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { orderCode?: number };
  if (typeof data.orderCode !== "number") {
    throw new Error("Viva order response missing orderCode");
  }
  return {
    orderCode: data.orderCode,
    checkoutUrl: `${checkoutBase}?ref=${data.orderCode}`,
  };
}

/**
 * Create a Smart Checkout v2 payment order using the resolved provider config
 * (DB-first, env fallback). Thin wrapper so existing callers keep working.
 */
export async function createVivaOrder(
  input: CreateVivaOrderInput,
): Promise<CreateVivaOrderResult> {
  return createVivaOrderFor(await resolveProviderViva(), input);
}

export interface VivaTransaction {
  statusId?: string; // "F" = finished/successful
  amount?: number;   // EUR major units (e.g. 12.34)
  merchantTrns?: string;
}

/**
 * Re-fetch a transaction to verify authenticity/amount before acting on a webhook.
 * GET {api}/checkout/v2/transactions/{transactionId} with a Bearer token.
 *
 * VERIFY: confirm this endpoint path + the response shape (statusId/amount/
 * merchantTrns) against a live/sandbox Viva account before enabling the flow.
 */
export async function getVivaTransaction(transactionId: string): Promise<VivaTransaction> {
  const token = await getAccessToken();
  const { api } = vivaUrls();
  const res = await fetch(`${api}/checkout/v2/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!res.ok) throw new Error(`Viva ${res.status}: ${await res.text()}`);
  return (await res.json()) as VivaTransaction;
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-PROPERTY variants — auth against a SPECIFIC merchant's OWN credentials,
// passed in explicitly. Used by the κοινόχρηστα flow so residents' payments land
// in the property's own Viva account, NEVER the global provider account.
//
// These deliberately DO NOT read any global VIVA_* credential env var — the only
// env they touch is VIVA_ENV (sandbox vs production base URLs), which is an
// environment selector, not a credential. Auth uses the classic Viva REST Basic
// scheme: base64(merchantId:apiKey). (Only the base host is environment-derived.)
//
// VERIFY: confirm the endpoint paths, request/response field casing, and that the
// Merchant-ID/API-key Basic pair authorizes order-create + transaction-retrieve
// against a real property-scoped Viva account (sandbox) before enabling the flow.
// ─────────────────────────────────────────────────────────────────────────────

export interface VivaMerchantCreds {
  merchantId: string;
  apiKey: string;
  sourceCode?: string;
}

function basicAuth(creds: VivaMerchantCreds): string {
  return Buffer.from(`${creds.merchantId}:${creds.apiKey}`).toString("base64");
}

/**
 * Create a payment order against a SPECIFIC merchant's own credentials.
 * POST {api}/api/orders with HTTP Basic auth (merchantId:apiKey).
 */
export async function createVivaOrderWith(
  creds: VivaMerchantCreds,
  input: CreateVivaOrderInput,
): Promise<CreateVivaOrderResult> {
  const { api, checkoutBase } = vivaUrls();
  const res = await fetch(`${api}/api/orders`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(creds)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountCents,
      customerTrns: input.customerTrns,
      merchantTrns: input.merchantTrns,
      sourceCode: input.sourceCode ?? creds.sourceCode,
      paymentTimeout: 300,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Viva ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { orderCode?: number; OrderCode?: number };
  const orderCode = data.orderCode ?? data.OrderCode;
  if (typeof orderCode !== "number") {
    throw new Error("Viva order response missing orderCode");
  }
  return {
    orderCode,
    checkoutUrl: `${checkoutBase}?ref=${orderCode}`,
  };
}

/**
 * Re-fetch a transaction against a SPECIFIC merchant's own credentials to verify
 * authenticity/amount before reconciling. GET {api}/api/transactions/{id} with
 * HTTP Basic auth (merchantId:apiKey).
 */
export async function getVivaTransactionWith(
  creds: VivaMerchantCreds,
  transactionId: string,
): Promise<VivaTransaction> {
  const { api } = vivaUrls();
  const res = await fetch(`${api}/api/transactions/${transactionId}`, {
    headers: { Authorization: `Basic ${basicAuth(creds)}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Viva ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    statusId?: string; StatusId?: string;
    amount?: number; Amount?: number;
    merchantTrns?: string; MerchantTrns?: string;
  };
  return {
    statusId: data.statusId ?? data.StatusId,
    amount: data.amount ?? data.Amount,
    merchantTrns: data.merchantTrns ?? data.MerchantTrns,
  };
}
