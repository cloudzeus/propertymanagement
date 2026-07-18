import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales } from "./i18n";
import { deniedRedirectPath } from "./lib/surfaces";


const { auth } = NextAuth(authConfig);

// Session cookie prefixes: Auth.js v5 + legacy v4 names, http/https variants,
// matched as prefixes to also catch chunked cookies (…session-token.0, .1, …).
const SESSION_COOKIE_PREFIXES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

export default auth((req: NextRequest & { auth: any }) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  // A session cookie that fails to decrypt (e.g. AUTH_SECRET changed) leaves
  // req.auth null but keeps being resent, spamming JWTSessionError on every
  // request. Delete it so the browser recovers without manual cookie clearing.
  const staleCookies = isLoggedIn
    ? []
    : req.cookies
        .getAll()
        .map((c) => c.name)
        .filter((name) => SESSION_COOKIE_PREFIXES.some((p) => name.startsWith(p)));
  const clearStale = <T extends NextResponse>(res: T): T => {
    for (const name of staleCookies) res.cookies.delete(name);
    return res;
  };

  // Strip any locale prefix from path for role checks
  const pathWithoutLocale = locales.reduce((acc: string, locale: string) => {
    return acc.replace(new RegExp(`^/${locale}(/|$)`), "/");
  }, pathname) || "/";

  // Localized public CONTENT (lives under app/[locale]/) — handled by next-intl.
  const localizedContentPaths = [
    "/",
    "/contact",
    "/pricing",
    "/faq",
    "/privacy",
    "/terms",
    "/cookie-policy",
  ];
  // Public but NOT localized (auth pages under app/(auth)/, plus the auth API).
  // These must bypass next-intl, otherwise its locale detection 302-redirects
  // e.g. /login → /en/login (no such route → 404) for English-locale visitors.
  const authPublicPaths = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/api/auth",
  ];

  const matches = (p: string) =>
    pathWithoutLocale === p || pathWithoutLocale.startsWith(p + "/");

  // Locale routing for public content, done by hand instead of next-intl's middleware.
  // Why: next-intl builds ABSOLUTE URLs from req.nextUrl, whose origin NextAuth's auth()
  // wrapper normalizes to AUTH_URL — behind the reverse proxy that origin doesn't match the
  // one Next serves on, and its rewrite/redirect pair degrades into a `/ ↔ /el` loop.
  // Contract (same as localePrefix "as-needed"): public URLs never carry the default-locale
  // prefix; unprefixed paths are rewritten internally to /el; /en stays as-is. The
  // x-locale-rewrite marker stops the strip-redirect when the middleware re-runs on the
  // internally rewritten request.
  if (localizedContentPaths.some(matches)) {
    // Redirects go to the PUBLIC origin (what the browser sees); rewrites go to the server's
    // OWN origin — Next only applies a middleware rewrite in-process when its origin matches
    // the one it is actually listening on (localhost:$PORT), any public-host origin degrades
    // into an external redirect.
    const host = req.headers.get("host") ?? req.nextUrl.host;
    const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
    const publicUrl = (path: string) => new URL(path + req.nextUrl.search, `${proto}://${host}`);
    const internalUrl = (path: string) =>
      new URL(path + req.nextUrl.search, `http://localhost:${process.env.PORT || "3000"}`);

    const defaultPrefixed = pathname === "/el" || pathname.startsWith("/el/");
    if (defaultPrefixed && !req.headers.get("x-locale-rewrite")) {
      return clearStale(NextResponse.redirect(publicUrl(pathname.slice(3) || "/"), 308));
    }
    // next-intl's requestLocale is fed by this header (its middleware would normally set it).
    const withLocale = (locale: string, extra?: Record<string, string>) => {
      const headers = new Headers(req.headers);
      headers.set("X-NEXT-INTL-LOCALE", locale);
      for (const [k, v] of Object.entries(extra ?? {})) headers.set(k, v);
      return headers;
    };
    const prefixLocale = locales.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
    if (!prefixLocale) {
      return clearStale(
        NextResponse.rewrite(internalUrl(pathname === "/" ? "/el" : `/el${pathname}`), {
          request: { headers: withLocale("el", { "x-locale-rewrite": "1" }) },
        }),
      );
    }
    return clearStale(NextResponse.next({ request: { headers: withLocale(prefixLocale) } }));
  }
  if (authPublicPaths.some(matches)) return clearStale(NextResponse.next());

  if (!isLoggedIn) {
    // Public origin from the actual request headers — req.nextUrl.origin is normalized
    // to AUTH_URL by the auth() wrapper and may not match the host being browsed.
    const host = req.headers.get("host") ?? req.nextUrl.host;
    const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
    const loginUrl = new URL("/login", `${proto}://${host}`);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return clearStale(NextResponse.redirect(loginUrl));
  }

  const role: string = req.auth?.user?.role ?? "";
  let effectiveRole = role;
  if (role === "SUPER_ADMIN") {
    const raw = req.cookies.get("impersonation")?.value;
    if (raw) {
      try {
        const imp = JSON.parse(raw);
        if (imp?.actorId === req.auth?.user?.id && typeof imp?.targetRole === "string") {
          effectiveRole = imp.targetRole;
        }
      } catch { /* ignore malformed cookie */ }
    }
  }
  const can = (...allowed: string[]) => allowed.includes(effectiveRole);
  // When impersonating, never strand on the dead-end /unauthorized (no exit there);
  // redirect to the impersonated role's home, where the Exit banner renders.
  const deny = () =>
    NextResponse.redirect(
      new URL(deniedRedirectPath(role, effectiveRole, pathWithoutLocale), req.nextUrl.origin),
    );

  if (pathWithoutLocale.startsWith("/super-admin") && !can("SUPER_ADMIN")) {
    return deny();
  }
  if (pathWithoutLocale.startsWith("/admin") && !can("SUPER_ADMIN", "ADMIN")) {
    return deny();
  }
  if (pathWithoutLocale.startsWith("/manager") && !can("SUPER_ADMIN", "ADMIN", "MANAGER")) {
    return deny();
  }
  if (pathWithoutLocale.startsWith("/staff") && !can("SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE")) {
    return deny();
  }
  if (pathWithoutLocale.startsWith("/marketplace") && !can("SUPER_ADMIN", "COLLABORATOR")) {
    return deny();
  }
  // Customer-role hierarchy: higher customer roles may access lower-role surfaces
  // (PROPERTY_ADMIN → /owner + /portal, PROPERTY_OWNER → /portal). Never the reverse.
  if (pathWithoutLocale.startsWith("/owner") && !can("SUPER_ADMIN", "ADMIN", "PROPERTY_ADMIN", "PROPERTY_OWNER")) {
    return deny();
  }
  if (pathWithoutLocale.startsWith("/portal") && !can("SUPER_ADMIN", "ADMIN", "PROPERTY_ADMIN", "PROPERTY_OWNER", "PROPERTY_RESIDENT")) {
    return deny();
  }

  return NextResponse.next();
});

export const config = {
  // api/realtime is excluded so the SSE route answers 401 itself (an EventSource on an
  // unattended signage TV must get a retryable status, not an HTML login redirect).
  matcher: ["/((?!api/auth|api/realtime|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
