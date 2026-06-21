/**
 * Environment variable validation and access
 * Ensures all required env vars are present at build/runtime
 */

// ── Resolved values (support alternative/alias env var names) ────────────────

// BunnyCDN via S3-compatible API.
// Public pull-zone URL: BUNNY_CDN_URL, else the b-cdn.net host that the project
// stores in BUNNY_STORAGE_API_HOST, else the default zone pull zone.
const cdnRaw = process.env.BUNNY_CDN_URL
  ?? process.env.BUNNY_STORAGE_API_HOST
  ?? (process.env.BUNNY_STORAGE_ZONE ? `https://${process.env.BUNNY_STORAGE_ZONE}.b-cdn.net` : "");
const BUNNY_CDN = cdnRaw.replace(/\/+$/, "");
const BUNNY_KEY = process.env.BUNNY_API_KEY ?? process.env.BUNNY_ACCESS_KEY ?? "";

// Mailgun base host. EU accounts use api.eu.mailgun.net — derive it from the
// account's MAILGUN_ENDPOINT (its origin) when set, otherwise default to the US host.
function resolveMailgunBase(): string {
  const raw = process.env.MAILGUN_ENDPOINT;
  if (raw) {
    try { return new URL(raw).origin; } catch { /* not a full URL — fall through */ }
  }
  return "https://api.mailgun.net";
}
const MAILGUN_BASE_URL = resolveMailgunBase();
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN ?? "";
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY ?? "";
const MAILGUN_FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL ?? "";

// ── Validation against RESOLVED values ───────────────────────────────────────
// Checks the value the app actually uses, so a required var satisfied by an alias
// (e.g. BUNNY_ACCESS_KEY for BUNNY_API_KEY) does NOT produce a false-positive warning.
const requiredResolved: Record<string, string> = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  AUTH_SECRET: process.env.AUTH_SECRET ?? "",
  MAILGUN_DOMAIN,
  MAILGUN_API_KEY,
  MAILGUN_FROM_EMAIL,
  BUNNY_API_KEY: BUNNY_KEY,
  BUNNY_STORAGE_ZONE: process.env.BUNNY_STORAGE_ZONE ?? "",
  BUNNY_CDN_URL: BUNNY_CDN,
};

function validateEnv() {
  const missing = Object.entries(requiredResolved).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    // Warn only — never throw at import. A hard throw breaks every page/server
    // action that transitively imports this module. Features needing a missing
    // var fail gracefully when actually used.
    console.warn(`[env] Missing required environment variables (no value, incl. aliases): ${missing.join(", ")}`);
  }
}
validateEnv();

export const env = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL!,

  // Auth
  AUTH_SECRET: process.env.AUTH_SECRET!,
  AUTH_URL: process.env.AUTH_URL || "http://localhost:3000",

  // Mailgun (MAILGUN_BASE_URL supports EU accounts via MAILGUN_ENDPOINT)
  MAILGUN_DOMAIN: MAILGUN_DOMAIN,
  MAILGUN_API_KEY: MAILGUN_API_KEY,
  MAILGUN_FROM_EMAIL: MAILGUN_FROM_EMAIL,
  MAILGUN_BASE_URL: MAILGUN_BASE_URL,

  // BunnyCDN (S3-compatible API)
  BUNNY_API_KEY: BUNNY_KEY,
  BUNNY_STORAGE_ZONE: process.env.BUNNY_STORAGE_ZONE ?? "",
  BUNNY_CDN_URL: BUNNY_CDN,
  BUNNY_S3_ENDPOINT: process.env.BUNNY_S3_REGION_ENDPOINT ?? "",
  BUNNY_S3_ACCESS: process.env.BUNNY_ACCESS_KEY ?? "",
  BUNNY_S3_SECRET: process.env.BUNNY_S3_REGION_SECRET_KEY ?? "",

  // AI Services (Optional)
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,

  // Assemblies (Daily + Deepgram)
  DAILY_API_KEY: process.env.DAILY_API_KEY,
  DEEP_GRAM_API_KEY: process.env.DEEP_GRAM_API_KEY,
  DAILY_WEBHOOK_SECRET: process.env.DAILY_WEBHOOK_SECRET,
  NEXT_PUBLIC_DAILY_DOMAIN: process.env.NEXT_PUBLIC_DAILY_DOMAIN,

  // App
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "Property Management",
  NODE_ENV: (process.env.NODE_ENV || "development") as "development" | "production",
} as const;

export function getEnv(key: keyof typeof env): string | undefined {
  return env[key];
}
