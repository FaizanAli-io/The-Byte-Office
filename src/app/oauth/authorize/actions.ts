'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { FINANCE_SESSION_COOKIE, verifyFinanceSession } from '@/lib/finance-auth';
import { decisionRedirect, parseAuthorizationRequest } from '@/lib/oauth/authorize';
import { createAuthorizationCode, touchClient } from '@/lib/oauth/store';

// `approved` is bound in: React does not pass the submitter's name/value to server actions.
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

  const code = await createAuthorizationCode({ clientId, redirectUri, codeChallenge, scopes, resource });
  await touchClient(clientId);
  redirect(decisionRedirect(redirectUri, state, { code }));
}
