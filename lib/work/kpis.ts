/**
 * KPI counters, filters and URL (de)serialisation for the work center.
 * Pure and client-safe — shared by the server page, the client table, the
 * dashboard strip and the AI read tool.
 */
import { WORK_PRIORITIES, WORK_SOURCES, WORK_STAGES, type WorkItem, type WorkPriority, type WorkSource, type WorkStage } from "./types";

export type WorkKpis = { overdue: number; today: number; week: number; unassigned: number };
export type WorkQuickFilter = "overdue" | "today" | "week" | "unassigned";
export type WorkFilters = {
  f?: WorkQuickFilter;
  source?: WorkSource[];
  stage?: WorkStage[];
  building?: string;
  assignee?: string | "none";
  priority?: WorkPriority[];
  mine?: boolean;
  from?: string;
  to?: string;
  q?: string;
};

const QUICK: readonly WorkQuickFilter[] = ["overdue", "today", "week", "unassigned"];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Athens", weekday: "short" });
const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** "YYYY-MM-DD" of the instant in Europe/Athens. */
export function athensDayKey(d: Date): string {
  return dayFmt.format(d);
}

function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** [monday, sunday] day keys of the Athens week containing `now`. */
function athensWeek(now: Date): [string, string] {
  const today = athensDayKey(now);
  const idx = WEEKDAY_INDEX[weekdayFmt.format(now)] ?? 0;
  return [shiftDay(today, -idx), shiftDay(today, 6 - idx)];
}

const dueKey = (i: WorkItem): string | null => (i.dueAt ? athensDayKey(new Date(i.dueAt)) : null);

export function isUnassigned(item: WorkItem): boolean {
  return item.source === "fault" && item.handledBy === "COMPANY" && !item.assigneeId && !item.supplierName;
}

export function isMine(item: WorkItem, userId: string): boolean {
  return item.assigneeId === userId || isUnassigned(item);
}

export function computeKpis(items: WorkItem[], now: Date): WorkKpis {
  const today = athensDayKey(now);
  const [monday, sunday] = athensWeek(now);
  let overdue = 0, todayN = 0, week = 0, unassigned = 0;
  for (const i of items) {
    if (i.overdue) overdue++;
    if (isUnassigned(i)) unassigned++;
    const k = dueKey(i);
    if (!k) continue;
    if (k === today) todayN++;
    if (k >= monday && k <= sunday) week++;
  }
  return { overdue, today: todayN, week, unassigned };
}

export function applyFilters(items: WorkItem[], filters: WorkFilters, ctx: { now: Date; userId: string }): WorkItem[] {
  const today = athensDayKey(ctx.now);
  const [monday, sunday] = athensWeek(ctx.now);
  const q = filters.q?.trim().toLowerCase();
  return items.filter((i) => {
    const k = dueKey(i);
    if (filters.f === "overdue" && !i.overdue) return false;
    if (filters.f === "today" && k !== today) return false;
    if (filters.f === "week" && !(k && k >= monday && k <= sunday)) return false;
    if (filters.f === "unassigned" && !isUnassigned(i)) return false;
    if (filters.mine && !isMine(i, ctx.userId)) return false;
    if (filters.source?.length && !filters.source.includes(i.source)) return false;
    if (filters.stage?.length && !filters.stage.includes(i.stage)) return false;
    if (filters.building && i.buildingId !== filters.building) return false;
    if (filters.assignee === "none" && i.assigneeId) return false;
    if (filters.assignee && filters.assignee !== "none" && i.assigneeId !== filters.assignee) return false;
    if (filters.priority?.length && (!i.priority || !filters.priority.includes(i.priority))) return false;
    if (filters.from && (!k || k < filters.from)) return false;
    if (filters.to && (!k || k > filters.to)) return false;
    if (q && ![i.title, i.subtitle, i.buildingName].some((s) => s?.toLowerCase().includes(q))) return false;
    return true;
  });
}

type ParamsLike = Record<string, string | string[] | undefined> | URLSearchParams;

function readParam(params: ParamsLike, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v.join(",") : v;
}

function list<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] | undefined {
  if (!raw) return undefined;
  const vals = raw.split(",").map((s) => s.trim()).filter((s): s is T => (allowed as readonly string[]).includes(s));
  return vals.length ? vals : undefined;
}

export function parseFilters(params: ParamsLike): WorkFilters {
  const out: WorkFilters = {};
  const f = readParam(params, "f");
  if (f && (QUICK as readonly string[]).includes(f)) out.f = f as WorkQuickFilter;
  const source = list(readParam(params, "source"), WORK_SOURCES); if (source) out.source = source;
  const stage = list(readParam(params, "stage"), WORK_STAGES); if (stage) out.stage = stage;
  const building = readParam(params, "building")?.trim(); if (building) out.building = building;
  const assignee = readParam(params, "assignee")?.trim(); if (assignee) out.assignee = assignee;
  const priority = list(readParam(params, "priority"), WORK_PRIORITIES); if (priority) out.priority = priority;
  const mine = readParam(params, "mine"); if (mine === "1" || mine === "true") out.mine = true;
  const from = readParam(params, "from"); if (from && DAY_RE.test(from)) out.from = from;
  const to = readParam(params, "to"); if (to && DAY_RE.test(to)) out.to = to;
  const q = readParam(params, "q")?.trim(); if (q) out.q = q;
  return out;
}

/** Query string without "?", stable key order. */
export function serializeFilters(filters: WorkFilters): string {
  const p = new URLSearchParams();
  if (filters.f) p.set("f", filters.f);
  if (filters.source?.length) p.set("source", filters.source.join(","));
  if (filters.stage?.length) p.set("stage", filters.stage.join(","));
  if (filters.building) p.set("building", filters.building);
  if (filters.assignee) p.set("assignee", filters.assignee);
  if (filters.priority?.length) p.set("priority", filters.priority.join(","));
  if (filters.mine) p.set("mine", "1");
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  if (filters.q) p.set("q", filters.q);
  return p.toString().replace(/%2C/g, ",");
}
