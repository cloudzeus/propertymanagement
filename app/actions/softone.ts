"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/prisma/client";
import { requirePermission } from "@/lib/rbac/permissions";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto/secrets";
import { configFromInput, envSoftoneConfig, getSoftoneConfig, getSoftoneSettingsRow, isCompleteConfig, type SoftoneConnectionInput } from "@/lib/softone/config";
import { testConnection, selector, type ConnectionTest } from "@/lib/softone/client";
import { runReadinessChecks } from "@/lib/softone/checks";
import { pullEntity, pullAllMasterData, type PullResult } from "@/lib/softone/sync/engine";
import { PULL_ORDER, type PullEntityKey } from "@/lib/softone/sync/core";
import { PARAMETER_LOOKUPS } from "@/lib/softone/mapping";
import { mapCustomer, mapSupplier, mapBuilding, mapService, mapWorkOrder, mapPropertyService, type MapResult, type S1Params } from "@/lib/softone/mappers";
import { revalidatePath } from "next/cache";

/**
 * SoftOne settings actions. SECURITY: every action is gated through the RBAC
 * registry (softone-* modules, granted to SUPER_ADMIN/ADMIN by default). The
 * password is stored AES-256-GCM encrypted and NEVER returned to the client —
 * only a mask («••••1234») and a presence flag. It is never logged.
 */
async function userId(): Promise<string | null> {
  const s = await auth();
  return (s?.user?.id as string | undefined) ?? null;
}

/* ───────────────────────── Σύνδεση ───────────────────────── */

export type SoftoneConnectionView = {
  enabled: boolean; serial: string; username: string; appId: string; company: string; branch: string; module: string; refid: string;
  hasPassword: boolean; passwordMask: string | null;
  syncEnabled: boolean; syncHour: number;
  source: "db" | "env" | null; envComplete: boolean;
  lastPingAt: string | null; lastPingOk: boolean | null; lastPingMessage: string | null; lastMasterSyncAt: string | null;
  encryptionReady: boolean;
};

export async function getSoftoneConnectionForEdit(): Promise<SoftoneConnectionView> {
  await requirePermission("softone-connection", "view");
  const s = await getSoftoneSettingsRow();
  const resolved = await getSoftoneConfig().catch(() => null);
  const env = envSoftoneConfig();
  let passwordMask: string | null = null;
  if (s?.passwordEnc) { try { passwordMask = maskSecret(s.passwordEnc); } catch { passwordMask = "••••"; } }
  return {
    enabled: s?.enabled ?? false,
    serial: s?.serial ?? "", username: s?.username ?? "", appId: s?.appId ?? "",
    company: s?.company != null ? String(s.company) : "", branch: s?.branch != null ? String(s.branch) : "", module: s?.module != null ? String(s.module) : "0", refid: s?.refid != null ? String(s.refid) : "",
    hasPassword: Boolean(s?.passwordEnc), passwordMask,
    syncEnabled: s?.syncEnabled ?? false, syncHour: s?.syncHour ?? 5,
    source: resolved?.source ?? null, envComplete: !!env,
    lastPingAt: s?.lastPingAt?.toISOString() ?? null, lastPingOk: s?.lastPingOk ?? null, lastPingMessage: s?.lastPingMessage ?? null,
    lastMasterSyncAt: s?.lastMasterSyncAt?.toISOString() ?? null,
    encryptionReady: Boolean(process.env.SECRETS_ENCRYPTION_KEY),
  };
}

export type SaveSoftoneConnectionInput = {
  enabled: boolean; serial: string; username: string; appId: string; company: string; branch: string; module: string; refid: string;
  /** undefined = keep existing; "" = clear; non-empty = encrypt & store. */
  password?: string;
  syncEnabled: boolean; syncHour: number;
};

const intOrNull = (v: string): number | null => { const t = v.trim(); if (!t) return null; const n = Number(t); return Number.isInteger(n) ? n : null; };

