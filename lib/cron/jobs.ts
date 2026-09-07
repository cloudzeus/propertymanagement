import "server-only";
import { db } from "@/lib/db";
import { addBusinessDays, businessDaysUntil } from "@/lib/rfq-shared";
import { notifyUsers, supplierUserIds, companyStaffIds, buildingDeciderIds } from "@/lib/notify";
import { pickReminderEmails, isReminderDue } from "@/lib/maintenance";
import { sendNotificationEmail } from "@/lib/mailgun";
import { runMonthlyAllowance } from "@/lib/wallet/allowance";

/**
 * Scheduled jobs. Each is a plain async function so it can run from the
 * in-process scheduler (instrumentation.ts), the HTTP routes under
 * /api/cron/* (external trigger, x-cron-secret) or the settings page.
 */
export type CronJob = {
  key: string;
  label: string;
  description: string;
  /** "daily" runs once per calendar day after `hour` (Europe/Athens); "monthly" on day 1. */
  schedule: { kind: "daily" | "monthly"; hour: number };
  run: () => Promise<Record<string, unknown>>;
};

/** Silent acceptance of completed work orders, decider reminder, RFQ expiry. */
export async function runWorkOrdersJob(): Promise<Record<string, unknown>> {
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
      await notifyUsers([...(await supplierUserIds(wo.supplierId)), ...(await companyStaffIds()), ...(await buildingDeciderIds(wo.buildingId))], {
        type: "WORK_ORDER", title: `Σιωπηρή παραλαβή: ${wo.number} ${wo.title}`,
        body: `Πέρασαν ${silentDays} εργάσιμες ημέρες χωρίς απάντηση από τον διαχειριστή· η εργασία θεωρείται παραληφθείσα και μπορεί να τιμολογηθεί.`,
        href: wo.maintenanceRequestId ? `/admin/maintenance/${wo.maintenanceRequestId}` : "/admin/work-orders", requestId: wo.maintenanceRequestId,
      });
      confirmed++;
      continue;
    }
    if (left === 1 && wo.maintenanceRequestId) {
      const already = await db.notification.findFirst({ where: { type: "WORK_ORDER_REMINDER", requestId: wo.maintenanceRequestId, createdAt: { gte: wo.completedAt! } }, select: { id: true } });
      if (already) continue;
      await notifyUsers(await buildingDeciderIds(wo.buildingId), {
        type: "WORK_ORDER_REMINDER", title: `Αύριο λήγει η προθεσμία παραλαβής: ${wo.number}`,
        body: "Δείτε την απόδειξη επισκευής και επιβεβαιώστε ή αμφισβητήστε την παραλαβή. Χωρίς απάντηση η εργασία θεωρείται παραληφθείσα.",
        href: `/portal/maintenance/${wo.maintenanceRequestId}`, requestId: wo.maintenanceRequestId,
      });
      reminded++;
    }
  }
  const grace = new Date(now.getTime() - 24 * 3600_000);
  const stale = await db.serviceRequest.findMany({ where: { status: "OPEN", deadlineAt: { lt: grace }, offers: { none: {} } }, select: { id: true, title: true, maintenanceRequestId: true } });
  for (const r of stale) {
    await db.serviceRequest.update({ where: { id: r.id }, data: { status: "EXPIRED" } });
    await notifyUsers(await companyStaffIds(), {
      type: "RFQ", title: `Έληξε χωρίς προσφορές: ${r.title}`, body: "Κανένας συνεργάτης δεν απάντησε μέχρι την προθεσμία. Στείλτε νέο αίτημα σε άλλους συνεργάτες.",
      href: r.maintenanceRequestId ? `/admin/maintenance/${r.maintenanceRequestId}` : "/admin/work-orders", requestId: r.maintenanceRequestId,
    });
  }
  return { confirmed, reminded, expired: stale.length, silentDays };
}

/** Email reminders N days before each recurring maintenance task is due. */
export async function runMaintenanceRemindersJob(): Promise<Record<string, unknown>> {
  const today = new Date();
  const tasks = await db.recurringTask.findMany({
    where: { active: true, nextDueDate: { not: null } },
    select: {
      id: true, title: true, kind: true, inServicePackage: true, nextDueDate: true, reminderDaysBefore: true, reminderSentAt: true,
      building: { select: { id: true, name: true, propertyId: true, managementAssignments: { select: { user: { select: { email: true, role: true } } } }, property: { select: { managementAssignments: { select: { user: { select: { email: true, role: true } } } } } } } },
    },
  });
  let sent = 0;
  for (const t of tasks) {
    if (!isReminderDue(t, today)) continue;
    const assignments = [...t.building.managementAssignments.map((a) => a.user), ...(t.building.property?.managementAssignments.map((a) => a.user) ?? [])];
    const managed = assignments.length > 0;
    const companyEmails = assignments.filter((u) => ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"].includes(u.role)).map((u) => u.email).filter(Boolean) as string[];
    const managerEmails = assignments.filter((u) => u.role === "PROPERTY_ADMIN").map((u) => u.email).filter(Boolean) as string[];
    const recipients = [...new Set(pickReminderEmails({ managed, inServicePackage: t.inServicePackage }, companyEmails, managerEmails))];
    if (recipients.length === 0) continue;
    const due = t.nextDueDate!.toLocaleDateString("el-GR");
    await Promise.all(recipients.map((email) => sendNotificationEmail(email, `Υπενθύμιση συντήρησης — ${t.building.name}`, `Η συντήρηση «${t.title}» είναι προγραμματισμένη για ${due}.`, { href: `/building/${t.building.id}?s=maintenance`, eyebrow: "Τακτική συντήρηση" })));
    await db.recurringTask.update({ where: { id: t.id }, data: { reminderSentAt: today } });
    sent++;
  }
  return { checked: tasks.length, sent };
}

export const CRON_JOBS: CronJob[] = [
  { key: "work-orders", label: "Συμβάσεις έργου", description: "Σιωπηρή παραλαβή μετά τις εργάσιμες της ρύθμισης, υπενθύμιση διαχειριστή μία μέρα πριν, λήξη αιτημάτων προσφοράς χωρίς προσφορές.", schedule: { kind: "daily", hour: 7 }, run: runWorkOrdersJob },
  { key: "maintenance-reminders", label: "Υπενθυμίσεις συντηρήσεων", description: "Email στους υπεύθυνους Ν ημέρες πριν από κάθε τακτική συντήρηση.", schedule: { kind: "daily", hour: 7 }, run: runMaintenanceRemindersJob },
  { key: "monthly-allowance", label: "Μηνιαία πίστωση πορτοφολιών", description: "Πιστώνει τη μηνιαία ποσόστωση των πακέτων χρεώσεων στα πορτοφόλια πελατών.", schedule: { kind: "monthly", hour: 6 }, run: async () => runMonthlyAllowance() },
];
