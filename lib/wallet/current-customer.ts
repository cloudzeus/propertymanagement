import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";

/** Resolve the Customer id owned by the currently signed-in portal user, or null.
 *  Effective session so super-admin View-as exercises the wallet as the target user. */
export async function currentCustomerId(): Promise<string | null> {
  const session = await getEffectiveSession();
  const userId = session?.user?.id;
  if (!userId) return null;
  // User→Customer link is the direct User.customerId foreign key
  // (relation "customerUsers" in prisma/schema.prisma).
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { customerId: true },
  });
  return user?.customerId ?? null;
}
