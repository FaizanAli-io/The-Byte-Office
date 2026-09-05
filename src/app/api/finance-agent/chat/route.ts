import { randomUUID } from "crypto";
import { listLedgerSummaries } from "@/lib/db/queries";
import {
  formatOpenRouterErrorForUser,
  OpenRouterError,
  requestOpenRouter,
  type OpenRouterMessage,
  type OpenRouterToolChoice,
} from "@/lib/finance-agent/openrouter";
import {
  executeFinanceTool,
  financeAgentTools,
} from "@/lib/finance-agent/tools";
import type {
  FinanceAgentResponse,
  FinanceChatMessage,
  PendingAgentAction,
} from "@/lib/finance-agent/types";
import {
  logAgentToolCall,
  saveAgentMessage,
} from "@/lib/finance-agent/repository";
import { NextResponse } from "next/server";

const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_TOTAL_CHARS = 24_000;
const MAX_TOOL_ROUNDS = 6;
const MAX_TOOL_CALLS = 8;

const systemPrompt = `You are the private finance assistant for The Byte Office.
Be concise, accurate, and explicit about currencies. Use tools for every claim about live portfolio, snapshots, or ledgers. Never invent IDs or balances.
Read before proposing a mutation. Write tools create pending confirmation proposals only: they do not apply changes. Say that the user must review and confirm the card, and never claim a pending action succeeded.
Do not ask for or reveal credentials. Do not provide arbitrary SQL. Refuse requests outside the available finance tools.
For ambiguous portfolio mutations, ask one focused clarification instead of guessing. Finalized ledgers are read-only.
When the user wants to add a ledger entry, immediately call ledger_entry_add. Never ask for type, account, amount, date, or notes — a form appears in chat with those fields. Type defaults to expense, account to the first account, and date to today. Month is enough; if unknown, list ledgers then call ledger_entry_add with the latest draft month.
When the user wants to edit a ledger entry, load the ledger if needed, then immediately call ledger_entry_update with month and entryId. Do not ask them to retype existing fields.
The user submits the form to save. Keep your reply short and point them at the form.
When invoking tools, always provide arguments as a clean JSON object. For parameterless tools (portfolio_get, snapshots_list, ledgers_list), always pass an empty object: {}.
For responses with multiple values, comparisons, or records, prefer clear Markdown headings, bullet lists, and Markdown tables. Keep prose concise and never put sensitive credentials in output.`;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { messages?: unknown };
    const history = sanitizeHistory(body.messages);
    if (!history.length || history.at(-1)?.role !== "user") {
      return error("A user message is required", 400);
    }

    const lastUser = history.at(-1)!;
    await saveAgentMessage({
      id: lastUser.id,
      role: "user",
      content: lastUser.content,
      createdAt: lastUser.createdAt,
    });

    const encoder = new TextEncoder();
    const writeIntent = writeIntentFor(lastUser.content);
    const requiredTool = requiredToolFor(lastUser.content, writeIntent);
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: StreamEvent) =>
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        try {
          send({ type: "status", status: "thinking" });
          const messages: OpenRouterMessage[] = [
            { role: "system", content: systemPrompt },
            ...history.map(({ role, content }) => ({ role, content })),
          ];
          const pendingActions: PendingAgentAction[] = [];
          const requestId = randomUUID();
          let toolCalls = 0;
          let model = process.env.OPENROUTER_MODEL || "z-ai/glm-5.2:free";
          let streamedText = "";
          let finalText = "";

          for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
            if (round > 0) send({ type: "status", status: "reading" });
            const needsAddForm =
              writeIntent === "ledger_entry_add" &&
              !pendingActions.some(
                (action) => action.actionType === "ledger_entry_add",
              );
            const forcedTool =
              round === 0 && requiredTool
                ? requiredTool
                : needsAddForm
                  ? "ledger_entry_add"
                  : null;
            const response = await requestOpenRouter({
              messages,
              tools: financeAgentTools,
              toolChoice: forcedTool
                ? ({
                    type: "function",
                    function: { name: forcedTool },
                  } satisfies OpenRouterToolChoice)
                : "auto",
              onText: (text) => {
                streamedText += text;
                send({ type: "delta", content: text });
              },
            });
            model = response.model;
            messages.push(response.message);

            if (!response.message.tool_calls?.length) {
              if (
                round === 0 &&
                requiredTool &&
                requiredTool !== "ledger_entry_add"
              ) {
                throw new OpenRouterError(
                  `The assistant did not call the required ${requiredTool} tool`,
                  502,
                );
              }
              finalText =
                response.message.content || "I could not produce a response.";
              break;
            }

            toolCalls += response.message.tool_calls.length;
            if (toolCalls > MAX_TOOL_CALLS) {
              finalText =
                "I reached the safe tool-call limit. Please narrow the request.";
              break;
            }

            send({ type: "status", status: "reading" });
            for (const call of response.message.tool_calls) {
              let toolOutput: unknown;
              let toolArgs: unknown = {};
              const startedAt = Date.now();
              let toolError: string | undefined;
              const toolName = call.function.name
                .replace(/^functions\./, "")
                .trim();
              try {
                toolArgs = parseToolArguments(call.function.arguments, toolName);
                const result = await executeFinanceTool(
                  toolName,
                  toolArgs,
                );
                toolOutput = result.output;
                if (result.pendingAction)
                  pendingActions.push(result.pendingAction);
              } catch (cause) {
                toolError =
                  cause instanceof Error
                    ? cause.message
                    : "Tool execution failed";
                toolOutput = { error: toolError };
              }
              try {
                await logAgentToolCall({
                  requestId,
                  model,
                  toolCallId: call.id,
                  toolName,
                  arguments: boundedJsonValue(
                    toolError
                      ? {
                          raw: call.function.arguments ?? null,
                          parsed: toolArgs,
                        }
                      : toolArgs,
                  ),
                  result: toolError ? undefined : boundedJsonValue(toolOutput),
                  error: toolError,
                  durationMs: Date.now() - startedAt,
                });
              } catch (logError) {
                console.error(
                  "Could not persist finance agent tool log:",
                  logError,
                );
              }
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                name: toolName,
                content: safeJson(toolOutput),
              });
            }
          }
          if (
            writeIntent === "ledger_entry_add" &&
            !pendingActions.some(
              (action) => action.actionType === "ledger_entry_add",
            )
          ) {
            send({ type: "status", status: "reading" });
            const opened = await openLedgerAddForm({
              requestId,
              model,
              userContent: lastUser.content,
              messages,
            });
            if (opened.pendingAction) {
              pendingActions.push(opened.pendingAction);
            }
            if (opened.error) {
              console.error("Could not open ledger add form:", opened.error);
            }
            if (!streamedText && !finalText) {
              finalText = opened.pendingAction
                ? "A ledger entry form is ready. Review the defaults, fill in the amount, and save."
                : "I could not open a ledger entry form. Make sure a draft ledger exists.";
            }
          }
          if (!finalText) {
            finalText =
              "I reached the safe reasoning limit. Please try a more focused request.";
          }
          const response = buildResponse(
            streamedText || finalText,
            pendingActions,
            model,
          );
          try {
            await saveAgentMessage(response.message);
          } catch (persistError) {
            console.error(
              "Could not persist finance agent assistant message:",
              persistError,
            );
          }
          send({
            type: "done",
            response,
          });
        } catch (cause) {
          console.error("POST /api/finance-agent/chat stream error:", cause);
          const message = formatOpenRouterErrorForUser(cause);
          try {
            await saveAgentMessage({
              id: randomUUID(),
              role: "assistant",
              content: `I couldn't complete that request.\n\n${message}`,
              createdAt: new Date().toISOString(),
              isError: true,
            });
          } catch (persistError) {
            console.error(
              "Could not persist finance agent error message:",
              persistError,
            );
          }
          send({
            type: "error",
            error: message,
          });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
      },
    });
  } catch (cause) {
    console.error("POST /api/finance-agent/chat error:", cause);
    if (cause instanceof RequestValidationError)
      return error(cause.message, cause.status);
    if (cause instanceof OpenRouterError)
      return error(cause.message, cause.status);
    return error("The finance assistant is temporarily unavailable", 500);
  }
}

