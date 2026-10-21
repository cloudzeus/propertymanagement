import { describe, it, expect } from "vitest";
import { athensDayKey, computeKpis, isUnassigned, isMine, applyFilters, parseFilters, serializeFilters } from "./kpis";
import type { WorkItem } from "./types";

// Tuesday 2026-10-20 10:00 Athens → week = Mon 19 … Sun 25
const now = new Date("2026-10-20T10:00:00+03:00");

function item(over: Partial<WorkItem> & { id: string }): WorkItem {
  return {
    source: "fault", sourceId: over.id, title: over.id, subtitle: null, buildingId: "b1", buildingName: "Κτήριο Α", customerName: null,
    stage: "new", rawStatus: "OPEN", priority: "NORMAL", dueAt: null, overdue: false, assigneeId: null, assigneeName: null,
    supplierName: null, handledBy: "COMPANY", href: "#", updatedAt: now.toISOString(), description: null, ...over,
  };
}

const items: WorkItem[] = [
  item({ id: "overdue-unassigned", dueAt: "2026-10-19T06:00:00.000Z", overdue: true }),                                   // Mon, overdue, COMPANY, nobody
  item({ id: "today-u1", dueAt: "2026-10-20T15:00:00.000Z", assigneeId: "u1", assigneeName: "Γιώργος" }),                 // today 18:00
  item({ id: "wo-thu", source: "work-order", stage: "waiting-customer", priority: null, handledBy: null, dueAt: "2026-10-23T06:00:00.000Z", supplierName: "Υδραυλικός ΑΕ" }),
  item({ id: "programme-old", source: "programme", stage: "overdue-programme", priority: null, handledBy: null, dueAt: "2026-10-10T06:00:00.000Z", overdue: true }),
  item({ id: "appt-next-mon", source: "appointment", stage: "scheduled", priority: null, handledBy: null, dueAt: "2026-10-26T06:00:00.000Z" }),
  item({ id: "no-due", handledBy: "PROPERTY_ADMIN", priority: "LOW", buildingId: "b2", buildingName: "Κτήριο Β" }),
];

describe("athensDayKey", () => {
  it("formats in Europe/Athens, not UTC", () => {
    expect(athensDayKey(new Date("2026-10-20T22:30:00.000Z"))).toBe("2026-10-21");
  });
});

describe("computeKpis", () => {
  it("counts overdue / today / this week / unassigned", () => {
    expect(computeKpis(items, now)).toEqual({ overdue: 2, today: 1, week: 3, unassigned: 1 });
  });
  it("ignores items without a due date in today/week", () => {
    expect(computeKpis([items[5]], now)).toEqual({ overdue: 0, today: 0, week: 0, unassigned: 0 });
  });
});

describe("isUnassigned / isMine", () => {
  it("unassigned = company-handled fault with neither employee nor supplier", () => {
    expect(isUnassigned(items[0])).toBe(true);
    expect(isUnassigned(items[5])).toBe(false);
    expect(isUnassigned(item({ id: "x", supplierName: "Kone" }))).toBe(false);
    expect(isUnassigned(items[2])).toBe(false);
  });
  it("mine = assigned to me or an unassigned company-handled fault", () => {
    expect(items.filter((i) => isMine(i, "u1")).map((i) => i.id)).toEqual(["overdue-unassigned", "today-u1"]);
  });
});

describe("applyFilters", () => {
  const ctx = { now, userId: "u1" };
  it("quick filters", () => {
    expect(applyFilters(items, { f: "overdue" }, ctx).map((i) => i.id)).toEqual(["overdue-unassigned", "programme-old"]);
    expect(applyFilters(items, { f: "today" }, ctx).map((i) => i.id)).toEqual(["today-u1"]);
    expect(applyFilters(items, { f: "week" }, ctx).map((i) => i.id)).toEqual(["overdue-unassigned", "today-u1", "wo-thu"]);
    expect(applyFilters(items, { f: "unassigned" }, ctx).map((i) => i.id)).toEqual(["overdue-unassigned"]);
  });
  it("mine, source, stage, building, assignee, priority", () => {
    expect(applyFilters(items, { mine: true }, ctx).map((i) => i.id)).toEqual(["overdue-unassigned", "today-u1"]);
    expect(applyFilters(items, { source: ["programme"] }, ctx)).toHaveLength(1);
    expect(applyFilters(items, { stage: ["waiting-customer", "scheduled"] }, ctx).map((i) => i.id)).toEqual(["wo-thu", "appt-next-mon"]);
    expect(applyFilters(items, { building: "b2" }, ctx).map((i) => i.id)).toEqual(["no-due"]);
    expect(applyFilters(items, { assignee: "u1" }, ctx).map((i) => i.id)).toEqual(["today-u1"]);
    expect(applyFilters(items, { assignee: "none", source: ["fault"] }, ctx).map((i) => i.id)).toEqual(["overdue-unassigned", "no-due"]);
    expect(applyFilters(items, { priority: ["LOW"] }, ctx).map((i) => i.id)).toEqual(["no-due"]);
  });
  it("date range is inclusive on Athens days and drops items without a due date", () => {
    expect(applyFilters(items, { from: "2026-10-21", to: "2026-10-23" }, ctx).map((i) => i.id)).toEqual(["wo-thu"]);
    expect(applyFilters(items, { from: "2026-10-20" }, ctx).map((i) => i.id)).toEqual(["today-u1", "wo-thu", "appt-next-mon"]);
  });
  it("q searches title, subtitle and building, case-insensitively", () => {
    expect(applyFilters(items, { q: "κτήριο β" }, ctx).map((i) => i.id)).toEqual(["no-due"]);
    expect(applyFilters(items, { q: "WO-" }, ctx).map((i) => i.id)).toEqual(["wo-thu"]);
  });
});

describe("parseFilters / serializeFilters", () => {
  it("drops unknown values and parses lists and booleans", () => {
    expect(parseFilters(new URLSearchParams("f=xyz&source=fault,nope&priority=LOW,FOO&mine=1"))).toEqual({ source: ["fault"], priority: ["LOW"], mine: true });
    expect(parseFilters({ f: "today", stage: ["new", "bogus"], building: "b1", assignee: "none", from: "2026-10-01", to: "bad", q: " νερό " }))
      .toEqual({ f: "today", stage: ["new"], building: "b1", assignee: "none", from: "2026-10-01", q: "νερό" });
  });
  it("round-trips with a stable key order", () => {
    const f = parseFilters(new URLSearchParams("mine=true&priority=LOW&source=fault"));
    expect(serializeFilters(f)).toBe("source=fault&priority=LOW&mine=1");
    expect(serializeFilters({})).toBe("");
    expect(serializeFilters({ f: "overdue", mine: false })).toBe("f=overdue");
  });
});
