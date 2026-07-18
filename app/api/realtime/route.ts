import { NextRequest } from "next/server";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { subscribeBuilding } from "@/lib/realtime/bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STAFF = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"];

async function canListen(userId: string, role: string, buildingId: string): Promise<boolean> {
  if (STAFF.includes(role)) return true;
  if (role === "PROPERTY_ADMIN" || role === "PROPERTY_VIEWER") {
    const b = await db.building.findUnique({ where: { id: buildingId }, select: { propertyId: true } });
    if (!b) return false;
    const a = await db.managementAssignment.findFirst({
      where: { userId, OR: [{ buildingId }, { propertyId: b.propertyId }] }, select: { id: true },
    });
    return !!a;
  }
  if (role === "PROPERTY_OWNER" || role === "PROPERTY_RESIDENT") {
    const u = await db.unit.findFirst({
      where: {
        buildingId,
        OR: [{ ownerId: userId }, { residentId: userId }, { occupancies: { some: { userId, endDate: null } } }],
      },
      select: { id: true },
    });
    return !!u;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) return new Response("Unauthorized", { status: 401 });
  const buildingId = req.nextUrl.searchParams.get("building");
  if (!buildingId) return new Response("Missing building", { status: 400 });
  const allowed = await canListen(eff.user.id as string, eff.user.role as string, buildingId);
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (text: string) => {
        try { controller.enqueue(encoder.encode(text)); } catch {}
      };
      send(`: connected\n\n`);
      const off = subscribeBuilding(buildingId, (e) => send(`data: ${JSON.stringify(e)}\n\n`));
      const heartbeat = setInterval(() => send(`: hb\n\n`), 25000);
      const close = () => {
        clearInterval(heartbeat);
        off();
        try { controller.close(); } catch {}
      };
      req.signal.addEventListener("abort", close);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
