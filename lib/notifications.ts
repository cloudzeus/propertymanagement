import "server-only";
import { db } from "@/lib/db";
import { sendPushToUsers } from "@/lib/push/send";

/**
 * Το ΜΟΝΑΔΙΚΟ σημείο που γράφει γραμμές Notification (καμπανάκι). Μετά την εγγραφή
 * στέλνει Web Push σε όσους παραλήπτες έχουν ενεργοποιήσει «Ειδοποιήσεις στο κινητό»
 * — fire-and-forget: ένα σφάλμα του push δεν φτάνει ποτέ στον καλούντα.
 * Οι καλούντες (lib/notify.ts, lib/maintenance-requests.ts, lib/demo-booking.ts)
 * αποφασίζουν παραλήπτες, href ανά ρόλο και e-mail· εδώ μόνο η εγγραφή + το push.
 */
export type NotificationRow = {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  href: string;
  requestId?: string | null;
};

export async function createNotifications(rows: NotificationRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.notification.createMany({ data: rows });
  void sendPushToUsers(rows).catch(() => {});
}
