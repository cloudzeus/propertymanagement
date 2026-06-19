/**
 * Environment variable validation and access
 * Ensures all required env vars are present at build/runtime
 */

const requiredEnvVars = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "MAILGUN_DOMAIN",
  "MAILGUN_API_KEY",
  "MAILGUN_FROM_EMAIL",
  "BUNNY_API_KEY",
  "BUNNY_STORAGE_ZONE",
  "BUNNY_CDN_URL",
];

const optionalEnvVars = [
  "DEEPSEEK_API_KEY",
  "GEMINI_API_KEY",
  "NEXT_PUBLIC_APP_URL",
];

function validateEnv() {
  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);
  if (missing.length > 0) {
    // Warn only — never throw at import. A hard throw breaks every page/server
    // action that transitively imports this module. Features needing a missing
    // var fail gracefully when actually used.
    console.warn(`[env] Missing/aliased environment variables: ${missing.join(", ")}`);
  }
}
validateEnv();

// BunnyCDN via S3-compatible API.
// Public pull-zone URL: BUNNY_CDN_URL, else the b-cdn.net host that the project
// stores in BUNNY_STORAGE_API_HOST, else the default zone pull zone.
const cdnRaw = process.env.BUNNY_CDN_URL
  ?? process.env.BUNNY_STORAGE_API_HOST
  ?? (process.env.BUNNY_STORAGE_ZONE ? `https://${process.env.BUNNY_STORAGE_ZONE}.b-cdn.net` : "");
const BUNNY_CDN = cdnRaw.replace(/\/+$/, "");
const BUNNY_KEY = process.env.BUNNY_API_KEY ?? process.env.BUNNY_ACCESS_KEY ?? "";

export const env = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL!,

  // Auth
  AUTH_SECRET: process.env.AUTH_SECRET!,
  AUTH_URL: process.env.AUTH_URL || "http://localhost:3000",

  // Mailgun
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN ?? "",
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY ?? "",
  MAILGUN_FROM_EMAIL: process.env.MAILGUN_FROM_EMAIL ?? "",

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

  // App
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "Property Management",
  NODE_ENV: (process.env.NODE_ENV || "development") as "development" | "production",
} as const;

export function getEnv(key: keyof typeof env): string | undefined {
  return env[key];
}
