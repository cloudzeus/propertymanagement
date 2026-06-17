import createMiddleware from "next-intl/middleware";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, locales } from "./i18n";

// Initialize i18n middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
});

// Auth middleware
const authMiddleware = auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  // Remove locale prefix for role checking
  const pathWithoutLocale = locales.reduce((acc, locale) => {
    return acc.replace(new RegExp(`^/${locale}`), "");
  }, pathname) || "/";

  // Public routes (don't require auth)
  const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password", "/"];
  if (publicRoutes.some(route => pathWithoutLocale.startsWith(route) || pathWithoutLocale === route)) {
    return NextResponse.next();
  }

  // Protected routes
  if (!isLoggedIn) {
    const loginUrl = new URL(`/${defaultLocale}/login`, req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based routing
  const role = (req.auth.user as any)?.role;

  const roleMatches = (allowedRoles: string[]) => allowedRoles.includes(role);

  if (pathWithoutLocale.startsWith("/super-admin") && !roleMatches(["SUPER_ADMIN"])) {
    return NextResponse.redirect(new URL(`/${defaultLocale}/unauthorized`, req.nextUrl.origin));
  }

  if (pathWithoutLocale.startsWith("/admin") && !roleMatches(["SUPER_ADMIN", "ADMIN"])) {
    return NextResponse.redirect(new URL(`/${defaultLocale}/unauthorized`, req.nextUrl.origin));
  }

  if (pathWithoutLocale.startsWith("/manager") && !roleMatches(["MANAGER", "PROPERTY_ADMIN"])) {
    return NextResponse.redirect(new URL(`/${defaultLocale}/unauthorized`, req.nextUrl.origin));
  }

  if (pathWithoutLocale.startsWith("/employee") && !roleMatches(["EMPLOYEE", "MANAGER"])) {
    return NextResponse.redirect(new URL(`/${defaultLocale}/unauthorized`, req.nextUrl.origin));
  }

  if (pathWithoutLocale.startsWith("/property-admin") && !roleMatches(["PROPERTY_ADMIN"])) {
    return NextResponse.redirect(new URL(`/${defaultLocale}/unauthorized`, req.nextUrl.origin));
  }

  if (pathWithoutLocale.startsWith("/property-owner") && !roleMatches(["PROPERTY_OWNER", "PROPERTY_ADMIN"])) {
    return NextResponse.redirect(new URL(`/${defaultLocale}/unauthorized`, req.nextUrl.origin));
  }

  if (pathWithoutLocale.startsWith("/property-resident") && !roleMatches(["PROPERTY_RESIDENT", "PROPERTY_ADMIN"])) {
    return NextResponse.redirect(new URL(`/${defaultLocale}/unauthorized`, req.nextUrl.origin));
  }

  if (pathWithoutLocale.startsWith("/property-viewer") && !roleMatches(["PROPERTY_VIEWER"])) {
    return NextResponse.redirect(new URL(`/${defaultLocale}/unauthorized`, req.nextUrl.origin));
  }

  if (pathWithoutLocale.startsWith("/collaborator") && !roleMatches(["COLLABORATOR"])) {
    return NextResponse.redirect(new URL(`/${defaultLocale}/unauthorized`, req.nextUrl.origin));
  }

  return NextResponse.next();
});

// Chain middlewares
export default function middleware(request: NextRequest) {
  // Apply auth middleware
  const authResponse = authMiddleware(request);
  if (authResponse && authResponse.status !== 200) {
    return authResponse;
  }

  // Apply i18n middleware
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