export async function saveSoftoneConnection(input: SaveSoftoneConnectionInput): Promise<{ ok: true } | { error: string }> {
  await requirePermission("softone-connection", "edit");
  for (const [k, label] of [["company", "COMPANY"], ["branch", "BRANCH"], ["module", "MODULE"], ["refid", "REFID"]] as const) {
    if (input[k].trim() && intOrNull(input[k]) == null) return { error: `Το ${label} πρέπει να είναι ακέραιος αριθμός.` };
  }
  const data: Prisma.SoftoneSettingsUncheckedUpdateInput = {
    enabled: Boolean(input.enabled),
    serial: input.serial.trim().replace(/^https?:\/\//, "").replace(/\.oncloud\.gr.*$/i, "") || null,
    username: input.username.trim() || null,
    appId: input.appId.trim() || null,
    company: intOrNull(input.company), branch: intOrNull(input.branch), module: intOrNull(input.module), refid: intOrNull(input.refid),
    syncEnabled: Boolean(input.syncEnabled),
    syncHour: Math.min(23, Math.max(0, Math.trunc(Number(input.syncHour) || 0))),
  };
  if (input.password !== undefined) {
    if (input.password) {
      try { data.passwordEnc = encryptSecret(input.password); }
      catch (e) { return { error: `Η κρυπτογράφηση απέτυχε: ${e instanceof Error ? e.message : String(e)}. Ορίστε το SECRETS_ENCRYPTION_KEY στον server.` }; }
    } else data.passwordEnc = null;
    // a new password invalidates any cached session
    data.clientId = null; data.clientIdDate = null;
  }
  await db.softoneSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...(data as Prisma.SoftoneSettingsUncheckedCreateInput) }, update: data });
  revalidatePath("/super-admin/settings/softone");
  return { ok: true };
}

export type TestSoftoneConnectionInput = Omit<SoftoneConnectionInput, "password"> & { password?: string };

/** «Δοκιμή σύνδεσης» with the values in the form (unsaved allowed). Password: typed → stored → env. */
export async function testSoftoneConnection(input: TestSoftoneConnectionInput): Promise<ConnectionTest> {
  await requirePermission("softone-connection", "view");
  let password = input.password ?? "";
  if (!password) {
    const s = await getSoftoneSettingsRow();
    if (s?.passwordEnc) { try { password = decryptSecret(s.passwordEnc); } catch { return { ok: false, message: "Δεν ήταν δυνατή η αποκρυπτογράφηση του αποθηκευμένου κωδικού (SECRETS_ENCRYPTION_KEY διαφορετικό από αυτό που χρησιμοποιήθηκε στην αποθήκευση).", companies: [] }; } }
  }
  let cfg = configFromInput({ ...input, password });
  if (!isCompleteConfig(cfg)) {
    const env = envSoftoneConfig();
    if (env && !input.serial.trim() && !input.username.trim()) cfg = env;
    else return { ok: false, message: "Συμπληρώστε serial, username, κωδικό, APPID, COMPANY και REFID.", companies: [] };
  }
  return testConnection(cfg);
}

/* ───────────────────────── Δομή & έλεγχοι ───────────────────────── */

export async function runSoftoneReadinessChecks() {
  await requirePermission("softone-structure", "view");
  const cfg = await getSoftoneConfig();
  if (!cfg) return { ok: false, results: [], error: "Το SoftOne δεν είναι ρυθμισμένο — συμπληρώστε και ενεργοποιήστε τη Σύνδεση πρώτα." };
  try { return await runReadinessChecks(); }
  catch (e) { return { ok: false, results: [], error: e instanceof Error ? e.message : String(e) }; }
}

/* ───────────────────────── Παράμετροι ───────────────────────── */

export type SoftoneParamsView = {
  values: Record<string, number | null>;
  vatMap: Record<string, number>; unitMap: Record<string, number>;
  codePrefixCustomer: string; codePrefixSupplier: string; codePrefixProject: string; codePrefixService: string;
  /** Local master data (from the pull) for the dropdowns that have a mirror. */
  local: { vat: { s1Key: number; name: string; percent: number }[]; unit: { s1Key: number; name: string; shortcut: string | null }[]; series: { s1Key: number; code: string | null; name: string; sosourceLabel: string | null }[] };
  configured: boolean;
};

