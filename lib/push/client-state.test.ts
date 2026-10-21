import { describe, it, expect } from "vitest";
import { decidePushState, urlBase64ToUint8Array, type PushStateInput } from "./client-state";

const base: PushStateInput = {
  hasServiceWorker: true, hasPushManager: true, hasNotification: true, hasPublicKey: true,
  permission: "default", subscribed: false, isIOS: false, standalone: false,
};

describe("decidePushState", () => {
  it.each<[string, Partial<PushStateInput>, string]>([
    ["no service worker", { hasServiceWorker: false }, "unsupported"],
    ["no PushManager", { hasPushManager: false }, "unsupported"],
    ["no Notification API", { hasNotification: false }, "unsupported"],
    ["no VAPID public key in the build", { hasPublicKey: false }, "unconfigured"],
    ["iOS Safari not installed", { isIOS: true }, "ios-install"],
    ["iOS installed to the home screen", { isIOS: true, standalone: true }, "off"],
    ["permission denied", { permission: "denied" }, "denied"],
    ["denied wins over a stale subscription", { permission: "denied", subscribed: true }, "denied"],
    ["granted + subscribed", { permission: "granted", subscribed: true }, "on"],
    ["granted but not subscribed", { permission: "granted" }, "off"],
    ["default permission", {}, "off"],
    ["unsupported wins over everything", { hasPushManager: false, permission: "denied", subscribed: true }, "unsupported"],
  ])("%s → %s", (_n, patch, expected) => {
    expect(decidePushState({ ...base, ...patch })).toBe(expected);
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes a url-safe base64 VAPID key into bytes", () => {
    const bytes = urlBase64ToUint8Array("AQID_-8");
    expect(Array.from(bytes)).toEqual([1, 2, 3, 255, 239]);
  });
  it("accepts an unpadded 87-char key (the usual P-256 public key length) and yields 65 bytes", () => {
    const key = "B".repeat(87);
    expect(urlBase64ToUint8Array(key)).toHaveLength(65);
  });
});
