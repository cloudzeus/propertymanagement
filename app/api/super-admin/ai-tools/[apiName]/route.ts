import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireSuperAdmin() {
  const session = await auth();
  return session?.user && (session.user as any).role === "SUPER_ADMIN";
}

const forbidden = () =>
  new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });

export async function PUT(request: Request, { params }: { params: Promise<{ apiName: string }> }) {
  if (!(await requireSuperAdmin())) return forbidden();
  const { apiName } = await params;
  const b = await request.json();
  const num = (v: unknown, f: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : f;
  };
  const tool = await db.aPICostConfig.update({
    where: { apiName },
    data: {
      displayName: b.displayName,
      category: ["ai", "api", "video"].includes(b.category) ? b.category : undefined,
      costModel: b.costModel,
      unitLabel: b.unitLabel,
      basePrice: b.basePrice !== undefined ? num(b.basePrice, 0) : undefined,
      freeQuota: b.freeQuota !== undefined ? Math.round(num(b.freeQuota, 0)) : undefined,
      markupPercent: b.markupPercent !== undefined ? num(b.markupPercent, 0) : undefined,
      enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
      documentationUrl: b.documentationUrl,
      notes: b.notes,
    },
  });
  return Response.json({ tool });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ apiName: string }> }) {
  if (!(await requireSuperAdmin())) return forbidden();
  const { apiName } = await params;
  await db.aPICostConfig.delete({ where: { apiName } });
  return Response.json({ ok: true });
}
