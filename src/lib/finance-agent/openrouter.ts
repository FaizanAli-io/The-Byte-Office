import "server-only";
import type { OpenRouterTool } from "./tools";

export type OpenRouterMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: OpenRouterToolCall[];
    }
  | {
      role: "tool";
      content: string;
      tool_call_id: string;
      name: string;
    };

export type OpenRouterToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type OpenRouterToolChoice = {
  type: "function";
  function: { name: string };
};

export type OpenRouterAssistantMessage = {
  role: "assistant";
  content: string | null;
  tool_calls?: OpenRouterToolCall[];
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "z-ai/glm-5.2:free";
const FALLBACK_MODELS = [
  "inclusionai/ling-3.0-flash-fin:free",
  "poolside/laguna-s-2.1:free",
];

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function formatOpenRouterErrorForUser(error: unknown) {
  if (!(error instanceof OpenRouterError)) {
    return "The finance assistant is temporarily unavailable";
  }
  if (isSharedQuotaError(error)) {
    const model = process.env.OPENROUTER_MODEL?.trim();
    const usingFree =
      !model ||
      model.endsWith(":free") ||
      model === "openrouter/free" ||
      model === DEFAULT_MODEL;
    if (usingFree) {
      return (
        "OpenRouter free model quota is exhausted for today. Free accounts get 50 requests per day; " +
        "adding $10 in credits at openrouter.ai unlocks 1,000 free requests per day. " +
        "You can also wait until tomorrow, or set OPENROUTER_MODEL in .env to a paid tool-capable model."
      );
    }
    return `OpenRouter rate limit reached for ${model}. Try again later or choose another model in OPENROUTER_MODEL.`;
  }
  if (error.status === 503 && error.message.includes("not configured")) {
    return "OpenRouter is not configured. Set OPENROUTER_API_KEY in .env and restart the app.";
  }
  return error.message;
}

export async function requestOpenRouter(input: {
  messages: OpenRouterMessage[];
  tools: OpenRouterTool[];
  onText?: (text: string) => void;
  toolChoice?: "auto" | "required" | OpenRouterToolChoice;
}) {
  const explicitModel = process.env.OPENROUTER_MODEL?.trim();
  const modelsToTry = explicitModel
    ? [explicitModel]
    : [DEFAULT_MODEL, ...FALLBACK_MODELS.filter((m) => m !== DEFAULT_MODEL)];

  let lastError: unknown;
  for (const model of modelsToTry) {
    try {
      return await requestModel(model, input);
    } catch (cause) {
      lastError = cause;
      if (!(cause instanceof OpenRouterError)) {
        throw cause;
      }
      if (isSharedQuotaError(cause)) {
        throw new OpenRouterError(formatOpenRouterErrorForUser(cause), 429);
      }
      if (!shouldTryNextModel(cause, modelsToTry.length > 1)) {
        throw cause;
      }
      console.warn(
        `OpenRouter model ${model} failed with status ${cause.status} (${cause.message}), trying next model...`,
      );
    }
  }
  throw lastError;
}

function shouldTryNextModel(error: OpenRouterError, hasFallback: boolean) {
  if (!hasFallback) return false;
  return [404, 500, 502, 503].includes(error.status);
}

function isSharedQuotaError(error: OpenRouterError) {
  if (error.status !== 429) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("free-models-per-day") ||
    message.includes("rate limit exceeded") ||
    message.includes("rate-limited") ||
    message.includes("too many requests")
  );
}

async function requestModel(
  model: string,
  input: {
    messages: OpenRouterMessage[];
    tools: OpenRouterTool[];
    onText?: (text: string) => void;
    toolChoice?: "auto" | "required" | OpenRouterToolChoice;
  },
): Promise<{ message: OpenRouterAssistantMessage; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenRouterError("OpenRouter is not configured", 503);
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "The Byte Office Finance Agent",
    },
    body: JSON.stringify({
      model,
      messages: input.messages,
      tools: input.tools,
      stream: true,
      tool_choice: input.toolChoice || "auto",
      temperature: 0.2,
      max_tokens: 1200,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new OpenRouterError(
      openRouterMessage(body) ||
        `OpenRouter request failed with status ${response.status}`,
      response.status,
    );
  }

  if (!response.body) {
    throw new OpenRouterError("OpenRouter returned no stream", 502);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let responseModel = model;
  const toolCalls: OpenRouterToolCall[] = [];

  const consume = (data: string) => {
    if (data === "[DONE]") return;
    let chunk: {
      model?: string;
      choices?: Array<{
        delta?: {
          content?: string | null;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            type?: "function";
            function?: { name?: string; arguments?: unknown };
          }>;
        };
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            type?: "function";
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

    const rawToolCalls =
      delta?.tool_calls || choice?.message?.tool_calls || [];
    for (const call of rawToolCalls) {
      let current: OpenRouterToolCall | undefined;
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
          type: "function" as const,
          function: { name: "", arguments: "" },
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

      if (
        call.function?.arguments !== undefined &&
        call.function?.arguments !== null
      ) {
        const rawArgs =
          typeof call.function.arguments === "object"
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
    buffer += decoder
      .decode(value || new Uint8Array(), { stream: !done })
      .replace(/\r\n/g, "\n");
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const event of events) {
      const data = event
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");
      if (data) consume(data);
    }
    if (done) break;
  }
  if (buffer.trim()) {
    const data = buffer
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    if (data) consume(data);
  }

  const validToolCalls = toolCalls
    .map((tc) => ({
      ...tc,
      function: {
        name: tc.function.name.replace(/^functions\./, "").trim(),
        arguments: tc.function.arguments.trim(),
      },
    }))
    .filter((tc) => Boolean(tc.function.name));

  return {
    message: {
      role: "assistant",
      content: content || null,
      tool_calls: validToolCalls.length ? validToolCalls : undefined,
    },
    model: responseModel,
  };
}

function openRouterMessage(body: string) {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string };
      message?: string;
    };
    return parsed.error?.message || parsed.message || "";
  } catch {
    return body.slice(0, 300);
  }
}
