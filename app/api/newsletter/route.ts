import { NextResponse } from "next/server";
import { subscribeNewsletter } from "@/lib/newsletter";

/** Public newsletter signup (double opt-in). Body: { email, locale?, source?, consent: true, consentText }. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.website) return NextResponse.json({ ok: true, status: "PENDING" }); // honeypot
    if (!body.consent) return NextResponse.json({ error: "CONSENT" }, { status: 400 });
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || null;
    const res = await subscribeNewsletter({
      email: String(body.email ?? ""),
      locale: body.locale,
      source: typeof body.source === "string" ? body.source.slice(0, 40) : "news",
      consentText: String(body.consentText ?? "").slice(0, 1000),
      ip,
      userAgent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true, status: res.status });
  } catch (e) {
    console.error("newsletter signup failed", e);
    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
}
