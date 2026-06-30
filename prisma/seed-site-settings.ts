import { db } from "@/lib/db";
import { DEFAULT_CONSENT_CONFIG } from "@/lib/cms/site-settings-defaults";
async function main() {
  await db.siteSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton", consentConfig: DEFAULT_CONSENT_CONFIG as any } });
  console.log("SiteSettings seeded.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
