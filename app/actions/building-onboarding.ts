"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { onboardingSchema } from "@/lib/ai/agents/building-onboarding";
import { buildOnboardingPayload, type OnboardingInput } from "./building-onboarding-payload";

// requireSuperAdmin / managingCompanyId are private (non-exported) in
// app/actions/properties.ts and buildings.ts — replicate inline here.
async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { role: true },
  });
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
  const parsed = onboardingSchema.safeParse(raw);
  if (
    !parsed.success ||
    !parsed.data.address ||
    !parsed.data.totalApartments ||
    !parsed.data.heatingType ||
    !parsed.data.managerName
  ) {
    return { error: "Συμπληρώστε όλα τα στοιχεία (διεύθυνση, διαμερίσματα, θέρμανση, διαχειριστή)." };
  }
  const input = parsed.data as OnboardingInput;
  const payload = buildOnboardingPayload(input);
  const companyId = await managingCompanyId();

  const buildingId = await db.$transaction(async (tx) => {
    const property = await tx.property.create({
      data: { companyId, customerId, name: payload.building.address, address: payload.building.address },
    });
    const building = await tx.building.create({
      data: {
        companyId,
        propertyId: property.id,
        name: payload.building.name,
        address: payload.building.address,
        // Building requires non-null city/postalCode strings; country defaults.
        city: "",
        postalCode: "",
        country: "Greece",
        unitsCount: payload.units.length,
        technicalNotes: `Διαχειριστής: ${payload.managerName}`,
      },
    });
    if (payload.units.length) {
      await tx.unit.createMany({
        data: payload.units.map((u) => ({ buildingId: building.id, unitNumber: u.unitNumber })),
      });
    }
    if (payload.meteredHeating) {
      const heatingCat = await tx.expenseCategory.findFirst({
        where: { defaultBasis: { in: ["HEATING_MILLESIMES", "METERED_70_30"] } },
        select: { id: true, defaultTenantPct: true, defaultOwnerPct: true },
      });
      if (heatingCat) {
        await tx.buildingCategoryOverride.upsert({
          where: { buildingId_categoryId: { buildingId: building.id, categoryId: heatingCat.id } },
          create: {
            buildingId: building.id,
            categoryId: heatingCat.id,
            distributionBasis: "METERED_70_30",
            tenantPct: heatingCat.defaultTenantPct,
            ownerPct: heatingCat.defaultOwnerPct,
          },
          update: { distributionBasis: "METERED_70_30" },
        });
      }
    }
    return building.id;
  });

  revalidatePath(`/super-admin/customers/${customerId}`);
  return { buildingId };
}
