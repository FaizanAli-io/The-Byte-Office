"use client";

import { currentMonth } from "@/lib/ledger";
import type {
  LedgerAccount,
  LedgerEntry,
  MonthlyLedger,
  MonthlyLedgerPayload,
} from "@/types/ledger";
import { useCallback, useEffect, useState } from "react";

export function useLedger() {
  const [month, setMonth] = useState(currentMonth);
  const [ledger, setLedger] = useState<MonthlyLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (selectedMonth: string) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/ledger?month=${selectedMonth}`);
      if (response.status === 404) {
        setLedger(null);
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load ledger");
      setLedger(data);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load ledger",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [load, month]);

  async function create(importFinance: boolean) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, importFinance }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not create ledger");
      setLedger(data);
      setNotice(
        importFinance
          ? "Opening balances imported from the portfolio editor."
          : "Monthly ledger created.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create ledger",
      );
    } finally {
      setSaving(false);
    }
  }

  async function save(status = ledger?.status) {
    if (!ledger || !status) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload: MonthlyLedgerPayload = {
        month: ledger.month,
        status,
        accounts: ledger.accounts,
        entries: ledger.entries,
        finalizedAt: status === "finalized" ? ledger.finalizedAt : undefined,
      };
      const response = await fetch("/api/ledger", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save ledger");
      setLedger(data);
      setNotice(
        status === "finalized"
          ? "Month finalized and locked."
          : ledger.status === "finalized"
            ? "Month reopened for editing."
            : "Ledger saved.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save ledger",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateAccount(id: string, patch: Partial<LedgerAccount>) {
    setLedger((current) =>
      current
        ? {
            ...current,
            accounts: current.accounts.map((account) =>
              account.id === id ? { ...account, ...patch } : account,
            ),
          }
        : current,
    );
  }

  function addAccount(account: LedgerAccount) {
    setLedger((current) =>
      current
        ? { ...current, accounts: [...current.accounts, account] }
        : current,
    );
  }

  function removeAccount(id: string) {
    setLedger((current) => {
      if (
        !current ||
        current.entries.some((entry) => entryUsesAccount(entry, id))
      ) {
        setError("Delete entries for this account before removing it.");
        return current;
      }
      return {
        ...current,
        accounts: current.accounts.filter((account) => account.id !== id),
      };
    });
  }

  function addEntry(entry: LedgerEntry) {
    setLedger((current) =>
      current ? { ...current, entries: [...current.entries, entry] } : current,
    );
  }

  function updateEntry(entry: LedgerEntry) {
    setLedger((current) =>
      current
        ? {
            ...current,
            entries: current.entries.map((item) =>
              item.id === entry.id ? entry : item,
            ),
          }
        : current,
    );
  }

  function removeEntry(id: string) {
    setLedger((current) =>
      current
        ? {
            ...current,
            entries: current.entries.filter((entry) => entry.id !== id),
          }
        : current,
    );
  }

  return {
    month,
    setMonth,
    ledger,
    loading,
    saving,
    error,
    notice,
    create,
    save,
    updateAccount,
    addAccount,
    removeAccount,
    addEntry,
    updateEntry,
    removeEntry,
  };
}

function entryUsesAccount(entry: LedgerEntry, id: string) {
  return entry.accountId === id || entry.destinationAccountId === id;
}