type StreamEvent =
  | { type: "status"; status: "thinking" | "reading" }
  | { type: "delta"; content: string }
  | { type: "done"; response: FinanceAgentResponse }
  | { type: "error"; error: string };

function sanitizeHistory(value: unknown) {
  if (!Array.isArray(value)) throw new RequestValidationError("Invalid chat");
  const candidate = value.slice(-MAX_MESSAGES);
  let total = 0;
  const messages: FinanceChatMessage[] = [];

  for (const item of candidate) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("role" in item) ||
      !("content" in item) ||
      (item.role !== "user" && item.role !== "assistant") ||
      typeof item.content !== "string"
    ) {
      throw new RequestValidationError("Invalid chat message");
    }
    const content = item.content.trim();
    if (!content || content.length > MAX_MESSAGE_CHARS) {
      throw new RequestValidationError("Chat message is empty or too long");
    }
    total += content.length;
    if (total > MAX_TOTAL_CHARS) {
      throw new RequestValidationError("Chat history is too large", 413);
    }
    const id =
      "id" in item && typeof item.id === "string" && item.id
        ? item.id
        : randomUUID();
    const createdAt =
      "createdAt" in item && typeof item.createdAt === "string" && item.createdAt
        ? item.createdAt
        : new Date().toISOString();
    messages.push({ id, role: item.role, content, createdAt });
  }
  return messages;
}

