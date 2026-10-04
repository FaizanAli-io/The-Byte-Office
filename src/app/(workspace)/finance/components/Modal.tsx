'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { financeStyles } from './FinanceUI';

export function Modal({
  open,
  onClose,
  title,
  description,
  width = 'w-[min(48rem,calc(100vw-2rem))]',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  width?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      className={`m-auto rounded-2xl border border-white/8 bg-slate-900 p-0 text-slate-200 shadow-2xl backdrop:bg-slate-950/70 ${width}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-white/8 p-5">
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        <button type="button" className={financeStyles.secondary} onClick={onClose}>
          Close
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
