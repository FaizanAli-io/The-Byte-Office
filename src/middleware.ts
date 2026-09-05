import {
  FINANCE_SESSION_COOKIE,
  verifyFinanceSession,
} from "@/lib/finance-auth";
import { NextRequest, NextResponse } from "next/server";

const publicFinancePaths = new Set(["/finance/login", "/finance/verify"]);

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = await verifyFinanceSession(
    request.cookies.get(FINANCE_SESSION_COOKIE)?.value,
  );

  if (publicFinancePaths.has(pathname)) {
    if (isAuthenticated && pathname === "/finance/login") {
      return NextResponse.redirect(new URL("/finance", request.url));
    }
    return NextResponse.next();
  }

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
    "/finance",
    "/finance/:path*",
    "/api/finance",
    "/api/finance-agent/:path*",
    "/api/snapshots/:path*",
    "/api/ledger/:path*",
  ],
};