export async function getSoftoneParamsForEdit(): Promise<SoftoneParamsView> {
  await requirePermission("softone-params", "view");
  const s = await getSoftoneSettingsRow();
  const [vat, unit, series] = await Promise.all([
    db.softoneVat.findMany({ where: { isActive: true }, orderBy: { percent: "desc" }, select: { s1Key: true, name: true, percent: true } }).catch(() => []),
    db.softoneUnit.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { s1Key: true, name: true, shortcut: true } }).catch(() => []),
    db.softoneSeries.findMany({ where: { isActive: true }, orderBy: [{ sosource: "asc" }, { code: "asc" }], select: { s1Key: true, code: true, name: true, sosourceLabel: true } }).catch(() => []),
  ]);
  const values: Record<string, number | null> = {};
  for (const l of PARAMETER_LOOKUPS) values[l.key] = (s?.[l.key as keyof typeof s] as number | null | undefined) ?? null;
  return {
    values,
    vatMap: (s?.vatMap as Record<string, number> | null) ?? {}, unitMap: (s?.unitMap as Record<string, number> | null) ?? {},
    codePrefixCustomer: s?.codePrefixCustomer ?? "PM-C-", codePrefixSupplier: s?.codePrefixSupplier ?? "PM-S-", codePrefixProject: s?.codePrefixProject ?? "PM-B-", codePrefixService: s?.codePrefixService ?? "PM-SRV-",
    local: { vat: vat.map((v) => ({ ...v, percent: Number(v.percent) })), unit, series },
    configured: (await getSoftoneConfig().catch(() => null)) !== null,
  };
}

export type SaveSoftoneParamsInput = {
  values: Record<string, number | null>;
  vatMap: Record<string, number>; unitMap: Record<string, number>;
  codePrefixCustomer: string; codePrefixSupplier: string; codePrefixProject: string; codePrefixService: string;
};

export async function saveSoftoneParams(input: SaveSoftoneParamsInput): Promise<{ ok: true } | { error: string }> {
  await requirePermission("softone-params", "edit");
  const data: Record<string, unknown> = {
    vatMap: input.vatMap, unitMap: input.unitMap,
    codePrefixCustomer: input.codePrefixCustomer.trim() || "PM-C-", codePrefixSupplier: input.codePrefixSupplier.trim() || "PM-S-",
    codePrefixProject: input.codePrefixProject.trim() || "PM-B-", codePrefixService: input.codePrefixService.trim() || "PM-SRV-",
  };
  for (const l of PARAMETER_LOOKUPS) {
    const v = input.values[l.key];
    data[l.key] = v == null || v === ("" as unknown) ? null : Number.isInteger(Number(v)) ? Number(v) : null;
  }
  await db.softoneSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data } as Prisma.SoftoneSettingsUncheckedCreateInput, update: data as Prisma.SoftoneSettingsUncheckedUpdateInput });
  revalidatePath("/super-admin/settings/softone/params");
  return { ok: true };
}

export type SelectorOption = { value: number; label: string; code?: string };

/** Live dropdown values from SoftOne (getSelectorData) for one editor. */
export async function loadSoftoneSelector(editor: string): Promise<{ ok: true; options: SelectorOption[] } | { ok: false; error: string }> {
  await requirePermission("softone-params", "view");
  if (!/^\$?[A-Za-z0-9_]{2,40}$/.test(editor)) return { ok: false, error: "Μη έγκυρος editor" };
  const r = await selector(editor);
  if (!r.success) return { ok: false, error: `${r.error ?? "σφάλμα"}${r.errorcode != null ? ` (κωδικός ${r.errorcode})` : ""}` };
  const keyName = editor.replace(/^\$/, "").toUpperCase();
  const options: SelectorOption[] = [];
  for (const row of r.data ?? []) {
    const entries = Object.entries(row);
    const keyEntry = entries.find(([k]) => k.toUpperCase() === keyName) ?? entries.find(([k]) => k.toUpperCase().endsWith(`.${keyName}`)) ?? entries[0];
    const value = Number(keyEntry?.[1]);
    if (!Number.isFinite(value)) continue;
    const name = entries.find(([k]) => /(^|\.)NAME$/i.test(k))?.[1];
    const code = entries.find(([k]) => /(^|\.)(CODE|SHORTCUT)$/i.test(k))?.[1];
    options.push({ value, label: String(name ?? code ?? value), code: code != null ? String(code) : undefined });
  }
  return { ok: true, options };
}

/* ───────────────────────── Συγχρονισμός (pull) ───────────────────────── */

