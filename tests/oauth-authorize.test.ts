import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The authorize endpoint's ordering is the security-critical part: nothing may
 * redirect until the client and its redirect URI are both confirmed, because
 * redirecting to an unverified URI hands an attacker the `state` and the error
 * detail. These tests stub the client lookup so that ordering can be checked
 * without a database.
 */
const getClient = vi.fn();
vi.mock('@/lib/oauth/store', () => ({ getClient: (id: string) => getClient(id) }));

const { parseAuthorizationRequest } = await import('@/lib/oauth/authorize');

const CLIENT_ID = '11111111-2222-3333-4444-555555555555';
const REDIRECT = 'https://chatgpt.test/callback';
const HEADERS = new Headers({ host: 'byteoffice.test', 'x-forwarded-proto': 'https' });
const CHALLENGE = 'c'.repeat(43);

function query(over: Record<string, string> = {}) {
  return new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    state: 'xyz',
    scope: 'finance:read',
    ...over,
  });
}

beforeEach(() => {
  getClient.mockReset();
  getClient.mockResolvedValue({
    clientId: CLIENT_ID,
    clientName: 'ChatGPT',
    redirectUris: [REDIRECT],
  });
});

describe('before the client is verified', () => {
  it('renders an error rather than redirecting when the client is unknown', async () => {
    getClient.mockResolvedValue(null);
    const result = await parseAuthorizationRequest(query(), HEADERS);
    expect(result.status).toBe('error');
  });

  it('renders an error rather than redirecting when the redirect URI is not registered', async () => {
    const result = await parseAuthorizationRequest(query({ redirect_uri: 'https://evil.test/cb' }), HEADERS);
    expect(result.status).toBe('error');
  });

  it.each([
    ['a trailing slash', `${REDIRECT}/`],
    ['an added query', `${REDIRECT}?x=1`],
    ['a different port', 'https://chatgpt.test:8443/callback'],
    ['a subdomain', 'https://evil.chatgpt.test/callback'],
    ['a path suffix', `${REDIRECT}/../callback`],
  ])('refuses a redirect URI differing by %s', async (_label, uri) => {
    const result = await parseAuthorizationRequest(query({ redirect_uri: uri }), HEADERS);
    expect(result.status).toBe('error');
  });
});

describe('after the client is verified', () => {
  const expectRedirectError = async (params: URLSearchParams, error: string) => {
    const result = await parseAuthorizationRequest(params, HEADERS);
    expect(result.status).toBe('redirect');
    if (result.status !== 'redirect') return;

    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe(REDIRECT);
    expect(url.searchParams.get('error')).toBe(error);
    expect(url.searchParams.get('state')).toBe('xyz');
  };

  it('refuses a response type other than code', () =>
    expectRedirectError(query({ response_type: 'token' }), 'unsupported_response_type'));

  it('refuses the plain PKCE method', () =>
    expectRedirectError(query({ code_challenge_method: 'plain' }), 'invalid_request'));

  it('refuses a missing challenge', () => expectRedirectError(query({ code_challenge: '' }), 'invalid_request'));

  it('refuses an unknown scope', () => expectRedirectError(query({ scope: 'finance:admin' }), 'invalid_scope'));

  it('refuses a resource naming another server', () =>
    expectRedirectError(query({ resource: 'https://elsewhere.test/api/mcp' }), 'invalid_target'));

  it('omits state from the redirect when the request never sent one', async () => {
    const result = await parseAuthorizationRequest(query({ state: '', response_type: 'token' }), HEADERS);
    expect(result.status).toBe('redirect');
    if (result.status !== 'redirect') return;
    expect(new URL(result.url).searchParams.has('state')).toBe(false);
  });
});

describe('a valid request', () => {
  it('resolves to the consent details, binding the resource for this host', async () => {
    const result = await parseAuthorizationRequest(query({ scope: 'finance:read finance:write' }), HEADERS);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.request).toMatchObject({
      clientId: CLIENT_ID,
      clientName: 'ChatGPT',
      redirectUri: REDIRECT,
      codeChallenge: CHALLENGE,
      state: 'xyz',
      scopes: ['finance:read', 'finance:write'],
      resource: 'https://byteoffice.test/api/mcp',
    });
  });

  it('accepts an omitted resource, since there is only one', async () => {
    const params = query();
    params.delete('resource');
    const result = await parseAuthorizationRequest(params, HEADERS);
    expect(result.status).toBe('ok');
  });

  it('accepts the resource with a trailing slash', async () => {
    const result = await parseAuthorizationRequest(query({ resource: 'https://byteoffice.test/api/mcp/' }), HEADERS);
    expect(result.status).toBe('ok');
  });
});
