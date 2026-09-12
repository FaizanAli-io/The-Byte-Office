import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(projectRoot, '.env'));
loadEnvFile(resolve(projectRoot, '.env.local'));

const baseUrl = process.env.MCP_BASE_URL || 'http://localhost:3000';
const apiKey = process.env.MCP_API_KEY;

if (!apiKey) {
  console.error('Set MCP_API_KEY before running the smoke test.');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
};

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${init.method || 'GET'} ${path} failed (${response.status}): ${text}`);
  }
  return body;
}

try {
  const spec = await request('/api/openapi');
  console.log('openapi title:', spec.info?.title);

  const portfolio = await request('/api/mcp/tools/portfolio_get');
  console.log('portfolio_get:', {
    localBanks: portfolio.result?.localBanks?.length,
    remoteBanks: portfolio.result?.remoteBanks?.length,
    mutualFunds: portfolio.result?.mutualFunds?.length,
    grandTotalPkr: portfolio.result?.grandTotalPkr,
  });

  const initialized = await request('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'tbo-mcp-smoke', version: '0.0.1' },
      },
    }),
  });
  console.log('mcp initialize:', initialized.result?.serverInfo || initialized);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
