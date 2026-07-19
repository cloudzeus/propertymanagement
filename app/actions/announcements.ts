"use server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { revalidatePath } from "next/cache";
import { sendAnnouncementEmail } from "@/lib/mailgun";
import { getScope, assertCustomer, type Scope } from "@/lib/scope";
import { resolveRecipients, type Person } from "@/lib/announcements/recipients";
import { applyMergeFields } from "@/lib/announcements/merge";
import { resolveAnnouncementCustomer } from "@/lib/announcements/targets";
import { requireBuildingCap, requireBuildingView } from "@/lib/building-access";
import { publishBuildingEvent } from "@/lib/realtime/bus";

const ORIGINATOR_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "PROPERTY_ADMIN"];
async function requireOriginator(): Promise<Scope> {
  const scope = await getScope();
  if (!ORIGINATOR_ROLES.includes(scope.role)) throw new Error("Forbidden");
  return scope;
}

export type Audience = "ALL" | "OWNERS" | "RESIDENTS" | "CUSTOM";

export type TargetInput = { scopeType: "PROPERTY" | "BUILDING" | "UNIT" | "USER"; scopeId: string };

export type AnnouncementInput = {
  title: string;
  content: string;          // HTML
  publishedAt?: string | null;
  audience: Audience;
  recipientUserIds?: string[]; // for CUSTOM
  addToCalendar?: boolean;
};

export type MultiAnnouncementInput = {
  title: string;
  content: string;
  emailSubject?: string;
  emailPreview?: string;
  publishedAt?: string | null;
  audience: Audience;
  targets: TargetInput[];
  recipientUserIds?: string[];
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

async function resolveBuildingIds(scope: Scope, targets: TargetInput[]): Promise<{ buildingIds: string[]; customerIds: string[]; userIds: string[] }> {
  const buildingIds = new Set<string>();
  const customerIds = new Set<string>();
  const userIds = new Set<string>();
  for (const t of targets) {
    if (t.scopeType === "PROPERTY") {
      const bs = await db.building.findMany({ where: { propertyId: t.scopeId }, select: { id: true, customerId: true } });
      for (const b of bs) { buildingIds.add(b.id); customerIds.add(b.customerId); }
    } else if (t.scopeType === "BUILDING") {
      const b = await db.building.findUnique({ where: { id: t.scopeId }, select: { id: true, customerId: true } });
      if (b) { buildingIds.add(b.id); customerIds.add(b.customerId); }
    } else if (t.scopeType === "UNIT") {
      const u = await db.unit.findUnique({ where: { id: t.scopeId }, select: { buildingId: true, customerId: true } });
      if (u) { buildingIds.add(u.buildingId); customerIds.add(u.customerId); }
    } else if (t.scopeType === "USER") {
      const u = await db.user.findUnique({ where: { id: t.scopeId }, select: { id: true, customerId: true } });
      if (u?.customerId) { userIds.add(u.id); customerIds.add(u.customerId); }
    }
  }
  return { buildingIds: [...buildingIds], customerIds: [...customerIds], userIds: [...userIds] };
}

async function peopleForBuildings(buildingIds: string[]): Promise<Person[]> {
  if (buildingIds.length === 0) return [];
  const units = await db.unit.findMany({
    where: { buildingId: { in: buildingIds } },
    select: {
      buildingId: true, unitNumber: true,
      owner: { select: { id: true, name: true, email: true } },
      resident: { select: { id: true, name: true, email: true } },
    },
  });
  const out: Person[] = [];
  for (const u of units) {
    if (u.owner) out.push({ ...u.owner, role: "OWNER", buildingId: u.buildingId, unit: u.unitNumber });
    if (u.resident) out.push({ ...u.resident, role: "RESIDENT", buildingId: u.buildingId, unit: u.unitNumber });
  }
  return out;
}

/** People available to target for an announcement (deduped, both roles flagged). */
export async function listAnnouncementTargets(buildingId: string): Promise<{ id: string; name: string | null; email: string; roles: ("OWNER" | "RESIDENT")[] }[]> {
  // Building-wide person directory (names/emails) — staff/manager only.
  await requireBuildingCap(buildingId, "viewLedger");
  const people = await peopleForBuildings([buildingId]);
  const map = new Map<string, { id: string; name: string | null; email: string; roles: ("OWNER" | "RESIDENT")[] }>();
  for (const p of people) {
    const ex = map.get(p.id);
    if (ex) { if (!ex.roles.includes(p.role)) ex.roles.push(p.role); }
    else map.set(p.id, { id: p.id, name: p.name, email: p.email, roles: [p.role] });
  }
  return [...map.values()].sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, "el"));
}

