"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { getBaseStation, type BaseStation } from "@/lib/distance/base";
import { getDistanceZones, isStale, recomputeStaleBuildings } from "@/lib/distance/buildings";
import { validateZones, zoneForKm, type DistanceZone } from "@/lib/distance/zones";

/* Ρυθμίσεις → Σταθμός βάσης & ζώνες απόστασης. */

export type DistanceOverview = {
  base: BaseStation | null;
  companyId: string | null;
  zones: DistanceZone[];
  perZone: { code: string; label: string; count: number }[];
  total: number;
  missing: number;
  estimated: number;
  stale: number;
  lastComputedAt: string | null;
};

async function allowed(action: "view" | "edit"): Promise<boolean> {
  const r = await getEffectivePermissions();
  return !!r && can(r.perms, "settings-distance", action);
}

const num = (v: unknown): number => {
  if (v == null || v === "") return Number.NaN;
  return typeof v === "number" ? v : Number(String(v).replace(",", "."));
};

/** Form values may arrive as strings; coerce before validating. */
function coerceZones(raw: unknown): DistanceZone[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((z, i, arr) => {
    const o = (z ?? {}) as Record<string, unknown>;
    const last = i === arr.length - 1;
    const maxRaw = num(o.maxKm);
    const feeRaw = num(o.travelFee);
    return {
      code: String(o.code ?? "").trim(),
      label: String(o.label ?? "").trim(),
      maxKm: last && (o.maxKm == null || o.maxKm === "") ? null : maxRaw,
      travelFee: o.travelFee == null || o.travelFee === "" ? 0 : feeRaw,
    };
  });
}

export async function saveDistanceZones(raw: DistanceZone[]): Promise<{ ok: true } | { error: string }> {
  if (!(await allowed("edit"))) return { error: "Δεν επιτρέπεται" };
  const zones = coerceZones(raw);
  const err = validateZones(zones);
  if (err) return { error: err };
  await db.appSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", distanceZones: zones }, update: { distanceZones: zones } });
  revalidatePath("/super-admin/settings/distance");
  revalidatePath("/super-admin/services");
  return { ok: true };
}

export async function recomputeAllDistances(): Promise<{ ok: true; result: { scanned: number; updated: number; estimated: number; skipped: number } } | { error: string }> {
  if (!(await allowed("edit"))) return { error: "Δεν επιτρέπεται" };
  // Only stale rows (never measured, base moved, or estimates); ROAD cache hits cost no provider call.
  const result = await recomputeStaleBuildings({ force: false, limit: 300 });
  revalidatePath("/super-admin/settings/distance");
  return { ok: true, result };
}

export async function loadDistanceOverview(): Promise<DistanceOverview> {
  if (!(await allowed("view"))) throw new Error("Δεν επιτρέπεται");
  const [base, zones, rows, company] = await Promise.all([
    getBaseStation(),
    getDistanceZones(),
    db.building.findMany({ select: { distanceKm: true, distanceAt: true, distanceBaseKey: true, distanceMethod: true } }),
    db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }),
  ]);
  const counts = new Map(zones.map((z) => [z.code, 0]));
  let missing = 0, estimated = 0, stale = 0, last: Date | null = null;
  for (const b of rows) {
    const z = zoneForKm(zones, b.distanceKm);
    if (z) counts.set(z.code, (counts.get(z.code) ?? 0) + 1); else missing++;
    if (b.distanceMethod === "ESTIMATE") estimated++;
    if (!base || isStale(b, base.key)) stale++;
    if (b.distanceAt && (!last || b.distanceAt > last)) last = b.distanceAt;
  }
  return {
    base, companyId: company?.id ?? null, zones,
    perZone: zones.map((z) => ({ code: z.code, label: z.label, count: counts.get(z.code) ?? 0 })),
    total: rows.length, missing, estimated, stale, lastComputedAt: last ? last.toISOString() : null,
  };
}
