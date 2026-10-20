import { describe, it, expect } from "vitest";
import { headingId, anchorForTab } from "./anchors";

const md = `## Τι βλέπετε εδώ\nΚείμενο.\n## Οικονομικά\n- Έξοδα\n### Κοινόχρηστα & πληρωμές\nΚείμενο.\n## Συχνές ερωτήσεις`;

describe("headingId", () => {
  it("makes a stable, URL-safe id from a Greek heading", () => {
    expect(headingId("Οικονομικά")).toBe("οικονομικά");
    expect(headingId("Κοινόχρηστα & πληρωμές")).toBe("κοινόχρηστα-πληρωμές");
    expect(headingId("  Τι βλέπετε εδώ; ")).toBe("τι-βλέπετε-εδώ");
  });
});

describe("anchorForTab", () => {
  const sections = ["finance: Οικονομικά", "koino: Κοινόχρηστα & πληρωμές", "ghost: Ανύπαρκτη ενότητα"];
  it("maps a tab key to the id of the heading named in the article's sections", () => {
    expect(anchorForTab(md, sections, "finance")).toBe("οικονομικά");
    expect(anchorForTab(md, sections, "koino")).toBe("κοινόχρηστα-πληρωμές");
  });
  it("returns null for unknown tabs, headings missing from the (role-filtered) markdown, or no tab", () => {
    expect(anchorForTab(md, sections, "people")).toBeNull();
    expect(anchorForTab(md, sections, "ghost")).toBeNull();
    expect(anchorForTab(md, sections, "")).toBeNull();
    expect(anchorForTab(md, [], "finance")).toBeNull();
  });
});
