'use client';

import type { FinanceToastState } from './FinanceToast';
import { financeApi } from '@/lib/api-client';
import { errorMessage } from '@/lib/client-api';
import type { Holding } from '@/types/finance';
import { useEffect, useState } from 'react';

export function useFinanceHandlers() {
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    financeApi
      .load()
      .then(({ holdings: loaded }) => {
        if (!Array.isArray(loaded)) throw new Error('Finance data was empty or invalid');
        setHoldings(loaded);
        setError('');
      })
      .catch((err) => {
        console.error('Failed to fetch /api/finance:', err);
        setError(errorMessage(err, 'Failed to load finance data'));
      })
      .finally(() => setLoading(false));
  }, []);

  const edit = (mutate: (current: Holding[]) => Holding[]) => setHoldings((current) => current && mutate(current));

  async function handleSave(): Promise<FinanceToastState> {
    if (!holdings || saving) return null;
    setSaving(true);
    try {
      const { data } = await financeApi.save(holdings);
      if (data) setHoldings(data.holdings);
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
    holdings,
    error,
    saving,
    loading,
    handleSave,
    add: (holding: Holding) => edit((current) => [...current, holding]),
    remove: (index: number) => edit((current) => current.filter((_, i) => i !== index)),
    change: (index: number, patch: Partial<Holding>) =>
      edit((current) => current.map((holding, i) => (i === index ? { ...holding, ...patch } : holding))),
    renameBank: (from: string, to: string) =>
      edit((current) =>
        current.map((holding) =>
          holding.kind === 'mutual_fund' && holding.group === from ? { ...holding, group: to } : holding
        )
      ),
    removeBank: (bank: string) =>
      edit((current) => current.filter((holding) => !(holding.kind === 'mutual_fund' && holding.group === bank))),
  };
}
