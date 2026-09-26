import { formBody, oauthError, OAUTH_NO_STORE } from '@/lib/oauth/http';
import { revokeRefreshToken } from '@/lib/oauth/store';

export const runtime = 'nodejs';

/**
 * RFC 7009. Answers 200 whatever happens, including for a token that does not
 * exist — a revocation endpoint that distinguished the two would be a free
 * oracle for testing whether a stolen value is live.
 *
 * Revoking one refresh token revokes its whole rotation chain. Access tokens
 * are stateless and cannot be recalled; they expire within six hours.
 */
export async function POST(request: Request) {
  const form = await formBody(request);
  if (!form) return oauthError('invalid_request', 'Body must be application/x-www-form-urlencoded');

  const token = form.get('token');
  if (token) await revokeRefreshToken(token);

  return new Response(null, { status: 200, headers: OAUTH_NO_STORE });
}
