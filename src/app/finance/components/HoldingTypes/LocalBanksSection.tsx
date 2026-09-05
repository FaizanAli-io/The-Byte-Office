import { SectionMap } from "../helpers";
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

export function LocalBanksSection({
  data,
  onChange,
  onAdd,
  onDelete,
}: {
  data: FinanceDoc;
  onChange: <K extends keyof SectionMap, F extends keyof SectionMap[K]>(
    section: K,
    index: number,
    field: F,
    value: SectionMap[K][F],
  ) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
}) {
  return (
    <section className={cardClass}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className={sectionTitleClass}>Local Banks</h2>
        <button onClick={onAdd} className={addBtnClass}>
          + Add Local Bank
        </button>
      </div>

      <div className="space-y-3">
        {data.localBanks.map((bank, i) => (
          <div
            key={i}
            className="grid gap-3 rounded-xl border border-white/7 bg-slate-950/45 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
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
                    numberOrZero(e.target.value),
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

      <div className="mt-5 flex items-center justify-end border-t border-white/6 pt-5">
        <div className="text-right">
          <span className="text-slate-400 text-sm font-medium">
            Section Total:{" "}
          </span>
          <span className="text-xl font-bold text-cyan-300">
            {Math.round(
              data.localBanks.reduce((sum, b) => sum + b.amountPkr, 0),
            ).toLocaleString()}
          </span>
          <span className="text-slate-400 text-sm ml-1">PKR</span>
        </div>
      </div>
    </section>
  );
}
