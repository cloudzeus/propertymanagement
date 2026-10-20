/** What the assistant knows about the page the user is on (pure; ids are NOT yet authorized). */
export type PageContext = { path: string; buildingId?: string; requestId?: string; tab?: string };

const BUILDING = [/^\/building\/([^/]+)$/, /^\/super-admin\/buildings\/([^/]+)(?:\/.*)?$/];
const REQUEST = [/^\/admin\/maintenance\/([^/]+)$/, /^\/portal\/maintenance\/([^/]+)$/, /^\/portal\/requests\/([^/]+)$/, /^\/marketplace\/requests\/([^/]+)$/];
const NOT_IDS = new Set(["settings", "new", "suppliers"]);

export function parsePageContext(pathname: string, search: string): PageContext {
  const path = pathname.replace(/\/+$/, "") || "/";
  const ctx: PageContext = { path };
  for (const re of BUILDING) { const m = path.match(re); if (m && !NOT_IDS.has(m[1])) { ctx.buildingId = m[1]; break; } }
  if (!ctx.buildingId) for (const re of REQUEST) { const m = path.match(re); if (m && !NOT_IDS.has(m[1])) { ctx.requestId = m[1]; break; } }
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const tab = sp.get("s") || sp.get("tab");
  if (tab) ctx.tab = tab;
  return ctx;
}
