// Coolify scheduled task (daily, e.g. 07:00): curl -H "x-cron-secret: $CRON_SECRET" https://property.dgsmart.gr/api/cron/work-orders
// 1. Silent acceptance: COMPLETED work orders the customer ignored for N business
//    days (AppSettings.silentAcceptDays) become CONFIRMED (autoConfirmedAt set).
// 2. One reminder to the building's deciders the business day before that.
// 3. RFQs past their deadline with no offer → EXPIRED.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addBusinessDays, businessDaysUntil } from "@/lib/rfq-shared";
import { notifyUsers, supplierUserIds, companyStaffIds, buildingDeciderIds } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const settings = await db.appSettings.findUnique({ where: { id: "singleton" }, select: { silentAcceptDays: true } });
  const silentDays = settings?.silentAcceptDays ?? 5;

  const completed = await db.workOrder.findMany({
    where: { status: "COMPLETED", completedAt: { not: null } },
    select: { id: true, number: true, title: true, buildingId: true, supplierId: true, maintenanceRequestId: true, completedAt: true },
  });

  let confirmed = 0, reminded = 0;
  for (const wo of completed) {
    const deadline = addBusinessDays(wo.completedAt!, silentDays);
    const left = businessDaysUntil(deadline, now);
    if (left <= 0 && deadline <= now) {
      await db.workOrder.update({ where: { id: wo.id }, data: { status: "CONFIRMED", customerConfirmedAt: now, autoConfirmedAt: now } });
      if (wo.maintenanceRequestId) {
        await db.maintenanceStatusEvent.create({ data: { requestId: wo.maintenanceRequestId, toStatus: "CONFIRMED", note: `Σιωπηρή παραλαβή ${wo.number} (${silentDays} εργάσιμες χωρίς απάντηση)` } });
      }
      const deciders = await buildingDeciderIds(wo.buildingId);
      await notifyUsers([...(await supplierUserIds(wo.supplierId)), ...(await companyStaffIds()), ...deciders], {
        type: "WORK_ORDER", title: `Σιωπηρή παραλαβή: ${wo.number} ${wo.title}`,
        body: `Πέρασαν ${silentDays} εργάσιμες ημέρες χωρίς απάντηση από τον διαχειριστή· η εργασία θεωρείται παραληφθείσα και μπορεί να τιμολογηθεί.`,
        href: wo.maintenanceRequestId ? `/admin/maintenance/${wo.maintenanceRequestId}` : "/admin/work-orders", requestId: wo.maintenanceRequestId,
      });
      confirmed++;
      continue;
    }
    if (left === 1 && wo.maintenanceRequestId) {
      // one reminder per work order: skip if one already exists since completion
      const already = await db.notification.findFirst({ where: { type: "WORK_ORDER_REMINDER", requestId: wo.maintenanceRequestId, createdAt: { gte: wo.completedAt! } }, select: { id: true } });
      if (already) continue;
      const deciders = await buildingDeciderIds(wo.buildingId);
      await notifyUsers(deciders, {
        type: "WORK_ORDER_REMINDER", title: `Αύριο λήγει η προθεσμία παραλαβής: ${wo.number}`,
        body: "Δείτε την απόδειξη επισκευής και επιβεβαιώστε ή αμφισβητήστε την παραλαβή. Χωρίς απάντηση η εργασία θεωρείται παραληφθείσα.",
        href: `/portal/maintenance/${wo.maintenanceRequestId}`, requestId: wo.maintenanceRequestId,
      });
      reminded++;
    }
  }

  // RFQ expiry: a day of grace after the deadline, only when nobody offered.
  const grace = new Date(now.getTime() - 24 * 3600_000);
  const stale = await db.serviceRequest.findMany({
    where: { status: "OPEN", deadlineAt: { lt: grace }, offers: { none: {} } },
    select: { id: true, title: true, maintenanceRequestId: true },
  });
  for (const r of stale) {
    await db.serviceRequest.update({ where: { id: r.id }, data: { status: "EXPIRED" } });
    await notifyUsers(await companyStaffIds(), {
      type: "RFQ", title: `Έληξε χωρίς προσφορές: ${r.title}`, body: "Κανένας συνεργάτης δεν απάντησε μέχρι την προθεσμία. Στείλτε νέο αίτημα σε άλλους συνεργάτες.",
      href: r.maintenanceRequestId ? `/admin/maintenance/${r.maintenanceRequestId}` : "/admin/work-orders", requestId: r.maintenanceRequestId,
    });
  }

  return NextResponse.json({ ok: true, confirmed, reminded, expired: stale.length, silentDays });
}
