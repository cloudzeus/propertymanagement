import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { hubHrefForRole } from "@/lib/help/hub";

/** /help → the help hub of the viewer's surface (keeps ?a= / ?q= / ?m=). */
export default async function HelpRedirectPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const eff = await getEffectiveSession();
  if (!eff) redirect("/login?callbackUrl=%2Fhelp");
  const sp = (await searchParams) ?? {};
  const qs = new URLSearchParams();
  for (const k of ["a", "q", "m"]) { const v = sp[k]; if (typeof v === "string" && v) qs.set(k, v); }
  const suffix = qs.toString() ? `?${qs}` : "";
  redirect(`${hubHrefForRole(eff.user.role as string)}${suffix}`);
}
