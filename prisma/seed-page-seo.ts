import { db } from "@/lib/db";
const HOME = {
  el: { title: "PropertyPro — Διαχείριση Ακινήτων", description: "Η ολοκληρωμένη πλατφόρμα διαχείρισης πολυκατοικιών και ακινήτων.", ogImage: "" },
  en: { title: "PropertyPro — Property Management", description: "The all-in-one platform for managing buildings and properties.", ogImage: "" },
};
async function main() {
  await db.pageSeo.upsert({ where: { slug: "home" }, update: {}, create: { slug: "home", seo: HOME } });
  console.log("PageSeo seeded.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
