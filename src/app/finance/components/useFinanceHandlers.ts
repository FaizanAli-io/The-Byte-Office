"use client";

import { useState, useEffect } from "react";
import { SectionMap } from "./helpers";
import { FinanceDoc } from "@/types/finance";

export function useFinanceHandlers() {
  const [data, setData] = useState<FinanceDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ------------------ lifecycle ------------------
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/finance");
      const json = await res.json();
      setData(json);
      setLoading(false);
    })();
  }, []);

  // ------------------ generic handler ------------------
  function handleChange<K extends keyof SectionMap, F extends keyof SectionMap[K]>(
    section: K,
    index: number,
    field: F,
    value: SectionMap[K][F]
  ) {
    setData((prev) => {
      if (!prev) return prev;
      const copy = structuredClone(prev) as FinanceDoc;

      const sectionArray = copy[section] as unknown as SectionMap[K][];
      if (!Array.isArray(sectionArray) || sectionArray[index] === undefined) {
        return copy;
      }

      const updated = {
        ...sectionArray[index],
        [field]: value
      } as SectionMap[K];

      const newSection = sectionArray.slice();
      newSection[index] = updated;

      (copy as any)[section] = newSection;
      return copy;
    });
  }

  // ------------------ mutual funds ------------------
  function handleChangeMutualFund(
    mfIndex: number,
    bankKey: string,
    fundIndex: number | null,
    field: "fund" | "units" | "price" | "bankName",
    value: string | number
  ) {
    setData((prev) => {
      if (!prev) return prev;
      const copy = structuredClone(prev) as FinanceDoc;

      const mfEntry = copy.mutualFunds[mfIndex];
      if (!mfEntry) return copy;

      if (field === "bankName" && fundIndex === null) {
        const bankFunds = (mfEntry as Record<string, any>)[bankKey];
        if (!bankFunds) return copy;

        const newMF = copy.mutualFunds.slice();
        newMF[mfIndex] = { [String(value)]: bankFunds };

        copy.mutualFunds = newMF;
        return copy;
      }

      if (fundIndex === null) return copy;

      const bankFunds = (
        mfEntry as Record<string, { fund: string; units: number; price: number }[]>
      )[bankKey];
      if (!bankFunds || !bankFunds[fundIndex]) return copy;

      const newFund = { ...bankFunds[fundIndex], [field]: value };
      const newBankFunds = bankFunds.slice();
      newBankFunds[fundIndex] = newFund;

      const newMF = copy.mutualFunds.slice();
      newMF[mfIndex] = { [bankKey]: newBankFunds };

      copy.mutualFunds = newMF;
      return copy;
    });
  }

  // allow renaming a bank/company
  function renameMutualFundBank(mfIndex: number, oldKey: string, newKey: string) {
    setData((prev) => {
      if (!prev) return prev;
      const copy = structuredClone(prev) as FinanceDoc;

      const mfEntry = copy.mutualFunds[mfIndex];
      if (!mfEntry) return copy;

      const bankFunds = (mfEntry as Record<string, any>)[oldKey];
      if (!bankFunds) return copy;

      const newMF = copy.mutualFunds.slice();
      newMF[mfIndex] = { [newKey]: bankFunds };

      copy.mutualFunds = newMF;
      return copy;
    });
  }

  // add a new company/bank with one empty fund
  function addMutualFundBank() {
    setData((prev) =>
      prev
        ? {
            ...prev,
            mutualFunds: [...prev.mutualFunds, { "New Bank": [{ fund: "", units: 0, price: 0 }] }]
          }
        : prev
    );
  }

  // add a new fund under an existing bank
  function addFundToBank(mfIndex: number, bankKey: string) {
    setData((prev) => {
      if (!prev) return prev;
      const copy = structuredClone(prev) as FinanceDoc;

      const mfEntry = copy.mutualFunds[mfIndex];
      if (!mfEntry) return copy;

      const bankFunds = (
        mfEntry as Record<string, { fund: string; units: number; price: number }[]>
      )[bankKey];
      if (!bankFunds) return copy;

      const newBankFunds = [...bankFunds, { fund: "", units: 0, price: 0 }];

      const newMF = copy.mutualFunds.slice();
      newMF[mfIndex] = { [bankKey]: newBankFunds };

      copy.mutualFunds = newMF;
      return copy;
    });
  }

  // ------------------ save ------------------
  async function handleSave() {
    if (!data) return;
    setSaving(true);
    await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    setSaving(false);
  }

  // ------------------ simple adders ------------------
  function addRemoteBank() {
    setData((prev) =>
      prev
        ? {
            ...prev,
            remoteBanks: [...prev.remoteBanks, { name: "", amountUsd: 0, exchangeRate: 0 }]
          }
        : prev
    );
  }

  function addLocalBank() {
    setData((prev) =>
      prev
        ? {
            ...prev,
            localBanks: [...prev.localBanks, { name: "", amountPkr: 0 }]
          }
        : prev
    );
  }

  return {
    data,
    loading,
    saving,
    handleChange,
    handleChangeMutualFund,
    renameMutualFundBank,
    addMutualFundBank,
    addFundToBank,
    addRemoteBank,
    addLocalBank,
    handleSave
  };
}
