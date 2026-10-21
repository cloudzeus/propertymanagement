"use server";

import { db } from "@/lib/db";
import { getEffectiveSession } from "@/lib/auth-effective";

/**
 * Web Push συνδρομές (PWA Φάση 2). Καλούνται από components/pwa/PushToggle.tsx.
 * Μία γραμμή ανά endpoint (= συσκευή/browser): το upsert ξαναδένει τη γραμμή στον
 * χρήστη που είναι συνδεδεμένος τώρα, ώστε κοινόχρηστη συσκευή να μη λαμβάνει ποτέ
 * ειδοποιήσεις του προηγούμενου λογαριασμού.
 */
export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushActionResult = { ok: true } | { ok: false; reason: "unauthorized" | "impersonating" | "invalid" };

const ENDPOINT_MAX = 2048;
const KEY_MAX = 512;
const UA_MAX = 255;
const BASE64URL = /^[A-Za-z0-9_-]+=*$/;

function validate(input: PushSubscriptionInput): { endpoint: string; p256dh: string; auth: string } | null {
  const endpoint = typeof input?.endpoint === "string" ? input.endpoint.trim() : "";
  const p256dh = typeof input?.keys?.p256dh === "string" ? input.keys.p256dh.trim() : "";
  const auth = typeof input?.keys?.auth === "string" ? input.keys.auth.trim() : "";
  if (!endpoint || endpoint.length > ENDPOINT_MAX) return null;
  try { if (new URL(endpoint).protocol !== "https:") return null; } catch { return null; }
  if (!p256dh || p256dh.length > KEY_MAX || !BASE64URL.test(p256dh)) return null;
  if (!auth || auth.length > KEY_MAX || !BASE64URL.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

export async function subscribePush(input: PushSubscriptionInput, userAgent?: string): Promise<PushActionResult> {
  const session = await getEffectiveSession();
  if (!session?.user?.id) return { ok: false, reason: "unauthorized" };
  if (session.impersonatorId) return { ok: false, reason: "impersonating" };
  const v = validate(input);
  if (!v) return { ok: false, reason: "invalid" };
  const ua = typeof userAgent === "string" && userAgent ? userAgent.slice(0, UA_MAX) : null;
  await db.pushSubscription.upsert({
    where: { endpoint: v.endpoint },
    create: { userId: session.user.id, endpoint: v.endpoint, p256dh: v.p256dh, auth: v.auth, userAgent: ua },
    update: { userId: session.user.id, p256dh: v.p256dh, auth: v.auth, userAgent: ua, lastUsedAt: null },
  });
  return { ok: true };
}

export async function unsubscribePush(endpoint: string): Promise<PushActionResult> {
  const session = await getEffectiveSession();
  if (!session?.user?.id) return { ok: false, reason: "unauthorized" };
  if (typeof endpoint !== "string" || !endpoint || endpoint.length > ENDPOINT_MAX) return { ok: false, reason: "invalid" };
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });
  return { ok: true };
}
