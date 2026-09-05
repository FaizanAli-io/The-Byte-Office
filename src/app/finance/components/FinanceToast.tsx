"use client";

import { useEffect } from "react";

export type FinanceToastState = {
  message: string;
  tone: "success" | "error" | "info";
} | null;

const toneStyles = {
  success: "border-emerald-400/25 bg-emerald-950 text-emerald-100",
  error: "border-rose-400/25 bg-rose-950 text-rose-100",
  info: "border-cyan-400/25 bg-slate-900 text-slate-100",
};

export function FinanceToast({
  toast,
  onDismiss,
}: {
  toast: FinanceToastState;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast]);

  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 z-[100] flex items-start justify-between gap-4 rounded-xl border px-4 py-3 shadow-2xl sm:left-auto sm:right-5 sm:max-w-sm ${toneStyles[toast.tone]}`}
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <p className="text-sm font-semibold leading-6">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-0.5 text-lg leading-none opacity-60 transition hover:opacity-100"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}
