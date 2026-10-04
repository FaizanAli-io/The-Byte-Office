import { formBody, oauthError, OAUTH_NO_STORE } from '@/lib/oauth/http';
import { revokeRefreshToken } from '@/lib/oauth/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const form = await formBody(request);
  if (!form) return oauthError('invalid_request', 'Body must be application/x-www-form-urlencoded');

  const token = form.get('token');
  if (token) await revokeRefreshToken(token);

  // Always 200, so revocation cannot be used to test whether a token is live.
  return new Response(null, { status: 200, headers: OAUTH_NO_STORE });
}
