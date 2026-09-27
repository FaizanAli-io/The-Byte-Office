'use client';

import { categoriesApi, ledgerApi } from '@/lib/api-client';
import { errorMessage } from '@/lib/client-api';
import { currentMonth } from '@/lib/ledger';
import type {
  CategoryKind,
  LedgerAccount,
  LedgerCategory,
  LedgerEntry,
  MonthlyLedger,
  MonthlyLedgerPayload,
} from '@/types/ledger';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useLedger() {
  const [month, setMonth] = useState(currentMonth);
  const [ledger, setLedger] = useState<MonthlyLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const persistChain = useRef(Promise.resolve());
  const ledgerRef = useRef<MonthlyLedger | null>(null);
  const [accountsDirty, setAccountsDirty] = useState(false);
  // Categories are global rather than per-month, so they load once and
  // survive a month change.
  const [categories, setCategories] = useState<LedgerCategory[]>([]);
  ledgerRef.current = ledger;

  const loadCategories = useCallback(async () => {
    setCategories(await categoriesApi.list());
  }, []);

  useEffect(() => {
    loadCategories().catch((cause) => setError(errorMessage(cause, 'Could not load categories')));
  }, [loadCategories]);

  const load = useCallback(async (selectedMonth: string) => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      setLedger(await ledgerApi.load(selectedMonth));
      setAccountsDirty(false);
    } catch (cause) {
      setError(errorMessage(cause, 'Could not load ledger'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [load, month]);

  async function create(importFinance: boolean) {
    setSaving(true);
    setError('');
    try {
      setLedger(await ledgerApi.create(month, importFinance));
      setNotice(importFinance ? 'Opening balances imported from the portfolio editor.' : 'Monthly ledger created.');
    } catch (cause) {
      setError(errorMessage(cause, 'Could not create ledger'));
    } finally {
      setSaving(false);
    }
  }

  async function persist(next: MonthlyLedger, successNotice: string) {
    persistChain.current = persistChain.current
      .catch(() => undefined)
      .then(async () => {
        setSaving(true);
        setError('');
        setNotice('');
        try {
          const payload: MonthlyLedgerPayload = {
            month: next.month,
            status: next.status,
            accounts: next.accounts,
            entries: next.entries,
            finalizedAt: next.status === 'finalized' ? next.finalizedAt : undefined,
          };
          setLedger(await ledgerApi.save(payload));
          setAccountsDirty(false);
          setNotice(successNotice);
        } catch (cause) {
          setError(errorMessage(cause, 'Could not save ledger'));
        } finally {
          setSaving(false);
        }
      });
    await persistChain.current;
  }

  async function save(status = ledger?.status) {
    if (!ledger || !status) return;
    const next = {
      ...ledger,
      status,
      finalizedAt: status === 'finalized' ? ledger.finalizedAt || new Date() : undefined,
    };
    await persist(
      next,
      status === 'finalized'
        ? 'Month finalized and locked.'
        : ledger.status === 'finalized'
          ? 'Month reopened for editing.'
          : 'Ledger saved.'
    );
  }

  async function saveAccounts() {
    const current = ledgerRef.current;
    if (!current) return;
    await persist(current, 'Accounts saved.');
  }

  function updateAccount(id: string, patch: Partial<LedgerAccount>) {
    setLedger((current) => {
      if (!current) return current;
      return {
        ...current,
        accounts: current.accounts.map((account) => (account.id === id ? { ...account, ...patch } : account)),
      };
    });
    setAccountsDirty(true);
  }

  function addAccount(account: LedgerAccount) {
    setLedger((current) => {
      if (!current) return current;
      const next = { ...current, accounts: [...current.accounts, account] };
      void persist(next, 'Account added.');
      return next;
    });
  }

  function removeAccount(id: string) {
    setLedger((current) => {
      if (!current || current.entries.some((entry) => entryUsesAccount(entry, id))) {
        setError('Delete entries for this account before removing it.');
        return current;
      }
      const next = {
        ...current,
        accounts: current.accounts.filter((account) => account.id !== id),
      };
      void persist(next, 'Account removed.');
      return next;
    });
  }

  /** One handler for both create and update, since the only difference is the id. */
  async function saveCategory(input: { id?: string; name?: string; kind?: CategoryKind; archived?: boolean }) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await (input.id
        ? categoriesApi.update({ ...input, id: input.id })
        : categoriesApi.create({ name: input.name ?? '', kind: input.kind ?? 'both' }));
      await loadCategories();
      setNotice(input.id ? 'Category updated.' : 'Category added.');
    } catch (cause) {
      setError(errorMessage(cause, 'Could not save category'));
    } finally {
      setSaving(false);
    }
  }

  async function removeCategory(id: string) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await categoriesApi.remove(id);
      await loadCategories();
      setNotice('Category deleted.');
    } catch (cause) {
      // Deleting a category in use is refused by the API with a count, which
      // is more useful than anything this layer could say.
      setError(errorMessage(cause, 'Could not delete category'));
    } finally {
      setSaving(false);
    }
  }

  function addEntry(entry: LedgerEntry) {
    setLedger((current) => {
      if (!current) return current;
      const next = { ...current, entries: [...current.entries, entry] };
      void persist(next, 'Transaction saved.');
      return next;
    });
  }

  function updateEntry(entry: LedgerEntry) {
    setLedger((current) => {
      if (!current) return current;
      const next = {
        ...current,
        entries: current.entries.map((item) => (item.id === entry.id ? entry : item)),
      };
      void persist(next, 'Transaction updated.');
      return next;
    });
  }

  function removeEntry(id: string) {
    setLedger((current) => {
      if (!current) return current;
      const next = {
        ...current,
        entries: current.entries.filter((entry) => entry.id !== id),
      };
      void persist(next, 'Transaction deleted.');
      return next;
    });
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
    saveAccounts,
    accountsDirty,
    updateAccount,
    addAccount,
    removeAccount,
    addEntry,
    updateEntry,
    removeEntry,
    categories,
    saveCategory,
    removeCategory,
  };
}

function entryUsesAccount(entry: LedgerEntry, id: string) {
  return entry.accountId === id || entry.destinationAccountId === id;
}
