/**
 * Re-index the wiki into WikiChunk (pgvector). Idempotent: only changed chunks are embedded.
 *   npx tsx --env-file=.env scripts/index-wiki.ts
 */
import { indexWiki } from "../lib/ai/assistant/indexer";

indexWiki()
  .then((r) => { console.log(JSON.stringify(r)); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
