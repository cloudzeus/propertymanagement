import { describe, it, expect } from "vitest";
import {
  BUILDING_ACTIONS, GROUP_ORDER, basicBuildingActions, buildingActionHref, filterBuildingActions,
  groupBuildingActions, isBuildingActionKey, resolveBuildingActions, wizardForAction,
} from "./building-actions";
import { capsForManager, capsForStaff, NO_CAPS, OCCUPANT_CAPS } from "./building-caps";
import { WIZARDS, getWizard } from "./wizards/registry";

const keys = (as: { key: string }[]) => as.map((a) => a.key);

describe("registry", () => {
  it("has unique keys and only known groups", () => {
    const ks = keys([...BUILDING_ACTIONS]);
    expect(new Set(ks).size).toBe(ks.length);
    for (const a of BUILDING_ACTIONS) expect(GROUP_ORDER).toContain(a.group);
  });
  it("covers every group", () => {
    const groups = new Set(BUILDING_ACTIONS.map((a) => a.group));
    expect([...GROUP_ORDER].every((g) => groups.has(g))).toBe(true);
  });
});

describe("resolveBuildingActions", () => {
  it("staff on a managed, metered building with a work viewer sees everything", () => {
    const all = resolveBuildingActions(capsForStaff(), { managed: true, metered: true, hasWorkViewer: true, superAdmin: true });
    expect(all.length).toBe(BUILDING_ACTIONS.length);
  });
  it("hides managed-only, metered-only and work-viewer actions when the flags are off", () => {
    const ks = keys(resolveBuildingActions(capsForStaff(), { managed: false, metered: false }));
    expect(ks).not.toContain("managed-item-new");
    expect(ks).not.toContain("heating-readings");
    expect(ks).not.toContain("rfq-new");
    expect(ks).not.toContain("appointment");
    expect(ks).not.toContain("building-edit"); // super-admin only
    expect(ks).toContain("fault-new");
  });
  it("company-managed building: the PROPERTY_ADMIN gets communication + requests + reads only", () => {
    const ks = keys(resolveBuildingActions(capsForManager(true), { managed: true, metered: true, hasWorkViewer: true }));
    expect(ks).toEqual(["contact-new", "statement", "fault-new", "task-new", "announcement-new", "assembly-new", "printables", "meter-readings", "file-upload", "audit"]);
  });
  it("self-managed building: the PROPERTY_ADMIN sees the staff set minus managed-only items", () => {
    const ks = keys(resolveBuildingActions(capsForManager(false), { managed: false, metered: false }));
    expect(ks).toContain("unit-new");
    expect(ks).toContain("koino-issue");
    expect(ks).not.toContain("managed-item-new");
  });
  it("occupants get only the fault report; no caps → nothing", () => {
    expect(keys(resolveBuildingActions(OCCUPANT_CAPS, { managed: true, metered: true }))).toEqual(["fault-new"]);
    expect(resolveBuildingActions(NO_CAPS, { managed: true, metered: true })).toEqual([]);
  });
  it("keeps registry order so groups stay contiguous", () => {
    const all = resolveBuildingActions(capsForStaff(), { managed: true, metered: true, hasWorkViewer: true, superAdmin: true });
    const order = all.map((a) => GROUP_ORDER.indexOf(a.group));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe("basic / grouped / search", () => {
  it("basic list is the short deep-linkable subset", () => {
    const ks = keys(basicBuildingActions(capsForStaff(), { managed: true, metered: true }));
    expect(ks).toEqual(["unit-new", "occupant-assign", "expense-new", "koino-issue", "fault-new", "announcement-new"]);
  });
  it("groups follow GROUP_ORDER and drop empty groups", () => {
    const g = groupBuildingActions(resolveBuildingActions(capsForManager(true), { managed: true, metered: false }));
    expect(g.map((x) => x.group)).toEqual(["units", "finance", "maintenance", "communication", "readings", "building"]);
    const noUnits = groupBuildingActions(resolveBuildingActions(OCCUPANT_CAPS, { managed: true, metered: false }));
    expect(noUnits.map((x) => x.group)).toEqual(["maintenance"]);
    expect(g.every((x) => x.actions.length > 0)).toBe(true);
  });
  it("search ignores case and Greek accents, and matches hints and group labels", () => {
    const all = resolveBuildingActions(capsForStaff(), { managed: true, metered: true, hasWorkViewer: true });
    expect(keys(filterBuildingActions(all, "ΒΛΑΒΗ"))).toEqual(["fault-new", "rfq-new", "appointment"]);
    expect(keys(filterBuildingActions(all, "ocr"))).toEqual(["expense-new"]);
    expect(keys(filterBuildingActions(all, "μετρησ"))).toEqual(["heating-readings", "meter-readings"]);
    expect(filterBuildingActions(all, "  ")).toBe(all);
  });
});

describe("deep links", () => {
  it("validates keys and builds the href", () => {
    expect(isBuildingActionKey("fault-new")).toBe(true);
    expect(isBuildingActionKey("drop-tables")).toBe(false);
    expect(isBuildingActionKey(null)).toBe(false);
    expect(buildingActionHref("/super-admin/buildings/b1", "expense-new")).toBe("/super-admin/buildings/b1?action=expense-new");
  });
});

describe("guided wizards", () => {
  it("maps building actions to wizards", () => {
    expect(wizardForAction("millesimes-calc")).toBe("millesimes-setup");
    expect(wizardForAction("managed-item-new")).toBe("common-area-new");
    expect(wizardForAction("task-new")).toBe("task-new");
    expect(wizardForAction("announcement-new")).toBe("announcement-new");
    expect(wizardForAction("assembly-new")).toBe("assembly-new");
    expect(wizardForAction("occupant-assign")).toBe("occupant-assign");
    expect(wizardForAction("unit-new")).toBeNull();
  });
  it("every wizard-mapped action's cap equals the wizard's cap", () => {
    for (const a of BUILDING_ACTIONS) if (a.wizard) expect(getWizard(a.wizard).cap, a.key).toBe(a.cap);
  });
  it("every building-scope wizard is reachable from exactly one action", () => {
    for (const w of WIZARDS.filter((x) => x.scope === "building")) {
      expect(BUILDING_ACTIONS.filter((a) => a.wizard === w.key).length, w.key).toBe(1);
    }
  });
});
