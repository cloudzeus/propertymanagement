import { redirect } from "next/navigation";

// Single-tenant: the company now lives under Settings → Εταιρία.
export default async function CompanyDetailRedirect() {
  redirect("/super-admin/settings/company");
}
