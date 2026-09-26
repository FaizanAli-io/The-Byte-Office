import 'server-only';
import { getClient } from './store';
import { mcpResourceUrl } from './metadata';
import { parseScopes, type OAuthScope } from './tokens';

/**
 * Validation for `/oauth/authorize`, shared by the page that renders consent
 * and the action that grants it. The action re-runs it rather than trusting
 * its own hidden fields, so a tampered form is caught in exactly the same way
 * a tampered query string is.
 *
 * The order matters and is the security-critical part. Until the client and
 * its redirect URI are both confirmed, there is nowhere safe to send the user:
 * redirecting to an unverified URI would hand an attacker the `state` and the
 * error detail, which is a textbook open redirect. So those two failures
 * render a page, and only afterwards does anything redirect.
 */

export type AuthorizationRequest = {
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scopes: OAuthScope[];
  resource: string;
};

export type AuthorizationParse =
  | { status: 'ok'; request: AuthorizationRequest }
  | { status: 'error'; message: string }
  | { status: 'redirect'; url: string };

export async function parseAuthorizationRequest(
  params: URLSearchParams,
  headers: Headers
): Promise<AuthorizationParse> {
  const clientId = params.get('client_id') ?? '';
  const redirectUri = params.get('redirect_uri') ?? '';

  const client = clientId ? await getClient(clientId) : null;
  if (!client) {
    return { status: 'error', message: 'Unknown client. Register the client before authorizing it.' };
  }
  // Exact match only. A prefix or origin comparison is an open redirect.
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return { status: 'error', message: 'This redirect URI is not registered for this client.' };
  }

  // From here a redirect is safe, so every remaining failure reports back to
  // the client the way RFC 6749 expects.
  const state = params.get('state') ?? '';
  const fail = (error: string, description: string): AuthorizationParse => {
    const url = new URL(redirectUri);
    url.searchParams.set('error', error);
    url.searchParams.set('error_description', description);
    if (state) url.searchParams.set('state', state);
    return { status: 'redirect', url: url.toString() };
  };

  if (params.get('response_type') !== 'code') {
    return fail('unsupported_response_type', 'Only the authorization code flow is supported');
  }
  if (!state) {
    return fail('invalid_request', 'state is required');
  }
  if (params.get('code_challenge_method') !== 'S256') {
    return fail('invalid_request', 'code_challenge_method must be S256');
  }

  const codeChallenge = params.get('code_challenge') ?? '';
  if (codeChallenge.length < 43 || codeChallenge.length > 128) {
    return fail('invalid_request', 'code_challenge is missing or malformed');
  }

  const scopes = parseScopes(params.get('scope'));
  if (!scopes) {
    return fail('invalid_scope', 'Supported scopes are finance:read and finance:write');
  }

  // RFC 8707. There is exactly one resource here, so an absent parameter is
  // taken to mean it rather than refused — a client that omits it still ends
  // up with a token bound to this server and nothing else.
  const resource = mcpResourceUrl(headers);
  const requested = params.get('resource');
  if (requested && normalise(requested) !== normalise(resource)) {
    return fail('invalid_target', 'resource does not name this MCP server');
  }

  return {
    status: 'ok',
    request: {
      clientId: client.clientId,
      clientName: client.clientName,
      redirectUri,
      codeChallenge,
      state,
      scopes,
      resource,
    },
  };
}

/** Where the browser goes once the user decides. */
export function decisionRedirect(redirectUri: string, state: string, result: { code: string } | { error: string }) {
  const url = new URL(redirectUri);
  if ('code' in result) url.searchParams.set('code', result.code);
  else url.searchParams.set('error', result.error);
  url.searchParams.set('state', state);
  return url.toString();
}

function normalise(value: string) {
  return value.replace(/\/+$/, '');
}
