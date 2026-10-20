import "server-only";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto/secrets";

/**
 * Resolved SoftOne Web Services connection — the installation Orithon talks to.
 *
 * Resolution order (same pattern as the provider-Viva config):
 *   1. DB (SoftoneSettings singleton) when enabled + serial + username + password + appId + company + refid
 *   2. env (SOFTONE_* or S1_*) fallback
 *   3. null when neither is configured
 *
 * The password is decrypted here only; it never leaves the server.
 */
export type SoftoneConfig = {
  source: "db" | "env";
  serial: string;
  url: string;
  appId: string;
  username: string;
  password: string;
  company: string;
  branch: string;
  module: string;
  refid: string;
};

export type SoftoneConnectionInput = {
  serial: string;
  appId: string;
  username: string;
  password: string;
  company: string;
  branch: string;
  module: string;
  refid: string;
};

export function urlForSerial(serial: string): string {
  const s = serial.trim().replace(/^https?:\/\//, "").replace(/\.oncloud\.gr.*$/i, "").replace(/\/.*$/, "");
  return s ? `https://${s}.oncloud.gr/s1services` : "";
}

export function envSoftoneConfig(): SoftoneConfig | null {
  const serial = process.env.SOFTONE_SERIAL ?? process.env.S1_SERIAL ?? "";
  const url = process.env.SOFTONE_URL ?? urlForSerial(serial);
  const cfg = {
    source: "env" as const,
    serial,
    url,
    appId: process.env.SOFTONE_APPID ?? process.env.S1_APP_ID ?? "",
    username: process.env.SOFTONE_USERNAME ?? process.env.S1_USERNAME ?? "",
    password: process.env.SOFTONE_PASSWORD ?? process.env.S1_PASSWORD ?? "",
    company: process.env.SOFTONE_COMPANY ?? process.env.S1_COMPANY ?? "",
    branch: process.env.SOFTONE_BRANCH ?? process.env.S1_BRANCH ?? "1000",
    module: process.env.SOFTONE_MODULE ?? process.env.S1_MODULE ?? "0",
    refid: process.env.SOFTONE_REFID ?? process.env.S1_REFID ?? "",
  };
  return cfg.url && cfg.appId && cfg.username && cfg.password && cfg.company && cfg.refid ? cfg : null;
}

/** Build a config from explicit (unsaved) values — used by «Δοκιμή σύνδεσης». */
export function configFromInput(i: SoftoneConnectionInput, source: "db" | "env" = "db"): SoftoneConfig {
  return {
    source,
    serial: i.serial.trim(),
    url: urlForSerial(i.serial),
    appId: i.appId.trim(),
    username: i.username.trim(),
    password: i.password,
    company: i.company.trim(),
    branch: i.branch.trim() || "1000",
    module: i.module.trim() || "0",
    refid: i.refid.trim(),
  };
}

export function isCompleteConfig(c: SoftoneConfig | null): c is SoftoneConfig {
  return !!(c && c.url && c.appId && c.username && c.password && c.company && c.refid);
}

export async function getSoftoneSettingsRow() {
  return db.softoneSettings.findUnique({ where: { id: "singleton" } });
}

export async function getSoftoneConfig(): Promise<SoftoneConfig | null> {
  const s = await getSoftoneSettingsRow();
  if (s?.enabled && s.serial && s.username && s.passwordEnc && s.appId && s.company != null && s.refid != null) {
    const cfg = configFromInput({
      serial: s.serial,
      appId: s.appId,
      username: s.username,
      password: decryptSecret(s.passwordEnc),
      company: String(s.company),
      branch: s.branch != null ? String(s.branch) : "1000",
      module: s.module != null ? String(s.module) : "0",
      refid: String(s.refid),
    }, "db");
    if (isCompleteConfig(cfg)) return cfg;
  }
  return envSoftoneConfig();
}

export async function isSoftoneConfigured(): Promise<boolean> {
  return (await getSoftoneConfig()) !== null;
}
