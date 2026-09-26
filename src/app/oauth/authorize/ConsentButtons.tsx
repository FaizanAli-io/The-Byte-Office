'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { financeStyles } from '../../(workspace)/finance/components/FinanceUI';

type Decision = 'approve' | 'deny';

type FormAction = (formData: FormData) => void | Promise<void>;

/**
 * Approve and Deny, with feedback that the press registered.
 *
 * Granting runs a database write and then a redirect back to the client, which
 * is long enough to look like nothing happened. `useFormStatus` reports the
 * parent form's submission, and the click records which button caused it, so
 * the pressed one can say what it is doing while both lock.
 *
 * `disabled` is driven by `pending` alone, never by the click. React flushes a
 * click's state update synchronously, so disabling from `onClick` would
 * disable the button before the browser ran the form's default submit action
 * — and a disabled button's submission is simply dropped. The label may
 * change on click; the disabled state may not.
 */
export function ConsentButtons({ approve, deny }: { approve: FormAction; deny: FormAction }) {
  const { pending } = useFormStatus();
  const [pressed, setPressed] = useState<Decision | null>(null);

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
      <button
        type="submit"
        formAction={approve}
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
