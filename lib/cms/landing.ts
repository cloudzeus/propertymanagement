import "server-only";
import { db } from "@/lib/db";
import { LANDING_SECTION_TYPES, defaultSectionData } from "@/lib/cms/landing-types";

export async function getLandingSections() {
  return db.landingSection.findMany({ where: { enabled: true }, orderBy: { order: "asc" } });
}

export async function getAllLandingSections() {
  return db.landingSection.findMany({ orderBy: { order: "asc" } });
}

/** Creates DB rows for any section types missing from the DB so they show up in the admin list.
 *  New body sections start disabled (nothing empty renders publicly); NAV/FOOTER start enabled
 *  since their components fall back to built-in defaults until content is entered. */
export async function ensureLandingSections(): Promise<void> {
  const existing = await db.landingSection.findMany({ select: { type: true, order: true } });
  const have = new Set(existing.map((s) => s.type));
  let order = existing.reduce((m, s) => Math.max(m, s.order), 0);
  for (const type of LANDING_SECTION_TYPES) {
    if (have.has(type)) continue;
    const chrome = type === "NAV" || type === "FOOTER";
    await db.landingSection.create({
      data: { type, enabled: chrome, order: ++order, data: defaultSectionData(type) },
    });
  }
}

/** Raw (bilingual) data of a chrome section (NAV / FOOTER), or null if absent/disabled. */
export async function getChromeSection(type: "NAV" | "FOOTER"): Promise<unknown | null> {
  try {
    const row = await db.landingSection.findUnique({ where: { type } });
    return row?.enabled ? row.data : null;
  } catch {
    return null;
  }
}
