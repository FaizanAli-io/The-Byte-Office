import {
  AgentActionError,
  cancelPendingAgentAction,
} from "@/lib/finance-agent/actions";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return NextResponse.json({
      action: await cancelPendingAgentAction(id),
    });
  } catch (cause) {
    console.error("POST finance agent cancel error:", cause);
    const status = cause instanceof AgentActionError ? cause.status : 500;
    const message =
      cause instanceof Error ? cause.message : "Could not cancel action";
    return NextResponse.json({ error: message }, { status });
  }
}
