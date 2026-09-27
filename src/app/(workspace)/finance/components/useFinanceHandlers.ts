'use client';

import type { FinanceToastState } from './FinanceToast';
import { financeApi } from '@/lib/api-client';
import { errorMessage } from '@/lib/client-api';
import { FinanceDoc } from '@/types/finance';
import { useState, useEffect } from 'react';

type BankSection = 'localBanks' | 'remoteBanks';
type MutualFundGroup = FinanceDoc['mutualFunds'][number];

const blankRow = {
  localBanks: { name: '', amountPkr: 0 },
  remoteBanks: { name: '', amountUsd: 0, exchangeRate: 0 },
} as const;

export function useFinanceHandlers() {
  const [data, setData] = useState<FinanceDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const doc = await financeApi.load();
        if (!Array.isArray(doc?.localBanks)) throw new Error('Finance data was empty or invalid');
        setData(doc);
        setError('');
      } catch (err) {
        console.error('Failed to fetch /api/finance:', err);
        setData(null);
        setError(errorMessage(err, 'Failed to load finance data'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Every mutation is "clone the doc, hand it to a mutator" — so that is the one primitive. */
  function edit(mutate: (draft: FinanceDoc) => void) {
    setData((prev) => {
      if (!prev) return prev;
      const draft = structuredClone(prev) as FinanceDoc;
      mutate(draft);
      return draft;
    });
  }

  /** Replaces the funds of one bank group, preserving the bank's name. */
  function editFunds(mfIndex: number, bankKey: string, mutate: (funds: MutualFundGroup[string]) => void) {
    edit((draft) => {
      const funds = draft.mutualFunds[mfIndex]?.[bankKey];
      if (!funds) return;
      mutate(funds);
    });
  }

  function handleChange(section: BankSection, index: number, field: string, value: string | number) {
    edit((draft) => {
      const row = draft[section][index] as unknown as Record<string, unknown> | undefined;
      if (row) row[field] = value;
    });
  }

  function handleChangeMutualFund(
    mfIndex: number,
    bankKey: string,
    fundIndex: number | null,
    field: 'fund' | 'value' | 'bankName',
    value: string | number
  ) {
    if (field === 'bankName' && fundIndex === null) {
      edit((draft) => {
        const funds = draft.mutualFunds[mfIndex]?.[bankKey];
        if (funds) draft.mutualFunds[mfIndex] = { [String(value)]: funds };
      });
      return;
    }
    if (fundIndex === null) return;
    editFunds(mfIndex, bankKey, (funds) => {
      if (funds[fundIndex]) funds[fundIndex] = { ...funds[fundIndex], [field]: value };
    });
  }

  async function handleSave(): Promise<FinanceToastState> {
    if (!data || saving) return null;
    setSaving(true);
    try {
      const { data: saved } = await financeApi.save(data);
      // Adopt the server's copy so holdings added in this session pick up the
      // IDs Postgres just assigned. Skipping this would make the next save
      // insert them again as new rows.
      if (saved) setData(saved);
      setError('');
      return { tone: 'success', message: 'Portfolio saved.' };
    } catch (err) {
      console.error('Failed to save /api/finance:', err);
      const message = errorMessage(err, 'Failed to save portfolio');
      setError(message);
      return { tone: 'error', message };
    } finally {
      setSaving(false);
    }
  }

  return {
    data,
    error,
    saving,
    loading,
    handleChange,
    handleChangeMutualFund,
    handleSave,
    addLocalBank: () => edit((draft) => void draft.localBanks.push({ ...blankRow.localBanks })),
    addRemoteBank: () => edit((draft) => void draft.remoteBanks.push({ ...blankRow.remoteBanks })),
    deleteLocalBank: (index: number) => edit((draft) => void draft.localBanks.splice(index, 1)),
    deleteRemoteBank: (index: number) => edit((draft) => void draft.remoteBanks.splice(index, 1)),
    addMutualFundBank: () => edit((draft) => void draft.mutualFunds.push({ 'New Bank': [{ fund: '', value: 0 }] })),
    deleteMutualFundBank: (mfIndex: number) => edit((draft) => void draft.mutualFunds.splice(mfIndex, 1)),
    addFundToBank: (mfIndex: number, bankKey: string) =>
      editFunds(mfIndex, bankKey, (funds) => void funds.push({ fund: '', value: 0 })),
    deleteFundFromBank: (mfIndex: number, bankKey: string, fundIndex: number) =>
      editFunds(mfIndex, bankKey, (funds) => void funds.splice(fundIndex, 1)),
  };
}
