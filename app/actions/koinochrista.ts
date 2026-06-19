"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { canManageBuildingExpenses } from "@/lib/expenses/authz";
import { buildKoinochristaDoc, type KoinoLine } from "@/lib/koinochrista-doc";
import { sendEmailWithAttachments, type EmailAttachment } from "@/lib/mailgun";
import type { PaymentMethod } from "@/app/actions/building-expenses";

async function requireAccess(buildingId: string): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const uid = session.user.id as string;
  if (!(await canManageBuildingExpenses(uid, buildingId))) throw new Error("Forbidden");
  return uid;
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

// ── Per-expense allocation breakdown (for the expandable row) ────────────────

export type AllocLineDTO = {
  id: string;
  unitNumber: string;
  ownerUserId: string | null; ownerName: string | null; ownerAmount: number; ownerPaid: boolean; ownerPaymentMethod: string | null;
  tenantUserId: string | null; tenantName: string | null; tenantAmount: number; tenantPaid: boolean; tenantPaymentMethod: string | null;
};

export async function listExpenseAllocations(expenseId: string): Promise<AllocLineDTO[]> {
  const exp = await db.buildingExpense.findUnique({ where: { id: expenseId }, select: { buildingId: true } });
  if (!exp) return [];
  await requireAccess(exp.buildingId);
  const allocs = await db.expenseAllocation.findMany({
    where: { expenseId },
    include: { unit: { select: { unitNumber: true } } },
    orderBy: { unit: { unitNumber: "asc" } },
  });
  const ids = [...new Set(allocs.flatMap((a) => [a.ownerUserId, a.tenantUserId]).filter((x): x is string => !!x))];
  const users = ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : [];
  const nameOf = (id: string | null) => { if (!id) return null; const u = users.find((x) => x.id === id); return u ? (u.name ?? u.email) : null; };
  return allocs.map((a) => ({
    id: a.id,
    unitNumber: a.unit.unitNumber,
    ownerUserId: a.ownerUserId, ownerName: nameOf(a.ownerUserId), ownerAmount: num(a.ownerAmount), ownerPaid: a.ownerPaid, ownerPaymentMethod: a.ownerPaymentMethod,
    tenantUserId: a.tenantUserId, tenantName: nameOf(a.tenantUserId), tenantAmount: num(a.tenantAmount), tenantPaid: a.tenantPaid, tenantPaymentMethod: a.tenantPaymentMethod,
  }));
}

export async function setAllocationPaid(allocationId: string, party: "owner" | "tenant", paid: boolean, method: PaymentMethod | null) {
  const a = await db.expenseAllocation.findUnique({ where: { id: allocationId }, select: { expense: { select: { buildingId: true } } } });
  if (!a) throw new Error("Δεν βρέθηκε η γραμμή κατανομής.");
  await requireAccess(a.expense.buildingId);
  const data = party === "owner"
    ? { ownerPaid: paid, ownerPaidAt: paid ? new Date() : null, ownerPaymentMethod: paid ? method : null }
    : { tenantPaid: paid, tenantPaidAt: paid ? new Date() : null, tenantPaymentMethod: paid ? method : null };
  await db.expenseAllocation.update({ where: { id: allocationId }, data });
  revalidatePath(`/super-admin/buildings/${a.expense.buildingId}`);
  return { ok: true };
}

// ── Monthly κοινόχρηστα per person ───────────────────────────────────────────

type PersonAgg = {
  userId: string; name: string; email: string | null;
  units: Set<string>; total: number; paid: number; lines: KoinoLine[]; receiptUrls: Set<string>;
};

async function aggregateByPerson(buildingId: string, month: string) {
  const expenses = await db.buildingExpense.findMany({
    where: { buildingId, month },
    include: {
      categoryRef: { select: { name: true } },
      receiptFile: { select: { url: true, name: true } },
      allocations: { include: { unit: { select: { unitNumber: true } } } },
    },
  });
  const userIds = new Set<string>();
  for (const e of expenses) for (const a of e.allocations) { if (a.ownerUserId) userIds.add(a.ownerUserId); if (a.tenantUserId) userIds.add(a.tenantUserId); }
  const users = userIds.size ? await db.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true, email: true } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const agg = new Map<string, PersonAgg>();
  const ensure = (uid: string): PersonAgg => {
    let p = agg.get(uid);
    if (!p) { const u = userMap.get(uid); p = { userId: uid, name: u?.name ?? u?.email ?? "—", email: u?.email ?? null, units: new Set(), total: 0, paid: 0, lines: [], receiptUrls: new Set() }; agg.set(uid, p); }
    return p;
  };

  for (const e of expenses) {
    const base = { category: e.categoryRef?.name ?? e.category ?? null, supplier: e.supplierName, documentNumber: e.documentNumber, documentDate: e.documentDate ? e.documentDate.toISOString() : null };
    for (const a of e.allocations) {
      if (a.ownerUserId && num(a.ownerAmount) > 0) {
        const p = ensure(a.ownerUserId); p.units.add(a.unit.unitNumber);
        p.total += num(a.ownerAmount); if (a.ownerPaid) p.paid += num(a.ownerAmount);
        p.lines.push({ ...base, role: "OWNER", amount: num(a.ownerAmount), paid: a.ownerPaid });
        if (e.receiptFile?.url) p.receiptUrls.add(e.receiptFile.url);
      }
      if (a.tenantUserId && num(a.tenantAmount) > 0) {
        const p = ensure(a.tenantUserId); p.units.add(a.unit.unitNumber);
        p.total += num(a.tenantAmount); if (a.tenantPaid) p.paid += num(a.tenantAmount);
        p.lines.push({ ...base, role: "TENANT", amount: num(a.tenantAmount), paid: a.tenantPaid });
        if (e.receiptFile?.url) p.receiptUrls.add(e.receiptFile.url);
      }
    }
  }
  return { expenses, agg };
}

