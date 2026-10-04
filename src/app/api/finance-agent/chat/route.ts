import { randomUUID } from 'crypto';
import { formatGroqErrorForUser, GroqError, PRIMARY_MODEL, requestGroq, type GroqMessage } from '@/lib/agent/groq';
import { getAgentRuntime } from '@/lib/agent/runtime';
import type { AgentResponse, AgentChatMessage, PendingAgentAction } from '@/lib/agent/types';
import { getConversation, logAgentToolCall, saveAgentMessage } from '@/lib/agent/repository';
import { NextResponse } from 'next/server';

// Worst case is MAX_TOOL_ROUNDS Groq calls, each with its own timeout.
export const maxDuration = 300;

const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_TOTAL_CHARS = 24_000;
const MAX_TOOL_ROUNDS = 6;
const MAX_TOOL_CALLS = 8;

type StreamEvent =
  | { type: 'status'; status: 'thinking' | 'reading' }
  | { type: 'delta'; content: string }
  | { type: 'done'; response: AgentResponse }
  | { type: 'error'; error: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { chatId?: unknown; messages?: unknown };
    const chatId = typeof body.chatId === 'string' ? body.chatId : '';
    if (!chatId || !(await getConversation(chatId))) return error('Chat not found', 404);

    const runtime = getAgentRuntime();
    const history = sanitizeHistory(body.messages);
    const lastUser = history.at(-1);
    if (!lastUser || lastUser.role !== 'user') return error('A user message is required', 400);

    await saveAgentMessage(chatId, lastUser);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: StreamEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        try {
          send({ type: 'status', status: 'thinking' });

          const messages: GroqMessage[] = [
            { role: 'system', content: runtime.systemPrompt },
            ...history.map(({ role, content }) => ({ role, content })),
          ];
          const pendingActions: PendingAgentAction[] = [];
          const requestId = randomUUID();
          let toolCalls = 0;
          let model = PRIMARY_MODEL;
          let streamedText = '';
          let finalText = '';

          for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
            // The client has gone away; stop burning Groq calls on a response
            // nobody will read.
            if (request.signal.aborted) return;
            if (round > 0) send({ type: 'status', status: 'reading' });

            const response = await requestGroq({
              messages,
              tools: runtime.tools,
              onText: (text) => {
                streamedText += text;
                send({ type: 'delta', content: text });
              },
            });
            model = response.model;
            messages.push(response.message);

            if (!response.message.tool_calls?.length) {
              finalText = response.message.content || 'I could not produce a response.';
              break;
            }

            toolCalls += response.message.tool_calls.length;
            if (toolCalls > MAX_TOOL_CALLS) {
              finalText = 'I reached the safe tool-call limit. Please narrow the request.';
              break;
            }

            send({ type: 'status', status: 'reading' });
            for (const call of response.message.tool_calls) {
              const toolName = call.function.name;
              const startedAt = Date.now();
              let toolArgs: Record<string, unknown> = {};
              let toolOutput: unknown;
              let toolError: string | undefined;

              try {
                toolArgs = parseToolArguments(call.function.arguments);
                const result = await runtime.execute(toolName, toolArgs);
                toolOutput = result.output;
                if (result.pendingAction) pendingActions.push(result.pendingAction);
              } catch (cause) {
                toolError = cause instanceof Error ? cause.message : 'Tool execution failed';
                toolOutput = { error: toolError };
              }

              await logAgentToolCall({
                requestId,
                model,
                toolCallId: call.id,
                toolName,
                arguments: boundedJsonValue(
                  toolError ? { raw: call.function.arguments ?? null, parsed: toolArgs } : toolArgs
                ),
                result: toolError ? undefined : boundedJsonValue(toolOutput),
                error: toolError,
                durationMs: Date.now() - startedAt,
              }).catch((cause) => console.error('Could not persist finance agent tool log:', cause));

              messages.push({
                role: 'tool',
                tool_call_id: call.id,
                name: toolName,
                content: safeJson(toolOutput),
              });
            }
          }

          const content =
            streamedText || finalText || 'I reached the safe reasoning limit. Please try a more focused request.';
          const response: AgentResponse = {
            message: {
              id: randomUUID(),
              role: 'assistant',
              content,
              createdAt: new Date().toISOString(),
              actions: pendingActions,
            },
            model,
          };

          await saveAgentMessage(chatId, response.message).catch((cause) =>
            console.error('Could not persist finance agent assistant message:', cause)
          );
          send({ type: 'done', response });
        } catch (cause) {
          console.error('POST /api/finance-agent/chat stream error:', cause);
          const message = formatGroqErrorForUser(cause);
          await saveAgentMessage(chatId, {
            id: randomUUID(),
            role: 'assistant',
            content: `I couldn't complete that request.\n\n${message}`,
            createdAt: new Date().toISOString(),
            isError: true,
          }).catch((persistError) => console.error('Could not persist finance agent error message:', persistError));
          send({ type: 'error', error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream',
      },
    });
  } catch (cause) {
    console.error('POST /api/finance-agent/chat error:', cause);
    if (cause instanceof RequestValidationError) return error(cause.message, cause.status);
    if (cause instanceof GroqError) return error(cause.message, cause.status);
    return error('The assistant is temporarily unavailable', 500);
  }
}

function sanitizeHistory(value: unknown): AgentChatMessage[] {
  if (!Array.isArray(value)) throw new RequestValidationError('Invalid chat');

  let total = 0;
  return value.slice(-MAX_MESSAGES).map((item) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('role' in item) ||
      !('content' in item) ||
      (item.role !== 'user' && item.role !== 'assistant') ||
      typeof item.content !== 'string'
    ) {
      throw new RequestValidationError('Invalid chat message');
    }

    const content = item.content.trim();
    if (!content || content.length > MAX_MESSAGE_CHARS) {
      throw new RequestValidationError('Chat message is empty or too long');
    }
    total += content.length;
    if (total > MAX_TOTAL_CHARS) throw new RequestValidationError('Chat history is too large', 413);

    return {
      id: 'id' in item && typeof item.id === 'string' && item.id ? item.id : randomUUID(),
      role: item.role,
      content,
      createdAt:
        'createdAt' in item && typeof item.createdAt === 'string' && item.createdAt
          ? item.createdAt
          : new Date().toISOString(),
    };
  });
}

function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== 'string') return {};

  const text = raw.trim();
  // Models routinely signal "no arguments" with something other than `{}`.
  if (!text || text === '{}' || text === 'null' || text === 'undefined' || text === 'None') return {};

  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through to a single, clear error
  }
  throw new Error(`The model returned invalid tool arguments: ${text.slice(0, 100)}`);
}

function safeJson(value: unknown) {
  const json = JSON.stringify(value);
  return json.length <= 12_000 ? json : JSON.stringify({ error: 'Tool result was too large; narrow the request' });
}

function boundedJsonValue(value: unknown) {
  try {
    return JSON.parse(safeJson(value)) as unknown;
  } catch {
    return { error: 'Value could not be serialized for logs' };
  }
}

class RequestValidationError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
