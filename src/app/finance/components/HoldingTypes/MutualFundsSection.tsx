import { FinanceDoc } from "@/types/finance";
import { styleClasses, numberOrZero } from "./shared";

const {
  cardClass,
  sectionTitleClass,
  labelClass,
  inputClass,
  addBtnClass,
  deleteBtnClass
} = styleClasses;

export function MutualFundsSection({
  data,
  onChange,
  onAddBank,
  onAddFund,
  onDeleteBank,
  onDeleteFund
}: {
  data: FinanceDoc;
  onChange: (
    mfIndex: number,
    bankKey: string,
    fundIndex: number | null,
    field: "fund" | "value" | "bankName",
    value: string | number
  ) => void;
  onAddBank: () => void;
  onAddFund: (mfIndex: number, bankKey: string) => void;
  onDeleteBank: (mfIndex: number) => void;
  onDeleteFund: (mfIndex: number, bankKey: string, fundIndex: number) => void;
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
            <div className="flex justify-between items-center mb-4">
              <div className="flex-1 mr-4">
                <label className={labelClass}>Bank Name</label>
                <input
                  className={inputClass}
                  value={bankKey}
                  placeholder="Enter bank name"
                  onChange={(e) =>
                    onChange(mfIndex, bankKey, null, "bankName", e.target.value)
                  }
                />
              </div>
              <button
                onClick={() => onDeleteBank(mfIndex)}
                className={deleteBtnClass}
              >
                −
              </button>
            </div>

            <div className="space-y-4">
              {funds.map((fund, fundIndex) => (
                <div
                  key={fundIndex}
                  className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end p-4 bg-slate-700/20 rounded-lg border border-slate-600/20"
                >
                  <div>
                    <label className={labelClass}>Fund Name</label>
                    <input
                      className={inputClass}
                      value={fund.fund}
                      placeholder="Fund name"
                      onChange={(e) =>
                        onChange(
                          mfIndex,
                          bankKey,
                          fundIndex,
                          "fund",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Value (PKR)</label>
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      value={fund.value}
                      placeholder="0"
                      onChange={(e) =>
                        onChange(
                          mfIndex,
                          bankKey,
                          fundIndex,
                          "value",
                          numberOrZero(e.target.value)
                        )
                      }
                    />
                  </div>
                  <button
                    onClick={() => onDeleteFund(mfIndex, bankKey, fundIndex)}
                    className={deleteBtnClass}
                  >
                    −
                  </button>
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
                <span className="text-slate-400 text-sm font-medium">
                  Bank Total:{" "}
                </span>
                <span className="font-bold text-xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {Math.round(
                    funds.reduce((sum, f) => sum + f.value, 0)
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex justify-end items-center mt-6 pt-6 border-t border-slate-600/30">
        <div className="text-right">
          <span className="text-slate-400 text-sm font-medium">
            Section Total:{" "}
          </span>
          <span className="font-bold text-2xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {Math.round(
              data.mutualFunds.reduce((total, mf) => {
                const bankKey = Object.keys(mf)[0];
                const funds = mf[bankKey];
                return total + funds.reduce((sum, f) => sum + f.value, 0);
              }, 0)
            ).toLocaleString()}
          </span>
        </div>
      </div>
    </section>
  );
}
