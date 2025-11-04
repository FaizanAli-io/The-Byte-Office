"use client";

export function TextSummary({ snapshot }: any) {
  const localBanks = snapshot.data.localBanks || [];
  const remoteBanks = snapshot.data.remoteBanks || [];
  const mutualFunds = snapshot.data.mutualFunds || [];

  console.log("Snapshot data in TextSummary:", snapshot.data);

  const localTotal = localBanks.reduce(
    (sum: number, b: any) => sum + b.amountPkr,
    0
  );
  const remoteTotal = remoteBanks.reduce(
    (sum: number, b: any) => sum + b.amountUsd * b.exchangeRate,
    0
  );
  const mutualTotal = mutualFunds.reduce((total: number, mf: any) => {
    const bankKey = Object.keys(mf)[0];
    const funds = mf[bankKey];
    return total + funds.reduce((s: number, f: any) => s + f.value, 0);
  }, 0);

  return (
    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-600/30 text-sm text-slate-300">
      <h4 className="text-lg font-semibold text-slate-200 mb-4">
        Portfolio Summary
      </h4>

      {/* Grid layout for each section */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Local Banks */}
        <div>
          <h5 className="font-semibold text-emerald-400 mb-2 flex items-center gap-1">
            🏦 Local Banks
          </h5>
          <ul className="space-y-1">
            {localBanks.map((b: any) => (
              <li key={b.name} className="flex justify-between">
                <span>{b.name}</span>
                <span className="font-medium">
                  {b.amountPkr.toLocaleString()} PKR
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-700/40 mt-2 pt-2 flex justify-between text-slate-400">
            <span>Total:</span>
            <span className="text-slate-100 font-semibold">
              {localTotal.toLocaleString()} PKR
            </span>
          </div>
        </div>

        {/* Remote Banks */}
        <div>
          <h5 className="font-semibold text-blue-400 mb-2 flex items-center gap-1">
            🌍 Remote Banks
          </h5>
          <ul className="space-y-1">
            {remoteBanks.map((b: any) => (
              <li key={b.name} className="flex justify-between">
                <span>{b.name}</span>
                <span className="font-medium">
                  {(b.amountUsd * b.exchangeRate).toLocaleString()} PKR
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-700/40 mt-2 pt-2 flex justify-between text-slate-400">
            <span>Total:</span>
            <span className="text-slate-100 font-semibold">
              {remoteTotal.toLocaleString()} PKR
            </span>
          </div>
        </div>

        {/* Mutual Funds */}
        <div>
          <h5 className="font-semibold text-purple-400 mb-2 flex items-center gap-1">
            📊 Mutual Funds
          </h5>
          <div className="space-y-2">
            {mutualFunds.map((mf: any) => {
              const bankKey = Object.keys(mf)[0];
              const funds = mf[bankKey];
              const total = funds.reduce(
                (sum: number, f: any) => sum + f.value,
                0
              );

              return (
                <div key={bankKey}>
                  <div className="flex justify-between text-slate-400">
                    <span>{bankKey}</span>
                    <span className="font-medium text-slate-200">
                      {total.toLocaleString()} PKR
                    </span>
                  </div>
                  <ul className="ml-3 mt-1 space-y-0.5 text-xs text-slate-400">
                    {funds.map((f: any, i: number) => (
                      <li key={i} className="flex justify-between">
                        <span>{f.fund}</span>
                        <span className="text-slate-300">
                          {f.value.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-700/40 mt-2 pt-2 flex justify-between text-slate-400">
            <span>Total:</span>
            <span className="text-slate-100 font-semibold">
              {mutualTotal.toLocaleString()} PKR
            </span>
          </div>
        </div>
      </div>

      {/* Grand Total */}
      <div className="mt-6 pt-3 border-t border-slate-700/40 flex justify-between text-slate-400">
        <span>💰 Total Portfolio Value:</span>
        <span className="text-slate-100 font-bold text-base">
          {Math.round(snapshot.grandTotal).toLocaleString()} PKR
        </span>
      </div>
    </div>
  );
}
