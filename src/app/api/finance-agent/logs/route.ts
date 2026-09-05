import { listAgentToolLogs } from "@/lib/finance-agent/repository";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const limit = Number(new URL(request.url).searchParams.get("limit") || 200);
    return NextResponse.json({ logs: await listAgentToolLogs(limit) });
  } catch (cause) {
    console.error("GET /api/finance-agent/logs error:", cause);
    return NextResponse.json(
      { error: "Failed to load assistant logs" },
      { status: 500 },
    );
  }
}
