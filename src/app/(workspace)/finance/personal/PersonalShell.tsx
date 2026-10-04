'use client';

import { errorMessage } from '@/lib/client-api';
import { useEffect, useState, type ReactNode } from 'react';
import { FinanceToast, type FinanceToastState } from '../components/FinanceToast';
import { FinancePageShell } from '../components/FinanceUI';

export function usePersonalData(refresh: () => Promise<void>) {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<FinanceToastState>(null);

  useEffect(() => {
    setLoading(true);
    void refresh()
      .catch((cause) => setToast({ tone: 'error', message: errorMessage(cause, 'Could not load personal data') }))
      .finally(() => setLoading(false));
  }, [refresh]);

  return { loading, toast, setToast };
}

export function PersonalShell({
  loading,
  toast,
  setToast,
  title,
  description,
  children,
}: {
  loading: boolean;
  toast: FinanceToastState;
  setToast: (toast: FinanceToastState) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading personal data…</p>
      </div>
    );
  }

  return (
    <>
      <FinancePageShell section="personal" title={title} description={description}>
        {children}
      </FinancePageShell>
      <FinanceToast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
