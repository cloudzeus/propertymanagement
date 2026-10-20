import { requirePermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/prisma/client";
import { getSoftoneConfig } from "@/lib/softone/config";
import { PULL_ENTITIES, type PullEntityKey } from "@/lib/softone/sync/core";
import { masterDataStatus, delegateFor } from "@/lib/softone/sync/engine";
import { SoftoneHeader } from "@/components/settings/softone/SoftoneHeader";
import { SoftoneSyncClient, type MasterRow, type LogRow } from "@/components/settings/softone/SoftoneSyncClient";

export const metadata = { title: "SoftOne — Συγχρονισμός" };
export const dynamic = "force-dynamic";

const SORTABLE = new Set(["s1Key", "code", "name", "isActive", "lastSyncedAt"]);

export default async function SoftoneSyncPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("softone-sync", "view");
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? "";
  const entity = (PULL_ENTITIES.some((e) => e.key === one("e")) ? one("e") : "vat") as PullEntityKey;
  const page = Math.max(1, Number(one("page")) || 1);
  const pageSize = [10, 25, 50, 100].includes(Number(one("pageSize"))) ? Number(one("pageSize")) : 25;
  const search = one("search").trim();
  const sortBy = SORTABLE.has(one("sortBy")) ? one("sortBy") : "s1Key";
  const sortDir = one("sortDir") === "desc" ? "desc" : "asc";

  const d = delegateFor(entity) as unknown as {
    findMany: (a: Prisma.SoftoneVatFindManyArgs) => Promise<Record<string, unknown>[]>;
    count: (a: { where?: Prisma.SoftoneVatWhereInput }) => Promise<number>;
  };
  const where: Prisma.SoftoneVatWhereInput = search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { code: { contains: search, mode: "insensitive" } }] } : {};
  const [status, cfg, total, rowsRaw, logsRaw] = await Promise.all([
    masterDataStatus(),
    getSoftoneConfig().catch(() => null),
    d.count({ where }).catch(() => 0),
    d.findMany({ where, orderBy: { [sortBy]: sortDir }, skip: (page - 1) * pageSize, take: pageSize }).catch(() => []),
    db.softoneSyncLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
  ]);

  const rows: MasterRow[] = rowsRaw.map((r) => ({
    id: String(r.id), s1Key: Number(r.s1Key), code: (r.code as string | null) ?? null, name: String(r.name), isActive: Boolean(r.isActive),
    lastSyncedAt: (r.lastSyncedAt as Date).toISOString(),
    extra: Object.fromEntries(Object.entries(r).filter(([k]) => !["id", "s1Key", "code", "name", "isActive", "raw", "source", "lastSyncedAt", "createdAt", "updatedAt"].includes(k)).map(([k, v]) => [k, v != null && typeof v === "object" && "toNumber" in (v as object) ? Number(v) : (v as string | number | boolean | null)])),
  }));
  const logs: LogRow[] = logsRaw.map((l) => ({
    id: l.id, entity: l.entity, entityId: l.entityId, object: l.object, action: l.action, direction: l.direction, status: l.status, softoneKey: l.softoneKey,
    counts: (l.counts as Record<string, number> | null) ?? null, error: l.error, trigger: l.trigger, durationMs: l.durationMs, createdAt: l.createdAt.toISOString(),
    payload: l.payload as unknown, response: l.response as unknown,
  }));

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SoftoneHeader title="Συγχρονισμός" subtitle="Master data από το SoftOne (pull), προεπισκόπηση αποστολών (push dry-run) και ιστορικό συγχρονισμού." />
      <SoftoneSyncClient
        configured={cfg !== null}
        status={status.map((s) => ({ ...s, lastRunAt: s.lastRunAt?.toISOString() ?? null, lastOkAt: s.lastOkAt?.toISOString() ?? null }))}
        entity={entity}
        table={{ rows, total, page, pageSize, search, sortBy, sortDir }}
        logs={logs}
      />
    </div>
  );
}
