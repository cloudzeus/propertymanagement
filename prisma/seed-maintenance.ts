/**
 * Seed default maintenance/fault categories (idempotent — matches by name).
 * Run: npx tsx --env-file=.env prisma/seed-maintenance.ts
 */
import { db } from "../lib/db";

const CATEGORIES: Array<{ name: string; icon: string; slaHours: number | null; companyResponsible: boolean; sortOrder: number }> = [
  { name: "Υδραυλικά", icon: "RiDropLine", slaHours: 48, companyResponsible: false, sortOrder: 1 },
  { name: "Ηλεκτρολογικά", icon: "RiFlashlightLine", slaHours: 24, companyResponsible: false, sortOrder: 2 },
  { name: "Ανελκυστήρας", icon: "RiArrowUpDownLine", slaHours: 12, companyResponsible: true, sortOrder: 3 },
  { name: "Θέρμανση / Καυστήρας", icon: "RiFireLine", slaHours: 24, companyResponsible: true, sortOrder: 4 },
  { name: "Κλιματισμός", icon: "RiWindyLine", slaHours: 72, companyResponsible: false, sortOrder: 5 },
  { name: "Κοινόχρηστος φωτισμός", icon: "RiLightbulbLine", slaHours: 48, companyResponsible: true, sortOrder: 6 },
  { name: "Πυρασφάλεια", icon: "RiAlarmWarningLine", slaHours: 12, companyResponsible: true, sortOrder: 7 },
  { name: "Θυροτηλέφωνο / Πόρτες", icon: "RiDoorOpenLine", slaHours: 72, companyResponsible: false, sortOrder: 8 },
  { name: "Κτηριακά / Οικοδομικά", icon: "RiBuilding2Line", slaHours: 168, companyResponsible: false, sortOrder: 9 },
  { name: "Καθαριότητα", icon: "RiBrushLine", slaHours: 72, companyResponsible: false, sortOrder: 10 },
  { name: "Άλλο", icon: "RiToolsLine", slaHours: null, companyResponsible: false, sortOrder: 99 },
];

async function main() {
  for (const c of CATEGORIES) {
    const existing = await db.maintenanceCategory.findFirst({ where: { name: c.name } });
    if (existing) {
      await db.maintenanceCategory.update({ where: { id: existing.id }, data: { icon: c.icon, sortOrder: c.sortOrder } });
    } else {
      await db.maintenanceCategory.create({ data: c });
    }
  }
  console.log(`Seeded ${CATEGORIES.length} maintenance categories.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
