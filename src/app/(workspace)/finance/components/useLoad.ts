'use client';

import { heldFundsApi } from '@/lib/api-client';
import { errorMessage } from '@/lib/client-api';
import { useCallback, useEffect, useState, type DependencyList } from 'react';

// Loads when `deps` change or on `reload`; a null loader waits. The last good data stays while a reload runs, and a
// response that arrives after a newer request started is dropped.
export function useLoad<T>(load: (() => Promise<T>) | null, deps: DependencyList, failure = 'Could not load') {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(load));
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!load) return;
    let cancelled = false;
    setLoading(true);
    load()
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setError('');
      })
      .catch((cause) => !cancelled && setError(errorMessage(cause, failure)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { data, setData, error, loading, reload };
}

export const useHeldFunds = (deps: DependencyList = [], enabled = true) =>
  useLoad(enabled ? heldFundsApi.load : null, deps, 'Could not load held funds');
