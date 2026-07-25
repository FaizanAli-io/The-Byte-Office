import { timingSafeEqual } from "crypto";
import {
  createFinanceSession,
  FINANCE_SESSION_COOKIE,
  FINANCE_SESSION_MAX_AGE,
} from "@/lib/finance-auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { password } = (await req.json()) as { password?: string };
    const expected = process.env.FINANCE_PASSWORD;

    if (!expected) {
      console.error("FINANCE_PASSWORD is not configured");
      return NextResponse.json(
        { error: "Finance authentication is not configured" },
        { status: 503 },
      );
    }

    if (!password || !passwordMatches(password, expected)) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const session = await createFinanceSession();
    const response = NextResponse.json({ success: true });
    response.cookies.set(FINANCE_SESSION_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: FINANCE_SESSION_MAX_AGE,
      path: "/",
    });
    return response;
  } catch (cause) {
    console.error("POST /api/finance-auth/login error:", cause);
    return NextResponse.json({ error: "Unable to sign in" }, { status: 500 });
  }
}

function passwordMatches(value: string, expected: string) {
  const providedBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}
