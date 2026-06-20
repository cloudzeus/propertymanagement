"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { revalidatePath } from "next/cache";
import { ensureRoom, createMeetingToken } from "@/lib/daily";
import { generateMinutesHtml } from "@/lib/assemblies/minutes";
import { sendAnnouncementEmail } from "@/lib/mailgun";

async function requireStaff(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const u = await db.user.findUnique({ where: { id: session.user.id as string }, select: { id: true, role: true } });
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "PROPERTY_ADMIN"].includes(u?.role ?? "")) throw new Error("Forbidden");
  return u!.id;
}

async function requireSuperAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const u = await db.user.findUnique({ where: { id: session.user.id as string }, select: { id: true, role: true } });
  if (u?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
  return u!.id;
}

/** Owners of a building (users with an OWNER occupancy on any of its units). */
async function buildingOwners(buildingId: string) {
  const occ = await db.unitOccupancy.findMany({
    where: { unit: { buildingId }, role: "OWNER", endDate: null },
    select: { userId: true, unitId: true, user: { select: { id: true, name: true, email: true } } },
  });
  // de-dupe by user (UnitOccupancy.user is required/non-null)
  const seen = new Map<string, { userId: string; unitId: string; name: string | null; email: string }>();
  for (const o of occ) {
    if (o.user.email && !seen.has(o.user.id)) {
      seen.set(o.user.id, { userId: o.user.id, unitId: o.unitId, name: o.user.name, email: o.user.email });
    }
  }
  return [...seen.values()];
}

export async function createAssembly(input: { buildingId: string; title: string; scheduledAt: string }) {
  const userId = await requireStaff();
  const building = await db.building.findUnique({ where: { id: input.buildingId }, select: { id: true, name: true, dailyRoomName: true, companyId: true, property: { select: { customerId: true } } } });
  if (!building) throw new Error("Building not found");

  const roomName = building.dailyRoomName ?? (await ensureRoom(building.id));
  if (!building.dailyRoomName) {
    await db.building.update({ where: { id: building.id }, data: { dailyRoomName: roomName } });
  }

  const assembly = await db.assembly.create({
    data: {
      buildingId: building.id,
      title: input.title,
      scheduledAt: new Date(input.scheduledAt),
      status: "SCHEDULED",
      dailyRoomName: roomName,
      createdById: userId,
    },
  });

  // Invite owners (email with link to OUR page) + participant rows.
  const owners = await buildingOwners(building.id);
  const link = `${env.NEXT_PUBLIC_APP_URL}/super-admin/buildings/${building.id}/assemblies/${assembly.id}`;
  for (const o of owners) {
    await db.assemblyParticipant.create({
      data: { assemblyId: assembly.id, userId: o.userId, unitId: o.unitId, displayName: o.name ?? o.email, invitedSentAt: new Date() },
    });
    await sendAnnouncementEmail(
      o.email,
      o.name,
      building.name,
      `Πρόσκληση σε Γενική Συνέλευση: ${input.title}`,
      `<p>Καλείστε σε Γενική Συνέλευση στις <strong>${new Date(input.scheduledAt).toLocaleString("el-GR")}</strong>.</p>
       <p>Πατήστε το κουμπί για να συμμετάσχετε.</p>`,
      link,
      { buildingId: building.id, customerId: building.property?.customerId, assemblyId: assembly.id, companyId: building.companyId ?? undefined },
    );
  }

  revalidatePath(`/super-admin/buildings/${building.id}`);
  return { id: assembly.id };
}

