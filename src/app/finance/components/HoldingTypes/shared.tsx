export const styleClasses = {
  cardClass:
    "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl shadow-2xl border border-slate-700/50 mb-6 backdrop-blur-sm",
  sectionTitleClass:
    "text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent tracking-wide mb-6",
  labelClass: "block text-sm font-semibold text-slate-300 mb-2",
  inputClass:
    "w-full rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 hover:bg-slate-800/80",
  addBtnClass:
    "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all duration-200 font-semibold text-sm hover:shadow-xl transform hover:-translate-y-0.5",
  deleteBtnClass:
    "bg-red-400 hover:bg-red-500 text-white rounded-lg px-2 py-1 font-bold text-sm shadow-md transition-all duration-200 hover:shadow-lg transform hover:-translate-y-0.5"
};

export function numberOrZero(value: string) {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}
