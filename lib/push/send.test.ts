import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const m = vi.hoisted(() => ({
  subs: [] as { id: string; userId: string; endpoint: string; p256dh: string; auth: string }[],
  deleted: [] as unknown[],
  updated: [] as unknown[],
  send: vi.fn(),
  setVapid: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    pushSubscription: {
      findMany: vi.fn(async ({ where }: { where: { userId: { in: string[] } } }) => m.subs.filter((s) => where.userId.in.includes(s.userId))),
      deleteMany: vi.fn(async (args: unknown) => { m.deleted.push(args); return { count: 1 }; }),
      updateMany: vi.fn(async (args: unknown) => { m.updated.push(args); return { count: 1 }; }),
    },
  },
}));
vi.mock("web-push", () => ({ default: { setVapidDetails: m.setVapid, sendNotification: m.send } }));

import { buildPushPayload, fanOut, isPushConfigured, sendPushToUsers, sendPushToUser, __resetPushForTests } from "./send";

const ENV = { NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:x@y.gr" };
const gone = (status: number) => Object.assign(new Error("gone"), { statusCode: status });

beforeEach(() => {
  m.subs = [
    { id: "s1", userId: "u1", endpoint: "https://push/a", p256dh: "k1", auth: "a1" },
    { id: "s2", userId: "u1", endpoint: "https://push/b", p256dh: "k2", auth: "a2" },
    { id: "s3", userId: "u2", endpoint: "https://push/c", p256dh: "k3", auth: "a3" },
  ];
  m.deleted.length = 0; m.updated.length = 0;
  vi.clearAllMocks();
  Object.assign(process.env, ENV);
  __resetPushForTests();
});
afterEach(() => { for (const k of Object.keys(ENV)) delete process.env[k]; });

describe("buildPushPayload", () => {
  it("serialises title/body/href with tag = href and truncates a long body", () => {
    const p = JSON.parse(buildPushPayload({ title: "Τίτλος", body: "x".repeat(500), href: "/portal/requests/1" }));
    expect(p.title).toBe("Τίτλος");
    expect(p.body).toHaveLength(201); // 200 chars + ellipsis
    expect(p.body.endsWith("…")).toBe(true);
    expect(p.href).toBe("/portal/requests/1");
    expect(p.tag).toBe("/portal/requests/1");
  });
  it("omits body when empty and falls back to /home for a missing href", () => {
    const p = JSON.parse(buildPushPayload({ title: "t", body: null, href: null }));
    expect(p.body).toBeUndefined();
    expect(p.href).toBe("/home");
  });
});

describe("fanOut", () => {
  const subs = [
    { endpoint: "https://push/a", p256dh: "k1", auth: "a1" },
    { endpoint: "https://push/b", p256dh: "k2", auth: "a2" },
    { endpoint: "https://push/c", p256dh: "k3", auth: "a3" },
  ];
  it("reports sent endpoints, marks 404/410 as gone and ignores other failures", async () => {
    const send = vi.fn(async (s: { endpoint: string }) => {
      if (s.endpoint.endsWith("/b")) throw gone(410);
      if (s.endpoint.endsWith("/c")) throw Object.assign(new Error("boom"), { statusCode: 500 });
    });
    const r = await fanOut(subs, "{}", send);
    expect(r.sent).toEqual(["https://push/a"]);
    expect(r.gone).toEqual(["https://push/b"]);
    expect(send).toHaveBeenCalledTimes(3);
  });
  it("treats 404 as gone too", async () => {
    const r = await fanOut(subs.slice(0, 1), "{}", async () => { throw gone(404); });
    expect(r.gone).toEqual(["https://push/a"]);
  });
});

describe("isPushConfigured", () => {
  it("is true only when all three VAPID env vars are set", () => {
    expect(isPushConfigured()).toBe(true);
    delete process.env.VAPID_PRIVATE_KEY;
    expect(isPushConfigured()).toBe(false);
  });
});

describe("sendPushToUsers", () => {
  it("sends one push per subscription of each recipient with the row's own payload", async () => {
    m.send.mockResolvedValue({ statusCode: 201 });
    await sendPushToUsers([
      { userId: "u1", title: "A", body: "a", href: "/x" },
      { userId: "u2", title: "B", body: null, href: "/y" },
    ]);
    expect(m.setVapid).toHaveBeenCalledWith("mailto:x@y.gr", "pub", "priv");
    expect(m.send).toHaveBeenCalledTimes(3);
    const [sub, payload, opts] = m.send.mock.calls[0];
    expect(sub).toEqual({ endpoint: "https://push/a", keys: { p256dh: "k1", auth: "a1" } });
    expect(JSON.parse(payload).title).toBe("A");
    expect(opts.TTL).toBe(86_400);
    expect(JSON.parse(m.send.mock.calls[2][1]).title).toBe("B");
    expect(m.updated[0]).toMatchObject({ where: { endpoint: { in: ["https://push/a", "https://push/b", "https://push/c"] } } });
  });
  it("deletes subscriptions the push service reports as gone", async () => {
    m.send.mockImplementation(async (s: { endpoint: string }) => { if (s.endpoint.endsWith("/b")) throw gone(410); return { statusCode: 201 }; });
    await sendPushToUsers([{ userId: "u1", title: "A", body: null, href: "/x" }]);
    expect(m.deleted).toEqual([{ where: { endpoint: { in: ["https://push/b"] } } }]);
  });
  it("does nothing when VAPID is not configured", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    await sendPushToUsers([{ userId: "u1", title: "A", body: null, href: "/x" }]);
    expect(m.send).not.toHaveBeenCalled();
  });
  it("never throws, even when the database call fails", async () => {
    const { db } = await import("@/lib/db");
    (db.pushSubscription.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("db down"));
    await expect(sendPushToUsers([{ userId: "u1", title: "A", body: null, href: "/x" }])).resolves.toBeUndefined();
  });
  it("sendPushToUser is a one-recipient wrapper", async () => {
    m.send.mockResolvedValue({ statusCode: 201 });
    await sendPushToUser("u2", { title: "T", body: "b", href: "/z" });
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.send.mock.calls[0][0].endpoint).toBe("https://push/c");
  });
});
