"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { buildKoinochristaDoc, type KoinoLine } from "@/lib/koinochrista-doc";
import { sendEmailWithAttachments, type EmailAttachment } from "@/lib/mailgun";
import type { PaymentMethod } from "@/app/actions/building-expenses";
import { requireBuildingCap, requireBuildingView } from "@/lib/building-access";
import type { BuildingCaps } from "@/lib/building-caps";

async function requireAccess(buildingId: string, cap: keyof BuildingCaps = "manageKoinochrista"): Promise<string> {
  const { userId } = await requireBuildingCap(buildingId, cap);
  return userId;
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
  await requireBuildingView(exp.buildingId);
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
  await requireAccess(a.expense.buildingId, "managePayments");
  const data = party === "owner"
    ? { ownerPaid: paid, ownerPaidAt: paid ? new Date() : null, ownerPaymentMethod: paid ? method : null }
    : { tenantPaid: paid, tenantPaidAt: paid ? new Date() : null, tenantPaymentMethod: paid ? method : null };
  await db.expenseAllocation.update({ where: { id: allocationId }, data });
  revalidatePath(`/super-admin/buildings/${a.expense.buildingId}`);
  revalidatePath(`/building/${a.expense.buildingId}`);
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
        p.lines.push({ ...base, role: "OWNER", amount: num(a.ownerAmount), paid: a.ownerPaid, note: a.breakdownNote });
        if (e.receiptFile?.url) p.receiptUrls.add(e.receiptFile.url);
      }
      if (a.tenantUserId && num(a.tenantAmount) > 0) {
        const p = ensure(a.tenantUserId); p.units.add(a.unit.unitNumber);
        p.total += num(a.tenantAmount); if (a.tenantPaid) p.paid += num(a.tenantAmount);
        p.lines.push({ ...base, role: "TENANT", amount: num(a.tenantAmount), paid: a.tenantPaid, note: a.breakdownNote });
        if (e.receiptFile?.url) p.receiptUrls.add(e.receiptFile.url);
      }
    }
  }
  return { expenses, agg };
}

export type KoinoPersonDTO = { userId: string; name: string; email: string | null; units: string[]; total: number; paid: number; due: number; lineCount: number };

export async function getKoinochristaByPerson(buildingId: string, month: string): Promise<KoinoPersonDTO[]> {
  await requireBuildingView(buildingId);
  const { agg } = await aggregateByPerson(buildingId, month);
  return [...agg.values()]
    .map((p) => ({ userId: p.userId, name: p.name, email: p.email, units: [...p.units].sort(), total: p.total, paid: p.paid, due: p.total - p.paid, lineCount: p.lines.length }))
    .sort((a, b) => b.due - a.due);
}

/** List the YYYY-MM months that have expenses for this building (newest first). */
export async function listExpenseMonths(buildingId: string): Promise<string[]> {
  await requireBuildingView(buildingId);
  const rows = await db.buildingExpense.findMany({ where: { buildingId }, select: { month: true }, distinct: ["month"], orderBy: { month: "desc" } });
  return rows.map((r) => r.month);
}

export type IssuanceDTO = { month: string; total: number; paid: number; due: number; unallocated: number; expenseCount: number; personCount: number; issued: boolean };

/** One row per monthly issuance, with aggregate totals for the accordion table.
 *  `unallocated` = charge shares whose owner/tenant slot has no assigned person
 *  (e.g. a unit with no current resident) — money that lands on nobody. */
export async function listIssuances(buildingId: string): Promise<IssuanceDTO[]> {
  await requireBuildingView(buildingId);
  const expenses = await db.buildingExpense.findMany({
    where: { buildingId },
    select: {
      month: true, status: true,
      allocations: { select: { ownerUserId: true, ownerAmount: true, ownerPaid: true, tenantUserId: true, tenantAmount: true, tenantPaid: true } },
    },
  });
  const map = new Map<string, { total: number; paid: number; unallocated: number; expenses: number; people: Set<string>; issued: boolean }>();
  for (const e of expenses) {
    let m = map.get(e.month);
    if (!m) { m = { total: 0, paid: 0, unallocated: 0, expenses: 0, people: new Set(), issued: false }; map.set(e.month, m); }
    m.expenses += 1;
    if (e.status === "ISSUED") m.issued = true;
    for (const a of e.allocations) {
      const oa = num(a.ownerAmount), ta = num(a.tenantAmount);
      if (oa > 0) { if (a.ownerUserId) { m.total += oa; if (a.ownerPaid) m.paid += oa; m.people.add(a.ownerUserId); } else m.unallocated += oa; }
      if (ta > 0) { if (a.tenantUserId) { m.total += ta; if (a.tenantPaid) m.paid += ta; m.people.add(a.tenantUserId); } else m.unallocated += ta; }
    }
  }
  return [...map.entries()]
    .map(([month, v]) => ({ month, total: v.total, paid: v.paid, due: v.total - v.paid, unallocated: v.unallocated, expenseCount: v.expenses, personCount: v.people.size, issued: v.issued }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));
}