const PARAMETERLESS_TOOLS = new Set([
  "portfolio_get",
  "snapshots_list",
  "ledgers_list",
]);

function parseToolArguments(
  raw: unknown,
  toolName?: string,
): Record<string, unknown> {
  if (raw === null || raw === undefined) {
    return {};
  }

  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  if (typeof raw !== "string") {
    return {};
  }

  let text = raw.trim();
  if (
    !text ||
    text === "null" ||
    text === "undefined" ||
    text === "None" ||
    text === "none" ||
    text === "{}" ||
    text === "()"
  ) {
    return {};
  }

  // Fast-path for parameterless tools
  if (toolName && PARAMETERLESS_TOOLS.has(toolName)) {
    return {};
  }

  // Strip markdown code fences if present: ```json ... ``` or ``` ... ```
  text = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Try standard JSON.parse first
  try {
    const parsed = JSON.parse(text);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
    if (typeof parsed === "string") {
      // Handle double-encoded JSON strings: "\"{\\\"month\\\": ...}\""
      const inner = JSON.parse(parsed);
      if (
        typeof inner === "object" &&
        inner !== null &&
        !Array.isArray(inner)
      ) {
        return inner as Record<string, unknown>;
      }
    }
  } catch {
    // Continue to repair attempts
  }

  // Handle concatenated duplicate JSON objects e.g. {"month": "2026-09"}{"month": "2026-09"}
  const matchFirstObject = text.match(/\{[\s\S]*?\}(?=\s*\{|$)/);
  if (matchFirstObject) {
    try {
      const parsed = JSON.parse(matchFirstObject[0]);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Continue
    }
  }

  // Handle single quotes or loose dictionary syntax e.g. {'month': '2026-09'}
  try {
    const relaxed = text
      .replace(/'/g, '"')
      .replace(/,\s*([}\]])/g, "$1");
    const parsed = JSON.parse(relaxed);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Continue
  }

  // Handle unquoted keys: {month: "2026-09"}
  try {
    const unquotedFixed = text
      .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
      .replace(/'/g, '"')
      .replace(/,\s*([}\]])/g, "$1");
    const parsed = JSON.parse(unquotedFixed);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Continue
  }

  // Handle function call syntax e.g. ledger_get(month="2026-09") or ledger_get("2026-09")
  const funcCallMatch = text.match(/\(([\s\S]*)\)$/);
  if (funcCallMatch) {
    const inner = funcCallMatch[1].trim();
    if (!inner) return {};
    const args: Record<string, unknown> = {};
    const kvRegex =
      /([a-zA-Z0-9_]+)\s*[:=]\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g;
    let kvMatch;
    while ((kvMatch = kvRegex.exec(inner)) !== null) {
      const key = kvMatch[1];
      const val = kvMatch[2] ?? kvMatch[3] ?? kvMatch[4];
      if (val === "true") args[key] = true;
      else if (val === "false") args[key] = false;
      else if (!isNaN(Number(val))) args[key] = Number(val);
      else args[key] = val;
    }
    if (Object.keys(args).length > 0) {
      return args;
    }
  }

  if (toolName && PARAMETERLESS_TOOLS.has(toolName)) {
    return {};
  }

  throw new Error(
    `The model returned invalid tool arguments: ${text.slice(0, 100)}`,
  );
}

function safeJson(value: unknown) {
  const json = JSON.stringify(value);
  return json.length <= 12_000
    ? json
    : JSON.stringify({
        error: "Tool result was too large; narrow the request",
      });
}

function writeIntentFor(
  content: string,
): "ledger_entry_add" | "ledger_entry_update" | null {
  const normalized = content.toLowerCase();
  const mentionsEntry =
    /\b(ledger|ledgers|entr(?:y|ies)|transaction|transactions|expense|income|transfer)\b/.test(
      normalized,
    );
  if (
    mentionsEntry &&
    /\b(add|create|new|insert|log|open(?:\s+the)?\s+form)\b/.test(normalized)
  ) {
    return "ledger_entry_add";
  }
  if (
    mentionsEntry &&
    /\b(edit|update|change|modify)\b/.test(normalized)
  ) {
    return "ledger_entry_update";
  }
  return null;
}

