"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAppSettings } from "@/lib/app-settings";
import { getProviderVivaConfig } from "@/lib/payments/provider-viva";
import { encryptSecret, maskSecret } from "@/lib/crypto/secrets";
import { revalidatePath } from "next/cache";

/**
 * Provider Viva settings actions.
 *
 * SECURITY: guarded to SUPER_ADMIN / ADMIN only. Secrets (client secret, api key)
 * are stored AES-256-GCM encrypted and NEVER returned to the client — the edit
 * view exposes only masked previews ("••••1234") and presence booleans.
 */

async function requireStaff(): Promise<string> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "SUPER_ADMIN" && role !== "ADMIN")) {
    throw new Error("Forbidden");
  }
  return session.user.id as string;
}

export type ProviderVivaEditView = {
  providerVivaEnabled: boolean;
  providerVivaClientId: string;
  providerVivaMerchantId: string;
  providerVivaSourceCode: string;
  clientSecretMask: string | null;
  apiKeyMask: string | null;
  hasClientSecret: boolean;
  hasApiKey: boolean;
  /** Which config the runtime currently resolves ("db" | "env" | null). */
  source: "db" | "env" | null;
};

export async function getProviderVivaForEdit(): Promise<ProviderVivaEditView> {
  await requireStaff();
  const s = await getAppSettings();
  const resolved = await getProviderVivaConfig();

  return {
    providerVivaEnabled: s.providerVivaEnabled,
    providerVivaClientId: s.providerVivaClientId ?? "",
    providerVivaMerchantId: s.providerVivaMerchantId ?? "",
    providerVivaSourceCode: s.providerVivaSourceCode ?? "",
    clientSecretMask: s.providerVivaClientSecretEnc ? maskSecret(s.providerVivaClientSecretEnc) : null,
    apiKeyMask: s.providerVivaApiKeyEnc ? maskSecret(s.providerVivaApiKeyEnc) : null,
    hasClientSecret: Boolean(s.providerVivaClientSecretEnc),
    hasApiKey: Boolean(s.providerVivaApiKeyEnc),
    source: resolved?.source ?? null,
  };
}

export type SaveProviderVivaInput = {
  providerVivaEnabled: boolean;
  providerVivaClientId: string;
  providerVivaMerchantId: string;
  providerVivaSourceCode: string;
  /** undefined = keep existing; "" = clear; non-empty = encrypt & store. */
  clientSecret?: string;
  /** undefined = keep existing; "" = clear; non-empty = encrypt & store. */
  apiKey?: string;
};

export async function saveProviderViva(
  input: SaveProviderVivaInput,
): Promise<{ ok: true } | { error: string }> {
  const userId = await requireStaff();

  // Non-secret fields: empty string clears the column.
  const data: Record<string, unknown> = {
    providerVivaEnabled: Boolean(input.providerVivaEnabled),
    providerVivaClientId: input.providerVivaClientId.trim() || null,
    providerVivaMerchantId: input.providerVivaMerchantId.trim() || null,
    providerVivaSourceCode: input.providerVivaSourceCode.trim() || null,
  };

  // Secrets: undefined keeps existing, "" clears, non-empty encrypts.
  if (input.clientSecret !== undefined) {
    data.providerVivaClientSecretEnc = input.clientSecret ? encryptSecret(input.clientSecret) : null;
  }
  if (input.apiKey !== undefined) {
    data.providerVivaApiKeyEnc = input.apiKey ? encryptSecret(input.apiKey) : null;
  }

  await db.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data, updatedById: userId } as never,
    update: { ...data, updatedById: userId } as never,
  });

  revalidatePath("/super-admin/settings/payments");
  return { ok: true };
}
