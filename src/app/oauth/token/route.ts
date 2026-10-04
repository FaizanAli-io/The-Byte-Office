import { formBody, oauthError, oauthJson } from '@/lib/oauth/http';
import { mcpResourceUrl, sameResource } from '@/lib/oauth/metadata';
import { consumeAuthorizationCode, issueRefreshToken, rotateRefreshToken, touchClient } from '@/lib/oauth/store';
import { OAUTH_ACCESS_TOKEN_MAX_AGE, signAccessToken, verifyCodeChallenge } from '@/lib/oauth/tokens';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const form = await formBody(request);
  if (!form) return oauthError('invalid_request', 'Body must be application/x-www-form-urlencoded');

  const grantType = form.get('grant_type');
  if (grantType === 'authorization_code') return exchangeCode(form, request);
  if (grantType === 'refresh_token') return exchangeRefreshToken(form, request);
  return oauthError('unsupported_grant_type', 'Supported grants are authorization_code and refresh_token');
}

async function exchangeCode(form: URLSearchParams, request: Request) {
  const code = form.get('code');
  const codeVerifier = form.get('code_verifier');
  const clientId = form.get('client_id');
  const redirectUri = form.get('redirect_uri');
  if (!code || !codeVerifier || !clientId || !redirectUri) {
    return oauthError('invalid_request', 'code, code_verifier, client_id and redirect_uri are required');
  }

  // Claim before checking: a code is spent by the attempt. Every failure is a flat invalid_grant.
  const claimed = await consumeAuthorizationCode(code);
  const resource = form.get('resource');
  if (
    !claimed ||
    claimed.clientId !== clientId ||
    claimed.redirectUri !== redirectUri ||
    !(await verifyCodeChallenge(codeVerifier, claimed.codeChallenge)) ||
    (resource && !sameResource(resource, claimed.resource))
  ) {
    return oauthError('invalid_grant', 'Authorization code is invalid, expired or already used');
  }

  await touchClient(clientId);
  return issueTokens(clientId, claimed.scopes, request);
}

async function exchangeRefreshToken(form: URLSearchParams, request: Request) {
  const presented = form.get('refresh_token');
  const clientId = form.get('client_id');
  if (!presented || !clientId) return oauthError('invalid_request', 'refresh_token and client_id are required');

  const rotated = await rotateRefreshToken(presented);
  if (!rotated || rotated.clientId !== clientId) {
    return oauthError('invalid_grant', 'Refresh token is invalid, expired or has been revoked');
  }

  const requested = form.get('scope')?.split(/\s+/).filter(Boolean);
  const scopes = requested?.length ? rotated.scopes.filter((scope) => requested.includes(scope)) : rotated.scopes;
  if (!scopes.length) return oauthError('invalid_scope', 'Requested scopes are not a subset of the granted scopes');

  await touchClient(clientId);
  return issueTokens(clientId, scopes, request, rotated.refreshToken);
}

async function issueTokens(clientId: string, scopes: string[], request: Request, refreshToken?: string) {
  return oauthJson({
    access_token: await signAccessToken(clientId, scopes, mcpResourceUrl(request)),
    token_type: 'Bearer',
    expires_in: OAUTH_ACCESS_TOKEN_MAX_AGE,
    refresh_token: refreshToken ?? (await issueRefreshToken(clientId, scopes)),
    scope: scopes.join(' '),
  });
}
