import { describe, it, expect } from "vitest";
import { resolveAnnouncementCustomer } from "./targets";

const staff = { seesAllCustomers: true, customerId: null } as const;
const admin = { seesAllCustomers: false, customerId: "cA" } as const;

describe("resolveAnnouncementCustomer", () => {
  it("single-customer targets → that customer for staff", () => {
    expect(resolveAnnouncementCustomer(staff, ["cA", "cA"])).toEqual({ ok: true, customerId: "cA" });
  });
  it("multi-customer targets → null (broadcast) for staff", () => {
    expect(resolveAnnouncementCustomer(staff, ["cA", "cB"])).toEqual({ ok: true, customerId: null });
  });
  it("PROPERTY_ADMIN targeting only their customer → ok", () => {
    expect(resolveAnnouncementCustomer(admin, ["cA", "cA"])).toEqual({ ok: true, customerId: "cA" });
  });
  it("PROPERTY_ADMIN targeting another customer → rejected", () => {
    expect(resolveAnnouncementCustomer(admin, ["cA", "cB"])).toEqual({ ok: false, reason: "cross-customer" });
  });
  it("no targets → rejected", () => {
    expect(resolveAnnouncementCustomer(staff, [])).toEqual({ ok: false, reason: "no-targets" });
  });
});
