'use client';

import { FormEvent, Fragment, useEffect, useRef, useState } from 'react';
import type { AgentConversation, AgentResponse, AgentChatMessage, PendingAgentAction } from '@/lib/agent/types';
import { agentApi } from '@/lib/api-client';
import { errorMessage } from '@/lib/client-api';
import { FinanceToast, type FinanceToastState } from '../../components/FinanceToast';
import { financeStyles } from '../../components/FinanceUI';
import { EmptyState, Message, ThinkingIndicator } from './ChatMessage';

const MAX_STORED_MESSAGES = 30;
const ACTIVE_CHAT_KEY = 'tbo_agent_chat_id';
const copy = {
  subtitle: 'TBO · finance · personal · writes need confirmation',
  placeholder: 'Ask about TBO, finance, or personal data…',
  empty:
    'I can explain The Byte Office, work with finance data, and update prayers or health readings. Writes wait for your confirmation.',
  prompts: [
    'What can The Byte Office build for a SaaS team?',
    'Summarize my current portfolio.',
    'How many prayers have I missed?',
    'Add a health reading for water of 8.',
  ],
};

export function FinanceAgentChat() {
  const [chats, setChats] = useState<AgentConversation[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<FinanceToastState>(null);
  const [failedRequest, setFailedRequest] = useState<AgentChatMessage[] | null>(null);
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function loadChats() {
    const { chats: loaded } = await agentApi.listChats();
    let next = loaded ?? [];
    if (!next.length) {
      const { chat } = await agentApi.createChat();
      if (!chat) throw new Error('Could not create chat');
      next = [chat];
    }
    setChats(next);
    const stored = window.localStorage.getItem(ACTIVE_CHAT_KEY);
    const selected = next.find((chat) => chat.id === stored)?.id ?? next[0].id;
    setChatId(selected);
    window.localStorage.setItem(ACTIVE_CHAT_KEY, selected);
    return selected;
  }

  async function loadMessages(id: string) {
    const { messages: loaded } = await agentApi.messages(id);
    setMessages(loaded ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setMessages([]);
    setChats([]);
    setChatId(null);
    void loadChats()
      .then(async (id) => {
        if (cancelled) return;
        await loadMessages(id);
      })
      .catch((cause) => {
        if (cancelled) return;
        setToast({
          tone: 'error',
          message: cause instanceof Error ? cause.message : 'Could not load chat',
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
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, thinking, streaming]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function submit(content: string, historyOverride?: AgentChatMessage[], retry = false) {
    const text = content.trim();
    if (!text || loading || !chatId) return;
    const nextMessages = (
      retry && historyOverride
        ? historyOverride
        : [
            ...(historyOverride ?? messages),
            {
              id: crypto.randomUUID(),
              role: 'user' as const,
              content: text,
              createdAt: new Date().toISOString(),
            },
          ]
    ).slice(-MAX_STORED_MESSAGES);
    setMessages(nextMessages);
    setFailedRequest(null);
    setInput('');
    setLoading(true);
    setStreaming(false);
    setThinking('Thinking…');

    try {
      const latest = nextMessages.at(-1)!;
      const response = await agentApi.streamChat(
        chatId,
        retry ? undefined : { id: latest.id, content: latest.content }
      );
      if (!response.ok || !response.body) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || 'The assistant could not respond');
      }
      const assistantId = crypto.randomUUID();
      let streamedContent = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const addOrUpdateAssistant = (content: string) => {
        setMessages((current) => {
          const existing = current.some((message) => message.id === assistantId);
          const message: AgentChatMessage = {
            id: assistantId,
            role: 'assistant',
            content,
            createdAt: new Date().toISOString(),
          };
          return existing
            ? current.map((item) => (item.id === assistantId ? { ...item, content } : item))
            : [...current, message].slice(-MAX_STORED_MESSAGES);
        });
      };
      let completed = false;
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, '\n');
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const event of events) {
          const line = event.split('\n').find((item) => item.startsWith('data:'));
          if (!line) continue;
          const item = JSON.parse(line.slice(5).trim()) as
            | { type: 'status'; status: 'thinking' | 'reading' }
            | { type: 'delta'; content: string }
            | { type: 'done'; response: AgentResponse }
            | { type: 'error'; error: string };
          if (item.type === 'status') {
            if (!streamedContent) {
              setThinking(item.status === 'reading' ? 'Reading workspace data…' : 'Thinking…');
            }
          } else if (item.type === 'delta') {
            streamedContent += item.content;
            setStreaming(true);
            setThinking(null);
            addOrUpdateAssistant(streamedContent);
          } else if (item.type === 'done') {
            completed = true;
            setThinking(null);
            setStreaming(false);
            setMessages((current) => {
              const next = current.some((message) => message.id === assistantId)
                ? current.map((message) => (message.id === assistantId ? item.response.message : message))
                : [...current, item.response.message];
              return next.slice(-MAX_STORED_MESSAGES);
            });
          } else {
            throw new Error(item.error);
          }
        }
        if (done) break;
      }
      if (!completed) throw new Error('The assistant stream ended unexpectedly');
      const { chats: refreshed } = await agentApi.listChats();
      setChats(refreshed ?? chats);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not send message';
      const errorMessage: AgentChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `I couldn't complete that request.\n\n${message}`,
        createdAt: new Date().toISOString(),
        isError: true,
      };
      setFailedRequest(nextMessages);
      setMessages((current) => [...current, errorMessage].slice(-MAX_STORED_MESSAGES));
      setToast({
        tone: 'error',
        message,
      });
    } finally {
      setLoading(false);
      setThinking(null);
      setStreaming(false);
    }
  }

  function retryFailedRequest() {
    if (loading || !chatId) return;
    const retry = historyForRetry(failedRequest ?? messages);
    if (!retry) return;
    void submit(retry.content, retry.history, true);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit(input);
  }

  async function updateAction(actionId: string, intent: 'confirm' | 'cancel', entry?: Record<string, unknown>) {
    setMessages((current) =>
      mapAction(current, actionId, (action) => ({
        ...action,
        status: 'executing',
      }))
    );
    try {
      const { action } = await agentApi.resolveAction(actionId, intent, entry);
      if (!action) throw new Error(`Could not ${intent} action`);
      setMessages((current) => mapAction(current, actionId, () => action));
      setToast({
        tone: intent === 'confirm' ? 'success' : 'info',
        message: intent === 'confirm' ? 'Change applied.' : 'Action cancelled.',
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Action request failed';
      setMessages((current) =>
        mapAction(current, actionId, (action) => ({
          ...action,
          status: 'failed',
          error: message,
        }))
      );
      setToast({ tone: 'error', message });
    }
  }

  async function clearChat() {
    if (!chatId) return;
    try {
      await agentApi.clearMessages(chatId);
      setMessages([]);
      setFailedRequest(null);
    } catch (cause) {
      setToast({ tone: 'error', message: errorMessage(cause, 'Could not clear chat') });
    }
  }

  async function startChat() {
    let chat: AgentConversation | undefined;
    try {
      ({ chat } = await agentApi.createChat());
    } catch (cause) {
      setToast({ tone: 'error', message: errorMessage(cause, 'Could not create chat') });
      return;
    }
    if (!chat) {
      setToast({ tone: 'error', message: 'Could not create chat' });
      return;
    }
    const newChat = chat;
    setChats((current) => [newChat, ...current]);
    setChatId(newChat.id);
    window.localStorage.setItem(ACTIVE_CHAT_KEY, newChat.id);
    setMessages([]);
    setFailedRequest(null);
  }

  async function removeChat(id: string) {
    try {
      await agentApi.deleteChat(id);
    } catch (cause) {
      setToast({ tone: 'error', message: errorMessage(cause, 'Could not delete chat') });
      return;
    }
    const remaining = chats.filter((chat) => chat.id !== id);
    if (!remaining.length) {
      await startChat();
      return;
    }
    setChats(remaining);
    const nextId = remaining[0].id;
    setChatId(nextId);
    window.localStorage.setItem(ACTIVE_CHAT_KEY, nextId);
    await loadMessages(nextId);
  }

  async function selectChat(id: string) {
    if (id === chatId || loading) return;
    setChatId(id);
    window.localStorage.setItem(ACTIVE_CHAT_KEY, id);
    setFailedRequest(null);
    setReady(false);
    try {
      await loadMessages(id);
    } catch (cause) {
      setToast({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Could not load chat',
      });
    } finally {
      setReady(true);
    }
  }

  const activeChat = chats.find((chat) => chat.id === chatId);

  return (
    <>
      <div className={`${financeStyles.card} overflow-hidden`}>
        <div className="grid h-[min(760px,calc(100dvh))] min-h-0 md:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="border-b border-white/8 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between px-3 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Chats</p>
              <button type="button" className={financeStyles.secondary} onClick={() => void startChat()}>
                New
              </button>
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto px-2 pb-3 md:max-h-[calc(100%-3.5rem)]">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`flex items-center gap-1 rounded-lg px-2 py-2 ${
                    chat.id === chatId ? 'bg-cyan-300/12 text-cyan-100' : 'text-slate-400 hover:bg-white/[0.05]'
                  }`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm font-semibold"
                    onClick={() => void selectChat(chat.id)}
                  >
                    {chat.title}
                  </button>
                  <button
                    type="button"
                    className="rounded px-1 text-xs text-slate-500 hover:text-rose-300"
                    aria-label={`Delete ${chat.title}`}
                    onClick={() => void removeChat(chat.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </aside>
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3 sm:px-6">
              <div>
                <p className="text-sm font-bold text-white">{activeChat?.title || 'Assistant'}</p>
                <p className="text-xs text-slate-500">{copy.subtitle}</p>
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

            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
              {!ready ? (
                <p className="py-10 text-center text-sm text-slate-500">Loading conversation…</p>
              ) : !messages.length ? (
                <EmptyState
                  description={copy.empty}
                  prompts={copy.prompts}
                  onPrompt={(prompt) => void submit(prompt)}
                />
              ) : (
                messages.map((message) => (
                  <Message
                    key={message.id}
                    message={message}
                    onAction={(id, intent, entry) => void updateAction(id, intent, entry)}
                    onRetry={message.isError && !loading ? retryFailedRequest : undefined}
                  />
                ))
              )}
              {loading && !streaming ? <ThinkingIndicator label={thinking ?? 'Thinking…'} /> : null}
              <div ref={endRef} />
            </div>

            <form
              onSubmit={onSubmit}
              className="sticky bottom-0 border-t border-white/8 bg-slate-950/90 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:p-4"
            >
              <div className="flex items-end gap-2">
                <textarea
                  aria-label="Message the assistant"
                  className={`${financeStyles.input} max-h-36 min-h-12 resize-none py-3`}
                  rows={1}
                  maxLength={4000}
                  placeholder={copy.placeholder}
                  value={input}
                  disabled={loading || !ready}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
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
                Relevant workspace data is sent to Groq to answer requests.
              </p>
            </form>
          </div>
        </div>
      </div>
      <FinanceToast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

function historyForRetry(source: AgentChatMessage[]) {
  let end = source.length;
  while (end > 0 && source[end - 1].isError) {
    end -= 1;
  }
  const prefix = source.slice(0, end);
  let lastUserIndex = -1;
  for (let index = prefix.length - 1; index >= 0; index -= 1) {
    if (prefix[index].role === 'user') {
      lastUserIndex = index;
      break;
    }
  }
  if (lastUserIndex < 0) return null;
  return {
    content: prefix[lastUserIndex].content,
    history: prefix.slice(0, lastUserIndex + 1),
  };
}

function mapAction(
  messages: AgentChatMessage[],
  actionId: string,
  update: (action: PendingAgentAction) => PendingAgentAction
) {
  return messages.map((message) => ({
    ...message,
    actions: message.actions?.map((action) => (action.id === actionId ? update(action) : action)),
  }));
}