function requiredToolFor(
  content: string,
  writeIntent: ReturnType<typeof writeIntentFor>,
) {
  if (writeIntent === "ledger_entry_add") {
    return monthFromMessage(content) ? "ledger_entry_add" : "ledgers_list";
  }
  const normalized = content.toLowerCase();
  if (
    /\bledger|ledgers|transaction|transactions|account(?:s)?\b/.test(normalized)
  ) {
    return "ledgers_list";
  }
  if (/\bsnapshot|snapshots\b/.test(normalized)) {
    return "snapshots_list";
  }
  if (
    /\bportfolio|holding|holdings|balance|balances|bank|banks|fund|funds\b/.test(
      normalized,
    )
  ) {
    return "portfolio_get";
  }
  return null;
}

const MONTH_NAMES: Record<string, string> = {
  january: "01",
  jan: "01",
  february: "02",
  feb: "02",
  march: "03",
  mar: "03",
  april: "04",
  apr: "04",
  may: "05",
  june: "06",
  jun: "06",
  july: "07",
  jul: "07",
  august: "08",
  aug: "08",
  september: "09",
  sep: "09",
  sept: "09",
  october: "10",
  oct: "10",
  november: "11",
  nov: "11",
  december: "12",
  dec: "12",
};

function monthFromMessage(content: string) {
  const iso = content.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  if (iso) return iso[0];
  const named = content.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\s+(20\d{2})\b/i,
  );
  if (!named) return null;
  const month = MONTH_NAMES[named[1].toLowerCase()];
  return month ? `${named[2]}-${month}` : null;
}

function draftMonthFromToolMessages(messages: OpenRouterMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "tool") continue;
    try {
      const parsed = JSON.parse(message.content) as unknown;
      if (!Array.isArray(parsed)) continue;
      const rows = parsed.filter(
        (row): row is { month: string; status?: string } =>
          typeof row === "object" &&
          row !== null &&
          "month" in row &&
          typeof row.month === "string",
      );
      if (!rows.length) continue;
      return rows.find((row) => row.status === "draft")?.month ?? rows[0].month;
    } catch {
      continue;
    }
  }
  return null;
}

async function latestDraftMonth() {
  const rows = await listLedgerSummaries();
  return rows.find((row) => row.status === "draft")?.month ?? rows[0]?.month;
}

async function openLedgerAddForm(input: {
  requestId: string;
  model: string;
  userContent: string;
  messages: OpenRouterMessage[];
}) {
  const month =
    monthFromMessage(input.userContent) ||
    draftMonthFromToolMessages(input.messages) ||
    (await latestDraftMonth());
  if (!month) {
    return { pendingAction: undefined, error: "No draft ledger found" };
  }
  const startedAt = Date.now();
  try {
    const result = await executeFinanceTool("ledger_entry_add", { month });
    try {
      await logAgentToolCall({
        requestId: input.requestId,
        model: input.model,
        toolCallId: `auto-ledger-add-${randomUUID()}`,
        toolName: "ledger_entry_add",
        arguments: { month },
        result: boundedJsonValue(result.output),
        durationMs: Date.now() - startedAt,
      });
    } catch (logError) {
      console.error("Could not persist auto ledger add log:", logError);
    }
    return { pendingAction: result.pendingAction, error: undefined };
  } catch (cause) {
    const error =
      cause instanceof Error ? cause.message : "Could not open add form";
    try {
      await logAgentToolCall({
        requestId: input.requestId,
        model: input.model,
        toolCallId: `auto-ledger-add-${randomUUID()}`,
        toolName: "ledger_entry_add",
        arguments: { month },
        error,
        durationMs: Date.now() - startedAt,
      });
    } catch (logError) {
      console.error("Could not persist auto ledger add log:", logError);
    }
    return { pendingAction: undefined, error };
  }
}

function boundedJsonValue(value: unknown) {
  try {
    return JSON.parse(safeJson(value)) as unknown;
  } catch {
    return { error: "Value could not be serialized for logs" };
  }
}

function buildResponse(
  content: string,
  actions: PendingAgentAction[],
  model: string,
): FinanceAgentResponse {
  return {
    message: {
      id: randomUUID(),
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
      actions,
    },
    model,
  };
}

class RequestValidationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
