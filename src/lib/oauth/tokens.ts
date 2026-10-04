import { base64UrlDecode, base64UrlEncode, constantTimeEqual, hmacHex, sha256Base64Url } from '@/lib/hmac';
import { mcpToolRegistry } from '@/lib/agent/registry';

export const OAUTH_ACCESS_TOKEN_MAX_AGE = 3600 * 6;
export const OAUTH_REFRESH_TOKEN_MAX_AGE = 86_400 * 30;
export const OAUTH_CODE_MAX_AGE = 60;

export const OAUTH_MODULES = ['finance', 'personal', 'tbo'] as const;
export type OAuthModule = (typeof OAUTH_MODULES)[number];

export type OAuthScope = `${OAuthModule}:${'read' | 'write'}`;

export function scopeForTool(tool: { module: string; write?: boolean }) {
  return `${tool.module}:${tool.write ? 'write' : 'read'}`;
}

export const OAUTH_SCOPES: OAuthScope[] = OAUTH_MODULES.flatMap(
  (module) => [`${module}:read`, `${module}:write`] as OAuthScope[]
).filter((scope) => mcpToolRegistry.some((tool) => scopeForTool(tool) === scope));

export const READ_SCOPES = OAUTH_SCOPES.filter((scope) => scope.endsWith(':read'));

const TOKEN_PREFIX = 'at';

function getOAuthSecret() {
  return process.env.OAUTH_SIGNING_SECRET;
}

function isOAuthScope(value: string): value is OAuthScope {
  return (OAUTH_SCOPES as readonly string[]).includes(value);
}

export function parseScopes(value: string | null | undefined): OAuthScope[] | null {
  const requested = (value ?? '').split(/\s+/).filter(Boolean);
  if (!requested.length) return [...READ_SCOPES];
  if (!requested.every(isOAuthScope)) return null;

  const implied = requested.map((scope) => scope.replace(':write', ':read'));
  return OAUTH_SCOPES.filter((scope) => requested.includes(scope) || implied.includes(scope));
}

export async function signAccessToken(clientId: string, scopes: string[], resource: string) {
  const secret = getOAuthSecret();
  if (!secret) throw new Error('OAUTH_SIGNING_SECRET is not configured');

  const expiresAt = Date.now() + OAUTH_ACCESS_TOKEN_MAX_AGE * 1000;
  const encodedScopes = base64UrlEncode(scopes.join(' '));
  const signature = await hmacHex(payload(expiresAt, clientId, encodedScopes, resource), secret);
  return `${TOKEN_PREFIX}.${expiresAt}.${clientId}.${encodedScopes}.${signature}`;
}

type VerifiedAccessToken = {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt: number;
};

export async function verifyAccessToken(token: string, resource: string): Promise<VerifiedAccessToken | null> {
  const [prefix, expiresValue, clientId, encodedScopes, signature, ...extra] = token.split('.');
  if (prefix !== TOKEN_PREFIX || !expiresValue || !clientId || !encodedScopes || !signature || extra.length) {
    return null;
  }

  const expiresAt = Number(expiresValue);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return null;

  const secret = getOAuthSecret();
  if (!secret) return null;

  const expected = await hmacHex(payload(expiresAt, clientId, encodedScopes, resource), secret);
  if (!constantTimeEqual(signature, expected)) return null;

  return {
    token,
    clientId,
    scopes: base64UrlDecode(encodedScopes).split(' ').filter(Boolean),
    expiresAt: Math.floor(expiresAt / 1000),
  };
}

export async function verifyCodeChallenge(codeVerifier: string, codeChallenge: string) {
  if (codeVerifier.length < 43 || codeVerifier.length > 128) return false;
  return constantTimeEqual(await sha256Base64Url(codeVerifier), codeChallenge);
}

function payload(expiresAt: number, clientId: string, encodedScopes: string, resource: string) {
  return `mcp:${expiresAt}:${clientId}:${encodedScopes}:${resource}`;
}
