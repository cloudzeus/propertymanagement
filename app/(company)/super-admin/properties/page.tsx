import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PropertiesClient } from "./PropertiesClient";

export const metadata = { title: "Ιδιοκτησίες — Super Admin" };

export default async function PropertiesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const me = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (me?.role !== "SUPER_ADMIN") redirect("/admin");

  const [properties, customers] = await Promise.all([
    db.property.findMany({
      orderBy: { name: "asc" },
      include: {
        customer: { select: { name: true } },
        _count: { select: { buildings: true, services: true } },
        buildings: {
          orderBy: { name: "asc" },
          include: {
            units: {
              orderBy: { unitNumber: "asc" },
              include: {
                owner: { select: { id: true, name: true, email: true } },
                resident: { select: { id: true, name: true, email: true } },
              },
            },
            commonAreas: { orderBy: [{ floor: "asc" }, { name: "asc" }] },
          },
        },
      },
    }),
    db.customer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <PropertiesClient
      initial={properties.map((p) => ({
        id: p.id, name: p.name, notes: p.notes, customerId: p.customerId, customerName: p.customer.name,
        address: p.address, city: p.city, postalCode: p.postalCode, country: p.country, lat: p.lat, lng: p.lng,
        vivaEnabled: p.vivaEnabled, vivaMerchantId: p.vivaMerchantId, vivaSourceCode: p.vivaSourceCode,
        buildingCount: p._count.buildings,
        unitCount: p.buildings.reduce((sum, b) => sum + b.units.length, 0),
        serviceCount: p._count.services,
        buildings: p.buildings.map((b) => ({
          id: b.id, name: b.name, address: b.address, city: b.city, postalCode: b.postalCode, country: b.country,
          floors: b.floors, basements: b.basements, hasElevator: b.hasElevator, hasBoiler: b.hasBoiler, hasFireSafety: b.hasFireSafety,
          technicalNotes: b.technicalNotes, lat: b.lat, lng: b.lng,
          units: b.units.map((u) => ({
            id: u.id, unitNumber: u.unitNumber, unitType: u.unitType, floor: u.floor,
            areaSqm: u.areaSqm, millesimes: u.millesimes,
            owner: u.owner ? { id: u.owner.id, name: u.owner.name, email: u.owner.email } : null,
            resident: u.resident ? { id: u.resident.id, name: u.resident.name, email: u.resident.email } : null,
          })),
          commonAreas: b.commonAreas.map((c) => ({ id: c.id, name: c.name, type: c.type, floor: c.floor })),
        })),
      }))}
      customers={customers}
    />
  );
}
