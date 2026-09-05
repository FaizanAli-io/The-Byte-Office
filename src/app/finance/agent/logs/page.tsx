"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FinancePageShell,
  FinanceCard,
  financeStyles,
} from "../../components/FinanceUI";

const LOGS_PER_PAGE = 10;

type ToolLog = {
  id: string;
  requestId: string;
  model: string;
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  result: unknown;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
};

export default function FinanceAgentLogsPage() {
  const [logs, setLogs] = useState<ToolLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const loadLogs = useCallback(async () => {
    setRefreshing(true);
    if (!hasLoadedRef.current) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/finance-agent/logs?limit=200", {
        cache: "no-store",
      });
      const body = (await response.json()) as {
        logs?: ToolLog[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Could not load logs");
      setLogs(body.logs || []);
      hasLoadedRef.current = true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load logs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
    const refreshTimer = window.setInterval(() => {
      void loadLogs();
    }, 5000);
    return () => window.clearInterval(refreshTimer);
  }, [loadLogs]);

  const totalPages = Math.max(1, Math.ceil(logs.length / LOGS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleLogs = logs.slice(
    currentPage * LOGS_PER_PAGE,
    (currentPage + 1) * LOGS_PER_PAGE,
  );

  useEffect(() => {
    setPage((value) => Math.min(value, totalPages - 1));
  }, [totalPages]);

  return (
    <FinancePageShell
      title="Assistant logs"
      description="Review every finance tool call made by the assistant, including its arguments, result, model, timing, and errors. This page refreshes every 5 seconds."
      actions={
        <button
          type="button"
          className={financeStyles.secondary}
          onClick={() => void loadLogs()}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh logs"}
        </button>
      }
    >
      <FinanceCard description="Logs may contain sensitive portfolio and ledger data. They are available only inside this protected workspace.">
        {error && logs.length === 0 ? (
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : loading && logs.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Loading assistant logs…
          </p>
        ) : logs.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            No tool calls have been logged yet.
          </p>
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
                    <th className="px-3 py-3 font-semibold">Model</th>
                    <th className="px-3 py-3 font-semibold">Duration</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Request</th>
                    <th className="px-3 py-3 font-semibold">Debug</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-white/5 align-top"
                    >
                      <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-500">
                        {formatTimeAgo(log.createdAt)}
                      </td>
                      <td className="px-3 py-4">
                        <p className="font-semibold text-cyan-200">
                          {log.toolName}
                        </p>
                        <LogPayload log={log} />
                      </td>
                      <td className="max-w-40 break-words px-3 py-4 text-xs text-slate-500">
                        {log.model}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-400">
                        {log.durationMs ?? "—"} ms
                      </td>
                      <td className="px-3 py-4">
                        <Status log={log} />
                      </td>
                      <td className="px-3 py-4 font-mono text-[11px] text-slate-600">
                        {log.requestId.slice(0, 8)}…
                      </td>
                      <td className="px-3 py-4">
                        <CopyButton
                          copied={copiedLogId === log.id}
                          onClick={() => void copyLog(log, setCopiedLogId)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-white/8 pt-4 sm:flex-row">
                <p className="text-xs text-slate-500">
                  Showing {currentPage * LOGS_PER_PAGE + 1}–
                  {Math.min((currentPage + 1) * LOGS_PER_PAGE, logs.length)} of{" "}
                  {logs.length} logs
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={financeStyles.secondary}
                    disabled={currentPage === 0}
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                  >
                    Previous
                  </button>
                  <span className="px-2 text-xs text-slate-500">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className={financeStyles.secondary}
                    disabled={currentPage === totalPages - 1}
                    onClick={() =>
                      setPage((value) => Math.min(totalPages - 1, value + 1))
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </FinanceCard>
    </FinancePageShell>
  );
}

function LogCard({
  log,
  copied,
  onCopy,
}: {
  log: ToolLog;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <article className={`${financeStyles.inset} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-cyan-200">{log.toolName}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatTimeAgo(log.createdAt)}
          </p>
        </div>
        <Status log={log} />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span>{log.durationMs ?? "—"} ms</span>
        <span className="break-all font-mono">{log.model}</span>
      </div>
      <LogPayload log={log} />
      <CopyButton copied={copied} onClick={onCopy} />
      <p className="mt-3 font-mono text-[11px] text-slate-600">
        Request {log.requestId}
      </p>
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
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
        {label}
      </p>
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
        log.error
          ? "bg-rose-400/10 text-rose-300"
          : "bg-emerald-400/10 text-emerald-300"
      }`}
    >
      {log.error ? "error" : "success"}
    </span>
  );
}

function CopyButton({
  copied,
  onClick,
}: {
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${financeStyles.secondary} mt-3 min-h-8 min-w-8 px-2 text-base leading-none`}
      aria-label={copied ? "Copied log JSON" : "Copy log JSON"}
      title={copied ? "Copied JSON" : "Copy JSON"}
      onClick={onClick}
    >
      {copied ? "✓" : "⧉"}
    </button>
  );
}

function formatPayload(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

async function copyLog(
  log: ToolLog,
  setCopiedLogId: (id: string | null) => void,
) {
  try {
    await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedLogId(log.id);
    window.setTimeout(() => setCopiedLogId(null), 2000);
  } catch {
    // Clipboard access can be unavailable outside a secure browser context.
  }
}

function formatTimeAgo(value: string) {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds} second${elapsedSeconds === 1 ? "" : "s"} ago`;
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} minute${elapsedMinutes === 1 ? "" : "s"} ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 30) {
    return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
  }

  const elapsedMonths = Math.floor(elapsedDays / 30);
  if (elapsedMonths < 12) {
    return `${elapsedMonths} month${elapsedMonths === 1 ? "" : "s"} ago`;
  }

  const elapsedYears = Math.floor(elapsedMonths / 12);
  return `${elapsedYears} year${elapsedYears === 1 ? "" : "s"} ago`;
}
