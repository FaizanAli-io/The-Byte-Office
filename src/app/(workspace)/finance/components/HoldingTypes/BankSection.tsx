import type { Holding } from '@/types/finance';
import { financeStyles } from '../FinanceUI';
import { HoldingSection, type HoldingField, type IndexedHolding } from './HoldingSection';

const SECTIONS = {
  local_bank: {
    title: 'Local Banks',
    addLabel: '+ Add Local Bank',
    rowClass: `${financeStyles.inset} grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end`,
    fields: [
      { key: 'name', label: 'Bank', placeholder: 'Bank name' },
      { key: 'amount', label: 'Amount (PKR)', money: true },
    ],
  },
  remote_bank: {
    title: 'Remote Banks',
    addLabel: '+ Add Remote Bank',
    rowClass: `${financeStyles.inset} grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-end`,
    fields: [
      { key: 'name', label: 'Bank', placeholder: 'Bank name' },
      { key: 'amount', label: 'Amount (USD)', money: true },
      { key: 'exchangeRate', label: 'Exchange Rate', numeric: true },
    ],
  },
} satisfies Record<string, { title: string; addLabel: string; rowClass: string; fields: HoldingField[] }>;

export function BankSection({
  kind,
  holdings,
  onAdd,
  onChange,
  onDelete,
}: {
  kind: 'local_bank' | 'remote_bank';
  holdings: IndexedHolding[];
  onAdd: (holding: Holding) => void;
  onChange: (index: number, patch: Partial<Holding>) => void;
  onDelete: (index: number) => void;
}) {
  const section = SECTIONS[kind];
  return (
    <HoldingSection
      {...section}
      rows={holdings.filter((holding) => holding.kind === kind)}
      onAdd={() => onAdd({ kind, name: '', group: null, amount: 0, exchangeRate: kind === 'remote_bank' ? 0 : 1 })}
      onChange={onChange}
      onDelete={onDelete}
    />
  );
}
