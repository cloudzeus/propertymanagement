import { db } from "@/lib/db";
import { lastNMonths, monthlyTrend, type TrendPoint } from "@/lib/dashboard/aggregations";

/** YYYY-MM for a date, UTC. */
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** First day (UTC) of the month `d` belongs to. */
function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// ---------------------------------------------------------------------------
// Revenue (our SaaS income): PAID ServiceInvoice + active Subscription MRR
// ---------------------------------------------------------------------------

export interface PlatformRevenue {
  monthTotal: number; // PAID invoices this calendar month
  prevMonthTotal: number; // PAID invoices previous calendar month
  deltaPct: number | null; // month-over-month %, null when prev is 0
  mrr: number; // recurring monthly value of ACTIVE subscriptions
  trend: TrendPoint[]; // last 6 months of PAID revenue, oldest first
}

/**
 * Our own revenue. When `companyId` is passed we scope to that company's
 * customers (admin dashboard); otherwise platform-wide (super-admin).
 */
export async function getPlatformRevenue(companyId?: string): Promise<PlatformRevenue> {
  const now = new Date();
  const thisMonth = monthKey(now);
  const months = lastNMonths(thisMonth, 6);
  const windowStart = new Date(`${months[0]}-01T00:00:00.000Z`);

  const customerScope = companyId ? { customer: { companyId } } : {};

  const [paidRows, subs] = await Promise.all([
    db.serviceInvoice.findMany({
      where: { status: "PAID", paidAt: { not: null, gte: windowStart }, ...customerScope },
      select: { amount: true, paidAt: true },
    }),
    db.subscription.findMany({
      where: { status: "ACTIVE", ...(companyId ? { companyId } : {}) },
      select: { amount: true, billingCycle: true },
    }),
  ]);

  const trendRows = paidRows.map((r) => ({
    month: monthKey(r.paidAt as Date),
    amount: Number(r.amount),
  }));
  const trend = monthlyTrend(trendRows, months);

  const prevMonth = months[months.length - 2];
  const monthTotal = trend[trend.length - 1]?.value ?? 0;
  const prevMonthTotal = trend.find((t) => t.month === prevMonth)?.value ?? 0;
  const deltaPct =
    prevMonthTotal === 0 ? null : Math.round(((monthTotal - prevMonthTotal) / prevMonthTotal) * 100);

  const mrr = subs.reduce(
    (acc, s) => acc + (s.billingCycle === "ANNUAL" ? s.amount / 12 : s.amount),
    0,
  );

  return { monthTotal, prevMonthTotal, deltaPct, mrr, trend };
}

// ---------------------------------------------------------------------------
// Outstanding: unpaid ServiceInvoices (money owed to us)
// ---------------------------------------------------------------------------

export interface Outstanding {
  amount: number;
  count: number;
  overdueCount: number;
}

export async function getOutstandingInvoices(companyId?: string): Promise<Outstanding> {
  const rows = await db.serviceInvoice.findMany({
    where: {
      status: { in: ["PENDING", "OVERDUE"] },
      ...(companyId ? { customer: { companyId } } : {}),
    },
    select: { amount: true, status: true },
  });
  return {
    amount: rows.reduce((a, r) => a + Number(r.amount), 0),
    count: rows.length,
    overdueCount: rows.filter((r) => r.status === "OVERDUE").length,
  };
}

// ---------------------------------------------------------------------------
// Expiring subscriptions & add-ons (renewal / expiry within N days)
// ---------------------------------------------------------------------------

export interface ExpiringItem {
  id: string;
  kind: "subscription" | "addon";
  companyName: string;
  label: string; // tier or feature name
  amount: number; // monthly-equivalent EUR
  expiresAt: Date;
  daysLeft: number;
}

