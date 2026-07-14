import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";

/** Τελευταίες ειδοποιήσεις + πλήθος αδιάβαστων, για το καμπανάκι. */
export async function GET() {
  const session = await getEffectiveSession();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, type: true, title: true, body: true, href: true, readAt: true, createdAt: true },
    }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return NextResponse.json({ items, unread });
}
