'use client';

import { financeStyles } from '../components/FinanceUI';

export const PAGE_SIZES = [10, 25, 50, 100];

export function Pagination({
  page,
  pageCount,
  pageSize,
  firstOnPage,
  shown,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  firstOnPage: number;
  shown: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-white/6 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500">
        {firstOnPage + 1}–{firstOnPage + shown} of {total}
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Per page
          <select
            className={`${financeStyles.input} w-auto py-1.5`}
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        {pageCount > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={financeStyles.secondary}
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
            >
              Previous
            </button>
            <span className="min-w-20 text-center text-xs text-slate-500">
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              className={financeStyles.secondary}
              disabled={page >= pageCount}
              onClick={() => onPage(page + 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
