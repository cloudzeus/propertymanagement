import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-effective";
import { testIntegration, INTEGRATIONS, type IntegrationId } from "@/lib/integrations";

const IDS = new Set(INTEGRATIONS.map((i) => i.id));

export async function POST(request: Request) {
  const session = await getEffectiveSession();
  if (!session || session.real.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id || !IDS.has(id as IntegrationId)) {
    return NextResponse.json({ error: "Άγνωστη ενσωμάτωση" }, { status: 400 });
  }
  const result = await testIntegration(id as IntegrationId);
  return NextResponse.json(result);
}
