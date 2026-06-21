import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "../customers/[id]/onboarding/OnboardingWizard";

export const metadata = { title: "AI Onboarding — Super Admin" };

// Global AI onboarding: pick any customer, then describe the building to the AI.
export default async function GlobalOnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const me = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (me?.role !== "SUPER_ADMIN") redirect("/admin");

  const customers = await db.customer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return <OnboardingWizard customers={customers} />;
}
