import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";

// Server-side proxy to the DGsmart fluent-pm ticketing API.
// The API key stays server-side; the dashboard form posts FormData here.
const STAFF_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"]);

const MAX_FILES = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: Request) {
  const session = await getEffectiveSession();
  if (!session) return json(401, { error: "unauthorized" });
  if (!STAFF_ROLES.has(session.real.role)) return json(403, { error: "forbidden" });

  const baseUrl = process.env.TICKETING_URL;
  const projectCode = process.env.TICKETING_PROJECT_CODE;
  const apiKey = process.env.TICKETING_API_KEY;
  if (!baseUrl || !projectCode || !apiKey) return json(503, { error: "ticketing_not_configured" });

  let inbound: FormData;
  try {
    inbound = await req.formData();
  } catch {
    return json(422, { error: "invalid_form" });
  }
  if (inbound.get("website")) return json(422, { error: "invalid_form" }); // honeypot

  const subject = String(inbound.get("subject") ?? "").trim();
  const body = String(inbound.get("body") ?? "").trim();
  if (!subject || subject.length > 200) return json(422, { error: "invalid_subject" });
  if (!body || body.length > 5000) return json(422, { error: "invalid_body" });

  const files = inbound.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_FILES) return json(422, { error: "too_many_files" });
  if (files.some((f) => f.size > MAX_FILE_BYTES)) return json(413, { error: "file_too_large" });
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_BYTES) return json(413, { error: "files_too_large" });

  // Reporter identity comes from the session — the client cannot spoof it.
  const reporterName = session.user.name ?? session.user.email;
  const reporterEmail = session.user.email;
  const originUrl = String(inbound.get("originUrl") ?? req.headers.get("referer") ?? "");

  const headers: Record<string, string> = {
    "X-Ticket-Project": projectCode,
    "X-Ticket-Key": apiKey,
  };

  let upstream: Response;
  try {
    if (files.length > 0) {
      const fd = new FormData();
      fd.set("subject", subject);
      fd.set("body", body);
      fd.set("reporterEmail", reporterEmail);
      fd.set("reporterName", reporterName);
      fd.set("originUrl", originUrl);
      for (const f of files) fd.append("files", f);
      // No manual Content-Type — fetch sets the multipart boundary itself.
      upstream = await fetch(`${baseUrl}/api/tickets`, { method: "POST", headers, body: fd });
    } else {
      upstream = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, reporterEmail, reporterName, originUrl }),
      });
    }
  } catch (err) {
    console.error("Ticketing upstream error:", err);
    return json(502, { error: "ticketing_unreachable" });
  }

  const text = await upstream.text();

  // Keep a local record of every created ticket so the team can track it later.
  if (upstream.status === 201 || upstream.status === 200) {
    try {
      const data = JSON.parse(text);
      if (data.code && data.publicToken) {
        await db.supportTicket.upsert({
          where: { code: data.code },
          update: {},
          create: { code: data.code, publicToken: data.publicToken, subject, createdById: session.user.id },
        });
      }
    } catch (err) {
      console.error("Failed to record support ticket locally:", err);
    }
  }

  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
