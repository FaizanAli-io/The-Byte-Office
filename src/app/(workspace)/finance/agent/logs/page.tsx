'use client';

import { agentApi, type ToolLog } from '@/lib/api-client';
import { useEffect, useState } from 'react';
import { FinancePageShell, FinanceCard, financeStyles } from '../../components/FinanceUI';
import { PAGE_SIZES, Pagination } from '../../components/Pagination';
import { useLoad } from '../../components/useLoad';

export default function FinanceAgentLogsPage() {
  const { data, loading, error, reload } = useLoad(
    () => agentApi.logs().then((loaded) => loaded.logs ?? []),
    [],
    'Could not load logs'
  );
  const logs = data ?? [];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  useEffect(() => {
    const refreshTimer = window.setInterval(reload, 5000);
    return () => window.clearInterval(refreshTimer);
  }, [reload]);

  const pageCount = Math.max(1, Math.ceil(logs.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstOnPage = (currentPage - 1) * pageSize;
  const visibleLogs = logs.slice(firstOnPage, firstOnPage + pageSize);

  return (
    <FinancePageShell
      section="agent"
      title="Assistant logs"
      description="Every tool call: internal ones from the assistant, external ones from MCP and REST clients, with arguments, result, caller, timing and errors. Refreshes every 5 seconds."
      actions={
        <button type="button" className={financeStyles.secondary} onClick={reload} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh logs'}
        </button>
      }
    >
      <FinanceCard description="Logs may contain sensitive portfolio and ledger data. They are available only inside this protected workspace.">
        {error && logs.length === 0 ? (
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : loading && logs.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading assistant logs…</p>
        ) : logs.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">No tool calls have been logged yet.</p>
        ) : (
          <>
            {error ? (
              <div className="mb-3 rounded-xl border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-200">
                Refresh failed: {error}
              </div>
            ) : null}
            <div className="space-y-3 md:hidden">
              {visibleLogs.map((log) => (
                <LogCard
                  key={log.id}
                  log={log}
                  copied={copiedLogId === log.id}
                  onCopy={() => void copyLog(log, setCopiedLogId)}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-xs uppercase tracking-[0.12em] text-slate-600">
                    <th className="px-3 py-3 font-semibold">Time</th>
                    <th className="px-3 py-3 font-semibold">Tool</th>
                    <th className="px-3 py-3 font-semibold">Caller</th>
                    <th className="px-3 py-3 font-semibold">Duration</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Request</th>
                    <th className="px-3 py-3 font-semibold">Debug</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLogs.map((log) => (
                    <tr key={log.id} className="border-b border-white/5 align-top">
                      <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-500">
                        {formatTimeAgo(log.createdAt)}
                      </td>
                      <td className="px-3 py-4">
                        <p className="font-semibold text-cyan-200">
                          {log.toolName} <TypeBadge type={log.type} />
                        </p>
                        <LogPayload log={log} />
                      </td>
                      <td className="max-w-40 break-words px-3 py-4 text-xs text-slate-500">{log.model}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-400">{log.durationMs ?? '—'} ms</td>
                      <td className="px-3 py-4">
                        <Status log={log} />
                      </td>
                      <td className="px-3 py-4 font-mono text-[11px] text-slate-600">{log.requestId.slice(0, 8)}…</td>
                      <td className="px-3 py-4">
                        <CopyButton copied={copiedLogId === log.id} onClick={() => void copyLog(log, setCopiedLogId)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              pageSize={pageSize}
              firstOnPage={firstOnPage}
              shown={visibleLogs.length}
              total={logs.length}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </>
        )}
      </FinanceCard>
    </FinancePageShell>
  );
}

function LogCard({ log, copied, onCopy }: { log: ToolLog; copied: boolean; onCopy: () => void }) {
  return (
    <article className={`${financeStyles.inset} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-cyan-200">
            {log.toolName} <TypeBadge type={log.type} />
          </p>
          <p className="mt-1 text-xs text-slate-500">{formatTimeAgo(log.createdAt)}</p>
        </div>
        <Status log={log} />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span>{log.durationMs ?? '—'} ms</span>
        <span className="break-all font-mono">{log.model}</span>
      </div>
      <LogPayload log={log} />
      <CopyButton copied={copied} onClick={onCopy} />
      <p className="mt-3 font-mono text-[11px] text-slate-600">Request {log.requestId}</p>
    </article>
  );
}

function LogPayload({ log }: { log: ToolLog }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-300">
        View arguments and result
      </summary>
      <div className="mt-2 grid gap-2 xl:grid-cols-2">
        <Payload label="Arguments" value={log.arguments} />
        <Payload label="Result" value={log.error || log.result} />
      </div>
    </details>
  );
}

function Payload({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{label}</p>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 p-3 text-[11px] leading-5 text-slate-400">
        {formatPayload(value)}
      </pre>
    </div>
  );
}

function Status({ log }: { log: ToolLog }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
        log.error ? 'bg-rose-400/10 text-rose-300' : 'bg-emerald-400/10 text-emerald-300'
      }`}
    >
      {log.error ? 'error' : 'success'}
    </span>
  );
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`${financeStyles.secondary} mt-3 min-h-8 min-w-8 px-2 text-base leading-none`}
      aria-label={copied ? 'Copied log JSON' : 'Copy log JSON'}
      title={copied ? 'Copied JSON' : 'Copy JSON'}
      onClick={onClick}
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}

function formatPayload(value: unknown) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

async function copyLog(log: ToolLog, setCopiedLogId: (id: string | null) => void) {
  try {
    await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedLogId(log.id);
    window.setTimeout(() => setCopiedLogId(null), 2000);
  } catch {}
}

const TIME_UNITS: [string, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 30],
  ['month', 12],
];

function formatTimeAgo(value: string) {
  let elapsed = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  let unit = 'year';
  for (const [name, size] of TIME_UNITS) {
    if (elapsed < size) {
      unit = name;
      break;
    }
    elapsed = Math.floor(elapsed / size);
  }
  return `${elapsed} ${unit}${elapsed === 1 ? '' : 's'} ago`;
}

function TypeBadge({ type }: { type: ToolLog['type'] }) {
  return (
    <span
      className={`ml-1 rounded-full px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide ${
        type === 'external' ? 'bg-amber-400/10 text-amber-300' : 'bg-white/5 text-slate-400'
      }`}
    >
      {type}
    </span>
  );
}
