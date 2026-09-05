import { FINANCE_SESSION_COOKIE, sessionCookieOptions } from "@/lib/finance-auth";
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(FINANCE_SESSION_COOKIE, "", {
    ...sessionCookieOptions(0),
    expires: new Date(0),
  });
  return response;
}
