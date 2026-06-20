"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { revalidatePath } from "next/cache";
import { sendAnnouncementEmail } from "@/lib/mailgun";

async function requireStaff(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const u = await db.user.findUnique({ where: { id: session.user.id as string }, select: { id: true, role: true } });
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "PROPERTY_ADMIN"].includes(u?.role ?? "")) throw new Error("Forbidden");
  return u!.id;
}

export type Audience = "ALL" | "OWNERS" | "RESIDENTS" | "CUSTOM";

export type AnnouncementInput = {
  title: string;
  content: string;          // HTML
  publishedAt?: string | null;
  audience: Audience;
  recipientUserIds?: string[]; // for CUSTOM
  addToCalendar?: boolean;
};

export type RecipientRow = {
  id: string; userId: string; name: string | null; email: string;
  role: "OWNER" | "RESIDENT" | "OTHER"; sentAt: string | null;
  acknowledgedAt: string | null; ipAddress: string | null; userAgent: string | null;
};
export type AnnouncementRow = {
  id: string; title: string; content: string; audience: Audience;
  publishedAt: string | null; createdAt: string; status: string;
  recurringTaskId: string | null;
  createdByName: string | null;
  recipients: RecipientRow[];
  total: number; acknowledged: number;
};

/** Current owners/residents of a building, with their role. */
async function buildingPeople(buildingId: string): Promise<{ id: string; name: string | null; email: string; role: "OWNER" | "RESIDENT" }[]> {
  const units = await db.unit.findMany({
    where: { buildingId },
    select: {
      owner: { select: { id: true, name: true, email: true } },
      resident: { select: { id: true, name: true, email: true } },
    },
  });
  const map = new Map<string, { id: string; name: string | null; email: string; role: "OWNER" | "RESIDENT" }>();
  for (const u of units) {
    if (u.owner) map.set(`${u.owner.id}:OWNER`, { ...u.owner, role: "OWNER" });
    if (u.resident) map.set(`${u.resident.id}:RESIDENT`, { ...u.resident, role: "RESIDENT" });
  }
  return [...map.values()];
}

/** People available to target for an announcement (deduped, both roles flagged). */
export async function listAnnouncementTargets(buildingId: string): Promise<{ id: string; name: string | null; email: string; roles: ("OWNER" | "RESIDENT")[] }[]> {
  await requireStaff();
  const people = await buildingPeople(buildingId);
  const map = new Map<string, { id: string; name: string | null; email: string; roles: ("OWNER" | "RESIDENT")[] }>();
  for (const p of people) {
    const ex = map.get(p.id);
    if (ex) { if (!ex.roles.includes(p.role)) ex.roles.push(p.role); }
    else map.set(p.id, { id: p.id, name: p.name, email: p.email, roles: [p.role] });
  }
  return [...map.values()].sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, "el"));
}

function resolveRecipients(
  people: { id: string; name: string | null; email: string; role: "OWNER" | "RESIDENT" }[],
  audience: Audience,
  customIds?: string[]
): { id: string; name: string | null; email: string }[] {
  let pool = people;
  if (audience === "OWNERS") pool = people.filter((p) => p.role === "OWNER");
  else if (audience === "RESIDENTS") pool = people.filter((p) => p.role === "RESIDENT");
  else if (audience === "CUSTOM") {
    const set = new Set(customIds ?? []);
    pool = people.filter((p) => set.has(p.id));
  }
  // Dedup by user id.
  const map = new Map<string, { id: string; name: string | null; email: string }>();
  for (const p of pool) if (!map.has(p.id)) map.set(p.id, { id: p.id, name: p.name, email: p.email });
  return [...map.values()];
}

