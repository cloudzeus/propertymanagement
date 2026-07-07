// Viva Smart Checkout v2 client. Coded to Viva's documented API; NOT yet verified
// against a live/sandbox account. Set VIVA_* env + verify in sandbox before enabling.

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

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

/**
 * OAuth2 client-credentials token for Smart Checkout v2.
 * POST {accounts}/connect/token with HTTP Basic auth (client id:secret).
 */
export async function getAccessToken(): Promise<string> {
  const clientId = requireEnv("VIVA_CLIENT_ID");
  const clientSecret = requireEnv("VIVA_CLIENT_SECRET");
  const { accounts } = vivaUrls();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

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
 * Create a Smart Checkout v2 payment order.
 * POST {api}/checkout/v2/orders with a Bearer token.
 */
export async function createVivaOrder(
  input: CreateVivaOrderInput,
): Promise<CreateVivaOrderResult> {
  const token = await getAccessToken();
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
      sourceCode: input.sourceCode ?? process.env.VIVA_SOURCE_CODE,
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
