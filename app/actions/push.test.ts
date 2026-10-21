import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string }; impersonatorId: string | null },
  upserts: [] as unknown[],
  deletes: [] as unknown[],
}));
vi.mock("@/lib/auth-effective", () => ({ getEffectiveSession: async () => m.session }));
vi.mock("@/lib/db", () => ({
  db: {
    pushSubscription: {
      upsert: vi.fn(async (args: unknown) => { m.upserts.push(args); return { id: "s1" }; }),
      deleteMany: vi.fn(async (args: unknown) => { m.deletes.push(args); return { count: 1 }; }),
    },
  },
}));

import { subscribePush, unsubscribePush } from "./push";

const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BPxkeyKEY_-", auth: "authKEY_-" } };

beforeEach(() => {
  m.session = { user: { id: "u1", role: "PROPERTY_ADMIN" }, impersonatorId: null };
  m.upserts.length = 0; m.deletes.length = 0;
  vi.clearAllMocks();
});

describe("subscribePush", () => {
  it("upserts by endpoint and binds the row to the effective user (re-binding a shared device)", async () => {
    const r = await subscribePush(sub, "Mozilla/5.0 (Android)");
    expect(r).toEqual({ ok: true });
    expect(m.upserts[0]).toEqual({
      where: { endpoint: sub.endpoint },
      create: { userId: "u1", endpoint: sub.endpoint, p256dh: "BPxkeyKEY_-", auth: "authKEY_-", userAgent: "Mozilla/5.0 (Android)" },
      update: { userId: "u1", p256dh: "BPxkeyKEY_-", auth: "authKEY_-", userAgent: "Mozilla/5.0 (Android)", lastUsedAt: null },
    });
  });
  it("rejects when not signed in", async () => {
    m.session = null;
    expect(await subscribePush(sub)).toEqual({ ok: false, reason: "unauthorized" });
    expect(m.upserts).toHaveLength(0);
  });
  it("rejects while the super-admin is viewing as another user (the device is theirs, not the target's)", async () => {
    m.session = { user: { id: "target", role: "PROPERTY_ADMIN" }, impersonatorId: "sa1" };
    expect(await subscribePush(sub)).toEqual({ ok: false, reason: "impersonating" });
    expect(m.upserts).toHaveLength(0);
  });
  it("rejects a non-https endpoint and malformed keys", async () => {
    expect(await subscribePush({ ...sub, endpoint: "http://evil/x" })).toEqual({ ok: false, reason: "invalid" });
    expect(await subscribePush({ ...sub, keys: { p256dh: "has space", auth: "a" } })).toEqual({ ok: false, reason: "invalid" });
    expect(await subscribePush({ ...sub, endpoint: "https://x/" + "a".repeat(3000) })).toEqual({ ok: false, reason: "invalid" });
    expect(m.upserts).toHaveLength(0);
  });
  it("truncates an over-long user agent instead of failing", async () => {
    await subscribePush(sub, "U".repeat(1000));
    expect((m.upserts[0] as { create: { userAgent: string } }).create.userAgent).toHaveLength(255);
  });
});

describe("unsubscribePush", () => {
  it("deletes only the current user's row for that endpoint", async () => {
    expect(await unsubscribePush(sub.endpoint)).toEqual({ ok: true });
    expect(m.deletes[0]).toEqual({ where: { endpoint: sub.endpoint, userId: "u1" } });
  });
  it("is a no-op without a session", async () => {
    m.session = null;
    expect(await unsubscribePush(sub.endpoint)).toEqual({ ok: false, reason: "unauthorized" });
    expect(m.deletes).toHaveLength(0);
  });
});
