"use client";

import { SectionMap } from "./helpers";
import { FinanceDoc } from "@/types/finance";
import { useState, useEffect } from "react";

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
  function handleChange<
    K extends keyof SectionMap,
    F extends keyof SectionMap[K]
  >(section: K, index: number, field: F, value: SectionMap[K][F]) {
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
    field: "fund" | "value" | "bankName",
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
        mfEntry as Record<string, { fund: string; value: number }[]>
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

  // add a new company/bank with one empty fund
  function addMutualFundBank() {
    setData((prev) =>
      prev
        ? {
            ...prev,
            mutualFunds: [
              ...prev.mutualFunds,
              { "New Bank": [{ fund: "", value: 0 }] }
            ]
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
        mfEntry as Record<string, { fund: string; value: number }[]>
      )[bankKey];
      if (!bankFunds) return copy;

      const newBankFunds = [...bankFunds, { fund: "", value: 0 }];

      const newMF = copy.mutualFunds.slice();
      newMF[mfIndex] = { [bankKey]: newBankFunds };

      copy.mutualFunds = newMF;
      return copy;
    });
  }

  // ------------------ simple adders ------------------
  function addRemoteBank() {
    setData((prev) =>
      prev
        ? {
            ...prev,
            remoteBanks: [
              ...prev.remoteBanks,
              { name: "", amountUsd: 0, exchangeRate: 0 }
            ]
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

  // ------------------ delete handlers ------------------

  // delete a specific fund under a mutual fund bank
  function deleteFundFromBank(
    mfIndex: number,
    bankKey: string,
    fundIndex: number
  ) {
    setData((prev) => {
      if (!prev) return prev;
      const copy = structuredClone(prev) as FinanceDoc;

      const mfEntry = copy.mutualFunds[mfIndex];
      if (!mfEntry) return copy;

      const bankFunds = (
        mfEntry as Record<string, { fund: string; value: number }[]>
      )[bankKey];
      if (!bankFunds) return copy;

      const newBankFunds = bankFunds.filter((_, i) => i !== fundIndex);

      const newMF = copy.mutualFunds.slice();
      newMF[mfIndex] = { [bankKey]: newBankFunds };

      copy.mutualFunds = newMF;
      return copy;
    });
  }

  // delete an entire mutual fund bank (and all its funds)
  function deleteMutualFundBank(mfIndex: number) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            mutualFunds: prev.mutualFunds.filter((_, i) => i !== mfIndex)
          }
        : prev
    );
  }

  // delete a remote bank
  function deleteRemoteBank(index: number) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            remoteBanks: prev.remoteBanks.filter((_, i) => i !== index)
          }
        : prev
    );
  }

  // delete a local bank
  function deleteLocalBank(index: number) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            localBanks: prev.localBanks.filter((_, i) => i !== index)
          }
        : prev
    );
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

  return {
    data,
    saving,
    loading,
    handleChange,
    addMutualFundBank,
    deleteMutualFundBank,
    handleChangeMutualFund,
    addFundToBank,
    addRemoteBank,
    addLocalBank,
    deleteFundFromBank,
    deleteRemoteBank,
    deleteLocalBank,
    handleSave
  };
}
