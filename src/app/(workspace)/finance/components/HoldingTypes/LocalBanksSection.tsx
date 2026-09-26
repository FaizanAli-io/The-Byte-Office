import type { FinanceDoc, FinanceLocalBank } from '@/types/finance';
import { HoldingSection, type HoldingField } from './HoldingSection';
import type { SectionHandlers } from './types';

const fields: HoldingField<FinanceLocalBank>[] = [
  { key: 'name', label: 'Bank', placeholder: 'Bank name' },
  { key: 'amountPkr', label: 'Amount (PKR)', numeric: true },
];

export function LocalBanksSection({ data, onAdd, onDelete, onChange }: SectionHandlers<FinanceDoc>) {
  return (
    <HoldingSection
      title="Local Banks"
      addLabel="+ Add Local Bank"
      rows={data.localBanks}
      fields={fields}
      rowClass="grid gap-3 rounded-xl border border-white/7 bg-slate-950/45 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      toPkr={(bank) => bank.amountPkr}
      onAdd={onAdd}
      onDelete={onDelete}
      onChange={(index, key, value) => onChange('localBanks', index, key, value)}
    />
  );
}
