"use client";

import {
  bankFundAllocations,
  individualFundAllocations,
  portfolioAllocations,
} from "@/lib/finance";
import type { FinanceSnapshot } from "@/types/finance";
import { useEffect, useState } from "react";
import { FinancePageShell, financeStyles } from "../components/FinanceUI";
import { AllocationChart, TextSummary } from "./components";

export default function SnapshotsPage() {
  const [snapshots, setSnapshots] = useState<FinanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/snapshots")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load snapshots");
        setSnapshots(await response.json());
      })
      .catch((error) => console.error("Error fetching snapshots:", error))
      .finally(() => setLoading(false));
  }, []);

  async function deleteSnapshot(id: string) {
    if (!window.confirm("Delete this snapshot?")) return;
    const response = await fetch("/api/snapshots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      window.alert("Failed to delete snapshot.");
      return;
    }
    setSnapshots((items) => items.filter((snapshot) => snapshot._id !== id));
    setExpanded((items) => items.filter((item) => item !== id));
  }

  return (
    <FinancePageShell
      title="Portfolio snapshots"
      description="A point-in-time history of total holdings and allocation across cash accounts and mutual funds."
    >
      {loading ? (
        <div
          className={`${financeStyles.card} p-12 text-center text-slate-500`}
        >
          Loading snapshots…
        </div>
      ) : snapshots.length === 0 ? (
        <div className={`${financeStyles.card} p-12 text-center`}>
          <p className="font-bold text-white">No snapshots yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Take the first one from the portfolio editor.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {snapshots.map((snapshot) => {
            const id = String(snapshot._id);
            const isExpanded = expanded.includes(id);
            return (
              <article
                key={id}
                className={`${financeStyles.card} overflow-hidden`}
              >
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <button
                    type="button"
                    className="flex-1 text-left"
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setExpanded((items) =>
                        isExpanded
                          ? items.filter((item) => item !== id)
                          : [...items, id],
                      )
                    }
                  >
                    <p className="text-sm font-semibold text-slate-400">
                      {new Date(snapshot.timestamp).toLocaleString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-cyan-300">
                      {Math.round(snapshot.grandTotal).toLocaleString()} PKR
                    </p>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600">
                      {isExpanded ? "Hide details" : "View details"}
                    </span>
                    <button
                      type="button"
                      className={financeStyles.danger}
                      onClick={() => deleteSnapshot(id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {isExpanded ? (
                  <div className="space-y-4 border-t border-white/7 p-5 sm:p-6">
                    <TextSummary snapshot={snapshot} />
                    <div className="grid gap-4 xl:grid-cols-3">
                      <AllocationChart
                        title="Portfolio allocation"
                        data={portfolioAllocations(snapshot.data)}
                      />
                      <AllocationChart
                        title="Funds by institution"
                        data={bankFundAllocations(snapshot.data)}
                      />
                      <AllocationChart
                        title="Individual funds"
                        data={individualFundAllocations(snapshot.data)}
                      />
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </FinancePageShell>
  );
}
