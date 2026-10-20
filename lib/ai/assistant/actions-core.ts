/** Pure rules for confirmable action proposals. */
export const PROPOSAL_TTL_MS = 15 * 60 * 1000;

export type ConfirmCard = { actionId: string; tool: string; title: string; summaryLines: string[]; warnings: string[] };

export type CanConfirm = { ok: true } | { ok: false; reason: "not_owner" | "not_proposed" | "expired"; message: string };

export function canConfirm(log: { userId: string; status: string; expiresAt: Date }, userId: string, now: Date): CanConfirm {
  if (log.userId !== userId) return { ok: false, reason: "not_owner", message: "Η πρόταση δεν σας ανήκει." };
  if (log.status !== "PROPOSED") return { ok: false, reason: "not_proposed", message: "Η ενέργεια έχει ήδη εκτελεστεί ή ακυρωθεί." };
  if (log.expiresAt.getTime() < now.getTime()) return { ok: false, reason: "expired", message: "Η πρόταση έληξε — ζητήστε την ξανά από τον βοηθό." };
  return { ok: true };
}

/** Greek message for a zod failure: lists the invalid field paths. */
export function zodErrorMessage(issues: { path: PropertyKey[]; message: string }[]): string {
  const fields = [...new Set(issues.map((i) => i.path.join(".") || "(root)"))];
  return `Μη έγκυρα στοιχεία: ${fields.join(", ")}. Ζητήστε διευκρίνιση από τον χρήστη.`;
}
