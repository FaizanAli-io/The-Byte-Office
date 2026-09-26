/**
 * Access-token signing and PKCE, kept free of the database driver so the
 * verifier can run anywhere a request is served.
 *
 * An access token is stateless: it carries its own expiry, client and scopes,
 * and a signature over all of them plus the resource it was issued for. That
 * means `/api/mcp` authenticates with no query at all, at the cost of not
 * being able to revoke a token before it expires — which is why the window is
 * six hours and why refresh tokens, which are rows, do the revoking.
 */
import { base64UrlDecode, base64UrlEncode, constantTimeEqual, hmacHex, sha256Base64Url } from '@/lib/hmac';
import { mcpToolRegistry } from '@/lib/agent/registry';

export const OAUTH_ACCESS_TOKEN_MAX_AGE = 3600 * 6;
export const OAUTH_REFRESH_TOKEN_MAX_AGE = 86_400 * 30;
/** A code is exchanged immediately or not at all. */
export const OAUTH_CODE_MAX_AGE = 60;

/**
 * One read and one write scope per module. Splitting by module rather than
 * having a single global pair means a connector that only needs the portfolio
 * never gains the ability to read prayer counts or send mail.
 */
export const OAUTH_MODULES = ['finance', 'personal', 'tbo'] as const;
export type OAuthModule = (typeof OAUTH_MODULES)[number];

export type OAuthScope = `${OAuthModule}:${'read' | 'write'}`;

/** The scope a tool needs: its module, plus whether it mutates anything. */
export function scopeForTool(tool: { module: string; write?: boolean }) {
  return `${tool.module}:${tool.write ? 'write' : 'read'}`;
}

/**
 * Exactly the scopes some exposed tool actually needs.
 *
 * Derived rather than listed so a scope can never be advertised that grants
 * nothing — withdrawing a tool from MCP withdraws its scope with it, and the
 * consent screen stops asking for a permission that would do nothing.
 */
export const OAUTH_SCOPES: OAuthScope[] = OAUTH_MODULES.flatMap(
  (module) => [`${module}:read`, `${module}:write`] as OAuthScope[]
).filter((scope) => mcpToolRegistry.some((tool) => scopeForTool(tool) === scope));

export const READ_SCOPES = OAUTH_SCOPES.filter((scope) => scope.endsWith(':read'));

const TOKEN_PREFIX = 'at';

export function getOAuthSecret() {
  return process.env.OAUTH_SIGNING_SECRET;
}

export function isOAuthScope(value: string): value is OAuthScope {
  return (OAUTH_SCOPES as readonly string[]).includes(value);
}

/**
 * Parses a space-delimited `scope` parameter.
 *
 * An absent or empty parameter is not an error: most MCP clients never send
 * one, and RFC 6749 lets the server apply a default. The default is every
 * read scope, which is the most a client can get without being able to change
 * anything. An unknown scope is still refused, because it means the client
 * wanted something this server does not have.
 */
export function parseScopes(value: string | null | undefined): OAuthScope[] | null {
  const requested = (value ?? '').split(/\s+/).filter(Boolean);
  if (!requested.length) return [...READ_SCOPES];
  if (!requested.every(isOAuthScope)) return null;

  // Write implies read: a tool that edits a module is useless without being
  // able to look at it first.
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

export type VerifiedAccessToken = {
  token: string;
  clientId: string;
  scopes: string[];
  /** Seconds since epoch, which is what the MCP SDK's `AuthInfo` expects. */
  expiresAt: number;
};

/**
 * Returns null for anything that is not a live token issued by us for this
 * exact resource. Binding the resource into the signature is what stops a
 * token minted for somewhere else being replayed here.
 */
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

/** PKCE S256: the verifier hashes to the challenge recorded at authorize time. */
export async function verifyCodeChallenge(codeVerifier: string, codeChallenge: string) {
  // RFC 7636 bounds the verifier; a short one would weaken the exchange.
  if (codeVerifier.length < 43 || codeVerifier.length > 128) return false;
  return constantTimeEqual(await sha256Base64Url(codeVerifier), codeChallenge);
}

function payload(expiresAt: number, clientId: string, encodedScopes: string, resource: string) {
  return `mcp:${expiresAt}:${clientId}:${encodedScopes}:${resource}`;
}
