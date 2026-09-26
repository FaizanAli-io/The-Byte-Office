'use client';

import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { FinanceChatMessage, PendingAgentAction } from '@/lib/finance-agent/types';
import { financeStyles } from '../../components/FinanceUI';
import { LedgerEntryChatForm } from './LedgerEntryChatForm';

/**
 * Everything the chat renders, split out from the container that owns the
 * conversation state. These are all pure: they take a message or an action and
 * draw it.
 */

export function EmptyState({
  description,
  prompts,
  onPrompt,
}: {
  description: string;
  prompts: string[];
  onPrompt: (prompt: string) => void;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center py-10 text-center sm:py-16">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xl text-cyan-300">
        ✦
      </div>
      <h2 className="mt-5 text-xl font-bold text-white">What would you like to know?</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
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

export function Message({
  message,
  onAction,
  onRetry,
}: {
  message: FinanceChatMessage;
  onAction: (id: string, intent: 'confirm' | 'cancel', entry?: Record<string, unknown>) => void;
  onRetry?: () => void;
}) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[92%] sm:max-w-[78%] ${isUser ? '' : 'w-full'}`}>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
            isUser
              ? 'rounded-br-md bg-cyan-300 text-slate-950'
              : 'rounded-bl-md border border-white/8 bg-white/[0.04] text-slate-200'
          }`}
        >
          {isUser ? message.content : <MarkdownMessage content={message.content} />}
        </div>
        {message.isError && onRetry ? (
          <button type="button" className={`${financeStyles.secondary} mt-2`} onClick={onRetry}>
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

/**
 * Assistant replies are Markdown. `react-markdown` parses it and `remark-gfm`
 * adds the table syntax the assistant is told to use; the component map below
 * is the only thing this app needs to own, replacing a hand-rolled parser that
 * reimplemented tables, headings, lists and inline formatting.
 */
const MARKDOWN_COMPONENTS: Components = {
  h1: (props) => <p className="mb-2 text-sm font-bold text-white" {...props} />,
  h2: (props) => <p className="mb-2 text-sm font-bold text-white" {...props} />,
  h3: (props) => <p className="mb-2 text-sm font-bold text-white" {...props} />,
  p: (props) => <p className="mb-3 last:mb-0" {...props} />,
  ul: (props) => <ul className="mb-3 list-disc space-y-1 pl-5" {...props} />,
  ol: (props) => <ol className="mb-3 list-decimal space-y-1 pl-5" {...props} />,
  strong: (props) => <strong className="font-bold text-white" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  code: (props) => <code className="rounded bg-black/30 px-1.5 py-0.5 text-[12px] text-cyan-200" {...props} />,
  a: (props) => <a className="text-cyan-300 underline" target="_blank" rel="noopener noreferrer" {...props} />,
  table: (props) => (
    <div className="my-3 overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-xs" {...props} />
    </div>
  ),
  th: (props) => <th className="border-b border-white/15 px-3 py-2 font-bold text-cyan-200" {...props} />,
  td: (props) => <td className="border-b border-white/8 px-3 py-2 text-slate-300" {...props} />,
  tr: (props) => <tr className="even:bg-white/[0.03]" {...props} />,
};

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="whitespace-normal">
      <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {content}
      </Markdown>
    </div>
  );
}

function ActionCard({
  action,
  onAction,
}: {
  action: PendingAgentAction;
  onAction: (id: string, intent: 'confirm' | 'cancel', entry?: Record<string, unknown>) => void;
}) {
  const pending = action.status === 'pending';
  const executing = action.status === 'executing';
  const showForm = Boolean(action.form) && (pending || executing);
  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-amber-300/20 bg-amber-300/[0.045]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300/10 px-4 py-3">
        <p className="text-sm font-bold text-amber-100">{action.preview.title}</p>
        <span className="rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200">
          {action.status}
        </span>
      </div>
      <div className="space-y-3 px-4 py-3">
        {showForm && action.form ? (
          <LedgerEntryChatForm
            form={action.form}
            busy={executing}
            onSubmit={(entry) => onAction(action.id, 'confirm', entry)}
            onCancel={() => onAction(action.id, 'cancel')}
          />
        ) : (
          <>
            {action.preview.before !== undefined ? <Preview label="Before" value={action.preview.before} /> : null}
            {action.preview.after !== undefined ? <Preview label="After" value={action.preview.after} /> : null}
          </>
        )}
        {action.error ? <p className="text-xs text-rose-300">{action.error}</p> : null}
        {!showForm && (pending || executing) ? (
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button
              type="button"
              className={financeStyles.primary}
              disabled={executing}
              onClick={() => onAction(action.id, 'confirm')}
            >
              {executing ? 'Working…' : 'Confirm change'}
            </button>
            <button
              type="button"
              className={financeStyles.secondary}
              disabled={executing}
              onClick={() => onAction(action.id, 'cancel')}
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
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 p-3 text-xs leading-5 text-slate-300">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function ThinkingIndicator({ label }: { label: string }) {
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
