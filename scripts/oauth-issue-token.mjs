import nextEnv from '@next/env';
import { fileURLToPath } from 'node:url';

nextEnv.loadEnvConfig(fileURLToPath(new URL('..', import.meta.url)));

const [name, ...scopeArgs] = process.argv.slice(2);
if (!name) {
  console.error('Usage: npm run oauth:token -- "<client name>" [scope ...]');
  process.exit(1);
}

const modules = ['finance', 'personal', 'tbo'];
const allowed = modules.flatMap((module) => [`${module}:read`, `${module}:write`]);
const scopes = scopeArgs.length ? scopeArgs : modules.map((module) => `${module}:read`);
const unknown = scopes.filter((scope) => !allowed.includes(scope));
if (unknown.length) {
  console.error(`Unknown scope(s): ${unknown.join(', ')}. Allowed: ${allowed.join(', ')}`);
  process.exit(1);
}

const { issueRefreshToken, registerClient } = await import('../src/lib/oauth/store.ts');

const client = await registerClient(name, ['http://localhost/cli-unused']);
const refreshToken = await issueRefreshToken(client.clientId, scopes);

console.log(`Client "${name}" registered with scopes: ${scopes.join(' ')}\n`);
console.log(`MCP_SMOKE_CLIENT_ID=${client.clientId}`);
console.log(`MCP_SMOKE_REFRESH_TOKEN=${refreshToken}\n`);
console.log('The refresh token rotates on every use: store the replacement each exchange returns.');
console.log(
  `Revoke it by deleting the client row: delete from finance.oauth_clients where client_id = '${client.clientId}';`
);
