import type { ReactNode } from 'react';
import { FinanceCard, Field as LabelledField, financeStyles } from '../FinanceUI';

export const addButtonClass = `${financeStyles.secondary} w-full sm:w-auto`;

const numberOrZero = (value: string) => Number(value) || 0;

export function Field({
  label,
  value,
  placeholder,
  numeric,
  money,
  disabled,
  onChange,
}: {
  label: string;
  value: string | number;
  placeholder?: string;
  numeric?: boolean;
  money?: boolean;
  disabled?: boolean;
  onChange: (value: string | number) => void;
}) {
  const isNumber = numeric || money;
  return (
    <LabelledField label={label}>
      <input
        className={financeStyles.input}
        type={isNumber ? 'number' : undefined}
        min={isNumber ? 0 : undefined}
        step={money ? '0.01' : undefined}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(isNumber ? numberOrZero(event.target.value) : event.target.value)}
      />
    </LabelledField>
  );
}

export function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rose-400/15 bg-rose-400/8 text-lg font-bold text-rose-300 transition hover:bg-rose-400/15"
    >
      −
    </button>
  );
}

export function SectionTotal({
  label = 'Section Total',
  value,
  unit,
}: {
  label?: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="text-right">
      <span className="text-slate-400 text-sm font-medium">{label}: </span>
      <span className={unit ? 'text-xl font-bold text-cyan-300' : 'text-lg font-bold text-cyan-300'}>
        {Math.round(value).toLocaleString()}
      </span>
      {unit ? <span className="text-slate-400 text-sm ml-1">{unit}</span> : null}
    </div>
  );
}

export function SectionCard({
  title,
  addLabel,
  onAdd,
  children,
  footer,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <FinanceCard
      title={title}
      action={
        <button onClick={onAdd} className={addButtonClass}>
          {addLabel}
        </button>
      }
    >
      {children}
      <div className="mt-5 flex items-center justify-end border-t border-white/6 pt-5">{footer}</div>
    </FinanceCard>
  );
}
