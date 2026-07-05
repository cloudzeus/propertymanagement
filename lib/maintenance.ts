/** Pure helpers for maintenance reminders — no DB access, unit-testable. */

export function pickReminderEmails(
  task: { managed: boolean; inServicePackage: boolean },
  companyEmployeeEmails: string[],
  managerEmails: string[],
): string[] {
  if (task.managed && task.inServicePackage) return companyEmployeeEmails;
  return managerEmails;
}

/** The reminder window opens `reminderDaysBefore` days before nextDueDate.
 *  Any reminderSentAt on/after window-open counts as "already sent this cycle". */
export function isReminderDue(
  t: { nextDueDate: Date | null; reminderDaysBefore: number; reminderSentAt: Date | null },
  today: Date,
): boolean {
  if (!t.nextDueDate) return false;
  const windowOpen = new Date(t.nextDueDate);
  windowOpen.setDate(windowOpen.getDate() - t.reminderDaysBefore);
  if (today < windowOpen) return false;
  if (t.reminderSentAt && t.reminderSentAt >= windowOpen) return false;
  return true;
}
