import { describe, it, expect } from "vitest";
import { urlPort, isPoolerUrl, resolveDbUrls, poolConfigFromEnv, redactUrl, POOLER_PORT } from "./db-url";

const POOLED = "postgres://giannis:secret@100.70.50.43:6432/propertymanagement?schema=public";
const DIRECT = "postgres://giannis:secret@100.70.50.43:5432/propertymanagement?schema=public";

describe("urlPort", () => {
  it("reads an explicit port", () => {
    expect(urlPort(POOLED)).toBe(6432);
    expect(urlPort(DIRECT)).toBe(5432);
  });
  it("defaults to 5432 when the URL has no port", () => {
    expect(urlPort("postgresql://u:p@db.local/app")).toBe(5432);
  });
  it("returns null for garbage", () => {
    expect(urlPort("")).toBeNull();
    expect(urlPort("not a url")).toBeNull();
  });
});

describe("isPoolerUrl", () => {
  it("is true on the PgBouncer port", () => {
    expect(POOLER_PORT).toBe(6432);
    expect(isPoolerUrl(POOLED)).toBe(true);
  });
  it("is true when pgbouncer=true is in the query even on another port", () => {
    expect(isPoolerUrl("postgres://u:p@h:5432/db?pgbouncer=true")).toBe(true);
  });
  it("is false for a direct URL", () => {
    expect(isPoolerUrl(DIRECT)).toBe(false);
    expect(isPoolerUrl("")).toBe(false);
  });
});

describe("resolveDbUrls", () => {
  it("uses DATABASE_URL for the app and DIRECT_URL for migrations", () => {
    const r = resolveDbUrls({ DATABASE_URL: POOLED, DIRECT_URL: DIRECT });
    expect(r.pooled).toBe(POOLED);
    expect(r.direct).toBe(DIRECT);
    expect(r.viaPooler).toBe(true);
    expect(r.warnings).toEqual([]);
  });
  it("falls back to DATABASE_URL for migrations and warns when the app URL is a pooler", () => {
    const r = resolveDbUrls({ DATABASE_URL: POOLED });
    expect(r.direct).toBe(POOLED);
    expect(r.viaPooler).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/DIRECT_URL/);
  });
  it("does not warn about a missing DIRECT_URL when the app connects directly", () => {
    const r = resolveDbUrls({ DATABASE_URL: DIRECT });
    expect(r.viaPooler).toBe(false);
    expect(r.direct).toBe(DIRECT);
    expect(r.warnings).toEqual([]);
  });
  it("warns when DIRECT_URL itself points at the pooler", () => {
    const r = resolveDbUrls({ DATABASE_URL: POOLED, DIRECT_URL: POOLED });
    expect(r.warnings.join(" ")).toMatch(/DIRECT_URL .*pooler/i);
  });
  it("warns when DATABASE_URL is missing and leaves both URLs empty", () => {
    const r = resolveDbUrls({});
    expect(r.pooled).toBe("");
    expect(r.direct).toBe("");
    expect(r.viaPooler).toBe(false);
    expect(r.warnings.join(" ")).toMatch(/DATABASE_URL/);
  });
});

describe("poolConfigFromEnv", () => {
  it("has the documented defaults", () => {
    expect(poolConfigFromEnv({})).toEqual({
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      application_name: "orithon-web",
    });
  });
  it("reads overrides from env", () => {
    const c = poolConfigFromEnv({ DB_POOL_MAX: "4", DB_POOL_IDLE_MS: "5000", DB_POOL_CONNECT_TIMEOUT_MS: "2000", DB_APPLICATION_NAME: "orithon-cron" });
    expect(c).toEqual({ max: 4, idleTimeoutMillis: 5000, connectionTimeoutMillis: 2000, application_name: "orithon-cron" });
  });
  it("clamps nonsense to a sane range", () => {
    expect(poolConfigFromEnv({ DB_POOL_MAX: "0" }).max).toBe(1);
    expect(poolConfigFromEnv({ DB_POOL_MAX: "9999" }).max).toBe(100);
    expect(poolConfigFromEnv({ DB_POOL_MAX: "abc" }).max).toBe(10);
    expect(poolConfigFromEnv({ DB_POOL_IDLE_MS: "-1" }).idleTimeoutMillis).toBe(1_000); // below the floor → floor
    expect(poolConfigFromEnv({ DB_POOL_IDLE_MS: "" }).idleTimeoutMillis).toBe(30_000); // empty → default
  });
});

describe("redactUrl", () => {
  it("hides the password but keeps host, port and database", () => {
    expect(redactUrl(POOLED)).toBe("postgres://giannis:***@100.70.50.43:6432/propertymanagement?schema=public");
  });
  it("leaves URLs without credentials alone and survives garbage", () => {
    expect(redactUrl("postgres://h:6432/db")).toBe("postgres://h:6432/db");
    expect(redactUrl("not a url")).toBe("not a url");
  });
});
