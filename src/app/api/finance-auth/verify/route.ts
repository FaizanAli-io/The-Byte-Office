import {
  createFinanceSession,
  FINANCE_SESSION_COOKIE,
  FINANCE_SIGNED_IN_COOKIE,
  sessionCookieOptions,
  signedInCookieOptions,
} from '@/lib/finance-auth';
import { consumeMagicLink } from '@/lib/finance-magic-link';
import { ApiError, apiRoute, jsonBody } from '@/lib/api';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export const POST = apiRoute('POST /api/finance-auth/verify', 'Unable to complete sign-in', async (req: Request) => {
  const { token } = await jsonBody<{ token?: string }>(req);
  if (!(await consumeMagicLink(token))) {
    throw new ApiError('This login link is invalid, already used, or has expired', 401);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(FINANCE_SESSION_COOKIE, await createFinanceSession(), sessionCookieOptions());
  response.cookies.set(FINANCE_SIGNED_IN_COOKIE, '1', signedInCookieOptions());
  return response;
});
