import {
  createFinanceSession,
  FINANCE_SESSION_COOKIE,
  sessionCookieOptions,
  verifyMagicLinkToken,
} from "@/lib/finance-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { token } = (await request.json()) as { token?: string };
    if (!(await verifyMagicLinkToken(token))) {
      return NextResponse.json(
        { error: "This login link is invalid or has expired" },
        { status: 401 },
      );
    }

    const session = await createFinanceSession();
    const response = NextResponse.json({ success: true, token: session });
    response.cookies.set(
      FINANCE_SESSION_COOKIE,
      session,
      sessionCookieOptions(),
    );
    return response;
  } catch (cause) {
    console.error("POST /api/finance-auth/verify error:", cause);
    return NextResponse.json(
      { error: "Unable to complete sign-in" },
      { status: 500 },
    );
  }
}
