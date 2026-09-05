"use client";

import { persistFinanceToken } from "@/lib/finance-session-client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function FinanceVerifyPage() {
  return (
    <Suspense
      fallback={
        <p className="px-4 pt-32 text-center text-sm text-slate-400">
          Signing you in…
        </p>
      }
    >
      <VerifySession />
    </Suspense>
  );
}

function VerifySession() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    const next = searchParams.get("next");
    if (!token) {
      setError("This login link is missing a token.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/finance-auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Unable to complete sign-in");
        }
        if (cancelled) return;
        persistFinanceToken(result.token);
        const destination =
          next?.startsWith("/finance") && !next.startsWith("//")
            ? next
            : "/finance";
        router.replace(destination);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to complete sign-in",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 pt-20">
        <div className="w-full max-w-sm rounded-2xl border border-white/8 bg-slate-900/75 p-7 text-center">
          <h1 className="text-xl font-bold text-white">Sign-in failed</h1>
          <p className="mt-3 text-sm text-rose-300" role="alert">
            {error}
          </p>
          <a
            href="/finance/login"
            className="mt-5 inline-flex text-sm font-semibold text-cyan-300 underline"
          >
            Request a new link
          </a>
        </div>
      </div>
    );
  }

  return (
    <p className="px-4 pt-32 text-center text-sm text-slate-400">
      Signing you in…
    </p>
  );
}
