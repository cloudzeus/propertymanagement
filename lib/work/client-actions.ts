/**
 * Server actions return `{ error }` for business failures but can also throw
 * (expired session, network, database). Inside an event handler a rejection is
 * invisible to the user, so every call goes through this wrapper.
 */
export const ACTION_FAILED = "Η ενέργεια απέτυχε. Δοκιμάστε ξανά.";

export async function callAction<T extends object>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch {
    return { error: ACTION_FAILED };
  }
}
