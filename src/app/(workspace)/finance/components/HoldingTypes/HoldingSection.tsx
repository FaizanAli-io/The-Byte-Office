import { valuePkr } from '@/lib/finance';
import type { Holding } from '@/types/finance';
import { DeleteButton, Field, SectionCard, SectionTotal } from './shared';

export type IndexedHolding = Holding & { index: number };

export type HoldingField = {
  key: 'name' | 'amount' | 'exchangeRate';
  label: string;
  numeric?: boolean;
  money?: boolean;
  placeholder?: string;
};

export function HoldingRow({
  holding,
  fields,
  className,
  onChange,
  onDelete,
}: {
  holding: IndexedHolding;
  fields: HoldingField[];
  className: string;
  onChange: (index: number, patch: Partial<Holding>) => void;
  onDelete: (index: number) => void;
}) {
  return (
    <div className={className}>
      {fields.map((field) => (
        <Field
          key={field.key}
          label={field.label}
          numeric={field.numeric}
          money={field.money}
          placeholder={field.placeholder ?? (field.numeric || field.money ? '0' : undefined)}
          value={holding[field.key]}
          onChange={(value) => onChange(holding.index, { [field.key]: value })}
        />
      ))}
      <DeleteButton onClick={() => onDelete(holding.index)} />
    </div>
  );
}

export function HoldingSection({
  title,
  addLabel,
  rows,
  fields,
  rowClass,
  onAdd,
  onChange,
  onDelete,
}: {
  title: string;
  addLabel: string;
  rows: IndexedHolding[];
  fields: HoldingField[];
  rowClass: string;
  onAdd: () => void;
  onChange: (index: number, patch: Partial<Holding>) => void;
  onDelete: (index: number) => void;
}) {
  return (
    <SectionCard
      title={title}
      addLabel={addLabel}
      onAdd={onAdd}
      footer={<SectionTotal value={rows.reduce((sum, row) => sum + valuePkr(row), 0)} unit="PKR" />}
    >
      <div className="space-y-3">
        {rows.map((row) => (
          <HoldingRow
            key={row.id ?? `new-${row.index}`}
            holding={row}
            fields={fields}
            className={rowClass}
            onChange={onChange}
            onDelete={onDelete}
          />
        ))}
      </div>
    </SectionCard>
  );
}