export async function createTestAssembly(input: {
  buildingId: string;
  title: string;
  scheduledAt: string;
  hostEmail: string;
  guestEmail: string;
}) {
  const userId = await requireSuperAdmin();
  const building = await db.building.findUnique({
    where: { id: input.buildingId },
    select: { id: true, name: true, dailyRoomName: true, companyId: true, property: { select: { customerId: true } } },
  });
  if (!building) throw new Error("Building not found");

  const roomName = building.dailyRoomName ?? (await ensureRoom(building.id));
  if (!building.dailyRoomName) {
    await db.building.update({ where: { id: building.id }, data: { dailyRoomName: roomName } });
  }

  const assembly = await db.assembly.create({
    data: {
      buildingId: building.id,
      title: `[TEST] ${input.title}`,
      scheduledAt: new Date(input.scheduledAt),
      status: "SCHEDULED",
      dailyRoomName: roomName,
      createdById: userId,
    },
  });

  const ctx = { buildingId: building.id, customerId: building.property?.customerId ?? undefined, assemblyId: assembly.id, companyId: building.companyId ?? undefined };
  const whenLabel = new Date(input.scheduledAt).toLocaleString("el-GR");

  // Host (manager) — joins via OUR in-app page (logs in as super admin).
  await db.assemblyParticipant.create({
    data: { assemblyId: assembly.id, email: input.hostEmail, isHost: true, displayName: input.hostEmail, invitedSentAt: new Date() },
  });
  const hostLink = `${env.NEXT_PUBLIC_APP_URL}/super-admin/buildings/${building.id}/assemblies/${assembly.id}`;
  await sendAnnouncementEmail(
    input.hostEmail, null, building.name,
    `[TEST] Διαχείριση Γενικής Συνέλευσης: ${input.title}`,
    `<p>Δοκιμαστική συνέλευση στις <strong>${whenLabel}</strong>.</p><p>Είστε ο <strong>διαχειριστής</strong>. Συνδεθείτε και ανοίξτε τη σελίδα για να ξεκινήσετε.</p>`,
    hostLink, ctx,
  );

  // Guest — joins via raw Daily prebuilt UI with a non-owner meeting token.
  const exp = Math.floor(Date.now() / 1000) + 4 * 60 * 60;
  const guestToken = await createMeetingToken({ room: roomName, userName: input.guestEmail, userId: `guest-${assembly.id}`, isOwner: false, expEpochSeconds: exp });
  const guestLink = `https://${env.NEXT_PUBLIC_DAILY_DOMAIN}.daily.co/${roomName}?t=${guestToken}`;
  await db.assemblyParticipant.create({
    data: { assemblyId: assembly.id, email: input.guestEmail, isHost: false, displayName: input.guestEmail, invitedSentAt: new Date() },
  });
  await sendAnnouncementEmail(
    input.guestEmail, null, building.name,
    `[TEST] Πρόσκληση σε Γενική Συνέλευση: ${input.title}`,
    `<p>Καλείστε σε δοκιμαστική Γενική Συνέλευση στις <strong>${whenLabel}</strong>.</p><p>Πατήστε για να συμμετάσχετε.</p>`,
    guestLink, ctx,
  );

  revalidatePath(`/super-admin/buildings/${building.id}`);
  return { id: assembly.id };
}

/** Issue a short-lived Daily token for the current user (owner or staff of this building). */
export async function getAssemblyToken(assemblyId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const userId = session.user.id as string;

  const assembly = await db.assembly.findUnique({
    where: { id: assemblyId },
    select: { id: true, dailyRoomName: true, scheduledAt: true, building: { select: { id: true } } },
  });
  if (!assembly) throw new Error("Assembly not found");

  const me = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true } });
  const isStaff = ["SUPER_ADMIN", "ADMIN", "MANAGER", "PROPERTY_ADMIN"].includes(me?.role ?? "");
  const participant = await db.assemblyParticipant.findFirst({ where: { assemblyId, userId } });
  if (!isStaff && !participant) throw new Error("Forbidden");

  // Ensure a participant row exists for join/leave aggregation (no unique constraint on assemblyId+userId).
  const existing = participant ?? (await db.assemblyParticipant.findFirst({ where: { assemblyId, userId } }));
  if (!existing) {
    await db.assemblyParticipant.create({
      data: { assemblyId, userId, displayName: me?.name ?? "Συμμετέχων" },
    });
  }

  const exp = Math.floor(Date.now() / 1000) + 4 * 60 * 60; // 4h window
  const token = await createMeetingToken({
    room: assembly.dailyRoomName,
    userName: me?.name ?? "Συμμετέχων",
    userId,
    isOwner: isStaff,
    expEpochSeconds: exp,
  });
  return { token, roomName: assembly.dailyRoomName };
}

/** End the assembly: persist transcript as source of truth, then auto-draft minutes. */
export async function endAssembly(assemblyId: string, transcript: string) {
  await requireStaff();
  const a = await db.assembly.findUnique({ where: { id: assemblyId }, select: { id: true, buildingId: true } });
  if (!a) throw new Error("Assembly not found");
  await db.assembly.update({
    where: { id: assemblyId },
    data: { transcriptRaw: transcript?.trim() ? transcript : null, status: transcript?.trim() ? "TRANSCRIBING" : "ENDED" },
  });
  if (transcript?.trim()) {
    try { await runMinutes(assemblyId); } catch (e) { console.error("endAssembly runMinutes failed", e); }
  }
  revalidatePath(`/super-admin/buildings/${a.buildingId}/assemblies/${assemblyId}`);
  return { ok: true };
}

