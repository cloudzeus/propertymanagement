import { RateLimiter } from "@/lib/ai/assistant/rate-limit";

/** /invite/[token] page views per IP, and activation attempts per token (in-memory, single instance). */
export const inviteViewLimiter = new RateLimiter(20, 10 * 60_000);
export const inviteActivateLimiter = new RateLimiter(5, 10 * 60_000);

export const RATE_LIMIT_MESSAGE = "Πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά.";