export async function pullSoftoneMasterData(entity: PullEntityKey | "all", dryRun: boolean): Promise<{ skipped?: string; results: PullResult[] }> {
  await requirePermission("softone-sync", dryRun ? "view" : "edit");
  const uid = await userId();
  if (entity === "all") {
    const r = await pullAllMasterData({ trigger: "manual", byUserId: uid, dryRun });
    if (!dryRun) revalidatePath("/super-admin/settings/softone/sync");
    return r;
  }
  if (!PULL_ORDER.includes(entity)) return { skipped: "Άγνωστη οντότητα", results: [] };
  const r = await pullEntity(entity, { dryRun, trigger: "manual", byUserId: uid });
  if (!dryRun) revalidatePath("/super-admin/settings/softone/sync");
  return { results: [r] };
}

/* ───────────────────────── Push dry-run (Φάση Α) ───────────────────────── */

export type PushEntityKey = "customer" | "supplier" | "building" | "service" | "work-order" | "property-service";

export async function searchPushCandidates(entity: PushEntityKey, q: string): Promise<{ id: string; label: string; linked: boolean }[]> {
  await requirePermission("softone-sync", "view");
  const term = q.trim();
  const where = term ? { contains: term, mode: "insensitive" as const } : undefined;
  switch (entity) {
    case "customer": return (await db.customer.findMany({ where: where ? { name: where } : {}, take: 20, orderBy: { name: "asc" }, select: { id: true, name: true, softoneTrdr: true } })).map((r) => ({ id: r.id, label: r.name, linked: r.softoneTrdr != null }));
    case "supplier": return (await db.supplier.findMany({ where: { customerId: null, isPlatform: false, ...(where ? { name: where } : {}) }, take: 20, orderBy: { name: "asc" }, select: { id: true, name: true, softoneTrdr: true } })).map((r) => ({ id: r.id, label: r.name, linked: r.softoneTrdr != null }));
    case "building": return (await db.building.findMany({ where: where ? { name: where } : {}, take: 20, orderBy: { name: "asc" }, select: { id: true, name: true, address: true, softonePrjc: true } })).map((r) => ({ id: r.id, label: `${r.name} — ${r.address}`, linked: r.softonePrjc != null }));
    case "service": return (await db.service.findMany({ where: where ? { name: where } : {}, take: 20, orderBy: { name: "asc" }, select: { id: true, name: true, code: true, softoneMtrl: true } })).map((r) => ({ id: r.id, label: `${r.code} · ${r.name}`, linked: r.softoneMtrl != null }));
    case "work-order": return (await db.workOrder.findMany({ where: where ? { OR: [{ number: where }, { title: where }] } : {}, take: 20, orderBy: { createdAt: "desc" }, select: { id: true, number: true, title: true, softoneCntrA: true } })).map((r) => ({ id: r.id, label: `${r.number} · ${r.title}`, linked: r.softoneCntrA != null }));
    case "property-service": return (await db.propertyService.findMany({ where: where ? { service: { name: where } } : {}, take: 20, orderBy: { createdAt: "desc" }, select: { id: true, softoneCntr: true, service: { select: { name: true } }, property: { select: { buildings: { select: { name: true }, take: 1 } } } } })).map((r) => ({ id: r.id, label: `${r.property.buildings[0]?.name ?? "Ακίνητο"} — ${r.service.name}`, linked: r.softoneCntr != null }));
  }
}

async function loadParams(): Promise<S1Params> {
  const s = await getSoftoneSettingsRow();
  return {
    countryGr: s?.countryGr ?? null, currencyEur: s?.currencyEur ?? null, paymentDefault: s?.paymentDefault ?? null,
    cntrTypeCustomer: s?.cntrTypeCustomer ?? null, cntrTypeSupplier: s?.cntrTypeSupplier ?? null, cntrTypeManaged: s?.cntrTypeManaged ?? null, cntrType1Default: s?.cntrType1Default ?? null,
    visitUnitMonths: s?.visitUnitMonths ?? null, seriesSales: s?.seriesSales ?? null, seriesPurchase: s?.seriesPurchase ?? null, prjType: s?.prjType ?? null,
    vatMap: (s?.vatMap as Record<string, number> | null) ?? null, unitMap: (s?.unitMap as Record<string, number> | null) ?? null,
    codePrefixCustomer: s?.codePrefixCustomer ?? "PM-C-", codePrefixSupplier: s?.codePrefixSupplier ?? "PM-S-", codePrefixProject: s?.codePrefixProject ?? "PM-B-", codePrefixService: s?.codePrefixService ?? "PM-SRV-",
    branch: s?.branch ?? null,
  };
}

