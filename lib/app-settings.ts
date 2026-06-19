import "server-only";
import { db } from "./db";

export type AppSettings = {
  companyName: string;
  logoUrl: string | null;
  logoSquareUrl: string | null;
  colorPrimary: string;
  colorPrimaryDk: string;
  colorAccent: string;
  colorSuccess: string;
  colorWarning: string;
  colorDanger: string;
  colorPurple: string;
  colorTeal: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  websiteUrl: string | null;
};

const DEFAULTS: AppSettings = {
  companyName: "PropertyPro",
  logoUrl: null,
  logoSquareUrl: null,
  colorPrimary: "#0078D4",
  colorPrimaryDk: "#005A9E",
  colorAccent: "#E31E2A",
  colorSuccess: "#107C10",
  colorWarning: "#CA5D00",
  colorDanger: "#A4262C",
  colorPurple: "#8764B8",
  colorTeal: "#038387",
  contactEmail: null,
  contactPhone: null,
  contactAddress: null,
  websiteUrl: null,
};

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const row = await (db as any).appSettings.findUnique({ where: { id: "singleton" } });
    return row ? { ...DEFAULTS, ...row } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export async function upsertAppSettings(data: Partial<AppSettings>, updatedById: string) {
  return (db as any).appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...DEFAULTS, ...data, updatedById },
    update: { ...data, updatedById },
  });
}

/** Converts AppSettings colors to inline CSS custom properties string */
export function buildBrandCss(s: AppSettings): string {
  return [
    `--color-primary:${s.colorPrimary}`,
    `--color-primary-dk:${s.colorPrimaryDk}`,
    `--color-accent:${s.colorAccent}`,
    `--color-success:${s.colorSuccess}`,
    `--color-warning:${s.colorWarning}`,
    `--color-danger:${s.colorDanger}`,
    `--color-purple:${s.colorPurple}`,
    `--color-teal:${s.colorTeal}`,
    `--primary:${s.colorPrimary}`,
    `--primary-dk:${s.colorPrimaryDk}`,
    `--destructive:${s.colorDanger}`,
  ].join(";");
}
