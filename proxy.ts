import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales } from "./i18n";
import { deniedRedirectPath } from "./lib/surfaces";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

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

  if (localizedContentPaths.some(matches)) return clearStale(intlMiddleware(req));
  if (authPublicPaths.some(matches)) return clearStale(NextResponse.next());

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
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
  if (pathWithoutLocale.startsWith("/owner") && !can("SUPER_ADMIN", "ADMIN", "PROPERTY_OWNER")) {
    return deny();
  }
  if (pathWithoutLocale.startsWith("/portal") && !can("SUPER_ADMIN", "ADMIN", "PROPERTY_ADMIN", "PROPERTY_RESIDENT", "PROPERTY_VIEWER")) {
    return deny();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
