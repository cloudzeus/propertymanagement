import { auth } from "@/auth";
import { db } from "@/lib/db";

/** Resolve the Customer id owned by the currently signed-in portal user, or null. */
export async function currentCustomerId(): Promise<string | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;
  // User→Customer link is the direct User.customerId foreign key
  // (relation "customerUsers" in prisma/schema.prisma).
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { customerId: true },
  });
  return user?.customerId ?? null;
}
