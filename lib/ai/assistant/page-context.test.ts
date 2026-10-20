import { describe, it, expect } from "vitest";
import { parsePageContext } from "./page-context";

describe("parsePageContext", () => {
  it("extracts a building id from manager and super-admin building pages", () => {
    expect(parsePageContext("/building/b1", "")).toEqual({ path: "/building/b1", buildingId: "b1" });
    expect(parsePageContext("/super-admin/buildings/b2", "?x=1")).toEqual({ path: "/super-admin/buildings/b2", buildingId: "b2" });
  });
  it("extracts a request id from fault detail pages only", () => {
    expect(parsePageContext("/admin/maintenance/r1", "")).toEqual({ path: "/admin/maintenance/r1", requestId: "r1" });
    expect(parsePageContext("/portal/requests/r2", "")).toEqual({ path: "/portal/requests/r2", requestId: "r2" });
    expect(parsePageContext("/portal/maintenance/r3", "")).toEqual({ path: "/portal/maintenance/r3", requestId: "r3" });
    expect(parsePageContext("/marketplace/requests/r4", "")).toEqual({ path: "/marketplace/requests/r4", requestId: "r4" });
    expect(parsePageContext("/admin/maintenance/settings", "")).toEqual({ path: "/admin/maintenance/settings" });
    expect(parsePageContext("/portal/requests/new", "")).toEqual({ path: "/portal/requests/new" });
  });
  it("reads the tab from ?s= or ?tab=", () => {
    expect(parsePageContext("/building/b1", "?s=maintenance")).toEqual({ path: "/building/b1", buildingId: "b1", tab: "maintenance" });
    expect(parsePageContext("/super-admin/buildings/b1", "tab=expenses")).toEqual({ path: "/super-admin/buildings/b1", buildingId: "b1", tab: "expenses" });
  });
});
