"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { FinanceLogoutButton } from "./FinanceLogoutButton";

export const financeStyles = {
  card: "rounded-2xl border border-white/8 bg-slate-900/70 shadow-[0_24px_80px_rgba(0,0,0,.22)] backdrop-blur-xl",
  inset: "rounded-xl border border-white/7 bg-slate-950/45",
  input:
    "min-h-11 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/55 focus:ring-2 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60",
  label:
    "mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500",
  primary:
    "inline-flex min-h-10 items-center justify-center rounded-lg bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex min-h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex min-h-9 items-center justify-center rounded-lg border border-rose-400/15 bg-rose-400/8 px-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-400/15 disabled:opacity-50",
};

const links = [
  { href: "/finance", label: "Portfolio" },
  { href: "/finance/snapshots", label: "Snapshots" },
  { href: "/finance/ledger", label: "Monthly ledger" },
  { href: "/finance/agent", label: "Assistant" },
  { href: "/finance/agent/logs", label: "Assistant logs" },
];

export function FinancePageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto w-full max-w-[1480px] px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
            Private finance workspace
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            {description}
          </p>
        </div>
        {actions ? (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap [&>*]:w-full sm:[&>*]:w-auto">
            {actions}
          </div>
        ) : null}
      </div>
      <nav
        aria-label="Finance navigation"
        className="mb-8 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-white/8 bg-slate-950/55 p-1"
      >
        {links.map((link) => {
          const active =
            link.href === "/finance"
              ? pathname === link.href
              : link.href === "/finance/agent"
                ? pathname === link.href
                : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-cyan-300/12 text-cyan-200"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        <FinanceLogoutButton />
      </nav>
      {children}
    </div>
  );
}

export function FinanceCard({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${financeStyles.card} p-5 sm:p-6 ${className}`}>
      {title || action ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? (
              <h2 className="text-lg font-bold text-white">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "cyan",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "cyan" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    cyan: "text-cyan-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
  };
  return (
    <div className={`${financeStyles.card} p-5`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className={`mt-3 text-2xl font-bold tracking-tight ${tones[tone]}`}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}
