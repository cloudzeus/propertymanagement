import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac/permissions";
import { ServicesClient } from "./ServicesClient";

export const metadata = { title: "Υπηρεσίες — Super Admin" };

export default async function ServicesPage() {
  await requirePermission("services", "view");
  const session = await auth();
  if (!session?.user) redirect("/login");
  const me = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (me?.role !== "SUPER_ADMIN") redirect("/admin");

  const services = await db.service.findMany({ orderBy: [{ isCore: "desc" }, { name: "asc" }] });

  return (
    <ServicesClient
      initial={services.map((s) => ({
        id: s.id, name: s.name, code: s.code, description: s.description,
        isCore: s.isCore, pricingModel: s.pricingModel, price: Number(s.price), active: s.active,
      }))}
    />
  );
}
