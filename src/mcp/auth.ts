import { OAuthError, OAuthErrorCode, type AuthInfo, type OAuthTokenVerifier } from '@modelcontextprotocol/server';
import { verifyAccessToken } from '@/lib/oauth/tokens';

/**
 * The resource-server half of OAuth: turn a bearer token into an identity, or
 * refuse it. There is no other way in — no shared key, no fallback.
 *
 * The verifier is built per request because the token is signed against the
 * resource it was issued for, and that is the URL this server is being
 * reached at. A token minted for a different audience cannot validate here,
 * which is what the MCP specification requires and what stops this server
 * being used as a deputy for someone else's token.
 */
export function accessTokenVerifier(resource: string): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      const verified = await verifyAccessToken(token, resource);
      if (!verified) {
        throw new OAuthError(
          OAuthErrorCode.InvalidToken,
          'Access token is invalid, expired or not issued for this server'
        );
      }
      return {
        token: verified.token,
        clientId: verified.clientId,
        scopes: verified.scopes,
        // The SDK refuses a token whose expiry is unset, so this is required.
        expiresAt: verified.expiresAt,
      };
    },
  };
}
