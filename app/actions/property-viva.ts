"use server";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { encryptSecret, maskSecret } from "@/lib/crypto/secrets";
import { canManagePropertyViva } from "@/lib/property-access";

export type PropertyVivaView = {
  vivaEnabled: boolean; vivaMerchantId: string | null; vivaSourceCode: string | null;
  apiKeyMask: string | null; hasApiKey: boolean;
};

async function requireAccess(propertyId: string): Promise<string> {
  const s = await getEffectiveSession();
  if (!s?.user?.id) throw new Error("Unauthorized");
  const uid = s.user.id as string;
  if (!(await canManagePropertyViva(uid, propertyId))) throw new Error("Forbidden");
  return uid;
}

export async function getPropertyVivaForEdit(propertyId: string): Promise<PropertyVivaView> {
  await requireAccess(propertyId);
  const p = await db.property.findUnique({ where: { id: propertyId }, select: { vivaEnabled: true, vivaMerchantId: true, vivaSourceCode: true, vivaApiKeyEnc: true } });
  if (!p) throw new Error("Not found");
  return {
    vivaEnabled: p.vivaEnabled, vivaMerchantId: p.vivaMerchantId, vivaSourceCode: p.vivaSourceCode,
    apiKeyMask: p.vivaApiKeyEnc ? maskSecret(p.vivaApiKeyEnc) : null, hasApiKey: !!p.vivaApiKeyEnc,
  };
}

export async function savePropertyViva(propertyId: string, input: {
  vivaEnabled: boolean; vivaMerchantId: string | null; vivaSourceCode: string | null; apiKey?: string | null;
}): Promise<PropertyVivaView> {
  await requireAccess(propertyId);
  const data: Record<string, unknown> = {
    vivaEnabled: input.vivaEnabled,
    vivaMerchantId: input.vivaMerchantId?.trim() || null,
    vivaSourceCode: input.vivaSourceCode?.trim() || null,
  };
  if (input.apiKey !== undefined) {
    data.vivaApiKeyEnc = input.apiKey && input.apiKey.trim() ? encryptSecret(input.apiKey.trim()) : null;
  }
  await db.property.update({ where: { id: propertyId }, data });
  const buildings = await db.building.findMany({ where: { propertyId }, select: { id: true } });
  revalidatePath(`/super-admin/properties/${propertyId}`);
  for (const b of buildings) revalidatePath(`/building/${b.id}`);
  return getPropertyVivaForEdit(propertyId);
}
