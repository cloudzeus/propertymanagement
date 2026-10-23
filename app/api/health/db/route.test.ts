import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const m = vi.hoisted(() => ({ eff: vi.fn(), queryRaw: vi.fn() }));
vi.mock("@/lib/auth-effective", () => ({ getEffectiveSession: m.eff }));
vi.mock("@/lib/db", () => ({ db: { $queryRaw: m.queryRaw } }));

import { GET } from "./route";

const backend = { pid: 4242, port: 5432, app: "orithon-web", user: "giannis", db: "propertymanagement", version: "PostgreSQL 16.4 on x86_64-pc-linux-gnu" };
const get = (headers: Record<string, string> = {}) =>
  GET(new Request("http://x/api/health/db", { headers }) as never);

const ENV = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = "postgres://giannis:pw@100.70.50.43:6432/propertymanagement?schema=public";
  process.env.HEALTH_TOKEN = "t0k3n";
  m.eff.mockResolvedValue(null);
  m.queryRaw.mockResolvedValueOnce([backend]).mockResolvedValueOnce([{ n: 3 }]);
});
afterEach(() => {
  process.env = { ...ENV };
});

describe("GET /api/health/db", () => {
  it("answers 401 to anonymous callers and to a wrong token, without touching the database", async () => {
    expect((await get()).status).toBe(401);
    expect((await get({ "x-health-token": "nope" })).status).toBe(401);
    expect(m.queryRaw).not.toHaveBeenCalled();
  });
  it("accepts the health token and reports a pooled connection with a redacted URL", async () => {
    const res = await get({ "x-health-token": "t0k3n" });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.viaPooler).toBe(true);
    expect(j.url).toBe("postgres://giannis:***@100.70.50.43:6432/propertymanagement?schema=public");
    expect(j.poolMax).toBe(10);
    expect(j.backend).toEqual({ pid: 4242, serverPort: 5432, applicationName: "orithon-web", user: "giannis", database: "propertymanagement", version: "PostgreSQL 16.4" });
    expect(j.serverConnections).toBe(3);
    expect(typeof j.latencyMs).toBe("number");
  });
  it("accepts the REAL super-admin session, even while impersonating someone else", async () => {
    m.eff.mockResolvedValue({ user: { id: "o1", role: "PROPERTY_OWNER" }, real: { id: "sa", role: "SUPER_ADMIN" }, impersonatorId: "sa" });
    expect((await get()).status).toBe(200);
  });
  it("rejects a non-super-admin session", async () => {
    m.eff.mockResolvedValue({ user: { id: "a1", role: "ADMIN" }, real: { id: "a1", role: "ADMIN" }, impersonatorId: null });
    expect((await get()).status).toBe(401);
    expect(m.queryRaw).not.toHaveBeenCalled();
  });
  it("ignores the token check when HEALTH_TOKEN is unset", async () => {
    delete process.env.HEALTH_TOKEN;
    expect((await get({ "x-health-token": "" })).status).toBe(401);
    expect((await get({ "x-health-token": "anything" })).status).toBe(401);
  });
  it("reports viaPooler=false on a direct URL", async () => {
    process.env.DATABASE_URL = "postgres://giannis:pw@100.70.50.43:5432/propertymanagement";
    const j = await (await get({ "x-health-token": "t0k3n" })).json();
    expect(j.viaPooler).toBe(false);
  });
  it("answers 503 with a generic message when the database is unreachable", async () => {
    m.queryRaw.mockReset().mockRejectedValue(new Error("connect ECONNREFUSED 100.70.50.43:6432 password=pw"));
    const res = await get({ "x-health-token": "t0k3n" });
    expect(res.status).toBe(503);
    const j = await res.json();
    expect(j.ok).toBe(false);
    expect(j.error).toBe("database unreachable");
    expect(JSON.stringify(j)).not.toContain("password=pw");
  });
});
