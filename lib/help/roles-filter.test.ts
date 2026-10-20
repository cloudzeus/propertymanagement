import { describe, it, expect } from "vitest";
import { filterRoleBlocks } from "./roles-filter";

const MD = `Intro για όλους.
:::roles PROPERTY_ADMIN, SUPER_ADMIN
Μόνο διαχειριστές.
:::
Μέση.
:::roles property_owner
Μόνο ιδιοκτήτες.
:::
Τέλος.`;

describe("filterRoleBlocks", () => {
  it("keeps blocks for a listed role and removes the fences", () => {
    const out = filterRoleBlocks(MD, "PROPERTY_ADMIN");
    expect(out).toContain("Μόνο διαχειριστές.");
    expect(out).not.toContain(":::");
    expect(out).not.toContain("Μόνο ιδιοκτήτες.");
  });
  it("is case-insensitive and keeps surrounding text", () => {
    const out = filterRoleBlocks(MD, "PROPERTY_OWNER");
    expect(out).toContain("Μόνο ιδιοκτήτες.");
    expect(out).not.toContain("Μόνο διαχειριστές.");
    expect(out).toContain("Intro για όλους.");
    expect(out).toContain("Μέση.");
    expect(out).toContain("Τέλος.");
  });
  it("leaves text unchanged when there are no blocks", () => {
    expect(filterRoleBlocks("plain\ntext", "ADMIN")).toBe("plain\ntext");
  });
});
