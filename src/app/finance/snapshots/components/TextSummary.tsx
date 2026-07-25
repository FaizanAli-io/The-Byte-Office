"use client";

import { portfolioTotals } from "@/lib/finance";
import type { FinanceSnapshot } from "@/types/finance";

export function TextSummary({ snapshot }: { snapshot: FinanceSnapshot }) {
  const totals = portfolioTotals(snapshot.data);

  return (
    <div className="rounded-xl border border-white/7 bg-slate-950/45 p-4">
      <h4 className="mb-4 text-sm font-bold text-slate-200">
        Portfolio summary
      </h4>
      <div className="grid gap-5 md:grid-cols-3">
        <SummaryGroup
          title="Local banks"
          tone="text-emerald-300"
          total={totals.local}
          items={snapshot.data.localBanks.map((bank) => ({
            label: bank.name,
            value: bank.amountPkr,
          }))}
        />
        <SummaryGroup
          title="Remote banks"
          tone="text-cyan-300"
          total={totals.remote}
          items={snapshot.data.remoteBanks.map((bank) => ({
            label: bank.name,
            value: bank.amountUsd * bank.exchangeRate,
          }))}
        />
        <SummaryGroup
          title="Mutual funds"
          tone="text-amber-300"
          total={totals.mutual}
          items={snapshot.data.mutualFunds.map((group) => {
            const bank = Object.keys(group)[0];
            return {
              label: bank,
              value: (group[bank] ?? []).reduce(
                (sum, fund) => sum + fund.value,
                0,
              ),
            };
          })}
        />
      </div>
    </div>
  );
}

function SummaryGroup({
  title,
  total,
  tone,
  items,
}: {
  title: string;
  total: number;
  tone: string;
  items: { label: string; value: number }[];
}) {
  return (
    <div>
      <h5 className={`text-sm font-bold ${tone}`}>{title}</h5>
      <ul className="mt-3 space-y-2 text-xs text-slate-500">
        {items.map((item, index) => (
          <li
            key={`${item.label}-${index}`}
            className="flex justify-between gap-4"
          >
            <span className="truncate">{item.label || "Unnamed"}</span>
            <span className="shrink-0 text-slate-300">
              {Math.round(item.value).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-between border-t border-white/6 pt-3 text-xs">
        <span className="text-slate-600">Total</span>
        <span className="font-bold text-slate-200">
          {Math.round(total).toLocaleString()} PKR
        </span>
      </div>
    </div>
  );
}
