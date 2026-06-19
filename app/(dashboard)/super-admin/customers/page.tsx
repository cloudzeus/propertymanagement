import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { CustomersClient } from "./CustomersClient";

export const metadata = { title: "Πελάτες — Super Admin" };

export default async function CustomersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const me = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (me?.role !== "SUPER_ADMIN") redirect("/admin");

  const customers = await db.customer.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { properties: true } },
      properties: {
        orderBy: { name: "asc" },
        include: {
          buildings: {
            orderBy: { name: "asc" },
            include: {
              commonAreas: { orderBy: [{ floor: "asc" }, { name: "asc" }] },
              units: {
                orderBy: [{ floor: "asc" }, { unitNumber: "asc" }],
                include: {
                  owner: { select: { id: true, name: true, email: true } },
                  resident: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return (
    <CustomersClient
      initial={customers.map((c) => ({
        id: c.id, type: c.type, name: c.name, code: c.code, afm: c.afm, doy: c.doy, email: c.email,
        phone: c.phone, phone2: c.phone2, fax: c.fax, webpage: c.webpage,
        address: c.address, city: c.city, district: c.district, postalCode: c.postalCode, country: c.country, remarks: c.remarks,
        lat: c.lat, lng: c.lng,
        propertyCount: c._count.properties,
        properties: c.properties.map((p) => ({
          id: p.id, name: p.name,
          address: p.address, city: p.city, postalCode: p.postalCode, country: p.country, lat: p.lat, lng: p.lng,
          buildingCount: p.buildings.length,
          unitCount: p.buildings.reduce((s, b) => s + b.units.length, 0),
          buildings: p.buildings.map((b) => ({
            id: b.id, name: b.name, address: b.address, city: b.city, postalCode: b.postalCode, country: b.country,
            floors: b.floors, basements: b.basements, hasElevator: b.hasElevator, hasBoiler: b.hasBoiler, hasFireSafety: b.hasFireSafety,
            technicalNotes: b.technicalNotes, lat: b.lat, lng: b.lng,
            commonAreas: b.commonAreas.map((a) => ({ id: a.id, name: a.name, type: a.type, floor: a.floor })),
            units: b.units.map((u) => ({
              id: u.id, unitNumber: u.unitNumber, unitType: u.unitType, floor: u.floor, areaSqm: u.areaSqm, millesimes: u.millesimes,
              owner: u.owner ? { id: u.owner.id, name: u.owner.name, email: u.owner.email } : null,
              resident: u.resident ? { id: u.resident.id, name: u.resident.name, email: u.resident.email } : null,
            })),
          })),
        })),
      }))}
    />
  );
}
