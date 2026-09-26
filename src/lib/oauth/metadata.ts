import { buildOAuthProtectedResourceMetadata, type OAuthMetadata } from '@modelcontextprotocol/server';
import { appOrigin } from '@/lib/finance-auth';
import { OAUTH_SCOPES } from './tokens';

/**
 * The two discovery documents a client reads before it can authenticate, and
 * the canonical resource identifier they agree on.
 *
 * Everything is derived from the request origin rather than an environment
 * variable so local development and production need no separate
 * configuration. Deriving the origin from a header is safe here because the
 * resource is signed into every access token: a forged `Host` produces a
 * resource that no real token matches, so the only outcome is rejection.
 */

export function mcpResourceUrl(source: Request | Headers) {
  return `${appOrigin(source)}/api/mcp`;
}

export function authorizationServerMetadata(source: Request | Headers): OAuthMetadata {
  const origin = appOrigin(source);
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    // S256 only. `plain` offers no protection against a stolen code.
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...OAUTH_SCOPES],
  };
}

export function protectedResourceMetadata(source: Request | Headers) {
  const origin = appOrigin(source);
  return buildOAuthProtectedResourceMetadata({
    oauthMetadata: authorizationServerMetadata(source),
    resourceServerUrl: new URL(`${origin}/api/mcp`),
    resourceName: 'The Byte Office',
    scopesSupported: [...OAUTH_SCOPES],
    dangerouslyAllowInsecureIssuerUrl: origin.startsWith('http://'),
  });
}

/** Discovery is read before a client has any credential, so it is cacheable and open. */
export function metadataResponse(document: unknown) {
  return Response.json(document, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
