import { requirePermission } from "@/lib/rbac/permissions";
import { getEffectiveSession } from "@/lib/auth-effective";
import { listManageableBuildings } from "@/app/actions/building-expenses";
import { HelpCenter } from "@/components/help/HelpCenter";

export const metadata = { title: "Βοήθεια & εγχειρίδια" };

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function StaffHelpPage({ searchParams }: { searchParams?: Promise<SP> }) {
  await requirePermission("help", "view");
  const [eff, sp, buildings] = await Promise.all([getEffectiveSession(), searchParams ?? Promise.resolve({} as SP), listManageableBuildings()]);
  return <HelpCenter role={eff?.user.role ?? "EMPLOYEE"} base="/staff/help" requested={str(sp.m)} article={str(sp.a)} q={str(sp.q)} firstBuildingId={buildings[0]?.id ?? null} />;
}
