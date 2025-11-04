"use client";

import { useState, useEffect } from "react";
import { FinanceSnapshot } from "@/types/finance";
import {
  TextSummary,
  PortfolioPie,
  MutualFundsPie,
  IndividualFundsPie
} from "./components";

export default function SnapshotsPage() {
  const [snapshots, setSnapshots] = useState<FinanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSnapshots, setExpandedSnapshots] = useState<string[]>([]);

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const fetchSnapshots = async () => {
    try {
      const response = await fetch("/api/snapshots");
      if (response.ok) {
        const data = await response.json();
        setSnapshots(data);
      }
    } catch (error) {
      console.error("Error fetching snapshots:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedSnapshots((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

  if (loading) {
    return (
      <div className="pt-24 px-6 flex justify-center items-center h-64">
        <p className="text-lg text-slate-400">Loading snapshots...</p>
      </div>
    );
  }

  return (
    <div className="pt-24 px-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Portfolio Snapshots
        </h1>
        <a
          href="/finance"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl shadow-lg transition-all duration-200 font-semibold text-sm hover:shadow-xl transform hover:-translate-y-0.5"
        >
          Back to Editor
        </a>
      </div>

      {snapshots.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-700/50 text-center">
          <p className="text-slate-400 text-lg">
            No snapshots found. Take your first snapshot in the Finance Editor!
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {snapshots.map((snapshot) => {
            const id = snapshot._id!;
            const isExpanded = expandedSnapshots.includes(id);

            const mutualFundsTotal = snapshot.data.mutualFunds.reduce(
              (total, mf) => {
                const bankKey = Object.keys(mf)[0];
                const funds = mf[bankKey];
                return total + funds.reduce((sum, f) => sum + f.value, 0);
              },
              0
            );

            const remoteBanksTotal = snapshot.data.remoteBanks.reduce(
              (sum, bank) => sum + bank.amountUsd * bank.exchangeRate,
              0
            );

            const localBanksTotal = snapshot.data.localBanks.reduce(
              (sum, bank) => sum + bank.amountPkr,
              0
            );

            return (
              <div
                key={id}
                className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl shadow-2xl border border-slate-700/50 hover:bg-slate-800/40 transition-all duration-200"
              >
                <div className="flex justify-between items-start">
                  <div className="pr-4 flex-1" onClick={() => toggleExpand(id)}>
                    <h3 className="text-xl font-semibold text-slate-200 mb-2">
                      {formatDate(snapshot.timestamp)}
                    </h3>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-400 text-sm">
                        Grand Total:
                      </span>
                      <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                        {Math.round(snapshot.grandTotal).toLocaleString()} PKR
                      </span>
                    </div>
                  </div>

                  <button
                    title="Delete snapshot"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!snapshot._id) return;
                      if (!window.confirm("Delete this snapshot?")) return;
                      try {
                        const res = await fetch("/api/snapshots", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: snapshot._id })
                        });
                        if (res.ok) {
                          setSnapshots((prev) =>
                            prev.filter((s) => s._id !== snapshot._id)
                          );
                          setExpandedSnapshots((prev) =>
                            prev.filter((x) => x !== snapshot._id)
                          );
                        } else alert("Failed to delete snapshot");
                      } catch {
                        alert("Error deleting snapshot");
                      }
                    }}
                    className="text-sm text-red-400 hover:text-red-300 bg-red-900/10 hover:bg-red-900/20 px-3 py-1 rounded"
                  >
                    🗑️ Delete
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-slate-600/30 space-y-6">
                    <TextSummary snapshot={snapshot} />

                    <div className="grid md:grid-cols-3 gap-6">
                      <PortfolioPie snapshot={snapshot} />
                      <MutualFundsPie snapshot={snapshot} />
                      <IndividualFundsPie snapshot={snapshot} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
