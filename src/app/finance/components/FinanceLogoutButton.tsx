"use client";

import { useState } from "react";

export function FinanceLogoutButton() {
  const [submitting, setSubmitting] = useState(false);

  async function logout() {
    setSubmitting(true);
    try {
      await fetch("/api/finance-auth/logout", { method: "POST" });
    } finally {
      window.location.replace("/finance/login");
    }
  }

  return (
    <button
      type="button"
      disabled={submitting}
      onClick={logout}
      className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-rose-400/8 hover:text-rose-300 disabled:opacity-50"
    >
      {submitting ? "Signing out…" : "Sign out"}
    </button>
  );
}
