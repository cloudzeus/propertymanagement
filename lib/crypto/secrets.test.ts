import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => { process.env.SECRETS_ENCRYPTION_KEY = randomBytes(32).toString("base64"); });

describe("secrets crypto", () => {
  it("round-trips", async () => {
    const { encryptSecret, decryptSecret } = await import("./secrets");
    const enc = encryptSecret("viva-api-key-123");
    expect(enc).not.toContain("viva-api-key-123");
    expect(decryptSecret(enc)).toBe("viva-api-key-123");
  });
  it("rejects a tampered ciphertext", async () => {
    const { encryptSecret, decryptSecret } = await import("./secrets");
    const enc = encryptSecret("secret");
    const bad = enc.slice(0, -4) + (enc.endsWith("A") ? "B" : "A") + enc.slice(-3);
    expect(() => decryptSecret(bad)).toThrow();
  });
  it("masks", async () => {
    const { encryptSecret, maskSecret } = await import("./secrets");
    expect(maskSecret(encryptSecret("abcd1234"))).toMatch(/1234$/);
  });
});
