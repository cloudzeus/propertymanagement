import { auth } from "@/auth";
import { db } from "@/lib/db";

function forbidden() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

async function requireSuperAdmin() {
  const session = await auth();
  return session?.user && (session.user as any).role === "SUPER_ADMIN";
}

export async function GET() {
  if (!(await requireSuperAdmin())) return forbidden();
  const rows = await db.aPICostConfig.findMany({ orderBy: { displayName: "asc" } });
  return Response.json({ tools: rows });
}

export async function POST(request: Request) {
  if (!(await requireSuperAdmin())) return forbidden();
  const b = await request.json();
  if (!b.apiName || !b.displayName) {
    return new Response(JSON.stringify({ error: "apiName and displayName required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const tool = await db.aPICostConfig.create({
    data: {
      apiName: String(b.apiName),
      displayName: String(b.displayName),
      category: ["ai", "api", "video"].includes(b.category) ? b.category : "api",
      costModel: String(b.costModel || "per_request"),
      unitLabel: String(b.unitLabel || "units"),
      basePrice: Number(b.basePrice) || 0,
      freeQuota: Math.round(Number(b.freeQuota) || 0),
      markupPercent: Number(b.markupPercent) || 0,
      enabled: b.enabled !== false,
      documentationUrl: b.documentationUrl || null,
      notes: b.notes || null,
    },
  });
  return Response.json({ tool }, { status: 201 });
}
