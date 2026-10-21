import { describe, it, expect } from "vitest";
import { callAction, ACTION_FAILED } from "./client-actions";

describe("callAction", () => {
  it("passes through a business result", async () => {
    expect(await callAction(async () => ({ ok: true }))).toEqual({ ok: true });
    expect(await callAction(async () => ({ error: "Δεν επιτρέπεται" }))).toEqual({ error: "Δεν επιτρέπεται" });
  });
  it("turns a thrown error into an error result instead of an unhandled rejection", async () => {
    expect(await callAction(async () => { throw new Error("Unauthorized"); })).toEqual({ error: ACTION_FAILED });
  });
});
