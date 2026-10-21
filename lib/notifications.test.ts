import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ rows: [] as unknown[], push: vi.fn(async () => {}) }));
vi.mock("@/lib/db", () => ({
  db: { notification: { createMany: vi.fn(async ({ data }: { data: unknown[] }) => { m.rows.push(...data); return { count: data.length }; }) } },
}));
vi.mock("@/lib/push/send", () => ({ sendPushToUsers: m.push }));

import { createNotifications } from "./notifications";

beforeEach(() => { m.rows.length = 0; vi.clearAllMocks(); });

describe("createNotifications", () => {
  it("writes the rows and fans out a push for the same rows", async () => {
    const rows = [
      { userId: "u1", type: "RFQ", title: "t", body: "b", href: "/x", requestId: null },
      { userId: "u2", type: "RFQ", title: "t", body: null, href: "/y", requestId: "r1" },
    ];
    await createNotifications(rows);
    expect(m.rows).toEqual(rows);
    await new Promise((r) => setTimeout(r, 0));
    expect(m.push).toHaveBeenCalledWith(rows);
  });
  it("skips both the write and the push for an empty list", async () => {
    await createNotifications([]);
    expect(m.rows).toHaveLength(0);
    expect(m.push).not.toHaveBeenCalled();
  });
  it("a rejected push never reaches the caller", async () => {
    m.push.mockRejectedValueOnce(new Error("push down"));
    await expect(createNotifications([{ userId: "u1", type: "X", title: "t", href: "/x" }])).resolves.toBeUndefined();
    await new Promise((r) => setTimeout(r, 0));
  });
});
