import {
  createFinanceSession,
  FINANCE_SESSION_COOKIE,
  sessionCookieOptions,
  verifyMagicLinkToken,
} from '@/lib/finance-auth';
import { ApiError, apiRoute, jsonBody } from '@/lib/api';
import { NextResponse } from 'next/server';

export const POST = apiRoute('POST /api/finance-auth/verify', 'Unable to complete sign-in', async (req: Request) => {
  const { token } = await jsonBody<{ token?: string }>(req);
  if (!(await verifyMagicLinkToken(token))) {
    throw new ApiError('This login link is invalid or has expired', 401);
  }

  const session = await createFinanceSession();
  const response = NextResponse.json({ success: true, token: session });
  response.cookies.set(FINANCE_SESSION_COOKIE, session, sessionCookieOptions());
  return response;
});
