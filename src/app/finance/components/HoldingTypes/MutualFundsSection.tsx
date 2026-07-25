import { FinanceDoc } from "@/types/finance";
import { styleClasses, numberOrZero } from "./shared";

const {
  cardClass,
  sectionTitleClass,
  labelClass,
  inputClass,
  addBtnClass,
  deleteBtnClass,
} = styleClasses;

export function MutualFundsSection({
  data,
  onChange,
  onAddBank,
  onAddFund,
  onDeleteBank,
  onDeleteFund,
}: {
  data: FinanceDoc;
  onChange: (
    mfIndex: number,
    bankKey: string,
    fundIndex: number | null,
    field: "fund" | "value" | "bankName",
    value: string | number,
  ) => void;
  onAddBank: () => void;
  onAddFund: (mfIndex: number, bankKey: string) => void;
  onDeleteBank: (mfIndex: number) => void;
  onDeleteFund: (mfIndex: number, bankKey: string, fundIndex: number) => void;
}) {
  return (
    <section className={cardClass}>
      <div className="mb-5 flex items-center justify-between gap-3">
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
            className="mb-4 rounded-xl border border-white/7 bg-slate-950/45 p-4"
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
                  className="grid gap-3 rounded-lg border border-white/6 bg-white/[0.025] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
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
                          e.target.value,
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
                          numberOrZero(e.target.value),
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

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/6 pt-4">
              <button
                onClick={() => onAddFund(mfIndex, bankKey)}
                className={addBtnClass}
              >
                + Add Fund
              </button>

              <div className="text-right">
                <span className="text-slate-400 text-sm font-medium">
                  Bank Total:{" "}
                </span>
                <span className="text-lg font-bold text-cyan-300">
                  {Math.round(
                    funds.reduce((sum, f) => sum + f.value, 0),
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      <div className="mt-5 flex items-center justify-end border-t border-white/6 pt-5">
        <div className="text-right">
          <span className="text-slate-400 text-sm font-medium">
            Section Total:{" "}
          </span>
          <span className="text-xl font-bold text-cyan-300">
            {Math.round(
              data.mutualFunds.reduce((total, mf) => {
                const bankKey = Object.keys(mf)[0];
                const funds = mf[bankKey];
                return total + funds.reduce((sum, f) => sum + f.value, 0);
              }, 0),
            ).toLocaleString()}
          </span>
        </div>
      </div>
    </section>
  );
}
