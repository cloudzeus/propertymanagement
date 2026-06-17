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
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

// Validate on module load in development
if (process.env.NODE_ENV === "development") {
  validateEnv();
}

export const env = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL!,

  // Auth
  AUTH_SECRET: process.env.AUTH_SECRET!,
  AUTH_URL: process.env.AUTH_URL || "http://localhost:3000",

  // Mailgun
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN!,
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY!,
  MAILGUN_FROM_EMAIL: process.env.MAILGUN_FROM_EMAIL!,

  // BunnyCDN
  BUNNY_API_KEY: process.env.BUNNY_API_KEY!,
  BUNNY_STORAGE_ZONE: process.env.BUNNY_STORAGE_ZONE!,
  BUNNY_CDN_URL: process.env.BUNNY_CDN_URL!,

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
