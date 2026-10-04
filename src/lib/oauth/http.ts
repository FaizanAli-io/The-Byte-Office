export const OAUTH_NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const;

type OAuthErrorCodeName =
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

export async function formBody(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/x-www-form-urlencoded')) return null;
  try {
    return new URLSearchParams(await request.text());
  } catch {
    return null;
  }
}

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
