import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { homePathForRole } from "@/lib/surfaces";
import type { UserRole } from "@/lib/prisma/enums";

export const metadata = { title: "Αρχική" };
export const dynamic = "force-dynamic";

/**
 * start_url του PWA: το manifest δεν ξέρει ρόλο (ζητείται χωρίς cookies),
 * οπότε το εικονίδιο ανοίγει εδώ και στέλνουμε τον καθένα στη δική του αρχική.
 */
export default async function HomePage() {
  const eff = await getEffectiveSession();
  if (!eff) redirect("/login?callbackUrl=/home");
  redirect(homePathForRole(eff.user.role as UserRole));
}
