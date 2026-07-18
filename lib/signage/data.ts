import { db } from "@/lib/db";

/** Buildings a PROPERTY_VIEWER screen account may display (direct or via property assignments). */
export async function viewerBuildingIds(userId: string): Promise<string[]> {
  const assignments = await db.managementAssignment.findMany({
    where: { userId },
    select: { buildingId: true, propertyId: true },
  });
  const direct = assignments.map((a) => a.buildingId).filter((x): x is string => !!x);
  const propertyIds = assignments.map((a) => a.propertyId).filter((x): x is string => !!x);
  const viaProperty = propertyIds.length
    ? (await db.building.findMany({ where: { propertyId: { in: propertyIds } }, select: { id: true } })).map((b) => b.id)
    : [];
  return [...new Set([...direct, ...viaProperty])];
}

export async function getSignageData(buildingId: string) {
  const month = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
  const [building, announcements, tasks, assembly, allocs, contacts] = await Promise.all([
    db.building.findUnique({
      where: { id: buildingId },
      select: { id: true, name: true, address: true, city: true, lat: true, lng: true },
    }),
    db.announcement.findMany({
      where: { buildingId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true, content: true, imageUrl: true, createdAt: true },
    }),
    db.recurringTask.findMany({
      where: { buildingId, active: true, nextDueDate: { gte: new Date() } },
      orderBy: { nextDueDate: "asc" },
      take: 5,
      select: { id: true, title: true, nextDueDate: true, vendor: true },
    }),
    db.assembly.findFirst({
      where: { buildingId, status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      select: { id: true, title: true, scheduledAt: true },
    }),
    db.expenseAllocation.findMany({
      where: { unit: { buildingId }, expense: { month } },
      select: { tenantAmount: true, tenantPaid: true, ownerAmount: true, ownerPaid: true },
    }),
    db.contact.findMany({
      where: { buildingId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true, phone: true },
    }),
  ]);
  if (!building) return null;
  let total = 0,
    collected = 0;
  for (const a of allocs) {
    const t = Number(a.tenantAmount),
      o = Number(a.ownerAmount);
    total += t + o;
    collected += (a.tenantPaid ? t : 0) + (a.ownerPaid ? o : 0);
  }
  return {
    building,
    announcements: announcements.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    tasks: tasks.map((t) => ({ ...t, nextDueDate: t.nextDueDate ? t.nextDueDate.toISOString() : null })),
    assembly: assembly ? { ...assembly, scheduledAt: assembly.scheduledAt.toISOString() } : null,
    collection: { pct: total > 0 ? Math.round((collected / total) * 100) : null },
    contacts,
  };
}

export type SignageData = NonNullable<Awaited<ReturnType<typeof getSignageData>>>;

const WEATHER_LABELS: Record<number, string> = {
  0: "Αίθριος", 1: "Κυρίως αίθριος", 2: "Λίγα σύννεφα", 3: "Συννεφιά",
  45: "Ομίχλη", 48: "Ομίχλη", 51: "Ψιχάλα", 53: "Ψιχάλα", 55: "Ψιχάλα",
  61: "Βροχή", 63: "Βροχή", 65: "Έντονη βροχή", 71: "Χιόνι", 73: "Χιόνι", 75: "Χιόνι",
  80: "Μπόρες", 81: "Μπόρες", 82: "Ισχυρές μπόρες", 95: "Καταιγίδα", 96: "Καταιγίδα", 99: "Καταιγίδα",
};

export async function getWeather(
  lat: number | null,
  lng: number | null,
): Promise<{ temp: number; label: string } | null> {
  if (lat == null || lng == null) return null;
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`,
      { next: { revalidate: 1800 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const temp = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    if (typeof temp !== "number") return null;
    return { temp: Math.round(temp), label: WEATHER_LABELS[code] ?? "" };
  } catch {
    return null;
  }
}
