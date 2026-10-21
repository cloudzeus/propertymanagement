import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ rows: [] as unknown[], mail: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findMany: vi.fn(async () => [{ id: "u1", email: "a@x.gr" }, { id: "u2", email: "b@x.gr" }]) },
  },
}));
vi.mock("@/lib/notifications", () => ({ createNotifications: vi.fn(async (rows: unknown[]) => { m.rows.push(...rows); }) }));
vi.mock("@/lib/mailgun", () => ({ sendNotificationEmail: m.mail }));

import { notifyUsers } from "./notify";

beforeEach(() => { m.rows.length = 0; vi.clearAllMocks(); });

describe("notifyUsers", () => {
  it("writes a bell row and e-mails every active recipient by default", async () => {
    await notifyUsers(["u1", "u2"], { type: "RFQ", title: "t", href: "/x" });
    expect(m.rows).toHaveLength(2);
    await new Promise((r) => setTimeout(r, 0));
    expect(m.mail).toHaveBeenCalledTimes(2);
  });
  it("email: false keeps the bell row and sends no mail (the caller already sent a branded one)", async () => {
    await notifyUsers(["u1", "u2"], { type: "RFQ", title: "t", href: "/x", email: false });
    expect(m.rows).toHaveLength(2);
    await new Promise((r) => setTimeout(r, 0));
    expect(m.mail).not.toHaveBeenCalled();
  });
});
