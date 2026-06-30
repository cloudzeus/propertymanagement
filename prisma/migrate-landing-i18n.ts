import { db } from "@/lib/db";
async function main() {
  const rows = await db.landingSection.findMany();
  for (const r of rows) {
    const d: any = r.data;
    if (d && typeof d === "object" && "el" in d && "en" in d) continue; // already migrated
    const localized = { el: d, en: JSON.parse(JSON.stringify(d)) };
    await db.landingSection.update({ where: { id: r.id }, data: { data: localized } });
  }
  console.log("Landing data localized.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
