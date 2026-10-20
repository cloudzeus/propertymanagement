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
  it("strips :::roles fences but keeps their text", () => {
    const chunks = chunkMarkdown("## Α\n:::roles PROPERTY_ADMIN\nΜόνο εσείς.\n:::\n", META);
    expect(chunks[0].content).toContain("Μόνο εσείς.");
    expect(chunks[0].content).not.toContain(":::");
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
