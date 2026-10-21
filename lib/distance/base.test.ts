import { describe, it, expect, vi } from "vitest";

const m = vi.hoisted(() => ({ company: null as null | Record<string, unknown> }));
vi.mock("@/lib/db", () => ({ db: { company: { findFirst: vi.fn(async () => m.company) } } }));

import { getBaseStation, baseKey } from "./base";

describe("getBaseStation", () => {
  it("is null without a company or without coordinates", async () => {
    m.company = null;
    expect(await getBaseStation()).toBeNull();
    m.company = { lat: null, lng: null, address: "x", city: null, postalCode: null };
    expect(await getBaseStation()).toBeNull();
  });
  it("returns coords, address and key", async () => {
    m.company = { lat: 37.98, lng: 23.73, address: "Αθηνάς 1", city: "Αθήνα", postalCode: "10551" };
    expect(await getBaseStation()).toEqual({ lat: 37.98, lng: 23.73, address: "Αθηνάς 1, 10551 Αθήνα", key: "379800,237300" });
  });
  it("baseKey matches coordKey rounding", () => expect(baseKey({ lat: 37.98123456, lng: 23.73 })).toBe("379812,237300"));
});
