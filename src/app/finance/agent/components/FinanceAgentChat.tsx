"use client";

import { FormEvent, Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  FinanceAgentResponse,
  FinanceChatMessage,
  PendingAgentAction,
} from "@/lib/finance-agent/types";
import {
  FinanceToast,
  type FinanceToastState,
} from "../../components/FinanceToast";
import { financeStyles } from "../../components/FinanceUI";
import { LedgerEntryChatForm } from "./LedgerEntryChatForm";

const MAX_STORED_MESSAGES = 30;
const prompts = [
  "Summarize my current portfolio.",
  "Show my latest snapshots.",
  "List my monthly ledgers.",
  "Compare my current portfolio with the latest snapshot.",
];

export function FinanceAgentChat() {
  const [messages, setMessages] = useState<FinanceChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<FinanceToastState>(null);
  const [failedRequest, setFailedRequest] = useState<
    FinanceChatMessage[] | null
  >(null);
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/finance-agent/messages")
      .then(async (response) => {
        const body = (await response.json()) as {
          messages?: FinanceChatMessage[];
          error?: string;
        };
        if (!response.ok) throw new Error(body.error || "Could not load chat");
        if (!cancelled) setMessages(body.messages ?? []);
      })
      .catch((cause) => {
        if (cancelled) return;
        setToast({
          tone: "error",
          message:
            cause instanceof Error ? cause.message : "Could not load chat",
        });
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, thinking, streaming]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function submit(
    content: string,
    historyOverride?: FinanceChatMessage[],
  ) {
    const text = content.trim();
    if (!text || loading) return;
    const userMessage: FinanceChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const baseMessages = historyOverride ?? messages;
    const nextMessages = [...baseMessages, userMessage].slice(
      -MAX_STORED_MESSAGES,
    );
    setMessages(nextMessages);
    setFailedRequest(null);
    setInput("");
    setLoading(true);
    setStreaming(false);
    setThinking("Thinking…");

    try {
      const response = await fetch("/api/finance-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "The assistant could not respond");
      }
      const assistantId = crypto.randomUUID();
      let streamedContent = "";
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const addOrUpdateAssistant = (content: string) => {
        setMessages((current) => {
          const existing = current.some(
            (message) => message.id === assistantId,
          );
          const message: FinanceChatMessage = {
            id: assistantId,
            role: "assistant",
            content,
            createdAt: new Date().toISOString(),
          };
          return existing
            ? current.map((item) =>
                item.id === assistantId ? { ...item, content } : item,
              )
            : [...current, message].slice(-MAX_STORED_MESSAGES);
        });
      };
      let completed = false;
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder
          .decode(value || new Uint8Array(), { stream: !done })
          .replace(/\r\n/g, "\n");
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const event of events) {
          const line = event
            .split("\n")
            .find((item) => item.startsWith("data:"));
          if (!line) continue;
          const item = JSON.parse(line.slice(5).trim()) as
            | { type: "status"; status: "thinking" | "reading" }
            | { type: "delta"; content: string }
            | { type: "done"; response: FinanceAgentResponse }
            | { type: "error"; error: string };
          if (item.type === "status") {
            if (!streamedContent) {
              setThinking(
                item.status === "reading"
                  ? "Reading your finance data…"
                  : "Thinking…",
              );
            }
          } else if (item.type === "delta") {
            streamedContent += item.content;
            setStreaming(true);
            setThinking(null);
            addOrUpdateAssistant(streamedContent);
          } else if (item.type === "done") {
            completed = true;
            setThinking(null);
            setStreaming(false);
            setMessages((current) => {
              const next = current.some(
                (message) => message.id === assistantId,
              )
                ? current.map((message) =>
                    message.id === assistantId
                      ? item.response.message
                      : message,
                  )
                : [...current, item.response.message];
              return next.slice(-MAX_STORED_MESSAGES);
            });
          } else {
            throw new Error(item.error);
          }
        }
        if (done) break;
      }
      if (!completed)
        throw new Error("The assistant stream ended unexpectedly");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not send message";
      const errorMessage: FinanceChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `I couldn't complete that request.\n\n${message}`,
        createdAt: new Date().toISOString(),
        isError: true,
      };
      setFailedRequest(nextMessages);
      setMessages((current) =>
        [...current, errorMessage].slice(-MAX_STORED_MESSAGES),
      );
      setToast({
        tone: "error",
        message,
      });
    } finally {
      setLoading(false);
      setThinking(null);
      setStreaming(false);
    }
  }

  function retryFailedRequest() {
    const lastUserMessage = failedRequest?.at(-1);
    if (!lastUserMessage || lastUserMessage.role !== "user") return;
    void submit(lastUserMessage.content, failedRequest!.slice(0, -1));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit(input);
  }

  async function updateAction(
    actionId: string,
    intent: "confirm" | "cancel",
    entry?: Record<string, unknown>,
  ) {
    setMessages((current) =>
      mapAction(current, actionId, (action) => ({
        ...action,
        status: "executing",
      })),
    );
    try {
      const response = await fetch(
        `/api/finance-agent/actions/${encodeURIComponent(actionId)}/${intent}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry ? { entry } : {}),
        },
      );
      const body = (await response.json()) as {
        action?: PendingAgentAction;
        error?: string;
      };
      if (!response.ok || !body.action) {
        throw new Error(body.error || `Could not ${intent} action`);
      }
      setMessages((current) =>
        mapAction(current, actionId, () => body.action!),
      );
      setToast({
        tone: intent === "confirm" ? "success" : "info",
        message:
          intent === "confirm" ? "Finance data updated." : "Action cancelled.",
      });
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Action request failed";
      setMessages((current) =>
        mapAction(current, actionId, (action) => ({
          ...action,
          status: "failed",
          error: message,
        })),
      );
      setToast({ tone: "error", message });
    }
  }

  async function clearChat() {
    try {
      const response = await fetch("/api/finance-agent/messages", {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Could not clear chat");
      }
      setMessages([]);
      setFailedRequest(null);
    } catch (cause) {
      setToast({
        tone: "error",
        message:
          cause instanceof Error ? cause.message : "Could not clear chat",
      });
    }
  }

  return (
    <>
      <div className={`${financeStyles.card} overflow-hidden`}>
        <div className="flex h-[min(680px,calc(100dvh))] min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3 sm:px-6">
            <div>
              <p className="text-sm font-bold text-white">Finance assistant</p>
              <p className="text-xs text-slate-500">
                Reads live data · writes require confirmation
              </p>
            </div>
            <button
              type="button"
              className={financeStyles.secondary}
              disabled={!messages.length || loading}
              onClick={() => void clearChat()}
            >
              Clear chat
            </button>
          </div>

          <div
            className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6"
            aria-live="polite"
          >
            {!ready ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Loading conversation…
              </p>
            ) : !messages.length ? (
              <EmptyState onPrompt={(prompt) => void submit(prompt)} />
            ) : (
              messages.map((message) => (
                <Message
                  key={message.id}
                  message={message}
                  onAction={(id, intent, entry) =>
                    void updateAction(id, intent, entry)
                  }
                  onRetry={message.isError ? retryFailedRequest : undefined}
                />
              ))
            )}
            {loading && !streaming ? (
              <ThinkingIndicator label={thinking ?? "Thinking…"} />
            ) : null}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={onSubmit}
            className="sticky bottom-0 border-t border-white/8 bg-slate-950/90 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:p-4"
          >
            <div className="flex items-end gap-2">
              <textarea
                aria-label="Message the finance assistant"
                className={`${financeStyles.input} max-h-36 min-h-12 resize-none py-3`}
                rows={1}
                maxLength={4000}
                placeholder="Ask about your portfolio, snapshots, or ledger…"
                value={input}
                disabled={loading || !ready}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button
                type="submit"
                className={`${financeStyles.primary} min-h-12 shrink-0 px-5`}
                disabled={loading || !ready || !input.trim()}
              >
                Send
              </button>
            </div>
            <p className="mt-2 px-1 text-[11px] text-slate-600">
              Relevant finance data is sent to OpenRouter to answer requests.
            </p>
          </form>
        </div>
      </div>
      <FinanceToast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

function EmptyState({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center py-10 text-center sm:py-16">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xl text-cyan-300">
        ✦
      </div>
      <h2 className="mt-5 text-xl font-bold text-white">
        What would you like to know?
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        I can inspect live holdings, snapshots, and monthly ledgers. Any change
        is staged for your explicit confirmation.
      </p>
      <div className="mt-7 grid w-full gap-2 sm:grid-cols-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="min-h-11 rounded-xl border border-white/8 bg-white/[0.035] px-4 py-3 text-left text-sm text-slate-300 transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.06] hover:text-white"
            onClick={() => onPrompt(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({
  message,
  onAction,
  onRetry,
}: {
  message: FinanceChatMessage;
  onAction: (
    id: string,
    intent: "confirm" | "cancel",
    entry?: Record<string, unknown>,
  ) => void;
  onRetry?: () => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[92%] sm:max-w-[78%] ${isUser ? "" : "w-full"}`}>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
            isUser
              ? "rounded-br-md bg-cyan-300 text-slate-950"
              : "rounded-bl-md border border-white/8 bg-white/[0.04] text-slate-200"
          }`}
        >
          {isUser ? (
            message.content
          ) : (
            <MarkdownMessage content={message.content} />
          )}
        </div>
        {message.isError && onRetry ? (
          <button
            type="button"
            className={`${financeStyles.secondary} mt-2`}
            onClick={onRetry}
          >
            Retry request
          </button>
        ) : null}
        {message.actions?.map((action) => (
          <ActionCard key={action.id} action={action} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (
      index + 1 < lines.length &&
      line.includes("|") &&
      /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])
    ) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (
        index < lines.length &&
        lines[index].includes("|") &&
        lines[index].trim()
      ) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push(
        <div key={`table-${index}`} className="my-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead>
              <tr>
                {headers.map((header, cellIndex) => (
                  <th
                    key={cellIndex}
                    className="border-b border-white/15 px-3 py-2 font-bold text-cyan-200"
                  >
                    <InlineMarkdown text={header} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="even:bg-white/[0.03]">
                  {headers.map((_, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="border-b border-white/8 px-3 py-2 text-slate-300"
                    >
                      <InlineMarkdown text={row[cellIndex] || ""} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push(
        <p key={index} className="mb-2 text-sm font-bold text-white">
          <InlineMarkdown text={heading[2]} />
        </p>,
      );
      index += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items: string[] = [];
      while (
        index < lines.length &&
        (ordered
          ? /^\d+\.\s+/.test(lines[index])
          : /^[-*]\s+/.test(lines[index]))
      ) {
        items.push(
          lines[index].replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, ""),
        );
        index += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List
          key={`list-${index}`}
          className={`${ordered ? "list-decimal" : "list-disc"} mb-3 space-y-1 pl-5`}
        >
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <InlineMarkdown text={item} />
            </li>
          ))}
        </List>,
      );
      continue;
    }
    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,3})\s|^[-*]\s+|^\d+\.\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(
      <p key={`paragraph-${index}`} className="mb-3 last:mb-0">
        <InlineMarkdown text={paragraph.join(" ")} />
      </p>,
    );
  }
  return <div className="break-words">{blocks}</div>;
}

function InlineMarkdown({ text }: { text: string }) {
  const pattern =
    /(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  return text.split(pattern).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) {
      return (
        <a
          key={index}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="text-cyan-300 underline"
        >
          {link[1]}
        </a>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-black/25 px-1 py-0.5 text-cyan-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (
      (part.startsWith("*") && part.endsWith("*")) ||
      (part.startsWith("_") && part.endsWith("_"))
    ) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function tableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function ActionCard({
  action,
  onAction,
}: {
  action: PendingAgentAction;
  onAction: (
    id: string,
    intent: "confirm" | "cancel",
    entry?: Record<string, unknown>,
  ) => void;
}) {
  const pending = action.status === "pending";
  const executing = action.status === "executing";
  const showForm = Boolean(action.form) && (pending || executing);
  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-amber-300/20 bg-amber-300/[0.045]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300/10 px-4 py-3">
        <p className="text-sm font-bold text-amber-100">
          {action.preview.title}
        </p>
        <span className="rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200">
          {action.status}
        </span>
      </div>
      <div className="space-y-3 px-4 py-3">
        {showForm && action.form ? (
          <LedgerEntryChatForm
            form={action.form}
            busy={executing}
            onSubmit={(entry) => onAction(action.id, "confirm", entry)}
            onCancel={() => onAction(action.id, "cancel")}
          />
        ) : (
          <>
            {action.preview.before !== undefined ? (
              <Preview label="Before" value={action.preview.before} />
            ) : null}
            {action.preview.after !== undefined ? (
              <Preview label="After" value={action.preview.after} />
            ) : null}
          </>
        )}
        {action.error ? (
          <p className="text-xs text-rose-300">{action.error}</p>
        ) : null}
        {!showForm && (pending || executing) ? (
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button
              type="button"
              className={financeStyles.primary}
              disabled={executing}
              onClick={() => onAction(action.id, "confirm")}
            >
              {executing ? "Working…" : "Confirm change"}
            </button>
            <button
              type="button"
              className={financeStyles.secondary}
              disabled={executing}
              onClick={() => onAction(action.id, "cancel")}
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Preview({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 p-3 text-xs leading-5 text-slate-300">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function ThinkingIndicator({ label }: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-3 rounded-2xl rounded-bl-md border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3">
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:-300ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:-150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300" />
        </span>
        <p className="text-sm text-cyan-100">{label}</p>
      </div>
    </div>
  );
}

function mapAction(
  messages: FinanceChatMessage[],
  actionId: string,
  update: (action: PendingAgentAction) => PendingAgentAction,
) {
  return messages.map((message) => ({
    ...message,
    actions: message.actions?.map((action) =>
      action.id === actionId ? update(action) : action,
    ),
  }));
}

