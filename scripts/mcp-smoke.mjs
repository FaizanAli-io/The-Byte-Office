// @next/env is CommonJS, so it has to come in through the default export.
import nextEnv from '@next/env';
import { fileURLToPath } from 'node:url';

nextEnv.loadEnvConfig(fileURLToPath(new URL('..', import.meta.url)));

const baseUrl = process.env.MCP_BASE_URL || 'http://localhost:3000';
const refreshToken = process.env.MCP_SMOKE_REFRESH_TOKEN;

let failures = 0;

function check(label, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

async function json(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* leave as text */
  }
  return { response, body };
}

// --- discovery, which needs no credentials -----------------------------------

const unauthorized = await fetch(`${baseUrl}/api/mcp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
});
check('unauthenticated /api/mcp is refused', unauthorized.status === 401, `status ${unauthorized.status}`);

const challenge = unauthorized.headers.get('www-authenticate') ?? '';
check('401 advertises resource metadata', challenge.includes('resource_metadata='), challenge || 'no header');

const prm = await json('/.well-known/oauth-protected-resource/api/mcp');
check('protected resource metadata is served', prm.response.ok && Boolean(prm.body?.authorization_servers?.length));

const asm = await json('/.well-known/oauth-authorization-server');
check('authorization server metadata is served', asm.response.ok && Boolean(asm.body?.token_endpoint));
check('PKCE S256 is advertised', asm.body?.code_challenge_methods_supported?.includes('S256') === true);
check('no API key auth is advertised', !JSON.stringify(asm.body ?? {}).includes('bearerAuth'));

// --- authenticated calls, when a refresh token is available ------------------

if (!refreshToken) {
  console.log('\nSet MCP_SMOKE_REFRESH_TOKEN to also exercise the authenticated path.');
  console.log('Mint one with: npm run oauth:token -- "smoke test"');
  process.exit(failures ? 1 : 0);
}

const clientId = process.env.MCP_SMOKE_CLIENT_ID;
if (!clientId) {
  console.error('MCP_SMOKE_CLIENT_ID must accompany MCP_SMOKE_REFRESH_TOKEN.');
  process.exit(1);
}

const token = await json('/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId }),
});
check('refresh token exchanges for an access token', token.response.ok && Boolean(token.body?.access_token));

if (!token.body?.access_token) process.exit(1);
console.log(`      scopes: ${token.body.scope}, expires in ${token.body.expires_in}s`);
console.log('      rotated refresh token (store it, the old one is now spent):');
console.log(`      MCP_SMOKE_REFRESH_TOKEN=${token.body.refresh_token}`);

const auth = { Authorization: `Bearer ${token.body.access_token}` };

const portfolio = await json('/api/mcp/tools/portfolio_get', { headers: auth });
check(
  'portfolio_get returns a total',
  portfolio.response.ok && typeof portfolio.body?.result?.grandTotalPkr === 'number'
);
if (portfolio.body?.result) {
  console.log(`      grand total: ${portfolio.body.result.grandTotalPkr} PKR`);
}

const initialized = await json('/api/mcp', {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'tbo-smoke', version: '0.0.1' } },
  }),
});
check('MCP initialize succeeds', initialized.response.ok && Boolean(initialized.body?.result?.serverInfo));

const tools = await json('/api/mcp', {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
});
const listed = tools.body?.result?.tools ?? [];
const writeTools = listed.filter((tool) => tool.annotations?.readOnlyHint === false);
const mayWrite = (token.body.scope ?? '').includes(':write');
check(
  `tools/list matches the granted scopes`,
  mayWrite ? writeTools.length > 0 : writeTools.length === 0,
  `${listed.length} tools, ${writeTools.length} of them writes`
);

process.exit(failures ? 1 : 0);
