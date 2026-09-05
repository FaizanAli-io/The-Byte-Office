import {
  AgentActionError,
  executeAgentAction,
} from "@/lib/finance-agent/actions";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      entry?: unknown;
    };
    return NextResponse.json(await executeAgentAction(id, body.entry));
  } catch (cause) {
    console.error("POST finance agent confirm error:", cause);
    const status = cause instanceof AgentActionError ? cause.status : 500;
    const message =
      cause instanceof Error ? cause.message : "Could not confirm action";
    return NextResponse.json({ error: message }, { status });
  }
}
