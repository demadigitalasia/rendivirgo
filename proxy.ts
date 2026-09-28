import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "rv_admin_session";
const LOGIN_ROUTE = "/admin/login";
const PUBLIC_ADMIN_ROUTES = new Set([LOGIN_ROUTE, "/admin/forgot-password", "/admin/reset-password"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ADMIN_ROUTES.has(pathname);
  const isLoginRoute = pathname === LOGIN_ROUTE;
  const expiredSession = request.nextUrl.searchParams.get("expired") === "1";
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (!isPublicRoute && !session) {
    const loginUrl = new URL(LOGIN_ROUTE, request.url);
    if (pathname !== "/admin") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute && session && expiredSession) {
    const response = NextResponse.next();
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (isLoginRoute && session) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
