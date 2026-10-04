import { OAuthError, OAuthErrorCode, type AuthInfo, type OAuthTokenVerifier } from '@modelcontextprotocol/server';
import { verifyAccessToken } from '@/lib/oauth/tokens';

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
        expiresAt: verified.expiresAt,
      };
    },
  };
}
