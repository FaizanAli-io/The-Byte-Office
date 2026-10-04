'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { financeStyles } from '../../(workspace)/finance/components/FinanceUI';

type Decision = 'approve' | 'deny';

type FormAction = (formData: FormData) => void | Promise<void>;

export function ConsentButtons({ approve, deny }: { approve: FormAction; deny: FormAction }) {
  const { pending } = useFormStatus();
  const [pressed, setPressed] = useState<Decision | null>(null);

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
      <button
        type="submit"
        formAction={approve}
        // Disable from `pending` only: disabling on click drops the form submission.
        disabled={pending}
        onClick={() => setPressed('approve')}
        aria-busy={pressed === 'approve'}
        className={`${financeStyles.primary} sm:min-w-40`}
      >
        {pressed === 'approve' ? <Working label="Authorizing" /> : 'Approve'}
      </button>
      <button
        type="submit"
        formAction={deny}
        disabled={pending}
        onClick={() => setPressed('deny')}
        aria-busy={pressed === 'deny'}
        className={`${financeStyles.secondary} sm:min-w-32`}
      >
        {pressed === 'deny' ? <Working label="Cancelling" /> : 'Deny'}
      </button>
    </div>
  );
}

function Working({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
      />
      {label}…
    </span>
  );
}
