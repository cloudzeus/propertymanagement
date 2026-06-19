"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { geocodeAddress } from "@/lib/geocoding";
import { revalidatePath } from "next/cache";

export type CompanyProfileInput = {
  // Identity
  name?: string;
  legalName?: string;
  legalForm?: string;
  afm?: string;
  taxOffice?: string;
  activity?: string;
  title?: string;
  glnCode?: string;
  registryNumber?: string;
  vatStatus?: string;
  distStats?: string;

  // Address
  address?: string;
  district?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  lat?: number | null;
  lng?: number | null;

  // Contact
  phone1?: string;
  phone2?: string;
  phone3?: string;
  fax?: string;
  email?: string;
  website?: string;

  // Registration
  gemhNumber?: string;
  ikaNumber?: string;
  ikaRegistry?: string;
  folderNumber?: string;
  kadCode?: string;

  // Dates
  foundedAt?: string | null;
  dissolutionDate?: string | null;

  // Financial
  iban?: string;
  bank?: string;
  initialCapital?: number | null;
  paidCapital?: number | null;

  // Legal rep
  legalRep?: string;
  legalRepId?: string;

  // HR / Social security
  tpte?: string;
  tpteteka?: string;
  employmentOrg?: string;

  // Misc
  remarks?: string;

  // SoftOne
  softoneCompanyCode?: number | null;
};

export async function updateCompanyProfile(companyId: string, data: CompanyProfileInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  await db.company.update({
    where: { id: companyId },
    data: {
      ...data,
      foundedAt:       data.foundedAt       ? new Date(data.foundedAt)       : null,
      dissolutionDate: data.dissolutionDate  ? new Date(data.dissolutionDate) : null,
    },
  });

  revalidatePath(`/super-admin/companies/${companyId}`);
  revalidatePath("/super-admin/settings/company");
  return { success: true };
}

export async function geocodeCompanyAddress(companyId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { address: true, city: true, postalCode: true, country: true },
  });
  if (!company?.address) return { error: "Δεν υπάρχει διεύθυνση" };

  const query = [company.address, company.city, company.postalCode, company.country]
    .filter(Boolean).join(", ");

  const results = await geocodeAddress(query);
  if (!results.length) return { error: "Δεν βρέθηκαν αποτελέσματα geocoding" };

  const { lat, lng } = results[0];
  await db.company.update({ where: { id: companyId }, data: { lat, lng } });
  revalidatePath(`/super-admin/companies/${companyId}`);
  revalidatePath("/super-admin/settings/company");
  return { lat, lng };
}
