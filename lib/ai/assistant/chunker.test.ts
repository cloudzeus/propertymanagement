import { describe, it, expect } from "vitest";
import { chunkMarkdown, planChunkSync } from "./chunker";

const META = { slug: "portal-payments", title: "Λογαριασμοί", route: "/portal/payments", surface: "customer" as const, roles: ["PROPERTY_OWNER"] };

describe("chunkMarkdown", () => {
  it("splits on H2 with a preamble chunk and deterministic anchors/hashes", () => {
    const md = "Εισαγωγή.\n\n## Τι βλέπετε εδώ\nΚείμενο Α.\n\n## Βήμα-βήμα\n1. Πατήστε «Πληρωμή».\n";
    const a = chunkMarkdown(md, META);
    const b = chunkMarkdown(md, META);
    expect(a.map((c) => c.anchor)).toEqual(["intro", "τι-βλέπετε-εδώ", "βήμα-βήμα"]);
    expect(a[1].heading).toBe("Τι βλέπετε εδώ");
    expect(a[1].content.startsWith("Λογαριασμοί › Τι βλέπετε εδώ")).toBe(true);
    expect(a[1].hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.map((c) => c.hash)).toEqual(b.map((c) => c.hash));
    expect(a[0]).toMatchObject({ slug: "portal-payments", route: "/portal/payments", roles: ["PROPERTY_OWNER"], surface: "customer" });
  });
  it("splits a long section by H3 then paragraphs with numbered anchors", () => {
    const long = "## Μεγάλο\n" + "### Α\n" + "x".repeat(900) + "\n\n### Β\n" + "y".repeat(900) + "\n\n" + "z".repeat(900) + "\n";
    const chunks = chunkMarkdown(long, META);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.every((c) => c.content.length <= 1400)).toBe(true);
    expect(new Set(chunks.map((c) => c.anchor)).size).toBe(chunks.length);
    expect(chunks[1].anchor).toBe("μεγάλο-2");
  });
  it("emits :::roles blocks as separate chunks restricted to the block's roles", () => {
    const md = "## Α\nΓια όλους.\n:::roles PROPERTY_ADMIN\nΜόνο διαχειριστές.\n:::\nΚαι πάλι για όλους.\n";
    const chunks = chunkMarkdown(md, { ...META, roles: ["PROPERTY_ADMIN", "PROPERTY_OWNER"] });
    const shared = chunks.filter((c) => c.roles.includes("PROPERTY_OWNER"));
    const mgr = chunks.filter((c) => !c.roles.includes("PROPERTY_OWNER"));
    expect(shared.map((c) => c.content).join("\n")).toContain("Για όλους.");
    expect(shared.map((c) => c.content).join("\n")).toContain("Και πάλι για όλους.");
    expect(shared.map((c) => c.content).join("\n")).not.toContain("Μόνο διαχειριστές.");
    expect(mgr).toHaveLength(1);
    expect(mgr[0].roles).toEqual(["PROPERTY_ADMIN"]);
    expect(mgr[0].content).toContain("Μόνο διαχειριστές.");
    expect(chunks.every((c) => !c.content.includes(":::"))).toBe(true);
    expect(new Set(chunks.map((c) => c.anchor)).size).toBe(chunks.length);
  });
  it("keeps a role block that spans several H2 sections restricted in every section it covers", () => {
    const md = "## Τι βλέπετε εδώ\nΓια όλους.\n:::roles PROPERTY_ADMIN\n## Επισκόπηση\nΜόνο διαχειριστές Α.\n## Οικονομικά\nΜόνο διαχειριστές Β.\n:::\n## Ως ένοικος\nΓια ενοίκους.\n";
    const chunks = chunkMarkdown(md, { ...META, roles: ["PROPERTY_ADMIN", "PROPERTY_RESIDENT"] });
    const byHeading = Object.fromEntries(chunks.map((c) => [c.heading, c.roles]));
    expect(byHeading["Τι βλέπετε εδώ"]).toEqual(["PROPERTY_ADMIN", "PROPERTY_RESIDENT"]);
    expect(byHeading["Επισκόπηση"]).toEqual(["PROPERTY_ADMIN"]);
    expect(byHeading["Οικονομικά"]).toEqual(["PROPERTY_ADMIN"]);
    expect(byHeading["Ως ένοικος"]).toEqual(["PROPERTY_ADMIN", "PROPERTY_RESIDENT"]);
  });
  it("changes the hash when only the roles change, so the index re-syncs", () => {
    const md = "## Α\nΚείμενο.\n";
    const a = chunkMarkdown(md, { ...META, roles: ["PROPERTY_OWNER"] })[0];
    const b = chunkMarkdown(md, { ...META, roles: ["PROPERTY_ADMIN"] })[0];
    expect(a.hash).not.toBe(b.hash);
  });
  it("uses the block's roles when the article is open to everyone", () => {
    const chunks = chunkMarkdown("## Α\n:::roles SUPER_ADMIN, ADMIN\nΜόνο στελέχη.\n:::\n", { ...META, roles: [] });
    expect(chunks[0].roles).toEqual(["SUPER_ADMIN", "ADMIN"]);
  });
});

describe("planChunkSync", () => {
  it("classifies changed, unchanged and orphaned anchors", () => {
    const next = [{ anchor: "a", hash: "1" }, { anchor: "b", hash: "2new" }, { anchor: "c", hash: "3" }].map((x) => ({ ...x, slug: "s", title: "t", heading: null, route: null, surface: null, roles: [], content: "" }));
    const plan = planChunkSync([{ anchor: "a", hash: "1" }, { anchor: "b", hash: "2" }, { anchor: "gone", hash: "9" }], next);
    expect(plan.toEmbed.map((c) => c.anchor)).toEqual(["b", "c"]);
    expect(plan.unchanged).toEqual(["a"]);
    expect(plan.toDelete).toEqual(["gone"]);
  });
});
