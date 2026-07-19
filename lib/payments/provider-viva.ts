import "server-only";
import { getAppSettings } from "@/lib/app-settings";
import { decryptSecret } from "@/lib/crypto/secrets";

/**
 * Resolved provider-Viva configuration — the global Viva account the platform
 * uses to COLLECT payments from app users (e.g. wallet top-ups). This is the
 * provider's own account, NOT a per-property merchant account (that path lives
 * in lib/viva.ts's *With helpers and is deliberately untouched here).
 *
 * Resolution order:
 *   1. DB (AppSettings singleton) when providerVivaEnabled + clientId + secret set
 *   2. env (VIVA_CLIENT_ID / VIVA_CLIENT_SECRET + optional VIVA_*) fallback
 *   3. null when neither is configured
 */
export type ProviderVivaConfig = {
  source: "db" | "env";
  clientId: string;
  clientSecret: string;
  merchantId: string | null;
  apiKey: string | null;
  sourceCode: string | null;
};

export async function getProviderVivaConfig(): Promise<ProviderVivaConfig | null> {
  const s = await getAppSettings();
  if (s?.providerVivaEnabled && s.providerVivaClientId && s.providerVivaClientSecretEnc) {
    return {
      source: "db",
      clientId: s.providerVivaClientId,
      clientSecret: decryptSecret(s.providerVivaClientSecretEnc),
      merchantId: s.providerVivaMerchantId ?? null,
      apiKey: s.providerVivaApiKeyEnc ? decryptSecret(s.providerVivaApiKeyEnc) : null,
      sourceCode: s.providerVivaSourceCode ?? null,
    };
  }

  const clientId = process.env.VIVA_CLIENT_ID;
  const clientSecret = process.env.VIVA_CLIENT_SECRET;
  if (clientId && clientSecret) {
    return {
      source: "env",
      clientId,
      clientSecret,
      merchantId: process.env.VIVA_MERCHANT_ID ?? null,
      apiKey: process.env.VIVA_API_KEY ?? null,
      sourceCode: process.env.VIVA_SOURCE_CODE ?? null,
    };
  }

  return null;
}

export async function isProviderVivaConfigured(): Promise<boolean> {
  return (await getProviderVivaConfig()) !== null;
}
