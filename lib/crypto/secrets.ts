import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) throw new Error("SECRETS_ENCRYPTION_KEY is not set");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("SECRETS_ENCRYPTION_KEY must be 32 bytes (base64)");
  return k;
}

/** AES-256-GCM → base64 "iv.tag.ciphertext". */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

export function decryptSecret(enc: string): string {
  const [ivB, tagB, ctB] = enc.split(".");
  if (!ivB || !tagB || !ctB) throw new Error("Malformed secret");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
}

/** "••••1234" — last 4 chars of the decrypted value, for display. */
export function maskSecret(enc: string): string {
  try { const v = decryptSecret(enc); return `••••${v.slice(-4)}`; } catch { return "••••"; }
}
