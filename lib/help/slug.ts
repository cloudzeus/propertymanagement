const ROOTS: Record<string, string> = {
  "/super-admin": "super-admin-home", "/admin": "admin-home", "/manager": "manager-home", "/staff": "staff-home",
  "/building": "building-home", "/owner": "owner-home", "/portal": "portal-home", "/marketplace": "marketplace-home",
  "/report": "report", "/print": "print-hub", "/signage": "signage",
};
const SEGMENTS: Record<string, string> = {
  "[id]": "detail", "[slug]": "detail", "[assemblyId]": "assembly", "[type]": "type", "[side]": "side", "[doc]": "doc", "[token]": "token",
};

/** Deterministic article file name for a route pattern. */
export function slugForRoute(route: string): string {
  if (ROOTS[route]) return ROOTS[route];
  return route.replace(/^\/+/, "").split("/").map((s) => SEGMENTS[s] ?? s.replace(/^\[(.*)\]$/, "$1")).join("-");
}
