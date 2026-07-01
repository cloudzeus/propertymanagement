import { describe, it, expect } from "vitest";
import { normalizeFeatureItems } from "./features";

const ICONS = ["ri-home", "ri-wallet", "ri-tools"];

describe("normalizeFeatureItems", () => {
  it("keeps valid items and coerces unknown icons to the fallback", () => {
    const out = normalizeFeatureItems(
      [
        { icon: "ri-wallet", title: "Payments", body: "Pay online." },
        { icon: "nonsense", title: "Tasks", body: "Track repairs." },
      ],
      ICONS,
      "ri-home",
    );
    expect(out).toEqual([
      { icon: "ri-wallet", title: "Payments", body: "Pay online." },
      { icon: "ri-home", title: "Tasks", body: "Track repairs." },
    ]);
  });

  it("drops items without a title and trims strings", () => {
    const out = normalizeFeatureItems(
      [{ icon: "ri-home", title: "  ok  ", body: "  b  " }, { icon: "ri-home", title: "", body: "x" }],
      ICONS,
      "ri-home",
    );
    expect(out).toEqual([{ icon: "ri-home", title: "ok", body: "b" }]);
  });
});
