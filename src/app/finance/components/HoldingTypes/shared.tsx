export const styleClasses = {
  cardClass:
    "rounded-2xl border border-white/8 bg-slate-900/70 p-5 shadow-[0_24px_80px_rgba(0,0,0,.22)] backdrop-blur-xl sm:p-6",
  sectionTitleClass: "text-lg font-bold text-white",
  labelClass:
    "mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500",
  inputClass:
    "min-h-11 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/55 focus:ring-2 focus:ring-cyan-400/10",
  addBtnClass:
    "inline-flex min-h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]",
  deleteBtnClass:
    "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rose-400/15 bg-rose-400/8 text-lg font-bold text-rose-300 transition hover:bg-rose-400/15",
};

export function numberOrZero(value: string) {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}
