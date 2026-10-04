import { fundGroups, valuePkr } from '@/lib/finance';
import type { Holding } from '@/types/finance';
import { HoldingRow, type IndexedHolding } from './HoldingSection';
import { DeleteButton, Field, SectionCard, SectionTotal, styleClasses } from './shared';

const FUND_FIELDS = [
  { key: 'name', label: 'Fund Name', placeholder: 'Fund name' },
  { key: 'amount', label: 'Value (PKR)', money: true },
] as const;

const fund = (bank: string): Holding => ({ kind: 'mutual_fund', name: '', group: bank, amount: 0, exchangeRate: 1 });
const total = (funds: IndexedHolding[]) => funds.reduce((sum, item) => sum + valuePkr(item), 0);

export function MutualFundsSection({
  holdings,
  onAdd,
  onChange,
  onDelete,
  onRenameBank,
  onDeleteBank,
}: {
  holdings: IndexedHolding[];
  onAdd: (holding: Holding) => void;
  onChange: (index: number, patch: Partial<Holding>) => void;
  onDelete: (index: number) => void;
  onRenameBank: (from: string, to: string) => void;
  onDeleteBank: (bank: string) => void;
}) {
  const groups = fundGroups(holdings);
  const nextBank = `New Bank ${groups.length + 1}`;

  return (
    <SectionCard
      title="Mutual Funds"
      addLabel="+ Add Bank"
      onAdd={() => onAdd(fund(nextBank))}
      footer={<SectionTotal value={total(groups.flatMap((group) => group.funds))} />}
    >
      {groups.map(({ bank, funds }, groupIndex) => (
        <div key={groupIndex} className="mb-4 rounded-xl border border-white/7 bg-slate-950/45 p-4">
          <div className="mb-4 flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <Field
                label="Bank Name"
                value={bank}
                placeholder="Enter bank name"
                onChange={(value) => onRenameBank(bank, String(value))}
              />
            </div>
            <DeleteButton onClick={() => onDeleteBank(bank)} />
          </div>

          <div className="space-y-4">
            {funds.map((item) => (
              <HoldingRow
                key={item.id ?? `new-${item.index}`}
                holding={item}
                fields={[...FUND_FIELDS]}
                className="grid gap-3 rounded-lg border border-white/6 bg-white/[0.025] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                onChange={onChange}
                onDelete={onDelete}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-white/6 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button onClick={() => onAdd(fund(bank))} className={styleClasses.addBtnClass}>
              + Add Fund
            </button>
            <SectionTotal label="Bank Total" value={total(funds)} />
          </div>
        </div>
      ))}
    </SectionCard>
  );
}
