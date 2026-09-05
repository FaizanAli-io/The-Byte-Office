"use client";

import { portfolioTotals } from "@/lib/finance";
import { useState } from "react";
import {
  LocalBanksSection,
  MutualFundsSection,
  RemoteBanksSection,
} from "./HoldingTypes";
import { FinancePageShell, StatCard, financeStyles } from "./FinanceUI";
import { FinanceToast, type FinanceToastState } from "./FinanceToast";
import { useFinanceHandlers } from "./useFinanceHandlers";

export default function FinanceEditor() {
  const {
    data,
    saving,
    loading,
    handleChange,
    addMutualFundBank,
    deleteMutualFundBank,
    handleChangeMutualFund,
    addFundToBank,
    addRemoteBank,
    addLocalBank,
    deleteFundFromBank,
    deleteRemoteBank,
    deleteLocalBank,
    handleSave,
  } = useFinanceHandlers();
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [toast, setToast] = useState<FinanceToastState>(null);

  async function handleSnapshot() {
    if (!data) return;
    setSnapshotLoading(true);
    try {
      const response = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          grandTotal: portfolioTotals(data).grandTotal,
        }),
      });
      if (!response.ok) throw new Error("Failed to save snapshot");
      setToast({ message: "Snapshot saved.", tone: "success" });
    } catch (error) {
      console.error("Error saving snapshot:", error);
      setToast({ message: "Failed to save snapshot.", tone: "error" });
    } finally {
      setSnapshotLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Loading portfolio…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">No finance data found.</p>
      </div>
    );
  }

  const totals = portfolioTotals(data);

  return (
    <FinancePageShell
      title="Portfolio editor"
      description="Keep the latest value of each account and fund. Use snapshots for history and the ledger for monthly reconciliation."
      actions={
        <>
          <button
            type="button"
            onClick={handleSnapshot}
            disabled={snapshotLoading}
            className={financeStyles.secondary}
          >
            {snapshotLoading ? "Saving snapshot…" : "Take snapshot"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={financeStyles.primary}
          >
            {saving ? "Saving…" : "Save portfolio"}
          </button>
        </>
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Local banks"
          value={`${Math.round(totals.local).toLocaleString()} PKR`}
        />
        <StatCard
          label="Remote banks"
          value={`${Math.round(totals.remote).toLocaleString()} PKR`}
        />
        <StatCard
          label="Mutual funds"
          value={`${Math.round(totals.mutual).toLocaleString()} PKR`}
          tone="amber"
        />
        <StatCard
          label="Portfolio total"
          value={`${Math.round(totals.grandTotal).toLocaleString()} PKR`}
          tone="emerald"
        />
      </div>

      <div className="space-y-6">
        <LocalBanksSection
          data={data}
          onAdd={addLocalBank}
          onChange={handleChange}
          onDelete={deleteLocalBank}
        />
        <RemoteBanksSection
          data={data}
          onAdd={addRemoteBank}
          onChange={handleChange}
          onDelete={deleteRemoteBank}
        />
        <MutualFundsSection
          data={data}
          onAddFund={addFundToBank}
          onAddBank={addMutualFundBank}
          onChange={handleChangeMutualFund}
          onDeleteFund={deleteFundFromBank}
          onDeleteBank={deleteMutualFundBank}
        />
      </div>
      <FinanceToast toast={toast} onDismiss={() => setToast(null)} />
    </FinancePageShell>
  );
}
