import { FinanceDoc } from '@/types/finance';
import { DeleteButton, Field, SectionCard, SectionTotal, styleClasses } from './shared';

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
    field: 'fund' | 'value' | 'bankName',
    value: string | number
  ) => void;
  onAddBank: () => void;
  onAddFund: (mfIndex: number, bankKey: string) => void;
  onDeleteBank: (mfIndex: number) => void;
  onDeleteFund: (mfIndex: number, bankKey: string, fundIndex: number) => void;
}) {
  const sectionTotal = data.mutualFunds.reduce((total, group) => total + bankTotal(group), 0);

  return (
    <SectionCard
      title="Mutual Funds"
      addLabel="+ Add Bank"
      onAdd={onAddBank}
      footer={<SectionTotal value={sectionTotal} />}
    >
      {data.mutualFunds.map((group, mfIndex) => {
        const bankKey = Object.keys(group)[0];
        const funds = group[bankKey];

        return (
          <div key={mfIndex} className="mb-4 rounded-xl border border-white/7 bg-slate-950/45 p-4">
            <div className="mb-4 flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <Field
                  label="Bank Name"
                  value={bankKey}
                  placeholder="Enter bank name"
                  onChange={(value) => onChange(mfIndex, bankKey, null, 'bankName', value)}
                />
              </div>
              <DeleteButton onClick={() => onDeleteBank(mfIndex)} />
            </div>

            <div className="space-y-4">
              {funds.map((fund, fundIndex) => (
                <div
                  key={fund.id ?? `new-${fundIndex}`}
                  className="grid gap-3 rounded-lg border border-white/6 bg-white/[0.025] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                >
                  <Field
                    label="Fund Name"
                    value={fund.fund}
                    placeholder="Fund name"
                    onChange={(value) => onChange(mfIndex, bankKey, fundIndex, 'fund', value)}
                  />
                  <Field
                    label="Value (PKR)"
                    value={fund.value}
                    money
                    onChange={(value) => onChange(mfIndex, bankKey, fundIndex, 'value', value)}
                  />
                  <DeleteButton onClick={() => onDeleteFund(mfIndex, bankKey, fundIndex)} />
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-white/6 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button onClick={() => onAddFund(mfIndex, bankKey)} className={styleClasses.addBtnClass}>
                + Add Fund
              </button>
              <SectionTotal label="Bank Total" value={bankTotal(group)} />
            </div>
          </div>
        );
      })}
    </SectionCard>
  );
}

function bankTotal(group: FinanceDoc['mutualFunds'][number]) {
  const bankKey = Object.keys(group)[0];
  return (group[bankKey] ?? []).reduce((sum, fund) => sum + fund.value, 0);
}
