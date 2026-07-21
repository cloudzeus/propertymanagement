// Test-only stub for "next/headers" — see next-server.ts for why this alias exists.
// Not invoked during unit tests; only satisfies module-load-time imports.
export function headers(): Headers {
  return new Headers();
}
export function cookies() {
  return {
    get: () => undefined,
    getAll: () => [],
    set: () => {},
    delete: () => {},
  };
}