export type MonthExpenseDTO = { id: string; documentDate: string | null; supplier: string | null; category: string | null; amount: number; status: string; receiptUrl: string | null };

/** Lightweight list of a month's expenses for the issuance "Έξοδα" tab. */
export async function listMonthExpenses(buildingId: string, month: string): Promise<MonthExpenseDTO[]> {
  await requireBuildingView(buildingId);
  const rows = await db.buildingExpense.findMany({
    where: { buildingId, month },
    orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
    include: { categoryRef: { select: { name: true } }, receiptFile: { select: { url: true } } },
  });
  return rows.map((e) => ({
    id: e.id,
    documentDate: e.documentDate ? e.documentDate.toISOString() : null,
    supplier: e.supplierName, category: e.categoryRef?.name ?? e.category ?? null,
    amount: num(e.amount), status: e.status, receiptUrl: e.receiptFile?.url ?? null,
  }));
}

// ── Per-person statement (movements / balance) ───────────────────────────────

export type StatementLine = {
  allocationId: string; party: "owner" | "tenant"; month: string;
  expenseId: string; category: string | null; supplier: string | null; documentNumber: string | null; documentDate: string | null;
  unitNumber: string; amount: number; paid: boolean; paymentMethod: string | null;
};
export type PersonStatement = {
  userId: string; name: string; email: string | null; units: string[];
  total: number; paid: number; due: number; lines: StatementLine[];
};

/** Full ledger for one person. Pass `month` to scope to a single issuance, or
 *  omit it to get the person's entire history across all months. */
export async function getPersonStatement(buildingId: string, userId: string, month?: string): Promise<PersonStatement> {
  await requireBuildingView(buildingId);
  const [user, expenses] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    db.buildingExpense.findMany({
      where: { buildingId, ...(month ? { month } : {}) },
      orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
      include: { categoryRef: { select: { name: true } }, allocations: { include: { unit: { select: { unitNumber: true } } } } },
    }),
  ]);
  const lines: StatementLine[] = [];
  const units = new Set<string>();
  let total = 0, paid = 0;
  for (const e of expenses) {
    const base = { month: e.month, expenseId: e.id, category: e.categoryRef?.name ?? e.category ?? null, supplier: e.supplierName, documentNumber: e.documentNumber, documentDate: e.documentDate ? e.documentDate.toISOString() : null };
    for (const a of e.allocations) {
      if (a.ownerUserId === userId && num(a.ownerAmount) > 0) {
        const amt = num(a.ownerAmount); total += amt; if (a.ownerPaid) paid += amt; units.add(a.unit.unitNumber);
        lines.push({ ...base, allocationId: a.id, party: "owner", unitNumber: a.unit.unitNumber, amount: amt, paid: a.ownerPaid, paymentMethod: a.ownerPaymentMethod });
      }
      if (a.tenantUserId === userId && num(a.tenantAmount) > 0) {
        const amt = num(a.tenantAmount); total += amt; if (a.tenantPaid) paid += amt; units.add(a.unit.unitNumber);
        lines.push({ ...base, allocationId: a.id, party: "tenant", unitNumber: a.unit.unitNumber, amount: amt, paid: a.tenantPaid, paymentMethod: a.tenantPaymentMethod });
      }
    }
  }
  // Data isolation: only return details for a person actually tied to THIS
  // building (via an allocation above, or a unit occupancy). Otherwise 404.
  if (lines.length === 0) {
    const member = await db.unit.findFirst({
      where: { buildingId, OR: [{ ownerId: userId }, { residentId: userId }, { occupancies: { some: { userId } } }] },
      select: { id: true },
    });
    if (!member) throw new Error("Δεν βρέθηκε το άτομο σε αυτό το κτήριο.");
  }
  return { userId, name: user?.name ?? user?.email ?? "—", email: user?.email ?? null, units: [...units].sort(), total, paid, due: total - paid, lines };
}

/** Mark several allocation portions paid/unpaid in one go (used by the person modal). */
export async function setAllocationsPaid(buildingId: string, items: { allocationId: string; party: "owner" | "tenant" }[], paid: boolean, method: PaymentMethod | null) {
  await requireAccess(buildingId, "managePayments");
  if (!items.length) return { count: 0 };
  // Data isolation: every allocation must belong to THIS building.
  const allocIds = [...new Set(items.map((i) => i.allocationId))];
  const owned = await db.expenseAllocation.count({ where: { id: { in: allocIds }, expense: { buildingId } } });
  if (owned !== allocIds.length) throw new Error("Μία ή περισσότερες γραμμές δεν ανήκουν σε αυτό το κτήριο.");
  const when = paid ? new Date() : null;
  let count = 0;
  for (const it of items) {
    const data = it.party === "owner"
      ? { ownerPaid: paid, ownerPaidAt: when, ownerPaymentMethod: paid ? method : null }
      : { tenantPaid: paid, tenantPaidAt: when, tenantPaymentMethod: paid ? method : null };
    await db.expenseAllocation.update({ where: { id: it.allocationId }, data });
    count++;
  }
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  revalidatePath(`/building/${buildingId}`);
  return { count };
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
