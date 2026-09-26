import type { ReactNode } from 'react';
import { toMajor, toMinor } from '@/lib/money';

export const styleClasses = {
  cardClass:
    'rounded-2xl border border-white/8 bg-slate-900/70 p-5 shadow-[0_24px_80px_rgba(0,0,0,.22)] backdrop-blur-xl sm:p-6',
  sectionTitleClass: 'text-lg font-bold text-white',
  labelClass: 'mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500',
  inputClass:
    'min-h-11 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/55 focus:ring-2 focus:ring-cyan-400/10',
  addBtnClass:
    'inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] sm:min-h-10 sm:w-auto',
  deleteBtnClass:
    'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rose-400/15 bg-rose-400/8 text-lg font-bold text-rose-300 transition hover:bg-rose-400/15',
};

export function numberOrZero(value: string) {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

/**
 * One labelled input. `money` fields display rupees but report minor units, so
 * this is one of the two places in the app that converts.
 */
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
      <label className={styleClasses.labelClass}>{label}</label>
      <input
        className={styleClasses.inputClass}
        type={isNumber ? 'number' : undefined}
        min={isNumber ? 0 : undefined}
        step={money ? '0.01' : undefined}
        value={money ? toMajor(Number(value)) : value}
        placeholder={placeholder}
        onChange={(event) => {
          if (money) return onChange(toMinor(numberOrZero(event.target.value)));
          onChange(isNumber ? numberOrZero(event.target.value) : event.target.value);
        }}
      />
    </div>
  );
}

export function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className={styleClasses.deleteBtnClass}>
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
        {Math.round(toMajor(value)).toLocaleString()}
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
    <section className={styleClasses.cardClass}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className={styleClasses.sectionTitleClass}>{title}</h2>
        <button onClick={onAdd} className={styleClasses.addBtnClass}>
          {addLabel}
        </button>
      </div>
      {children}
      <div className="mt-5 flex items-center justify-end border-t border-white/6 pt-5">{footer}</div>
    </section>
  );
}
