import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listMedia } from "@/lib/cms/media";

export async function GET(req: Request) {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || undefined;
  const type = searchParams.get("type") || undefined;
  const items = await listMedia({ q, type });
  return NextResponse.json({ items });
}
