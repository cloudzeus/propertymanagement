"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { buildingInfoSchema, setUnitsSchema } from "@/lib/ai/agents/building-onboarding";
import { buildOnboardingPayload } from "./building-onboarding-payload";
import { UnitType } from "@/lib/prisma/enums";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (user?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

async function managingCompanyId(): Promise<string> {
  const c = await db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!c) throw new Error("No managing company");
  return c.id;
}

export async function createBuildingFromOnboarding(
  customerId: string,
  raw: unknown,
): Promise<{ buildingId: string } | { error: string }> {
  await requireSuperAdmin();
  const data = (raw ?? {}) as { building?: unknown; units?: unknown };
  const building = buildingInfoSchema.safeParse(data.building);
  const unitsParsed = setUnitsSchema.safeParse({ units: Array.isArray(data.units) ? data.units : [] });
  // Minimum to create the shell: an address + at least one unit. Manager, heating
  // type and τ.μ./millesimes are optional here and can be completed later in the
  // building detail (the audit flags what's still missing).
  if (!building.success || !building.data.address) {
    return { error: "Συμπληρώστε τουλάχιστον τη διεύθυνση." };
  }
  if (!unitsParsed.success || unitsParsed.data.units.length === 0) {
    return { error: "Προσθέστε τουλάχιστον μία μονάδα." };
  }
  const payload = buildOnboardingPayload({ building: building.data, units: unitsParsed.data.units });
  const companyId = await managingCompanyId();

  const buildingId = await db.$transaction(async (tx) => {
    const property = await tx.property.create({
      data: {
        companyId, customerId, name: payload.building.address, address: payload.building.address,
        city: payload.building.city || null, postalCode: payload.building.postalCode || null,
        lat: payload.building.lat ?? null, lng: payload.building.lng ?? null,
      },
    });
    const b = await tx.building.create({
      data: {
        companyId, customerId, propertyId: property.id,
        name: payload.building.address, address: payload.building.address,
        city: payload.building.city || "", postalCode: payload.building.postalCode || "", country: "Greece",
        lat: payload.building.lat ?? null, lng: payload.building.lng ?? null,
        hasElevator: payload.building.hasElevator,
        elevatorSurchargePerFloor: payload.building.elevatorSurchargePerFloor,
        elevatorExemptGroundFloor: payload.building.elevatorExemptGroundFloor,
        unitsCount: payload.units.length,
        technicalNotes: `Διαχειριστής: ${payload.building.managerName}`,
      },
    });
    await tx.unit.createMany({
      data: payload.units.map((u) => ({
        buildingId: b.id,
        customerId,
        unitNumber: u.unitNumber,
        floor: u.floor ?? undefined,
        areaSqm: u.areaSqm ?? undefined,
        unitType: u.unitType as UnitType,
        millesimes: u.millesimes ?? undefined,
        millesimesElevator: u.millesimesElevator ?? undefined,
        millesimesHeating: u.millesimesHeating ?? undefined,
      })),
    });
    if (payload.meteredHeating) {
      const heatingCat = await tx.expenseCategory.findFirst({
        where: { defaultBasis: { in: ["HEATING_MILLESIMES", "METERED_70_30"] } },
        select: { id: true, defaultTenantPct: true, defaultOwnerPct: true },
      });
      if (heatingCat) {
        await tx.buildingCategoryOverride.upsert({
          where: { buildingId_categoryId: { buildingId: b.id, categoryId: heatingCat.id } },
          create: { buildingId: b.id, categoryId: heatingCat.id, distributionBasis: "METERED_70_30", tenantPct: heatingCat.defaultTenantPct, ownerPct: heatingCat.defaultOwnerPct },
          update: { distributionBasis: "METERED_70_30" },
        });
      }
    }
    return b.id;
  });

  revalidatePath(`/super-admin/customers/${customerId}`);
  return { buildingId };
}
