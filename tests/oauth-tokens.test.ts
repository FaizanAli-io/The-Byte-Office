import { beforeEach, describe, expect, it } from 'vitest';
import {
  OAUTH_ACCESS_TOKEN_MAX_AGE,
  parseScopes,
  READ_SCOPES,
  scopeForTool,
  signAccessToken,
  verifyAccessToken,
  verifyCodeChallenge,
} from '@/lib/oauth/tokens';
import { base64UrlEncode, sha256Base64Url } from '@/lib/hmac';
import { isUsableRedirectUri } from '@/lib/oauth/http';

const RESOURCE = 'https://byteoffice.test/api/mcp';
const CLIENT = '11111111-2222-3333-4444-555555555555';

beforeEach(() => {
  process.env.OAUTH_SIGNING_SECRET = 'test-oauth-secret';
});

describe('access tokens', () => {
  it('round-trips the client and scopes', async () => {
    const token = await signAccessToken(CLIENT, ['finance:read'], RESOURCE);
    const verified = await verifyAccessToken(token, RESOURCE);

    expect(verified?.clientId).toBe(CLIENT);
    expect(verified?.scopes).toEqual(['finance:read']);
  });

  it('reports expiry in seconds, which is what the MCP SDK requires', async () => {
    const token = await signAccessToken(CLIENT, ['finance:read'], RESOURCE);
    const verified = await verifyAccessToken(token, RESOURCE);

    const expected = Math.floor((Date.now() + OAUTH_ACCESS_TOKEN_MAX_AGE * 1000) / 1000);
    expect(verified?.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(Math.abs((verified?.expiresAt ?? 0) - expected)).toBeLessThan(5);
  });

  it('rejects a token issued for a different resource', async () => {
    const token = await signAccessToken(CLIENT, ['finance:read'], 'https://elsewhere.test/api/mcp');
    expect(await verifyAccessToken(token, RESOURCE)).toBeNull();
  });

  it('rejects a tampered scope claim', async () => {
    const token = await signAccessToken(CLIENT, ['finance:read'], RESOURCE);
    const [prefix, expires, clientId, , signature] = token.split('.');
    const widened = [prefix, expires, clientId, base64UrlEncode('finance:read finance:write'), signature].join('.');

    expect(await verifyAccessToken(widened, RESOURCE)).toBeNull();
  });

  it('rejects a tampered expiry', async () => {
    const token = await signAccessToken(CLIENT, ['finance:read'], RESOURCE);
    const parts = token.split('.');
    parts[1] = String(Number(parts[1]) + 86_400_000);

    expect(await verifyAccessToken(parts.join('.'), RESOURCE)).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signAccessToken(CLIENT, ['finance:read'], RESOURCE);
    process.env.OAUTH_SIGNING_SECRET = 'rotated';

    expect(await verifyAccessToken(token, RESOURCE)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await signAccessToken(CLIENT, ['finance:read'], RESOURCE);
    const parts = token.split('.');
    parts[1] = String(Date.now() - 1000);

    expect(await verifyAccessToken(parts.join('.'), RESOURCE)).toBeNull();
  });

  it.each([['nonsense'], ['at.1.2.3'], ['at..a.b.c'], ['xx.1.2.3.4'], ['']])(
    'rejects malformed token %s',
    async (value) => {
      expect(await verifyAccessToken(value, RESOURCE)).toBeNull();
    }
  );
});

describe('PKCE', () => {
  const verifier = 'a'.repeat(64);

  it('accepts the verifier that produced the challenge', async () => {
    expect(await verifyCodeChallenge(verifier, await sha256Base64Url(verifier))).toBe(true);
  });

  it('rejects any other verifier', async () => {
    expect(await verifyCodeChallenge('b'.repeat(64), await sha256Base64Url(verifier))).toBe(false);
  });

  it('rejects a verifier outside the length RFC 7636 allows', async () => {
    const short = 'a'.repeat(42);
    expect(await verifyCodeChallenge(short, await sha256Base64Url(short))).toBe(false);

    const long = 'a'.repeat(129);
    expect(await verifyCodeChallenge(long, await sha256Base64Url(long))).toBe(false);
  });
});

describe('scope parsing', () => {
  it('accepts the known scopes, always including read', () => {
    expect(parseScopes('finance:write finance:read')).toEqual(['finance:read', 'finance:write']);
  });

  it('keeps modules separate', () => {
    expect(parseScopes('personal:write')).toEqual(['personal:read', 'personal:write']);
    expect(parseScopes('finance:read')).toEqual(['finance:read']);
  });

  it('de-duplicates', () => {
    expect(parseScopes('finance:read finance:read')).toEqual(['finance:read']);
  });

  it('adds read to a request that only asked to write, since nothing works without it', () => {
    expect(parseScopes('finance:write')).toEqual(['finance:read', 'finance:write']);
  });

  it.each([[''], [null], [undefined], ['   ']])(
    'defaults %s to every read scope, because most MCP clients send no scope',
    (value) => {
      expect(parseScopes(value)).toEqual(READ_SCOPES);
      expect(parseScopes(value)?.some((scope) => scope.endsWith(':write'))).toBe(false);
    }
  );

  it('names a scope per module for every tool', () => {
    expect(scopeForTool({ module: 'personal', write: true })).toBe('personal:write');
    expect(scopeForTool({ module: 'tbo' })).toBe('tbo:read');
  });

  it.each([['finance:admin'], ['finance:read admin'], ['*']])('rejects the unknown scope %s', (value) => {
    expect(parseScopes(value)).toBeNull();
  });
});

describe('redirect URI validation', () => {
  it.each([
    ['https://chatgpt.com/callback', true],
    ['https://example.com/a/b?x=1', true],
    ['http://localhost:3000/cb', true],
    ['http://127.0.0.1:8080/cb', true],
    ['http://evil.test/cb', false],
    ['https://example.com/cb#frag', false],
    ['/relative/cb', false],
    ['javascript:alert(1)', false],
    ['', false],
  ])('%s -> %s', (value, expected) => {
    expect(isUsableRedirectUri(value)).toBe(expected);
  });
});
