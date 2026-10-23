import { describe, it, expect } from "vitest";
import { EXAMPLE_STEP_KEY, formatSeconds, stepLabel, withExampleStep } from "./flow";

describe("guided flow helpers", () => {
  it("appends the example step last with the default title", () => {
    const steps = withExampleStep([{ key: "a", title: "A" }, { key: "b", title: "B" }], { title: undefined });
    expect(steps.map((s) => s.key)).toEqual(["a", "b", EXAMPLE_STEP_KEY]);
    expect(steps[2].title).toBe("Παράδειγμα εφαρμογής");
    expect(steps[2].isExample).toBe(true);
  });
  it("keeps steps unchanged without an example", () => {
    const steps = withExampleStep([{ key: "a", title: "A" }], null);
    expect(steps).toHaveLength(1);
    expect(steps[0].isExample).toBe(false);
  });
  it("uses a custom example title", () => {
    const none: { key: string; title: string }[] = [];
    expect(withExampleStep(none, { title: "Τι θα δείτε" })[0].title).toBe("Τι θα δείτε");
  });
  it("labels steps in Greek, 1-based", () => {
    expect(stepLabel(0, 4)).toBe("Βήμα 1 από 4");
    expect(stepLabel(3, 4)).toBe("Βήμα 4 από 4");
  });
  it("formats seconds as m′ss″", () => {
    expect(formatSeconds(80)).toBe("1′20″");
    expect(formatSeconds(59)).toBe("0′59″");
    expect(formatSeconds(125.6)).toBe("2′06″");
  });
});
