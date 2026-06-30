import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales } from "./i18n";

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
  if (isPublic) return NextResponse.next();

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

  if (pathWithoutLocale.startsWith("/super-admin") && !can("SUPER_ADMIN")) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }
  if (pathWithoutLocale.startsWith("/admin") && !can("SUPER_ADMIN", "ADMIN")) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }
  if (pathWithoutLocale.startsWith("/manager") && !can("SUPER_ADMIN", "ADMIN", "MANAGER", "PROPERTY_ADMIN")) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }
  if (pathWithoutLocale.startsWith("/staff") && !can("SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE")) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }
  if (pathWithoutLocale.startsWith("/marketplace") && !can("SUPER_ADMIN", "COLLABORATOR")) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }
  if (pathWithoutLocale.startsWith("/owner") && !can("SUPER_ADMIN", "ADMIN", "PROPERTY_OWNER")) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }
  if (pathWithoutLocale.startsWith("/portal") && !can("SUPER_ADMIN", "ADMIN", "PROPERTY_RESIDENT", "PROPERTY_VIEWER")) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
