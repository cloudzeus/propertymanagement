import "server-only";
import { db } from "@/lib/db";
import { getEmailBrand } from "@/lib/email-brand";
import { DEFAULT_EMAIL_BRAND } from "@/lib/email-template";

/** Issuer block printed in every document header (management company). */
export type PrintBrand = {
  name: string; logoUrl: string; siteUrl: string;
  address: string | null; phone: string | null; email: string | null;
  afm: string | null; taxOffice: string | null; iban: string | null;
};

export async function getPrintBrand(): Promise<PrintBrand> {
  const [brand, company] = await Promise.all([
    getEmailBrand(),
    db.company.findFirst({ select: { afm: true, taxOffice: true, iban: true, phone1: true, email: true, address: true, city: true, postalCode: true } }).catch(() => null),
  ]);
  const companyAddress = company ? [company.address, [company.postalCode, company.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : null;
  // ΑΦΜ/ΔΟΥ/IBAN come from the Company profile only when the brand itself is the configured company
  // (not the Orithon fallback) — otherwise the header would mix two legal entities.
  const own = brand.name !== DEFAULT_EMAIL_BRAND.name;
  return {
    name: brand.name, logoUrl: brand.logoUrl, siteUrl: brand.siteUrl,
    address: brand.address || companyAddress || null,
    phone: brand.phone || company?.phone1 || null,
    email: brand.email || company?.email || null,
    afm: own ? company?.afm || null : null, taxOffice: own ? company?.taxOffice || null : null, iban: own ? company?.iban || null : null,
  };
}
