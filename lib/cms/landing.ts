import "server-only";
import { db } from "@/lib/db";

export async function getLandingSections() {
  return db.landingSection.findMany({ where: { enabled: true }, orderBy: { order: "asc" } });
}

export async function getAllLandingSections() {
  return db.landingSection.findMany({ orderBy: { order: "asc" } });
}
