// Test-only stub for "next/server". Vitest (plain Node/Vite resolution) can't resolve
// this subpath because next's package.json has no "exports" map entry for it — Next.js's
// own bundler (webpack/turbopack) special-cases it, but vitest doesn't. This file exists
// purely so modules that reference NextRequest/NextResponse at import time (e.g. next-auth's
// runtime, pulled in transitively via @/auth) can load under vitest; nothing here is ever
// invoked in unit tests, which never execute request-handling code paths.
export class NextRequest extends Request {}
export class NextResponse extends Response {
  static json(body: unknown, init?: ResponseInit) {
    return Response.json(body, init);
  }
}
