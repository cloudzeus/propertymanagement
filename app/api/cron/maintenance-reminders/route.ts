// Coolify scheduled task (daily): curl -H "x-cron-secret: $CRON_SECRET" https://property.dgsmart.gr/api/cron/maintenance-reminders
// Set CRON_SECRET in Coolify env.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pickReminderEmails, isReminderDue } from "@/lib/maintenance";
import { sendNotificationEmail } from "@/lib/mailgun";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const today = new Date();

  const tasks = await db.recurringTask.findMany({
    where: { active: true, nextDueDate: { not: null } },
    select: {
      id: true, title: true, kind: true, inServicePackage: true,
      nextDueDate: true, reminderDaysBefore: true, reminderSentAt: true,
      building: {
        select: {
          id: true, name: true, propertyId: true,
          managementAssignments: { select: { user: { select: { email: true, role: true } } } },
          property: { select: { managementAssignments: { select: { user: { select: { email: true, role: true } } } } } },
        },
      },
    },
  });

  let sent = 0;
  for (const t of tasks) {
    if (!isReminderDue(t, today)) continue;

    const assignments = [
      ...t.building.managementAssignments.map((a) => a.user),
      ...(t.building.property?.managementAssignments.map((a) => a.user) ?? []),
    ];
    const managed = assignments.length > 0;
    const companyEmails = assignments
      .filter((u) => ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"].includes(u.role))
      .map((u) => u.email).filter(Boolean) as string[];
    const managerEmails = assignments
      .filter((u) => u.role === "PROPERTY_ADMIN")
      .map((u) => u.email).filter(Boolean) as string[];

    const recipients = [...new Set(pickReminderEmails({ managed, inServicePackage: t.inServicePackage }, companyEmails, managerEmails))];
    if (recipients.length === 0) continue;

    const due = t.nextDueDate!.toLocaleDateString("el-GR");
    await Promise.all(recipients.map((email) =>
      sendNotificationEmail(email, `Υπενθύμιση συντήρησης — ${t.building.name}`,
        `Η συντήρηση «${t.title}» είναι προγραμματισμένη για ${due}.`)
    ));
    await db.recurringTask.update({ where: { id: t.id }, data: { reminderSentAt: today } });
    sent++;
  }

  return NextResponse.json({ ok: true, checked: tasks.length, sent });
}
