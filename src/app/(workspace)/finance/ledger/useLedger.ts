'use client';

import { categoriesApi, ledgerApi, type CategoryInput } from '@/lib/api-client';
import { errorMessage } from '@/lib/client-api';
import { currentMonth, entryUsesAccount } from '@/lib/ledger';
import type { LedgerAccount, LedgerCategory, LedgerEntry, MonthlyLedger, MonthlyLedgerPayload } from '@/types/ledger';
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
  // Read when a queued save runs, not when it was queued, or back-to-back saves reject each other.
  const versionRef = useRef<MonthlyLedger['updatedAt']>('');
  const [accountsDirty, setAccountsDirty] = useState(false);
  const [categories, setCategories] = useState<LedgerCategory[]>([]);
  ledgerRef.current = ledger;

  const adopt = useCallback((next: MonthlyLedger | null) => {
    versionRef.current = next?.updatedAt ?? '';
    setLedger(next);
  }, []);

  const loadCategories = useCallback(async () => {
    setCategories(await categoriesApi.list());
  }, []);

  useEffect(() => {
    loadCategories().catch((cause) => setError(errorMessage(cause, 'Could not load categories')));
  }, [loadCategories]);

  const load = useCallback(
    async (selectedMonth: string) => {
      setLoading(true);
      setError('');
      setNotice('');
      try {
        adopt(await ledgerApi.load(selectedMonth));
        setAccountsDirty(false);
      } catch (cause) {
        setError(errorMessage(cause, 'Could not load ledger'));
      } finally {
        setLoading(false);
      }
    },
    [adopt]
  );

  useEffect(() => {
    load(month);
  }, [load, month]);

  async function run(action: () => Promise<unknown>, successNotice: string, failure: string) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successNotice);
    } catch (cause) {
      setError(errorMessage(cause, failure));
    } finally {
      setSaving(false);
    }
  }

  const create = () =>
    run(
      async () => adopt(await ledgerApi.create(month)),
      'Monthly ledger created from the portfolio.',
      'Could not create ledger'
    );

  async function enqueue(month: string, write: () => Promise<MonthlyLedger>, successNotice: string) {
    persistChain.current = persistChain.current
      .catch(() => undefined)
      .then(async () => {
        setSaving(true);
        setError('');
        setNotice('');
        try {
          adopt(await write());
          setNotice(successNotice);
        } catch (cause) {
          setError(errorMessage(cause, 'Could not save ledger'));
          adopt(await ledgerApi.load(month).catch(() => ledgerRef.current));
        } finally {
          setSaving(false);
        }
      });
    await persistChain.current;
  }

  async function persist(next: MonthlyLedger, successNotice: string) {
    await enqueue(
      next.month,
      async () => {
        const payload: MonthlyLedgerPayload = {
          month: next.month,
          status: next.status,
          accounts: next.accounts,
          finalizedAt: next.status === 'finalized' ? next.finalizedAt : undefined,
          updatedAt: versionRef.current,
        };
        const saved = await ledgerApi.save(payload);
        setAccountsDirty(false);
        return saved;
      },
      successNotice
    );
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
    const account = ledgerRef.current?.accounts.find((item) => item.id === id);
    const inUse = ledgerRef.current?.entries.some((entry) => entryUsesAccount(entry, id));
    if (
      account?.holdingId &&
      !inUse &&
      !window.confirm(`Remove "${account.name}"? It is removed from your portfolio too.`)
    ) {
      return;
    }
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

  const saveCategory = (input: CategoryInput) =>
    run(
      async () => {
        await (input.id
          ? categoriesApi.update({ ...input, id: input.id })
          : categoriesApi.create({ name: input.name ?? '', kind: input.kind ?? 'both' }));
        await loadCategories();
      },
      input.id ? 'Category updated.' : 'Category added.',
      'Could not save category'
    );

  const removeCategory = (id: string) =>
    run(
      async () => {
        await categoriesApi.remove(id);
        await loadCategories();
      },
      'Category deleted.',
      'Could not delete category'
    );

  function changeEntries(
    update: (entries: LedgerEntry[]) => LedgerEntry[],
    write: (month: string) => Promise<MonthlyLedger>,
    notice: string
  ) {
    const month = ledgerRef.current?.month;
    if (!month) return;
    setLedger((current) => (current ? { ...current, entries: update(current.entries) } : current));
    void enqueue(month, () => write(month), notice);
  }

  function addEntry(entry: LedgerEntry) {
    changeEntries(
      (entries) => [...entries, entry],
      (month) => ledgerApi.addEntry(month, entry),
      'Transaction saved.'
    );
  }

  function updateEntry(entry: LedgerEntry) {
    changeEntries(
      (entries) => entries.map((item) => (item.id === entry.id ? entry : item)),
      (month) => ledgerApi.updateEntry(month, entry),
      'Transaction updated.'
    );
  }

  function removeEntry(id: string) {
    changeEntries(
      (entries) => entries.filter((entry) => entry.id !== id),
      (month) => ledgerApi.removeEntry(month, id),
      'Transaction deleted.'
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
