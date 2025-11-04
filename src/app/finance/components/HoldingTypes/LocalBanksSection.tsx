import { SectionMap } from "../helpers";
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

export function LocalBanksSection({
  data,
  onChange,
  onAdd,
  onDelete
}: {
  data: FinanceDoc;
  onChange: <K extends keyof SectionMap, F extends keyof SectionMap[K]>(
    section: K,
    index: number,
    field: F,
    value: SectionMap[K][F]
  ) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
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
            className="grid grid-cols-[1fr_1fr_auto] gap-6 items-end p-5 bg-slate-800/30 rounded-xl border border-slate-600/30 backdrop-blur-sm hover:bg-slate-800/40 transition-all duration-200"
          >
            <div>
              <label className={labelClass}>Bank</label>
              <input
                className={inputClass}
                value={bank.name}
                placeholder="Bank name"
                onChange={(e) =>
                  onChange("localBanks", i, "name", e.target.value)
                }
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
                  onChange(
                    "localBanks",
                    i,
                    "amountPkr",
                    numberOrZero(e.target.value)
                  )
                }
              />
            </div>

            <button onClick={() => onDelete(i)} className={deleteBtnClass}>
              −
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end items-center mt-6 pt-6 border-t border-slate-600/30">
        <div className="text-right">
          <span className="text-slate-400 text-sm font-medium">
            Section Total:{" "}
          </span>
          <span className="font-bold text-2xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {Math.round(
              data.localBanks.reduce((sum, b) => sum + b.amountPkr, 0)
            ).toLocaleString()}
          </span>
          <span className="text-slate-400 text-sm ml-1">PKR</span>
        </div>
      </div>
    </section>
  );
}
