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

export default auth((req: NextRequest & { auth: any }) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  // Strip any locale prefix from path for role checks
  const pathWithoutLocale = locales.reduce((acc: string, locale: string) => {
    return acc.replace(new RegExp(`^/${locale}(/|$)`), "/");
  }, pathname) || "/";

  const publicPaths = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/",
    "/contact",
    "/pricing",
    "/faq",
    "/privacy",
    "/terms",
    "/cookie-policy",
    "/api/auth",
  ];

  const isPublic = publicPaths.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(p + "/")
  );
  if (isPublic) return intlMiddleware(req);

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
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
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
