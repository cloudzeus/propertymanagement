import "server-only";
import { db } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/mailgun";

/**
 * Notify specific users: in-app bell row + best-effort email. Unlike
 * `notifyStakeholders` (which derives recipients from a fault), this takes an
 * explicit list — used by the RFQ/offer/work-order flow where the audience is a
 * supplier's crew, the company's staff, or a building's managers.
 */
export async function notifyUsers(userIds: string[], opts: { type: string; title: string; body?: string; href: string; requestId?: string | null; excludeUserId?: string | null }) {
  const ids = [...new Set(userIds.filter((id) => id && id !== opts.excludeUserId))];
  if (ids.length === 0) return;
  const users = await db.user.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: { id: true, email: true } });
  if (users.length === 0) return;
  await db.notification.createMany({
    data: users.map((u) => ({ userId: u.id, type: opts.type, title: opts.title, body: opts.body ?? null, href: opts.href, requestId: opts.requestId ?? null })),
  });
  void Promise.allSettled(users.filter((u) => u.email).map((u) => sendNotificationEmail(u.email, opts.title, opts.body ?? opts.title, { href: opts.href })));
}

/** Active COLLABORATOR logins of a supplier. */
export async function supplierUserIds(supplierId: string): Promise<string[]> {
  const rows = await db.user.findMany({ where: { supplierId, role: "COLLABORATOR", status: "ACTIVE" }, select: { id: true } });
  return rows.map((r) => r.id);
}

/** Company staff who handle offers (ADMIN + MANAGER; SUPER_ADMIN sees everything anyway). */
export async function companyStaffIds(): Promise<string[]> {
  const rows = await db.user.findMany({ where: { role: { in: ["ADMIN", "MANAGER"] }, status: "ACTIVE" }, select: { id: true } });
  return rows.map((r) => r.id);
}

/** The customer-side people who decide for a building: its management assignments + the customer's PROPERTY_ADMIN users. */
export async function buildingDeciderIds(buildingId: string): Promise<string[]> {
  const b = await db.building.findUnique({ where: { id: buildingId }, select: { customerId: true, propertyId: true, managementAssignments: { select: { userId: true } } } });
  if (!b) return [];
  const [propAssignments, admins] = await Promise.all([
    db.managementAssignment.findMany({ where: { propertyId: b.propertyId }, select: { userId: true } }),
    db.user.findMany({ where: { customerId: b.customerId, role: "PROPERTY_ADMIN", status: "ACTIVE" }, select: { id: true } }),
  ]);
  return [...new Set([...b.managementAssignments.map((a) => a.userId), ...propAssignments.map((a) => a.userId), ...admins.map((a) => a.id)])];
}
