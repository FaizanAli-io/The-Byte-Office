import 'server-only';
import type { GroqTool } from './tools';

export type GroqMessage =
  | { role: 'system' | 'user'; content: string }
  | {
      role: 'assistant';
      content: string | null;
      tool_calls?: GroqToolCall[];
    }
  | {
      role: 'tool';
      content: string;
      tool_call_id: string;
      name: string;
    };

export type GroqToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type GroqToolChoice = {
  type: 'function';
  function: { name: string };
};

export type GroqAssistantMessage = {
  role: 'assistant';
  content: string | null;
  tool_calls?: GroqToolCall[];
};

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const PRIMARY_MODEL = 'openai/gpt-oss-20b';
export const FALLBACK_MODEL = 'openai/gpt-oss-120b';

export class GroqError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export function formatGroqErrorForUser(error: unknown) {
  if (!(error instanceof GroqError)) {
    return 'The finance assistant is temporarily unavailable';
  }
  if (isRateLimitError(error)) {
    return error.message.includes(FALLBACK_MODEL)
      ? error.message
      : `Groq rate limit reached for ${PRIMARY_MODEL}. Try again later.`;
  }
  if (error.status === 503 && error.message.includes('not configured')) {
    return 'Groq is not configured. Set GROQ_API_KEY in .env and restart the app.';
  }
  return error.message;
}

export async function requestGroq(input: {
  messages: GroqMessage[];
  tools: GroqTool[];
  onText?: (text: string) => void;
  toolChoice?: 'auto' | 'required' | GroqToolChoice;
}) {
  let streamed = false;
  const onText = (text: string) => {
    streamed = true;
    input.onText?.(text);
  };

  try {
    return await requestModel({ ...input, model: PRIMARY_MODEL, onText });
  } catch (cause) {
    if (!isRateLimitError(cause) || streamed) {
      throw cause;
    }
    try {
      return await requestModel({ ...input, model: FALLBACK_MODEL, onText });
    } catch (fallbackCause) {
      if (isRateLimitError(fallbackCause)) {
        throw new GroqError(
          `Groq rate limit reached for ${PRIMARY_MODEL} and ${FALLBACK_MODEL}. Try again later.`,
          429
        );
      }
      throw fallbackCause;
    }
  }
}

function isRateLimitError(error: unknown) {
  return error instanceof GroqError && error.status === 429;
}

async function requestModel(input: {
  model: string;
  messages: GroqMessage[];
  tools: GroqTool[];
  onText?: (text: string) => void;
  toolChoice?: 'auto' | 'required' | GroqToolChoice;
}): Promise<{ message: GroqAssistantMessage; model: string }> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new GroqError('Groq is not configured', 503);
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      tools: input.tools,
      stream: true,
      tool_choice: input.toolChoice || 'auto',
      temperature: 0.25,
      max_tokens: 4096,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new GroqError(groqMessage(body) || `Groq request failed with status ${response.status}`, response.status);
  }

  if (!response.body) {
    throw new GroqError('Groq returned no stream', 502);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let responseModel = input.model;
  const toolCalls: GroqToolCall[] = [];

  const consume = (data: string) => {
    if (data === '[DONE]') return;
    let chunk: {
      model?: string;
      choices?: Array<{
        delta?: {
          content?: string | null;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            type?: 'function';
            function?: { name?: string; arguments?: unknown };
          }>;
        };
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            type?: 'function';
            function?: { name?: string; arguments?: unknown };
          }>;
        };
      }>;
    };
    try {
      chunk = JSON.parse(data);
    } catch {
      return;
    }
    responseModel = chunk.model || responseModel;
    const choice = chunk.choices?.[0];
    const delta = choice?.delta;
    if (delta?.content) {
      content += delta.content;
      input.onText?.(delta.content);
    } else if (choice?.message?.content && !content) {
      content = choice.message.content;
      input.onText?.(content);
    }

    const rawToolCalls = delta?.tool_calls || choice?.message?.tool_calls || [];
    for (const call of rawToolCalls) {
      let current: GroqToolCall | undefined;
      if (call.index !== undefined) {
        current = toolCalls[call.index];
      } else if (call.id) {
        current = toolCalls.find((tc) => tc.id === call.id);
      } else if (toolCalls.length > 0) {
        current = toolCalls[0];
      }

      if (!current) {
        current = {
          id: call.id || `call_${toolCalls.length}`,
          type: 'function' as const,
          function: { name: '', arguments: '' },
        };
        if (call.index !== undefined) {
          toolCalls[call.index] = current;
        } else {
          toolCalls.push(current);
        }
      }

      if (call.id && !current.id) {
        current.id = call.id;
      }

      if (call.function?.name) {
        const namePart = String(call.function.name);
        if (!current.function.name) {
          current.function.name = namePart;
        } else if (current.function.name === namePart) {
          // Exact duplicate name from provider chunk
        } else if (namePart.startsWith(current.function.name)) {
          current.function.name = namePart;
        } else {
          current.function.name += namePart;
        }
      }

      if (call.function?.arguments !== undefined && call.function?.arguments !== null) {
        const rawArgs =
          typeof call.function.arguments === 'object'
            ? JSON.stringify(call.function.arguments)
            : String(call.function.arguments);

        if (!current.function.arguments) {
          current.function.arguments = rawArgs;
        } else if (current.function.arguments === rawArgs) {
          // Exact duplicate arguments chunk
        } else if (rawArgs.startsWith(current.function.arguments)) {
          // Cumulative arguments snapshot
          current.function.arguments = rawArgs;
        } else {
          current.function.arguments += rawArgs;
        }
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, '\n');
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const event of events) {
      const data = event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('');
      if (data) consume(data);
    }
    if (done) break;
  }
  if (buffer.trim()) {
    const data = buffer
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('');
    if (data) consume(data);
  }

  const validToolCalls = toolCalls
    .map((tc) => ({
      ...tc,
      function: {
        name: tc.function.name.replace(/^functions\./, '').trim(),
        arguments: tc.function.arguments.trim(),
      },
    }))
    .filter((tc) => Boolean(tc.function.name));

  return {
    message: {
      role: 'assistant',
      content: content || null,
      tool_calls: validToolCalls.length ? validToolCalls : undefined,
    },
    model: responseModel,
  };
}

function groqMessage(body: string) {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string };
      message?: string;
    };
    return parsed.error?.message || parsed.message || '';
  } catch {
    return body.slice(0, 300);
  }
}
