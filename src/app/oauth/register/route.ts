import { isUsableRedirectUri, oauthError, oauthJson } from '@/lib/oauth/http';
import { recentClientCount, registerClient } from '@/lib/oauth/store';

export const runtime = 'nodejs';

const MAX_REGISTRATIONS_PER_HOUR = 20;
const MAX_REDIRECT_URIS = 10;
const MAX_NAME_LENGTH = 200;

/**
 * RFC 7591 Dynamic Client Registration.
 *
 * Clients such as ChatGPT cannot be pre-registered — there is no way to know
 * their redirect URI in advance — so they register themselves here. This
 * endpoint is deliberately open: a `client_id` grants nothing until a human
 * approves a specific authorization request at `/oauth/authorize`.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return oauthError('invalid_client_metadata', 'Body must be JSON');
  }

  const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : '';
  if (!clientName || clientName.length > MAX_NAME_LENGTH) {
    return oauthError('invalid_client_metadata', 'client_name is required');
  }

  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || !redirectUris.length || redirectUris.length > MAX_REDIRECT_URIS) {
    return oauthError('invalid_redirect_uri', 'redirect_uris must hold between 1 and 10 entries');
  }
  if (!redirectUris.every(isUsableRedirectUri)) {
    return oauthError(
      'invalid_redirect_uri',
      'Each redirect URI must be absolute HTTPS (or loopback) with no fragment'
    );
  }

  // Public clients only: there is no secret to authenticate with.
  const authMethod = body.token_endpoint_auth_method;
  if (authMethod !== undefined && authMethod !== 'none') {
    return oauthError('invalid_client_metadata', 'Only token_endpoint_auth_method "none" is supported');
  }

  const grantTypes = body.grant_types;
  if (
    grantTypes !== undefined &&
    (!Array.isArray(grantTypes) ||
      !grantTypes.every((grant) => grant === 'authorization_code' || grant === 'refresh_token'))
  ) {
    return oauthError('invalid_client_metadata', 'Only authorization_code and refresh_token are supported');
  }

  if ((await recentClientCount()) >= MAX_REGISTRATIONS_PER_HOUR) {
    return oauthError('invalid_client_metadata', 'Too many registrations, try again later', 429);
  }

  const client = await registerClient(clientName, redirectUris);
  return oauthJson(
    {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
    201
  );
}
