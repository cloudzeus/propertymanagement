import { describe, it, expect, vi } from "vitest";
import { decideBanner, isIOSUserAgent, readState, snooze, markInstalled, SNOOZE_DAYS, STORAGE_KEYS } from "./install-banner";

const NOW = new Date("2026-10-21T10:00:00Z");
const base = { isPhone: true, standalone: false, installed: false, snoozedUntil: null as Date | null, now: NOW, isIOS: false, hasNativePrompt: false };
const day = 24 * 3600 * 1000;

describe("decideBanner", () => {
  it.each([
    ["desktop", { isPhone: false, hasNativePrompt: true }, "hidden"],
    ["already standalone", { standalone: true, hasNativePrompt: true }, "hidden"],
    ["installed earlier", { installed: true, hasNativePrompt: true }, "hidden"],
    ["snoozed until tomorrow", { snoozedUntil: new Date(NOW.getTime() + day), hasNativePrompt: true }, "hidden"],
    ["snooze expired yesterday + prompt", { snoozedUntil: new Date(NOW.getTime() - day), hasNativePrompt: true }, "native"],
    ["android with prompt", { hasNativePrompt: true }, "native"],
    ["iOS without prompt", { isIOS: true }, "ios"],
    ["android without prompt (not installable yet)", {}, "hidden"],
    ["iOS with a prompt uses the prompt", { isIOS: true, hasNativePrompt: true }, "native"],
  ])("%s → %s", (_label, patch, expected) => {
    expect(decideBanner({ ...base, ...patch })).toBe(expected);
  });
});

describe("isIOSUserAgent", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
  const ipad = "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15";
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";
  it("detects iPhone and iPad", () => {
    expect(isIOSUserAgent(iphone)).toBe(true);
    expect(isIOSUserAgent(ipad)).toBe(true);
  });
  it("treats a Macintosh UA with touch points as iPadOS", () => {
    expect(isIOSUserAgent(mac, 5)).toBe(true);
    expect(isIOSUserAgent(mac, 0)).toBe(false);
  });
  it("is false for Android", () => expect(isIOSUserAgent(android, 5)).toBe(false));
});

describe("storage helpers", () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m }; };
  it("snooze writes now + 30 days and readState parses it back", () => {
    const s = mem();
    const until = snooze(s, NOW);
    expect(SNOOZE_DAYS).toBe(30);
    expect(until.getTime()).toBe(NOW.getTime() + 30 * day);
    expect(s.m.get(STORAGE_KEYS.snoozedUntil)).toBe(until.toISOString());
    expect(readState(s)).toEqual({ installed: false, snoozedUntil: until });
  });
  it("markInstalled is read back as installed", () => {
    const s = mem();
    markInstalled(s);
    expect(readState(s).installed).toBe(true);
  });
  it("readState(null) and a throwing storage give the empty state", () => {
    expect(readState(null)).toEqual({ installed: false, snoozedUntil: null });
    const throwing = { getItem: vi.fn(() => { throw new Error("SecurityError"); }) };
    expect(readState(throwing)).toEqual({ installed: false, snoozedUntil: null });
  });
  it("readState ignores a malformed snoozedUntil", () => {
    const s = mem(); s.setItem(STORAGE_KEYS.snoozedUntil, "garbage");
    expect(readState(s).snoozedUntil).toBeNull();
  });
  it("snooze/markInstalled swallow storage errors and snooze still returns the date", () => {
    const throwing = { setItem: vi.fn(() => { throw new Error("QuotaExceeded"); }) };
    expect(snooze(throwing, NOW).getTime()).toBe(NOW.getTime() + 30 * day);
    expect(() => markInstalled(throwing)).not.toThrow();
    expect(snooze(null, NOW)).toBeInstanceOf(Date);
  });
});