export async function listAnnouncements(buildingId: string): Promise<AnnouncementRow[]> {
  await requireStaff();
  const rows = await db.announcement.findMany({
    where: { buildingId },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true, title: true, content: true, audience: true, status: true,
      publishedAt: true, createdAt: true, recurringTaskId: true,
      createdBy: { select: { name: true, email: true } },
      recipients: {
        orderBy: { user: { name: "asc" } },
        select: {
          id: true, userId: true, sentAt: true, acknowledgedAt: true, ipAddress: true, userAgent: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });
  // role lookup for recipient labelling
  const people = await buildingPeople(buildingId);
  const roleOf = new Map<string, "OWNER" | "RESIDENT">();
  for (const p of people) if (!roleOf.has(p.id)) roleOf.set(p.id, p.role);

  return rows.map((a) => ({
    id: a.id, title: a.title, content: a.content, audience: a.audience as Audience,
    status: a.status, recurringTaskId: a.recurringTaskId,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
    createdByName: a.createdBy?.name ?? a.createdBy?.email ?? null,
    recipients: a.recipients.map((r) => ({
      id: r.id, userId: r.userId, name: r.user.name, email: r.user.email,
      role: roleOf.get(r.userId) ?? "OTHER",
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
      acknowledgedAt: r.acknowledgedAt ? r.acknowledgedAt.toISOString() : null,
      ipAddress: r.ipAddress, userAgent: r.userAgent,
    })),
    total: a.recipients.length,
    acknowledged: a.recipients.filter((r) => r.acknowledgedAt).length,
  }));
}

export async function createAnnouncement(buildingId: string, data: AnnouncementInput) {
  const userId = await requireStaff();
  if (!data.title.trim()) return { error: "Το θέμα είναι υποχρεωτικό" };
  if (!data.content || data.content.replace(/<[^>]*>/g, "").trim() === "") return { error: "Το κείμενο είναι υποχρεωτικό" };

  const building = await db.building.findUnique({ where: { id: buildingId }, select: { name: true } });
  if (!building) return { error: "Το κτήριο δεν βρέθηκε" };

  const people = await buildingPeople(buildingId);
  const recipients = resolveRecipients(people, data.audience, data.recipientUserIds);
  if (recipients.length === 0) return { error: "Δεν βρέθηκαν παραλήπτες για την επιλεγμένη ομάδα" };

  const publishedAt = data.publishedAt ? new Date(data.publishedAt) : new Date();

  // Optional calendar entry.
  let recurringTaskId: string | null = null;
  if (data.addToCalendar) {
    const task = await db.recurringTask.create({
      data: {
        buildingId, title: `Ανακοίνωση: ${data.title.trim()}`, frequency: "CUSTOM" as any,
        nextDueDate: publishedAt, notes: "Αυτόματη εγγραφή από ανακοίνωση", active: true,
      },
      select: { id: true },
    });
    recurringTaskId = task.id;
  }

  const announcement = await db.announcement.create({
    data: {
      buildingId, title: data.title.trim(), content: data.content,
      audience: data.audience, publishedAt, recurringTaskId, createdById: userId,
      recipients: {
        create: recipients.map((r) => ({ userId: r.id, sentAt: new Date() })),
      },
    },
    select: { id: true, recipients: { select: { token: true, userId: true } } },
  });

  // Send acknowledgment emails (best-effort; failures don't block creation).
  const tokenByUser = new Map(announcement.recipients.map((r) => [r.userId, r.token]));
  await Promise.allSettled(
    recipients.map((r) => {
      const token = tokenByUser.get(r.id);
      if (!token) return Promise.resolve();
      const ackUrl = `${env.NEXT_PUBLIC_APP_URL}/announcements/${token}`;
      return sendAnnouncementEmail(r.email, r.name, building.name, data.title.trim(), data.content, ackUrl);
    })
  );

  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { ok: true, id: announcement.id, sent: recipients.length };
}

export async function deleteAnnouncement(id: string) {
  await requireStaff();
  const a = await db.announcement.findUnique({ where: { id }, select: { buildingId: true, recurringTaskId: true } });
  if (!a) return { error: "Η ανακοίνωση δεν βρέθηκε" };
  await db.announcement.delete({ where: { id } });
  if (a.recurringTaskId) {
    await db.recurringTask.delete({ where: { id: a.recurringTaskId } }).catch(() => {});
  }
  revalidatePath(`/super-admin/buildings/${a.buildingId}`);
  return { ok: true };
}
