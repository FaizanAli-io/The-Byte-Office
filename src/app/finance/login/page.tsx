"use client";

import { useState } from "react";
import { financeStyles } from "../components/FinanceUI";

export default function FinanceLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/finance-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in");

      const requestedPath = new URLSearchParams(window.location.search).get(
        "next",
      );
      const destination =
        requestedPath?.startsWith("/finance") && !requestedPath.startsWith("//")
          ? requestedPath
          : "/finance";
      window.location.replace(destination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 pt-20">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/8 bg-slate-900/75 p-7 shadow-2xl backdrop-blur-xl"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
          Private workspace
        </p>
        <h1 className="mt-3 text-2xl font-bold text-white">Finance login</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Your password is verified securely by the server.
        </p>
        <label className="mt-6 block">
          <span className={financeStyles.label}>Password</span>
          <input
            autoFocus
            required
            autoComplete="current-password"
            value={password}
            type="password"
            placeholder="Enter password"
            className={financeStyles.input}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className={`${financeStyles.primary} mt-4 w-full`}
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Continue"}
        </button>
        {error ? (
          <p className="mt-3 text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
