import type { PrismaClient } from "../lib/prisma/client";

import { DistributionBasis } from "../lib/prisma/enums";

type Cat = {
  code: string;
  name: string;
  utilityType: "NONE" | "POWER" | "WATER" | "GAS";
  tenant: number;
  owner: number;
  sortOrder: number;
  defaultBasis?: DistributionBasis;
};

export const DEFAULT_EXPENSE_CATEGORIES: Cat[] = [
  { code: "POWER",          name: "Ρεύμα κοινοχρήστων / ΔΕΗ", utilityType: "POWER", tenant: 100, owner: 0, sortOrder: 1 },
  { code: "WATER",          name: "Νερό / ΕΥΔΑΠ-ΕΥΑΘ",        utilityType: "WATER", tenant: 100, owner: 0, sortOrder: 2 },
  { code: "GAS",            name: "Φυσικό αέριο / Θέρμανση",   utilityType: "GAS",   tenant: 100, owner: 0, sortOrder: 3, defaultBasis: "HEATING_MILLESIMES" },
  { code: "CLEANING",       name: "Καθαριότητα",               utilityType: "NONE",  tenant: 100, owner: 0, sortOrder: 4 },
  { code: "MANAGEMENT",     name: "Διαχείριση",                utilityType: "NONE",  tenant: 100, owner: 0, sortOrder: 5 },
  { code: "ELEVATOR_OP",    name: "Ανελκυστήρας – Λειτουργία",  utilityType: "NONE",  tenant: 100, owner: 0, sortOrder: 6, defaultBasis: "ELEVATOR_MILLESIMES" },
  { code: "ELEVATOR_MAINT", name: "Ανελκυστήρας – Συντήρηση",   utilityType: "NONE",  tenant: 0,   owner: 100, sortOrder: 7, defaultBasis: "ELEVATOR_MILLESIMES" },
  { code: "MAINTENANCE",    name: "Συντήρηση / Επισκευές",     utilityType: "NONE",  tenant: 0,   owner: 100, sortOrder: 8 },
  { code: "INSURANCE",      name: "Ασφάλεια",                  utilityType: "NONE",  tenant: 0,   owner: 100, sortOrder: 9 },
  { code: "RESERVE",        name: "Αποθεματικό",               utilityType: "NONE",  tenant: 0,   owner: 100, sortOrder: 10 },
  { code: "OTHER",          name: "Λοιπά",                     utilityType: "NONE",  tenant: 0,   owner: 100, sortOrder: 11 },
];

export async function seedExpenseCategories(db: PrismaClient) {
  for (const c of DEFAULT_EXPENSE_CATEGORIES) {
    await db.expenseCategory.upsert({
      where: { code: c.code },
      update: {}, // do NOT clobber admin edits on re-seed
      create: {
        code: c.code,
        name: c.name,
        utilityType: c.utilityType,
        defaultTenantPct: c.tenant,
        defaultOwnerPct: c.owner,
        sortOrder: c.sortOrder,
        ...(c.defaultBasis ? { defaultBasis: c.defaultBasis } : {}),
      },
    });
  }
  console.log(`✅ Seeded ${DEFAULT_EXPENSE_CATEGORIES.length} expense categories`);
}
