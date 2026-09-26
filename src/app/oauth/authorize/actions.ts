'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { FINANCE_SESSION_COOKIE, verifyFinanceSession } from '@/lib/finance-auth';
import { decisionRedirect, parseAuthorizationRequest } from '@/lib/oauth/authorize';
import { createAuthorizationCode, touchClient } from '@/lib/oauth/store';

/**
 * The consent decision.
 *
 * Everything is re-validated from the submitted query string rather than
 * trusted from the form, so tampering with a hidden field is no different
 * from tampering with the original URL. Next verifies the origin of a server
 * action, which is what keeps another site from posting this on your behalf.
 *
 * `approved` is bound into the action rather than read from the submitting
 * button. React does not pass a submitter's `name`/`value` through to a
 * server action, so encoding the choice that way silently read as a denial.
 */
export async function decideAuthorization(approved: boolean, formData: FormData) {
  const query = String(formData.get('query') ?? '');

  const session = (await cookies()).get(FINANCE_SESSION_COOKIE)?.value;
  if (!(await verifyFinanceSession(session))) {
    redirect(`/finance/login?next=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
  }

  const parsed = await parseAuthorizationRequest(new URLSearchParams(query), await headers());
  if (parsed.status === 'error') redirect(`/oauth/authorize?${query}`);
  if (parsed.status === 'redirect') redirect(parsed.url);

  const { clientId, redirectUri, codeChallenge, state, resource, scopes } = parsed.request;

  if (!approved) {
    redirect(decisionRedirect(redirectUri, state, { error: 'access_denied' }));
  }

  // Approving grants exactly what the consent screen listed: the scopes the
  // request asked for, already narrowed to ones this server recognises. There
  // is nothing to choose on the screen, so there is nothing to reconcile here.
  const code = await createAuthorizationCode({ clientId, redirectUri, codeChallenge, scopes, resource });
  await touchClient(clientId);
  redirect(decisionRedirect(redirectUri, state, { code }));
}
