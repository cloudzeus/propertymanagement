import { describe, it, expect } from "vitest";
import { RBAC_MODULES, DEFAULT_PERMISSIONS } from "./registry";
import { RBAC_ACTIONS, permKey } from "./types";

describe("RBAC registry", () => {
  it("has unique module keys", () => {
    const keys = RBAC_MODULES.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("uses only valid actions", () => {
    for (const m of RBAC_MODULES)
      for (const a of m.actions) expect(RBAC_ACTIONS).toContain(a);
  });
  it("uses only valid surfaces", () => {
    const surfaces = new Set(["company", "customer", "marketplace"]);
    for (const m of RBAC_MODULES) expect(surfaces.has(m.surface)).toBe(true);
  });
  it("default permission keys reference real module:action pairs", () => {
    const valid = new Set(
      RBAC_MODULES.flatMap((m) => m.actions.map((a) => permKey(m.key, a))),
    );
    for (const keys of Object.values(DEFAULT_PERMISSIONS))
      for (const k of keys ?? []) expect(valid.has(k)).toBe(true);
  });
  it("SUPER_ADMIN default includes every permission", () => {
    const all = RBAC_MODULES.flatMap((m) => m.actions.map((a) => permKey(m.key, a)));
    expect(new Set(DEFAULT_PERMISSIONS.SUPER_ADMIN)).toEqual(new Set(all));
  });
});
