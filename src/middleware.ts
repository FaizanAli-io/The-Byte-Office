import {
  FINANCE_SESSION_COOKIE,
  verifyFinanceSession,
} from "@/lib/finance-auth";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/finance/login") {
    const isAuthenticated = await verifyFinanceSession(
      request.cookies.get(FINANCE_SESSION_COOKIE)?.value,
    );
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/finance", request.url));
    }
    return NextResponse.next();
  }

  const isAuthenticated = await verifyFinanceSession(
    request.cookies.get(FINANCE_SESSION_COOKIE)?.value,
  );
  if (isAuthenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/finance/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/finance/:path*",
    "/api/finance",
    "/api/snapshots/:path*",
    "/api/ledger/:path*",
  ],
};
