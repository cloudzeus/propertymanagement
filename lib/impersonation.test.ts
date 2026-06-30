import { describe, it, expect } from "vitest";
import { parseImpersonation, serializeImpersonation, IMPERSONATION_COOKIE } from "./impersonation";

const sample = { actorId: "a1", targetUserId: "u2", targetRole: "PROPERTY_OWNER" as const };

describe("impersonation cookie codec", () => {
  it("round-trips", () => {
    expect(parseImpersonation(serializeImpersonation(sample))).toEqual(sample);
  });
  it("returns null on garbage", () => {
    expect(parseImpersonation("not-json")).toBeNull();
    expect(parseImpersonation("")).toBeNull();
    expect(parseImpersonation(undefined)).toBeNull();
  });
  it("returns null when required fields missing", () => {
    expect(parseImpersonation(JSON.stringify({ actorId: "a1" }))).toBeNull();
  });
  it("exposes a cookie name", () => {
    expect(IMPERSONATION_COOKIE).toBe("impersonation");
  });
});
