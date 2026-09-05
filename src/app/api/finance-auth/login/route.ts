import {
  appOrigin,
  createMagicLinkToken,
  getSessionSecret,
} from "@/lib/finance-auth";
import { FINANCE_LOGIN_EMAIL } from "@/lib/finance-constants";
import { sendFinanceLoginEmail } from "@/lib/finance-email";
import { NextResponse } from "next/server";

const lastSentAt = new Map<string, number>();

export async function POST(request: Request) {
  try {
    if (!getSessionSecret()) {
      return NextResponse.json(
        { error: "Finance authentication is not configured" },
        { status: 503 },
      );
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "local";
    const previous = lastSentAt.get(ip) ?? 0;
    if (Date.now() - previous < 30_000) {
      return NextResponse.json(
        { error: "Please wait a moment before requesting another link" },
        { status: 429 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { next?: string };
    const nextPath =
      body.next?.startsWith("/finance") && !body.next.startsWith("//")
        ? body.next
        : "";

    const token = await createMagicLinkToken();
    const loginUrl = new URL("/finance/verify", appOrigin(request));
    loginUrl.searchParams.set("token", token);
    if (nextPath) loginUrl.searchParams.set("next", nextPath);

    let emailed = false;
    try {
      emailed = await sendFinanceLoginEmail(loginUrl.toString());
    } catch (cause) {
      console.error("Finance login email failed:", cause);
    }
    lastSentAt.set(ip, Date.now());

    if (!emailed && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Email delivery is not configured" },
        { status: 503 },
      );
    }

    return NextResponse.json({
      success: true,
      emailed,
      email: FINANCE_LOGIN_EMAIL,
      ...(process.env.NODE_ENV === "production"
        ? {}
        : { loginLink: loginUrl.toString() }),
    });
  } catch (cause) {
    console.error("POST /api/finance-auth/login error:", cause);
    return NextResponse.json(
      { error: "Unable to send login link" },
      { status: 500 },
    );
  }
}