/** Core minutes generation WITHOUT auth — callable by the webhook. */
export async function runMinutes(assemblyId: string) {
  const a = await db.assembly.findUnique({
    where: { id: assemblyId },
    select: { id: true, transcriptRaw: true, buildingId: true, building: { select: { name: true, companyId: true, property: { select: { customerId: true } } } } },
  });
  if (!a?.transcriptRaw) throw new Error("No transcript yet");

  const result = await generateMinutesHtml({
    transcript: a.transcriptRaw,
    buildingName: a.building.name,
    ctx: { companyId: a.building.companyId ?? undefined, customerId: a.building.property?.customerId ?? undefined, buildingId: a.buildingId, assemblyId },
  });
  if (!result.success) throw new Error(result.error ?? "DeepSeek failed");

  await db.assembly.update({ where: { id: assemblyId }, data: { minutesDraft: result.html, status: "DRAFT_READY" } });
  revalidatePath(`/super-admin/buildings/${a.buildingId}/assemblies/${assemblyId}`);
  return { html: result.html };
}

/** Staff-facing wrapper: auth-gate then run. */
export async function generateMinutes(assemblyId: string) {
  await requireStaff();
  return runMinutes(assemblyId);
}

export async function approveAndSendMinutes(assemblyId: string, finalHtml: string) {
  await requireStaff();
  const a = await db.assembly.findUnique({
    where: { id: assemblyId },
    select: { id: true, title: true, buildingId: true, building: { select: { name: true, companyId: true, property: { select: { customerId: true } } } }, participants: { select: { id: true, userId: true } } },
  });
  if (!a) throw new Error("Assembly not found");

  await db.assembly.update({ where: { id: assemblyId }, data: { minutesFinal: finalHtml, status: "SENT", approvedAt: new Date(), sentAt: new Date() } });

  const link = `${env.NEXT_PUBLIC_APP_URL}/super-admin/buildings/${a.buildingId}/assemblies/${assemblyId}`;
  const owners = await buildingOwners(a.buildingId);
  for (const o of owners) {
    await sendAnnouncementEmail(
      o.email,
      o.name,
      a.building.name,
      `Πρακτικά Γενικής Συνέλευσης — ${a.title}`,
      finalHtml,
      link,
      { buildingId: a.buildingId, customerId: a.building.property?.customerId, assemblyId: a.id, companyId: a.building.companyId ?? undefined },
    );
  }
  const participantEmails = await db.assemblyParticipant.findMany({
    where: { assemblyId, email: { not: null } },
    select: { email: true, displayName: true },
  });
  const ownerEmails = new Set(owners.map((o) => o.email));
  for (const pe of participantEmails) {
    if (pe.email && !ownerEmails.has(pe.email)) {
      await sendAnnouncementEmail(pe.email, pe.displayName, a.building.name, `Πρακτικά Γενικής Συνέλευσης — ${a.title}`, finalHtml, link);
    }
  }
  await db.assemblyParticipant.updateMany({ where: { assemblyId }, data: { momSentAt: new Date() } });

  revalidatePath(`/super-admin/buildings/${a.buildingId}/assemblies/${assemblyId}`);
  return { sent: owners.length };
}

export type AssemblyRow = {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  participantCount: number;
  cost: number;
};

export async function listAssemblies(buildingId: string): Promise<AssemblyRow[]> {
  await requireStaff();
  const rows = await db.assembly.findMany({
    where: { buildingId },
    orderBy: { scheduledAt: "desc" },
    select: { id: true, title: true, scheduledAt: true, status: true, _count: { select: { participants: true } } },
  });
  const costs = await db.aPIUsageLog.groupBy({
    by: ["assemblyId"],
    where: { assemblyId: { in: rows.map((r) => r.id) } },
    _sum: { totalCost: true },
  });
  const costMap = new Map(costs.map((c) => [c.assemblyId, c._sum.totalCost ?? 0]));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    scheduledAt: r.scheduledAt.toISOString(),
    status: r.status,
    participantCount: r._count.participants,
    cost: costMap.get(r.id) ?? 0,
  }));
}

/** Cost breakdown for one assembly (groups APIUsageLog by apiName). */
export async function getAssemblyCost(assemblyId: string) {
  await requireStaff();
  const rows = await db.aPIUsageLog.groupBy({
    by: ["apiName"],
    where: { assemblyId },
    _sum: { totalCost: true, tokensUsed: true, requestCount: true },
  });
  const total = rows.reduce((s, r) => s + (r._sum.totalCost ?? 0), 0);
  return { total, byApi: rows.map((r) => ({ apiName: r.apiName, cost: r._sum.totalCost ?? 0, tokens: r._sum.tokensUsed ?? 0, units: r._sum.requestCount ?? 0 })) };
}
