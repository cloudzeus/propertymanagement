import { NextResponse } from "next/server";
import { confirmNewsletter } from "@/lib/newsletter";

export const dynamic = "force-dynamic";

/** Double opt-in link target → public status page. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const t = url.searchParams.get("t") ?? "";
  const res = t ? await confirmNewsletter(t) : { ok: false as const, error: "INVALID", locale: "el" };
  const locale = ("locale" in res && res.locale === "en") ? "en" : "el";
  const state = res.ok ? "confirmed" : "invalid";
  return NextResponse.redirect(new URL(`/${locale}/newsletter?state=${state}`, url.origin));
}