export async function listAnnouncements(buildingId?: string): Promise<AnnouncementRow[]> {
  const scope = await requireOriginator();
  // Building-scoped listing must be building-authorized (not just same-customer).
  if (buildingId) await requireBuildingView(buildingId);
  const rows = await db.announcement.findMany({
    where: {
      ...(buildingId ? { buildingId } : {}),
      ...(scope.seesAllCustomers ? {} : { customerId: scope.customerId ?? "__no_customer__" }),
    },
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
  const roleOf = new Map<string, "OWNER" | "RESIDENT">();
  if (buildingId) {
    const people = await peopleForBuildings([buildingId]);
    for (const p of people) if (!roleOf.has(p.id)) roleOf.set(p.id, p.role);
  }

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

export async function createAnnouncement(data: MultiAnnouncementInput) {
  const scope = await requireOriginator();
  if (!data.title.trim()) return { error: "Το θέμα είναι υποχρεωτικό" };
  if (!data.content || data.content.replace(/<[^>]*>/g, "").trim() === "") return { error: "Το κείμενο είναι υποχρεωτικό" };
  if (!data.targets?.length) return { error: "Επιλέξτε τουλάχιστον έναν παραλήπτη" };

  const { buildingIds, customerIds, userIds } = await resolveBuildingIds(scope, data.targets);

  // Building-scoped authorization: the caller must hold the announcements
  // capability on EVERY targeted building (staff always do; a PROPERTY_ADMIN
  // only on buildings covered by a ManagementAssignment).
  for (const bId of buildingIds) {
    await requireBuildingCap(bId, "manageAnnouncements");
  }

  const resolved = resolveAnnouncementCustomer(
    { seesAllCustomers: scope.seesAllCustomers, customerId: scope.customerId },
    customerIds,
  );
  if (!resolved.ok) {
    return { error: resolved.reason === "cross-customer" ? "Δεν επιτρέπεται αποστολή σε άλλον πελάτη" : "Δεν βρέθηκαν έγκυροι παραλήπτες" };
  }

  const people = await peopleForBuildings(buildingIds);
  if (userIds.length) {
    const directUsers = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
    for (const u of directUsers) people.push({ ...u, role: "RESIDENT", buildingId: "", unit: null });
  }
  const recipients = resolveRecipients(people, data.audience, data.recipientUserIds);
  if (recipients.length === 0) return { error: "Δεν βρέθηκαν παραλήπτες για την επιλεγμένη ομάδα" };

  let senderName: string | null = null, senderReplyTo: string | null = null;
  if (resolved.customerId) {
    const c = await db.customer.findUnique({ where: { id: resolved.customerId }, select: { name: true, email: true } });
    senderName = c?.name ?? null; senderReplyTo = c?.email ?? null;
  }

  const firstBuilding = buildingIds.length === 1
    ? await db.building.findUnique({ where: { id: buildingIds[0] }, select: { name: true } })
    : null;

  const publishedAt = data.publishedAt ? new Date(data.publishedAt) : new Date();
  const subjectTemplate = (data.emailSubject?.trim() || data.title.trim());

  // Optional calendar entry (single-building only).
  let recurringTaskId: string | null = null;
  if (data.addToCalendar && buildingIds.length === 1) {
    const task = await db.recurringTask.create({
      data: { buildingId: buildingIds[0], title: `Ανακοίνωση: ${data.title.trim()}`, frequency: "CUSTOM" as any, nextDueDate: publishedAt, notes: "Αυτόματη εγγραφή από ανακοίνωση", active: true },
      select: { id: true },
    });
    recurringTaskId = task.id;
  }

  const announcement = await db.announcement.create({
    data: {
      buildingId: buildingIds.length === 1 ? buildingIds[0] : null,
      customerId: resolved.customerId,
      origin: scope.seesAllCustomers ? "STAFF" : "MANAGER",
      title: data.title.trim(),
      content: data.content,
      emailSubject: data.emailSubject?.trim() || null,
      emailPreview: data.emailPreview?.trim() || null,
      senderName, senderReplyTo, recurringTaskId,
      audience: data.audience, publishedAt, createdById: scope.userId,
      targets: { create: data.targets.map((t) => ({ scopeType: t.scopeType, scopeId: t.scopeId })) },
      recipients: { create: recipients.map((r) => ({ userId: r.id, sentAt: new Date() })) },
    },
    select: { id: true, recipients: { select: { token: true, userId: true } } },
  });

  const recipMeta = new Map(recipients.map((r) => [r.id, r]));
  const tokenByUser = new Map(announcement.recipients.map((r) => [r.userId, r.token]));
  const headingLabel = firstBuilding?.name ?? senderName ?? "Διαχείριση";
  await Promise.allSettled(
    recipients.map((r) => {
      const token = tokenByUser.get(r.id);
      if (!token) return Promise.resolve();
      const meta = recipMeta.get(r.id);
      const mergeCtx = { name: r.name, unit: meta?.unit ?? null, building: firstBuilding?.name ?? null, property: null };
      const ackUrl = `${env.NEXT_PUBLIC_APP_URL}/announcements/${token}`;
      return sendAnnouncementEmail(
        r.email, r.name, headingLabel,
        applyMergeFields(subjectTemplate, mergeCtx),
        applyMergeFields(data.content, mergeCtx),
        ackUrl,
        { senderName, replyTo: senderReplyTo, preview: data.emailPreview ?? null },
        { customerId: resolved.customerId ?? undefined, userId: scope.userId },
      );
    })
  );

  revalidatePath(`/announcements`);
  for (const bId of buildingIds) publishBuildingEvent(bId, "announcement");
  return { ok: true, id: announcement.id, sent: recipients.length };
}

export async function deleteAnnouncement(id: string) {
  const scope = await requireOriginator();
  const a = await db.announcement.findUnique({ where: { id }, select: { buildingId: true, customerId: true, recurringTaskId: true } });
  if (!a) return { error: "Η ανακοίνωση δεν βρέθηκε" };
  if (a.buildingId) await requireBuildingCap(a.buildingId, "manageAnnouncements");
  else assertCustomer(scope, a.customerId);
  await db.announcement.delete({ where: { id } });
  if (a.recurringTaskId) {
    await db.recurringTask.delete({ where: { id: a.recurringTaskId } }).catch(() => {});
  }
  if (a.buildingId) {
    revalidatePath(`/super-admin/buildings/${a.buildingId}`);
    revalidatePath(`/building/${a.buildingId}`);
    publishBuildingEvent(a.buildingId, "announcement");
  }
  revalidatePath(`/announcements`);
  return { ok: true };
}