/** Preview ONLY: builds the setData payload(s) for one of our records. Never calls SoftOne, never writes. */
export async function dryRunPush(entity: PushEntityKey, id: string): Promise<{ ok: true; results: MapResult[] } | { ok: false; error: string }> {
  await requirePermission("softone-sync", "view");
  const p = await loadParams();
  try {
    switch (entity) {
      case "customer": {
        const c = await db.customer.findUnique({ where: { id } });
        if (!c) return { ok: false, error: "Δεν βρέθηκε" };
        return { ok: true, results: [mapCustomer({ ...c, type: c.type }, p)] };
      }
      case "supplier": {
        const s = await db.supplier.findUnique({ where: { id } });
        if (!s) return { ok: false, error: "Δεν βρέθηκε" };
        return { ok: true, results: [mapSupplier({ ...s, fax: null, type: "COMPANY" }, p)] };
      }
      case "building": {
        const b = await db.building.findUnique({ where: { id }, include: { customer: { select: { softoneTrdr: true } }, property: { select: { createdAt: true } } } });
        if (!b) return { ok: false, error: "Δεν βρέθηκε" };
        return { ok: true, results: [mapBuilding({ ...b, customerTrdr: b.customer.softoneTrdr, managedSince: b.property.createdAt }, p)] };
      }
      case "service": {
        const s = await db.service.findUnique({ where: { id } });
        if (!s) return { ok: false, error: "Δεν βρέθηκε" };
        return { ok: true, results: [mapService({ id: s.id, code: s.code, name: s.name, vatPct: 24, unit: "μήνας", customerPrice: Number(s.price), supplierPrice: null, active: s.active, softoneMtrl: s.softoneMtrl }, p)] };
      }
      case "work-order": {
        const w = await db.workOrder.findUnique({ where: { id }, include: { customer: { select: { softoneTrdr: true } }, supplier: { select: { softoneTrdr: true } }, building: { select: { softonePrjc: true } } } });
        if (!w) return { ok: false, error: "Δεν βρέθηκε" };
        const { a, b } = mapWorkOrder({
          id: w.id, number: w.number, title: w.title, description: w.description, createdAt: w.createdAt, customerAcceptedAt: w.customerAcceptedAt, supplierAcceptedAt: w.supplierAcceptedAt, scheduledAt: w.scheduledAt, completedAt: w.completedAt,
          warrantyMonths: w.warrantyMonths, customerPrice: Number(w.customerPrice), supplierPrice: Number(w.supplierPrice), customerMessage: w.customerMessage,
          customerTrdr: w.customer.softoneTrdr, supplierTrdr: w.supplier.softoneTrdr, buildingPrjc: w.building.softonePrjc, serviceMtrl: null /* η υπηρεσία της προσφοράς δεν έχει ακόμη δεσμό με MTRL (§11.3) */, softoneCntrA: w.softoneCntrA, softoneCntrB: w.softoneCntrB,
        }, p);
        return { ok: true, results: [a, b] };
      }
      case "property-service": {
        const ps = await db.propertyService.findUnique({ where: { id }, include: { service: true, property: { include: { customer: { select: { softoneTrdr: true } }, buildings: { select: { name: true, softonePrjc: true, unitsCount: true }, take: 1 } } } } });
        if (!ps) return { ok: false, error: "Δεν βρέθηκε" };
        const b = ps.property.buildings[0];
        return { ok: true, results: [mapPropertyService({ id: ps.id, buildingName: b?.name ?? "Ακίνητο", serviceName: ps.service.name, serviceMtrl: ps.service.softoneMtrl, price: Number(ps.service.price), qty: ps.service.isCore ? (b?.unitsCount ?? 1) : 1, startedAt: ps.startedAt, endedAt: ps.endedAt, customerTrdr: ps.property.customer.softoneTrdr, buildingPrjc: b?.softonePrjc ?? null, softoneCntr: ps.softoneCntr }, p)] };
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
