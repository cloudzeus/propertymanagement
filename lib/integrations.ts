import "server-only";
import { env } from "./env";
import { testConnection as testBunny } from "./bunnycdn";

export type IntegrationId = "mailgun" | "bunnycdn" | "deepseek" | "gemini";

export type IntegrationMeta = {
  id: IntegrationId;
  name: string;
  icon: string;
  description: string;
  details: string;
  /** Env var names this integration uses (for the Configure panel). */
  envVars: string[];
  docsUrl: string;
};

export const INTEGRATIONS: IntegrationMeta[] = [
  {
    id: "mailgun",
    name: "Mailgun",
    icon: "📧",
    description: "Υπηρεσία email για ειδοποιήσεις & OTP",
    details: "Αποστολή email για επαναφορά κωδικού, κωδικούς OTP και ειδοποιήσεις συστήματος.",
    envVars: ["MAILGUN_API_KEY", "MAILGUN_DOMAIN", "MAILGUN_FROM_EMAIL", "MAILGUN_ENDPOINT"],
    docsUrl: "https://documentation.mailgun.com/",
  },
  {
    id: "bunnycdn",
    name: "BunnyCDN",
    icon: "📁",
    description: "Αποθήκευση αρχείων & CDN",
    details: "Αποθήκευση εικόνων, εγγράφων και άλλων αρχείων (S3-compatible storage).",
    envVars: ["BUNNY_STORAGE_ZONE", "BUNNY_ACCESS_KEY", "BUNNY_S3_REGION_ENDPOINT", "BUNNY_S3_REGION_SECRET_KEY", "BUNNY_CDN_URL"],
    docsUrl: "https://docs.bunny.net/",
  },
  {
    id: "deepseek",
    name: "Deepseek API",
    icon: "🤖",
    description: "AI μεταφράσεις & ανάλυση",
    details: "Μετάφραση Ελληνικά→Αγγλικά, ανάλυση ακινήτων, σύνοψη περιεχομένου.",
    envVars: ["DEEPSEEK_API_KEY"],
    docsUrl: "https://api-docs.deepseek.com/",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    icon: "✨",
    description: "Προηγμένη AI παραγωγή",
    details: "Προτάσεις συντήρησης και AI insights.",
    envVars: ["GEMINI_API_KEY"],
    docsUrl: "https://ai.google.dev/gemini-api/docs",
  },
];

export type IntegrationStatus = {
  id: IntegrationId;
  configured: boolean;
  /** Per-env-var presence (value masked — booleans only) for the Configure panel. */
  envPresent: Record<string, boolean>;
};

function present(name: string): boolean {
  return !!process.env[name];
}

/** Static "is it configured?" status derived from env (no network calls). */
export function integrationStatuses(): IntegrationStatus[] {
  return INTEGRATIONS.map((m) => {
    const envPresent: Record<string, boolean> = {};
    for (const v of m.envVars) envPresent[v] = present(v);
    let configured = false;
    switch (m.id) {
      case "mailgun":
        configured = !!(env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN);
        break;
      case "bunnycdn":
        configured = !!(env.BUNNY_STORAGE_ZONE && env.BUNNY_S3_ACCESS && env.BUNNY_S3_SECRET && env.BUNNY_S3_ENDPOINT);
        break;
      case "deepseek":
        configured = !!env.DEEPSEEK_API_KEY;
        break;
      case "gemini":
        configured = !!env.GEMINI_API_KEY;
        break;
    }
    return { id: m.id, configured, envPresent };
  });
}

export type TestResult = { id: IntegrationId; ok: boolean; message: string; latencyMs: number };

async function timed<T>(fn: () => Promise<{ ok: boolean; message: string }>): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const start = performance.now();
  try {
    const r = await fn();
    return { ...r, latencyMs: Math.round(performance.now() - start) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Αποτυχία", latencyMs: Math.round(performance.now() - start) };
  }
}

/** Live connectivity/credential check for one integration. */
export async function testIntegration(id: IntegrationId): Promise<TestResult> {
  const r = await timed(async () => {
    switch (id) {
      case "mailgun": {
        if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) return { ok: false, message: "Λείπει MAILGUN_API_KEY ή MAILGUN_DOMAIN" };
        const auth = Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString("base64");
        const res = await fetch(`${env.MAILGUN_BASE_URL}/v3/domains/${env.MAILGUN_DOMAIN}`, {
          headers: { Authorization: `Basic ${auth}` }, cache: "no-store",
        });
        if (res.ok) return { ok: true, message: `Domain ${env.MAILGUN_DOMAIN} επαληθεύτηκε` };
        return { ok: false, message: `HTTP ${res.status} από Mailgun` };
      }
      case "bunnycdn":
        return testBunny();
      case "deepseek": {
        if (!env.DEEPSEEK_API_KEY) return { ok: false, message: "Λείπει DEEPSEEK_API_KEY" };
        const res = await fetch("https://api.deepseek.com/models", {
          headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` }, cache: "no-store",
        });
        if (res.ok) return { ok: true, message: "Κλειδί Deepseek έγκυρο" };
        return { ok: false, message: `HTTP ${res.status} από Deepseek` };
      }
      case "gemini": {
        if (!env.GEMINI_API_KEY) return { ok: false, message: "Λείπει GEMINI_API_KEY" };
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`, { cache: "no-store" });
        if (res.ok) return { ok: true, message: "Κλειδί Gemini έγκυρο" };
        return { ok: false, message: `HTTP ${res.status} από Gemini` };
      }
    }
  });
  return { id, ...r };
}
