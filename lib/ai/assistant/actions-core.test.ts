import { describe, it, expect } from "vitest";
import { canConfirm, PROPOSAL_TTL_MS } from "./actions-core";

const now = new Date("2026-10-20T10:00:00Z");
const log = (over: Partial<{ userId: string; status: string; expiresAt: Date }> = {}) => ({ userId: "u1", status: "PROPOSED", expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS), ...over });

describe("canConfirm", () => {
  it("accepts the owner's live proposal", () => {
    expect(canConfirm(log(), "u1", now)).toEqual({ ok: true });
  });
  it("refuses another user", () => {
    expect(canConfirm(log(), "u2", now)).toMatchObject({ ok: false, reason: "not_owner" });
  });
  it("refuses a proposal that is no longer PROPOSED", () => {
    expect(canConfirm(log({ status: "EXECUTED" }), "u1", now)).toMatchObject({ ok: false, reason: "not_proposed", message: "Η ενέργεια έχει ήδη εκτελεστεί ή ακυρωθεί." });
  });
  it("refuses an expired proposal", () => {
    expect(canConfirm(log({ expiresAt: new Date(now.getTime() - 1) }), "u1", now)).toMatchObject({ ok: false, reason: "expired", message: "Η πρόταση έληξε — ζητήστε την ξανά από τον βοηθό." });
  });
  it("uses a 15-minute TTL", () => {
    expect(PROPOSAL_TTL_MS).toBe(15 * 60 * 1000);
  });
});
