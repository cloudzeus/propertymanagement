import { describe, it, expect } from "vitest";
import { DEFAULT_API_COSTS } from "./api-costs";

describe("DEFAULT_API_COSTS", () => {
  it("has per-minute pricing for daily and deepgram", () => {
    expect(DEFAULT_API_COSTS.daily.costModel).toBe("per_minute");
    expect(DEFAULT_API_COSTS.deepgram.costModel).toBe("per_minute");
    expect(typeof DEFAULT_API_COSTS.daily.basePrice).toBe("number");
    expect(typeof DEFAULT_API_COSTS.deepgram.basePrice).toBe("number");
  });
});
