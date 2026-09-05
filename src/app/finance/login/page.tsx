"use client";

import { FINANCE_LOGIN_EMAIL } from "@/lib/finance-constants";
import { useState } from "react";
import { financeStyles } from "../components/FinanceUI";

export default function FinanceLoginPage() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [emailed, setEmailed] = useState(false);
  const [loginLink, setLoginLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSent(false);
    setEmailed(false);
    setLoginLink("");

    try {
      const next = new URLSearchParams(window.location.search).get("next");
      const response = await fetch("/api/finance-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send link");
      setSent(true);
      setEmailed(Boolean(result.emailed));
      if (typeof result.loginLink === "string") setLoginLink(result.loginLink);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to send login link",
      );
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
          We will email a one-time link to {FINANCE_LOGIN_EMAIL}. Opening it
          signs you in and keeps you signed in on this browser.
        </p>
        <button
          type="submit"
          className={`${financeStyles.primary} mt-6 w-full`}
          disabled={submitting}
        >
          {submitting ? "Sending link…" : "Email me a login link"}
        </button>
        {sent && emailed ? (
          <p className="mt-3 text-sm text-emerald-300" role="status">
            A login link was sent to {FINANCE_LOGIN_EMAIL}. It expires in 15
            minutes.
          </p>
        ) : null}
        {sent && !emailed && loginLink ? (
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Email is not configured yet, so use this link:{" "}
            <a className="text-cyan-300 underline" href={loginLink}>
              Open finance workspace
            </a>
          </p>
        ) : null}
        {sent && emailed && loginLink ? (
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Local backup link:{" "}
            <a className="text-cyan-300 underline" href={loginLink}>
              Open finance workspace
            </a>
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
