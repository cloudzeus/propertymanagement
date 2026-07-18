import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { generateMinutesHtml } from "@/lib/assemblies/minutes";

/**
 * Core minutes generation + persistence for an assembly.
 * NO auth here — callers MUST guard: the Daily webhook verifies its HMAC
 * signature, and the `generateMinutes` server action gates on
 * `requireBuildingCap(buildingId, "manageAssemblies")`.
 */
export async function runAssemblyMinutes(assemblyId: string): Promise<{ html: string }> {
  const a = await db.assembly.findUnique({
    where: { id: assemblyId },
    select: { id: true, transcriptRaw: true, buildingId: true, building: { select: { name: true, companyId: true, property: { select: { customerId: true } } } } },
  });
  if (!a?.transcriptRaw) throw new Error("No transcript yet");

  const result = await generateMinutesHtml({
    transcript: a.transcriptRaw,
    buildingName: a.building.name,
    ctx: { companyId: a.building.companyId ?? undefined, customerId: a.building.property?.customerId ?? undefined, buildingId: a.buildingId, assemblyId },
  });
  if (!result.success) throw new Error(result.error ?? "DeepSeek failed");

  const html = result.html ?? "";
  await db.assembly.update({ where: { id: assemblyId }, data: { minutesDraft: html, status: "DRAFT_READY" } });
  revalidatePath(`/super-admin/buildings/${a.buildingId}/assemblies/${assemblyId}`);
  revalidatePath(`/building/${a.buildingId}/assemblies/${assemblyId}`);
  return { html };
}
