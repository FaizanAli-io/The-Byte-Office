import { createFinanceSession, setSessionCookies } from '@/lib/finance-auth';
import { consumeMagicLink } from '@/lib/finance-magic-link';
import { ApiError, apiRoute, jsonBody } from '@/lib/api';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export const POST = apiRoute('POST /api/finance-auth/verify', 'Unable to complete sign-in', async (req: Request) => {
  const { token } = await jsonBody<{ token?: string }>(req);
  if (!(await consumeMagicLink(token))) {
    throw new ApiError('This login link is invalid, already used, or has expired', 401);
  }
  return setSessionCookies(NextResponse.json({ success: true }), await createFinanceSession());
});
