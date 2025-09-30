import { SectionMap } from "./helpers";
import { FinanceDoc } from "@/types/finance";

const cardClass =
  "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl shadow-2xl border border-slate-700/50 mb-6 backdrop-blur-sm";
const sectionTitleClass =
  "text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent tracking-wide mb-6";
const labelClass = "block text-sm font-semibold text-slate-300 mb-2";
const inputClass =
  "w-full rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 hover:bg-slate-800/80";
const addBtnClass =
  "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all duration-200 font-semibold text-sm hover:shadow-xl transform hover:-translate-y-0.5";

function numberOrZero(value: string) {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

export function MutualFundsSection({
  data,
  onChange,
  onAddBank,
  onAddFund
}: {
  data: FinanceDoc;
  onChange: (
    mfIndex: number,
    bankKey: string,
    fundIndex: number | null,
    field: "fund" | "units" | "price" | "bankName",
    value: string | number
  ) => void;
  onAddBank: () => void;
  onAddFund: (mfIndex: number, bankKey: string) => void;
}) {
  return (
    <section className={cardClass}>
      <div className="flex justify-between items-center mb-6">
        <h2 className={sectionTitleClass}>Mutual Funds</h2>
        <button onClick={onAddBank} className={addBtnClass}>
          + Add Bank
        </button>
      </div>

      {data.mutualFunds.map((mf, mfIndex) => {
        const bankKey = Object.keys(mf)[0];
        const funds = mf[bankKey];

        return (
          <div
            key={mfIndex}
            className="bg-slate-800/30 border border-slate-600/30 p-5 rounded-xl mb-6 backdrop-blur-sm"
          >
            <div className="mb-4">
              <label className={labelClass}>Bank Name</label>
              <input
                className={inputClass}
                value={bankKey}
                placeholder="Enter bank name"
                onChange={(e) => onChange(mfIndex, bankKey, null, "bankName", e.target.value)}
              />
            </div>

            <div className="space-y-4">
              {funds.map((fund, fundIndex) => (
                <div
                  key={fundIndex}
                  className="grid grid-cols-4 gap-4 items-end p-4 bg-slate-700/20 rounded-lg border border-slate-600/20"
                >
                  <div>
                    <label className={labelClass}>Fund Name</label>
                    <input
                      className={inputClass}
                      value={fund.fund}
                      placeholder="Fund name"
                      onChange={(e) =>
                        onChange(mfIndex, bankKey, fundIndex, "fund", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Units</label>
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      value={fund.units}
                      placeholder="0"
                      onChange={(e) =>
                        onChange(mfIndex, bankKey, fundIndex, "units", Number(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Price</label>
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      value={fund.price}
                      placeholder="0"
                      onChange={(e) =>
                        onChange(mfIndex, bankKey, fundIndex, "price", Number(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Total Value</label>
                    <div className="text-right font-bold text-xl bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                      {Math.round(fund.units * fund.price).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-600/30">
              <button
                onClick={() => onAddFund(mfIndex, bankKey)}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 font-semibold text-sm hover:shadow-xl transform hover:-translate-y-0.5"
              >
                + Add Fund
              </button>

              <div className="text-right">
                <span className="text-slate-400 text-sm font-medium">Bank Total: </span>
                <span className="font-bold text-xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {Math.round(
                    funds.reduce((sum, f) => sum + f.units * f.price, 0)
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex justify-end items-center mt-6 pt-6 border-t border-slate-600/30">
        <div className="text-right">
          <span className="text-slate-400 text-sm font-medium">Section Total: </span>
          <span className="font-bold text-2xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {Math.round(
              data.mutualFunds.reduce((total, mf) => {
                const bankKey = Object.keys(mf)[0];
                const funds = mf[bankKey];
                return total + funds.reduce((sum, f) => sum + f.units * f.price, 0);
              }, 0)
            ).toLocaleString()}
          </span>
        </div>
      </div>
    </section>
  );
}

export function RemoteBanksSection({
  data,
  onChange,
  onAdd
}: {
  data: FinanceDoc;
  onChange: <K extends keyof SectionMap, F extends keyof SectionMap[K]>(
    section: K,
    index: number,
    field: F,
    value: SectionMap[K][F]
  ) => void;
  onAdd: () => void;
}) {
  return (
    <section className={cardClass}>
      <div className="flex justify-between items-center mb-3">
        <h2 className={sectionTitleClass}>Remote Banks</h2>
        <button onClick={onAdd} className={addBtnClass}>
          + Add Remote Bank
        </button>
      </div>

      <div className="space-y-5">
        {data.remoteBanks.map((bank, i) => (
          <div
            key={i}
            className="grid grid-cols-4 gap-4 items-end p-5 bg-slate-800/30 rounded-xl border border-slate-600/30 backdrop-blur-sm hover:bg-slate-800/40 transition-all duration-200"
          >
            <div>
              <label className={labelClass}>Bank</label>
              <input
                className={inputClass}
                value={bank.name}
                placeholder="Bank name"
                onChange={(e) => onChange("remoteBanks", i, "name", e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Amount (USD)</label>
              <input
                className={inputClass}
                type="number"
                min={0}
                value={bank.amountUsd}
                placeholder="0"
                onChange={(e) =>
                  onChange("remoteBanks", i, "amountUsd", numberOrZero(e.target.value))
                }
              />
            </div>

            <div>
              <label className={labelClass}>Exchange Rate</label>
              <input
                className={inputClass}
                type="number"
                min={0}
                value={bank.exchangeRate}
                placeholder="0"
                onChange={(e) =>
                  onChange("remoteBanks", i, "exchangeRate", numberOrZero(e.target.value))
                }
              />
            </div>

            <div>
              <label className={labelClass}>Value (PKR)</label>
              <div className="text-right font-bold text-xl bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                {Math.round(bank.amountUsd * bank.exchangeRate).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end items-center mt-6 pt-6 border-t border-slate-600/30">
        <div className="text-right">
          <span className="text-slate-400 text-sm font-medium">Section Total: </span>
          <span className="font-bold text-2xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {Math.round(
              data.remoteBanks.reduce((sum, b) => sum + b.amountUsd * b.exchangeRate, 0)
            ).toLocaleString()}
          </span>
          <span className="text-slate-400 text-sm ml-1">PKR</span>
        </div>
      </div>
    </section>
  );
}

export function LocalBanksSection({
  data,
  onChange,
  onAdd
}: {
  data: FinanceDoc;
  onChange: <K extends keyof SectionMap, F extends keyof SectionMap[K]>(
    section: K,
    index: number,
    field: F,
    value: SectionMap[K][F]
  ) => void;
  onAdd: () => void;
}) {
  return (
    <section className={cardClass}>
      <div className="flex justify-between items-center mb-3">
        <h2 className={sectionTitleClass}>Local Banks</h2>
        <button onClick={onAdd} className={addBtnClass}>
          + Add Local Bank
        </button>
      </div>

      <div className="space-y-5">
        {data.localBanks.map((bank, i) => (
          <div
            key={i}
            className="grid grid-cols-2 gap-6 items-end p-5 bg-slate-800/30 rounded-xl border border-slate-600/30 backdrop-blur-sm hover:bg-slate-800/40 transition-all duration-200"
          >
            <div>
              <label className={labelClass}>Bank</label>
              <input
                className={inputClass}
                value={bank.name}
                placeholder="Bank name"
                onChange={(e) => onChange("localBanks", i, "name", e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Amount (PKR)</label>
              <input
                className={inputClass}
                type="number"
                min={0}
                value={bank.amountPkr}
                placeholder="0"
                onChange={(e) =>
                  onChange("localBanks", i, "amountPkr", numberOrZero(e.target.value))
                }
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end items-center mt-6 pt-6 border-t border-slate-600/30">
        <div className="text-right">
          <span className="text-slate-400 text-sm font-medium">Section Total: </span>
          <span className="font-bold text-2xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {Math.round(data.localBanks.reduce((sum, b) => sum + b.amountPkr, 0)).toLocaleString()}
          </span>
          <span className="text-slate-400 text-sm ml-1">PKR</span>
        </div>
      </div>
    </section>
  );
}
