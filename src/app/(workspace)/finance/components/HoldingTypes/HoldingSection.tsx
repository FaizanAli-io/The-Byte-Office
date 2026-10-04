import { DeleteButton, Field, SectionCard, SectionTotal } from './shared';

export type HoldingField<T> = {
  key: keyof T & string;
  label: string;
  numeric?: boolean;
  money?: boolean;
  placeholder?: string;
};

export function HoldingSection<T extends { id?: string }>({
  title,
  addLabel,
  rows,
  fields,
  rowClass,
  toPkr,
  onAdd,
  onDelete,
  onChange,
}: {
  title: string;
  addLabel: string;
  rows: T[];
  fields: HoldingField<T>[];
  rowClass: string;
  toPkr: (row: T) => number;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onChange: (index: number, key: keyof T & string, value: string | number) => void;
}) {
  return (
    <SectionCard
      title={title}
      addLabel={addLabel}
      onAdd={onAdd}
      footer={<SectionTotal value={rows.reduce((sum, row) => sum + toPkr(row), 0)} unit="PKR" />}
    >
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.id ?? `new-${index}`} className={rowClass}>
            {fields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                numeric={field.numeric}
                money={field.money}
                placeholder={field.placeholder ?? (field.numeric || field.money ? '0' : undefined)}
                value={row[field.key] as string | number}
                onChange={(value) => onChange(index, field.key, value)}
              />
            ))}
            <DeleteButton onClick={() => onDelete(index)} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