export async function getExpiringSubscriptions(
  days = 30,
  companyId?: string,
): Promise<ExpiringItem[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const [subs, addons] = await Promise.all([
    db.subscription.findMany({
      where: {
        status: "ACTIVE",
        renewalDate: { gte: startOfMonth(now), lte: horizon },
        ...(companyId ? { companyId } : {}),
      },
      select: { id: true, tier: true, amount: true, billingCycle: true, renewalDate: true, company: { select: { name: true } } },
      orderBy: { renewalDate: "asc" },
    }),
    db.addonFeature.findMany({
      where: {
        active: true,
        expiresAt: { not: null, gte: startOfMonth(now), lte: horizon },
        ...(companyId ? { companyId } : {}),
      },
      select: { id: true, featureName: true, monthlyPrice: true, expiresAt: true, company: { select: { name: true } } },
      orderBy: { expiresAt: "asc" },
    }),
  ]);

  const dayMs = 24 * 60 * 60 * 1000;
  const items: ExpiringItem[] = [
    ...subs.map((s) => ({
      id: s.id,
      kind: "subscription" as const,
      companyName: s.company.name,
      label: String(s.tier),
      amount: s.billingCycle === "ANNUAL" ? s.amount / 12 : s.amount,
      expiresAt: s.renewalDate,
      daysLeft: Math.ceil((s.renewalDate.getTime() - now.getTime()) / dayMs),
    })),
    ...addons.map((a) => ({
      id: a.id,
      kind: "addon" as const,
      companyName: a.company.name,
      label: a.featureName,
      amount: a.monthlyPrice,
      expiresAt: a.expiresAt as Date,
      daysLeft: Math.ceil(((a.expiresAt as Date).getTime() - now.getTime()) / dayMs),
    })),
  ];

  return items.sort((x, y) => x.expiresAt.getTime() - y.expiresAt.getTime());
}

// ---------------------------------------------------------------------------
// Maintenance requests on MANAGED buildings, split by reporter role
// ---------------------------------------------------------------------------

const MANAGER_ROLES = new Set(["PROPERTY_ADMIN", "MANAGER", "EMPLOYEE", "ADMIN", "SUPER_ADMIN"]);
const ACTIVE_FAULT_STATUSES = ["OPEN", "ACKNOWLEDGED", "SCHEDULED", "IN_PROGRESS", "ON_HOLD"];

export interface ManagedFaultsSummary {
  open: number; // active (not completed/cancelled)
  urgent: number; // active + priority URGENT/HIGH
  slaBreached: number; // active + slaDueAt in the past
  byManager: number; // active, reported by a manager/staff
  byOccupant: number; // active, reported by an owner/resident (or unknown)
  companyCovered: number; // active + handledBy = COMPANY (managed contract)
  recent: ManagedFaultRow[];
}

export interface ManagedFaultRow {
  id: string;
  title: string;
  buildingName: string;
  buildingId: string;
  status: string;
  priority: string;
  reporterName: string | null;
  reporterSide: "manager" | "occupant";
  slaBreached: boolean;
  createdAt: Date;
}

export async function getManagedFaultsSummary(companyId?: string): Promise<ManagedFaultsSummary> {
  const now = new Date();
  const rows = await db.maintenanceRequest.findMany({
    where: {
      status: { in: ACTIVE_FAULT_STATUSES },
      building: {
        property: { managed: true },
        ...(companyId ? { companyId } : {}),
      },
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      handledBy: true,
      slaDueAt: true,
      createdAt: true,
      building: { select: { id: true, name: true } },
      reportedBy: { select: { name: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  let urgent = 0;
  let slaBreached = 0;
  let byManager = 0;
  let byOccupant = 0;
  let companyCovered = 0;
  const recent: ManagedFaultRow[] = [];

  for (const r of rows) {
    const isManager = MANAGER_ROLES.has(String(r.reportedBy?.role));
    if (isManager) byManager++;
    else byOccupant++;
    if (r.priority === "URGENT" || r.priority === "HIGH") urgent++;
    const breached = !!r.slaDueAt && r.slaDueAt < now;
    if (breached) slaBreached++;
    if (r.handledBy === "COMPANY") companyCovered++;
    if (recent.length < 8) {
      recent.push({
        id: r.id,
        title: r.title,
        buildingName: r.building.name,
        buildingId: r.building.id,
        status: r.status,
        priority: r.priority,
        reporterName: r.reportedBy?.name ?? null,
        reporterSide: isManager ? "manager" : "occupant",
        slaBreached: breached,
        createdAt: r.createdAt,
      });
    }
  }

  return {
    open: rows.length,
    urgent,
    slaBreached,
    byManager,
    byOccupant,
    companyCovered,
    recent,
  };
}

/** Count of managed buildings (Property.managed = true), optionally company-scoped. */
export async function getManagedBuildingsCount(companyId?: string): Promise<number> {
  return db.building.count({
    where: { property: { managed: true }, ...(companyId ? { companyId } : {}) },
  });
}
