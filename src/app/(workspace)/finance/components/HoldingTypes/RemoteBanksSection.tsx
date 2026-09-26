import type { FinanceDoc, FinanceRemoteBank } from '@/types/finance';
import { HoldingSection, type HoldingField } from './HoldingSection';
import type { SectionHandlers } from './types';

const fields: HoldingField<FinanceRemoteBank>[] = [
  { key: 'name', label: 'Bank', placeholder: 'Bank name' },
  { key: 'amountUsd', label: 'Amount (USD)', numeric: true },
  { key: 'exchangeRate', label: 'Exchange Rate', numeric: true },
];

export function RemoteBanksSection({ data, onAdd, onDelete, onChange }: SectionHandlers<FinanceDoc>) {
  return (
    <HoldingSection
      title="Remote Banks"
      addLabel="+ Add Remote Bank"
      rows={data.remoteBanks}
      fields={fields}
      rowClass="grid gap-3 rounded-xl border border-white/7 bg-slate-950/45 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-end"
      toPkr={(bank) => bank.amountUsd * bank.exchangeRate}
      onAdd={onAdd}
      onDelete={onDelete}
      onChange={(index, key, value) => onChange('remoteBanks', index, key, value)}
    />
  );
}
