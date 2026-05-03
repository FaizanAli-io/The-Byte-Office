"use client";

import { useFinanceHandlers } from "./useFinanceHandlers";
import {
  MutualFundsSection,
  RemoteBanksSection,
  LocalBanksSection,
} from "./HoldingTypes";
import { useState } from "react";

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

  // Calculate grand total
  const calculateGrandTotal = () => {
    if (!data) return 0;

    const mutualFunds = Array.isArray(data.mutualFunds) ? data.mutualFunds : [];
    const remoteBanks = Array.isArray(data.remoteBanks) ? data.remoteBanks : [];
    const localBanks = Array.isArray(data.localBanks) ? data.localBanks : [];

    const mutualFundsTotal = mutualFunds.reduce((total, mf) => {
      if (!mf || typeof mf !== "object") return total;
      const bankKey = Object.keys(mf)[0];
      const funds = Array.isArray((mf as any)[bankKey])
        ? (mf as any)[bankKey]
        : [];
      return (
        total +
        funds.reduce(
          (sum: number, f: any) =>
            sum + (typeof f?.value === "number" ? f.value : 0),
          0,
        )
      );
    }, 0);

    const remoteBanksTotal = remoteBanks.reduce((sum, bank: any) => {
      const usd = typeof bank?.amountUsd === "number" ? bank.amountUsd : 0;
      const rate =
        typeof bank?.exchangeRate === "number" ? bank.exchangeRate : 0;
      return sum + usd * rate;
    }, 0);

    const localBanksTotal = localBanks.reduce((sum, bank: any) => {
      return sum + (typeof bank?.amountPkr === "number" ? bank.amountPkr : 0);
    }, 0);

    return mutualFundsTotal + remoteBanksTotal + localBanksTotal;
  };

  const handleSnapshot = async () => {
    if (!data) return;

    setSnapshotLoading(true);
    try {
      const grandTotal = calculateGrandTotal();

      const response = await fetch("/api/snapshots", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, grandTotal }),
        method: "POST",
      });

      if (response.ok) {
        alert("Snapshot saved successfully!");
      } else {
        throw new Error("Failed to save snapshot");
      }
    } catch (error) {
      console.error("Error saving snapshot:", error);
      alert("Failed to save snapshot");
    } finally {
      setSnapshotLoading(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">Loading…</p>
      </div>
    );

  if (!data)
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">No finance data found.</p>
      </div>
    );

  return (
    <div className="pt-24 px-6 space-y-8">
      <h1 className="text-3xl font-bold mb-4">Finance Editor</h1>

      <MutualFundsSection
        data={data}
        onAddFund={addFundToBank}
        onAddBank={addMutualFundBank}
        onChange={handleChangeMutualFund}
        onDeleteFund={deleteFundFromBank}
        onDeleteBank={deleteMutualFundBank}
      />

      <RemoteBanksSection
        data={data}
        onAdd={addRemoteBank}
        onChange={handleChange}
        onDelete={deleteRemoteBank}
      />

      <LocalBanksSection
        data={data}
        onAdd={addLocalBank}
        onChange={handleChange}
        onDelete={deleteLocalBank}
      />

      {/* Grand Total Section */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-700/50 backdrop-blur-sm">
        <div className="text-center">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent tracking-wide mb-4">
            Portfolio Grand Total
          </h2>
          <div className="text-6xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent mb-2">
            {Math.round(calculateGrandTotal()).toLocaleString()}
          </div>
          <div className="text-slate-400 text-lg font-medium">PKR</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center gap-4 mb-4">
        <div className="flex gap-4">
          <button
            onClick={handleSnapshot}
            disabled={snapshotLoading}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-200 font-semibold hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {snapshotLoading ? "Saving Snapshot..." : "📸 Take Snapshot"}
          </button>

          <a
            href="/finance/snapshots"
            className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-200 font-semibold hover:shadow-xl transform hover:-translate-y-0.5 flex items-center"
          >
            📊 View Snapshots
          </a>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-200 font-semibold hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving Changes..." : "💾 Save Changes"}
        </button>
      </div>
    </div>
  );
}
