import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  languageCookieName,
  languageCookiePresentHeaderName,
  languageHeaderName,
  localizedPath,
  originalPathHeaderName,
  normalizeLanguage,
} from "@/lib/locale";

const SESSION_COOKIE = "rv_admin_session";
const LOGIN_ROUTE = "/admin/login";
const PUBLIC_ADMIN_ROUTES = new Set([LOGIN_ROUTE, "/admin/forgot-password", "/admin/reset-password"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
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

    const headers = new Headers(request.headers);
    headers.set(languageHeaderName, "en");
    headers.set(originalPathHeaderName, pathname);
    return NextResponse.next({ request: { headers } });
  }

  const explicitLanguage = pathname.match(/^\/(en|id)(?=\/|$)/)?.[1];
  const basePath = pathname.replace(/^\/(?:en|id)(?=\/|$)/, "") || "/";
  const query = request.nextUrl.search;

  if (explicitLanguage === "en") {
    const response = NextResponse.redirect(new URL(`${basePath}${query}`, request.url));
    response.cookies.set(languageCookieName, "en", {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  }

  if (explicitLanguage === "id") {
    const destination = request.nextUrl.clone();
    destination.pathname = basePath;
    const headers = new Headers(request.headers);
    headers.set(languageHeaderName, "id");
    headers.set(originalPathHeaderName, pathname);
    headers.set(languageCookiePresentHeaderName, "1");
    const response = NextResponse.rewrite(destination, { request: { headers } });
    response.cookies.set(languageCookieName, "id", {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  }

  const language = normalizeLanguage(request.cookies.get(languageCookieName)?.value);
  if (language === "id") {
    return NextResponse.redirect(new URL(`${localizedPath(pathname, "id")}${query}`, request.url));
  }

  const headers = new Headers(request.headers);
  headers.set(languageHeaderName, language);
  headers.set(originalPathHeaderName, pathname);
  headers.set(languageCookiePresentHeaderName, request.cookies.has(languageCookieName) ? "1" : "0");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.[^/]+$).*)",
  ],
};