export type KoinoPersonDTO = { userId: string; name: string; email: string | null; units: string[]; total: number; paid: number; due: number; lineCount: number };

export async function getKoinochristaByPerson(buildingId: string, month: string): Promise<KoinoPersonDTO[]> {
  await requireAccess(buildingId);
  const { agg } = await aggregateByPerson(buildingId, month);
  return [...agg.values()]
    .map((p) => ({ userId: p.userId, name: p.name, email: p.email, units: [...p.units].sort(), total: p.total, paid: p.paid, due: p.total - p.paid, lineCount: p.lines.length }))
    .sort((a, b) => b.due - a.due);
}

/** List the YYYY-MM months that have expenses for this building (newest first). */
export async function listExpenseMonths(buildingId: string): Promise<string[]> {
  await requireAccess(buildingId);
  const rows = await db.buildingExpense.findMany({ where: { buildingId }, select: { month: true }, distinct: ["month"], orderBy: { month: "desc" } });
  return rows.map((r) => r.month);
}

const MAX_ATTACH_BYTES = 10 * 1024 * 1024;
const MAX_RECEIPTS = 20;

export async function sendKoinochristaReminder(buildingId: string, month: string, userId: string): Promise<{ to: string }> {
  await requireAccess(buildingId);
  const building = await db.building.findUnique({ where: { id: buildingId }, select: { name: true, address: true } });
  if (!building) throw new Error("Δεν βρέθηκε κτήριο.");
  const { agg } = await aggregateByPerson(buildingId, month);
  const person = agg.get(userId);
  if (!person) throw new Error("Δεν υπάρχουν χρεώσεις για αυτό το άτομο τον συγκεκριμένο μήνα.");
  if (!person.email) throw new Error("Ο παραλήπτης δεν έχει καταχωρημένο email.");

  const docBuf = buildKoinochristaDoc({
    buildingName: building.name, buildingAddress: building.address, month,
    personName: person.name, unitLabels: [...person.units].sort(), lines: person.lines,
  });
  const attachments: EmailAttachment[] = [{ filename: `koinochrista-${month}.doc`, content: docBuf, contentType: "application/msword" }];

  // Attach the receipt files (best-effort; skip oversized/failed fetches).
  let i = 0;
  for (const url of [...person.receiptUrls].slice(0, MAX_RECEIPTS)) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_ATTACH_BYTES) continue;
      const ct = res.headers.get("content-type") ?? "application/octet-stream";
      const ext = ct.includes("pdf") ? "pdf" : ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
      attachments.push({ filename: `apodeixi-${++i}.${ext}`, content: Buffer.from(ab), contentType: ct });
    } catch { /* skip */ }
  }

  const due = person.total - person.paid;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a">
      <p>Αγαπητέ/ή ${person.name},</p>
      <p>Σας υπενθυμίζουμε τα κοινόχρηστα της περιόδου <b>${month}</b> για το κτήριο <b>${building.name}</b>.</p>
      <ul>
        <li>Σύνολο χρεώσεων: <b>${person.total.toFixed(2)} €</b></li>
        <li>Πληρωμένα: <b>${person.paid.toFixed(2)} €</b></li>
        <li>Υπόλοιπο προς πληρωμή: <b style="color:#b91c1c">${due.toFixed(2)} €</b></li>
      </ul>
      <p>Επισυνάπτεται η αναλυτική κατάσταση (Word) και τα σχετικά παραστατικά.</p>
      <p>Σας ευχαριστούμε.</p>
    </div>`;

  const sent = await sendEmailWithAttachments({
    to: person.email,
    subject: `Κοινόχρηστα ${month} — ${building.name}`,
    html, tags: ["koinochrista-reminder"], attachments,
  });
  if (!sent.success) throw new Error(sent.error ?? "Αποτυχία αποστολής email.");
  return { to: person.email };
}
