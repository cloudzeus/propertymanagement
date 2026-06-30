import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata = { title: "AI Onboarding — Super Admin" };

export default async function OnboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await db.customer.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!customer) notFound();
  return <OnboardingWizard customerId={customer.id} customerName={customer.name} />;
}
