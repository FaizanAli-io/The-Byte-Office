"use client";

import { useState, useEffect } from "react";
import { FinanceSnapshot } from "@/types/finance";

export default function SnapshotsPage() {
  const [snapshots, setSnapshots] = useState<FinanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<FinanceSnapshot | null>(null);

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

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (loading) {
    return (
      <div className="pt-24 px-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-lg text-slate-400">Loading snapshots...</p>
        </div>
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
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-700/50 backdrop-blur-sm text-center">
          <p className="text-slate-400 text-lg">
            No snapshots found. Take your first snapshot in the Finance Editor!
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {snapshots.map((snapshot, index) => (
            <div
              key={snapshot._id || index}
              className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl shadow-2xl border border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/40 transition-all duration-200 cursor-pointer"
              onClick={() =>
                setSelectedSnapshot(selectedSnapshot?._id === snapshot._id ? null : snapshot)
              }
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-semibold text-slate-200 mb-2">
                    {formatDate(snapshot.timestamp)}
                  </h3>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400 text-sm">Grand Total:</span>
                    <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                      {Math.round(snapshot.grandTotal).toLocaleString()} PKR
                    </span>
                  </div>
                </div>
                <div className="text-slate-400">
                  {selectedSnapshot?._id === snapshot._id ? "▼" : "▶"}
                </div>
              </div>

              {selectedSnapshot?._id === snapshot._id && (
                <div className="mt-6 pt-6 border-t border-slate-600/30 space-y-4">
                  <div className="grid md:grid-cols-3 gap-6">
                    {/* Mutual Funds Summary */}
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-600/30">
                      <h4 className="text-lg font-semibold text-slate-300 mb-2">Mutual Funds</h4>
                      <div className="text-right">
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                          {Math.round(
                            snapshot.data.mutualFunds.reduce((total, mf) => {
                              const bankKey = Object.keys(mf)[0];
                              const funds = mf[bankKey];
                              return total + funds.reduce((sum, f) => sum + f.units * f.price, 0);
                            }, 0)
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        {snapshot.data.mutualFunds.length} banks
                      </div>
                    </div>

                    {/* Remote Banks Summary */}
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-600/30">
                      <h4 className="text-lg font-semibold text-slate-300 mb-2">Remote Banks</h4>
                      <div className="text-right">
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                          {Math.round(
                            snapshot.data.remoteBanks.reduce(
                              (sum, bank) => sum + bank.amountUsd * bank.exchangeRate,
                              0
                            )
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        {snapshot.data.remoteBanks.length} banks
                      </div>
                    </div>

                    {/* Local Banks Summary */}
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-600/30">
                      <h4 className="text-lg font-semibold text-slate-300 mb-2">Local Banks</h4>
                      <div className="text-right">
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                          {Math.round(
                            snapshot.data.localBanks.reduce((sum, bank) => sum + bank.amountPkr, 0)
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        {snapshot.data.localBanks.length} banks
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
