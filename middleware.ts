import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  // Public routes
  if (pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password") || pathname === "/") {
    return NextResponse.next();
  }

  // Protected routes
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based routing
  const role = (req.auth.user as any)?.role;

  if (pathname.startsWith("/super-admin") && role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }

  if (pathname.startsWith("/admin") && !["SUPER_ADMIN", "ADMIN"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }

  if (pathname.startsWith("/manager") && !["MANAGER", "PROPERTY_ADMIN"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }

  if (pathname.startsWith("/employee") && !["EMPLOYEE", "MANAGER"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }

  if (pathname.startsWith("/property-admin") && role !== "PROPERTY_ADMIN") {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }

  if (pathname.startsWith("/property-owner") && !["PROPERTY_OWNER", "PROPERTY_ADMIN"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }

  if (pathname.startsWith("/property-resident") && !["PROPERTY_RESIDENT", "PROPERTY_ADMIN"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }

  if (pathname.startsWith("/property-viewer") && !["PROPERTY_VIEWER"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }

  if (pathname.startsWith("/collaborator") && role !== "COLLABORATOR") {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
