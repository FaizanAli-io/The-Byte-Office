/**
 * Shared shapes for the authorization server's machine-facing endpoints.
 *
 * OAuth error bodies are specified by RFC 6749 §5.2 and clients parse them, so
 * they are not the same thing as the application's `ApiError`. Every response
 * carrying or refusing a credential is `no-store`.
 */

export const OAUTH_NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const;

export type OAuthErrorCodeName =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'invalid_scope'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'invalid_redirect_uri'
  | 'invalid_client_metadata';

export function oauthError(error: OAuthErrorCodeName, description: string, status = 400) {
  return Response.json({ error, error_description: description }, { status, headers: OAUTH_NO_STORE });
}

export function oauthJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: OAUTH_NO_STORE });
}

/**
 * Token and revocation requests are form-encoded, not JSON. Accepting only the
 * specified media type keeps a malformed body from being read as a valid
 * request with every field missing.
 */
export async function formBody(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/x-www-form-urlencoded')) return null;
  try {
    return new URLSearchParams(await request.text());
  } catch {
    return null;
  }
}

/**
 * A redirect URI is usable only if it is absolute, carries no fragment, and is
 * either HTTPS or a loopback address for local development. Anything else is
 * refused at registration so it can never reach the authorize endpoint.
 */
export function isUsableRedirectUri(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
}
