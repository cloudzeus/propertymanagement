/**
 * Re-index the wiki into WikiChunk (pgvector). Idempotent: only changed chunks are embedded.
 *   npx tsx --env-file=.env scripts/index-wiki.ts
 */
import Module from "node:module";
import path from "node:path";

// `server-only` is a Next.js marker package with no Node runtime; outside Next we resolve it to an empty stub.
const STUB = path.join(process.cwd(), "test", "stubs", "empty.ts");
const mod = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const orig = mod._resolveFilename;
mod._resolveFilename = function (request: string, ...rest: unknown[]) {
  return request === "server-only" ? STUB : orig.call(this, request, ...rest);
};

import("../lib/ai/assistant/indexer")
  .then(({ indexWiki }) => indexWiki())
  .then((r) => { console.log(JSON.stringify(r)); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
