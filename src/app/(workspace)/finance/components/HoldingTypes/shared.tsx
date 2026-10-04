import type { ReactNode } from 'react';
import { financeStyles } from '../FinanceUI';

export const addButtonClass =
  'inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] sm:min-h-10 sm:w-auto';

const numberOrZero = (value: string) => Number(value) || 0;

export function Field({
  label,
  value,
  placeholder,
  numeric,
  money,
  onChange,
}: {
  label: string;
  value: string | number;
  placeholder?: string;
  numeric?: boolean;
  money?: boolean;
  onChange: (value: string | number) => void;
}) {
  const isNumber = numeric || money;
  return (
    <div>
      <label className={financeStyles.label}>{label}</label>
      <input
        className={financeStyles.input}
        type={isNumber ? 'number' : undefined}
        min={isNumber ? 0 : undefined}
        step={money ? '0.01' : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(isNumber ? numberOrZero(event.target.value) : event.target.value)}
      />
    </div>
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
    <section className={`${financeStyles.card} p-5 sm:p-6`}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <button onClick={onAdd} className={addButtonClass}>
          {addLabel}
        </button>
      </div>
      {children}
      <div className="mt-5 flex items-center justify-end border-t border-white/6 pt-5">{footer}</div>
    </section>
  );
}
