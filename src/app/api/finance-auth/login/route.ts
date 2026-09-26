import { appOrigin, getSessionSecret } from '@/lib/finance-auth';
import { issueMagicLink } from '@/lib/finance-magic-link';
import { FINANCE_LOGIN_EMAIL } from '@/lib/finance-constants';
import { sendFinanceLoginEmail } from '@/lib/finance-email';
import { ApiError, apiRoute, optionalJsonBody } from '@/lib/api';

export const runtime = 'nodejs';

// Per-instance only, so this is a courtesy throttle rather than a real limit.
const lastSentAt = new Map<string, number>();

export const POST = apiRoute('POST /api/finance-auth/login', 'Unable to send login link', async (request: Request) => {
  if (!getSessionSecret()) throw new ApiError('Finance authentication is not configured', 503);

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (Date.now() - (lastSentAt.get(ip) ?? 0) < 30_000) {
    throw new ApiError('Please wait a moment before requesting another link', 429);
  }

  const { next } = await optionalJsonBody<{ next?: string }>(request);
  const nextPath = next?.startsWith('/finance') && !next.startsWith('//') ? next : '';

  const loginUrl = new URL('/finance/verify', appOrigin(request));
  loginUrl.searchParams.set('token', await issueMagicLink());
  if (nextPath) loginUrl.searchParams.set('next', nextPath);

  let emailed = false;
  try {
    emailed = await sendFinanceLoginEmail(loginUrl.toString());
  } catch (cause) {
    console.error('Finance login email failed:', cause);
  }
  lastSentAt.set(ip, Date.now());

  const isProduction = process.env.NODE_ENV === 'production';
  if (!emailed && isProduction) throw new ApiError('Email delivery is not configured', 503);

  return {
    success: true,
    emailed,
    email: FINANCE_LOGIN_EMAIL,
    ...(isProduction ? {} : { loginLink: loginUrl.toString() }),
  };
});
