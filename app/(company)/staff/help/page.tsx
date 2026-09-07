import { requirePermission } from "@/lib/rbac/permissions";
import { getEffectiveSession } from "@/lib/auth-effective";
import { HelpCenter } from "@/components/help/HelpCenter";

export const metadata = { title: "Βοήθεια & εγχειρίδια" };

type SP = Record<string, string | string[] | undefined>;

export default async function StaffHelpPage({ searchParams }: { searchParams?: Promise<SP> }) {
  await requirePermission("help", "view");
  const [eff, sp] = await Promise.all([getEffectiveSession(), searchParams ?? Promise.resolve({} as SP)]);
  return <HelpCenter role={eff?.user.role ?? "EMPLOYEE"} base="/staff/help" requested={typeof sp.m === "string" ? sp.m : undefined} />;
}
