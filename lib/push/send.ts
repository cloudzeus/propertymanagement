import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db";

/**
 * Web Push (PWA Φάση 2). Στέλνει push σε όλες τις συσκευές ενός χρήστη όταν
 * δημιουργείται γραμμή Notification για αυτόν (δείτε lib/notifications.ts).
 *
 * Κανόνες (spec docs/superpowers/specs/2026-10-21-pwa-push-design.md §3.2):
 *  - Χωρίς VAPID στο env → τίποτα (σιωπηλά). Τα κλειδιά ρυθμίζονται lazy, ώστε build/tests
 *    να μην απαιτούν κλειδιά.
 *  - 404/410 από την push service → η συνδρομή διαγράφεται. Άλλα σφάλματα → warn, μένει.
 *  - Ποτέ throw προς τον καλούντα (fire-and-forget, όπως publishBuildingEvent).
 */
export type PushPayloadInput = { title: string; body?: string | null; href?: string | null };
export type PushRow = PushPayloadInput & { userId: string };
export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushSendFn = (target: PushTarget, payload: string) => Promise<unknown>;

const BODY_MAX = 200;
const TTL_SECONDS = 86_400;
const FALLBACK_HREF = "/home";

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

/** Το JSON που διαβάζει ο service worker (public/sw.js, handler 'push'). `tag` = href: νεότερο push για το ίδιο αντικείμενο αντικαθιστά το παλιό. */
export function buildPushPayload(input: PushPayloadInput): string {
  const href = input.href && input.href.trim() ? input.href : FALLBACK_HREF;
  const raw = (input.body ?? "").trim();
  const body = raw.length > BODY_MAX ? raw.slice(0, BODY_MAX) + "…" : raw;
  return JSON.stringify({ title: input.title, ...(body ? { body } : {}), href, tag: href });
}

function statusOf(err: unknown): number | undefined {
  const s = (err as { statusCode?: unknown } | null)?.statusCode;
  return typeof s === "number" ? s : undefined;
}

/** Καθαρή: στέλνει σε κάθε συνδρομή, επιστρέφει ποια πέτυχαν και ποια «χάθηκαν» (404/410). */
export async function fanOut(targets: PushTarget[], payload: string, send: PushSendFn): Promise<{ sent: string[]; gone: string[] }> {
  const results = await Promise.allSettled(targets.map((t) => send(t, payload)));
  const sent: string[] = [];
  const gone: string[] = [];
  results.forEach((r, i) => {
    const endpoint = targets[i].endpoint;
    if (r.status === "fulfilled") { sent.push(endpoint); return; }
    const status = statusOf(r.reason);
    if (status === 404 || status === 410) gone.push(endpoint);
    else console.warn("[push] send failed", endpoint.slice(0, 48), status ?? (r.reason as Error)?.message);
  });
  return { sent, gone };
}

let configured = false;
let warnedDisabled = false;
function getSender(): PushSendFn | null {
  if (!isPushConfigured()) {
    if (!warnedDisabled) { warnedDisabled = true; console.info("[push] disabled — VAPID env vars missing"); }
    return null;
  }
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    configured = true;
  }
  return (t, payload) => webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: TTL_SECONDS });
}

/** Για τα tests: ξαναρυθμίζει τα VAPID στην επόμενη αποστολή. */
export function __resetPushForTests(): void { configured = false; warnedDisabled = false; }

/** Ένα push ανά συνδρομή ανά γραμμή — κάθε γραμμή έχει το δικό της href (ανά ρόλο). Δεν πετάει ποτέ. */
export async function sendPushToUsers(rows: PushRow[]): Promise<void> {
  try {
    if (rows.length === 0) return;
    const send = getSender();
    if (!send) return;
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const subs = await db.pushSubscription.findMany({ where: { userId: { in: userIds } }, select: { userId: true, endpoint: true, p256dh: true, auth: true } });
    if (subs.length === 0) return;
    const byUser = new Map<string, PushTarget[]>();
    for (const s of subs) (byUser.get(s.userId) ?? byUser.set(s.userId, []).get(s.userId)!).push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
    const sent = new Set<string>();
    const gone = new Set<string>();
    for (const row of rows) {
      const targets = byUser.get(row.userId);
      if (!targets?.length) continue;
      const r = await fanOut(targets, buildPushPayload(row), send);
      r.sent.forEach((e) => sent.add(e));
      r.gone.forEach((e) => gone.add(e));
    }
    if (gone.size) await db.pushSubscription.deleteMany({ where: { endpoint: { in: [...gone] } } });
    if (sent.size) await db.pushSubscription.updateMany({ where: { endpoint: { in: [...sent] } }, data: { lastUsedAt: new Date() } });
  } catch (err) {
    console.warn("[push] fan-out failed", (err as Error)?.message);
  }
}

export async function sendPushToUser(userId: string, payload: PushPayloadInput): Promise<void> {
  return sendPushToUsers([{ userId, ...payload }]);
}
