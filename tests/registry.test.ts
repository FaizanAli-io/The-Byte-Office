import { describe, expect, it } from 'vitest';
import { agentToolRegistry, groqTools, httpMethodFor, mcpToolRegistry } from '@/lib/agent/registry';
import { OAUTH_SCOPES, READ_SCOPES, scopeForTool } from '@/lib/oauth/tokens';
import { buildOpenApiDocument } from '@/mcp/openapi';

describe('agent tool registry', () => {
  it('has unique tool names', () => {
    const names = agentToolRegistry.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('exposes every tool over MCP except sending mail', () => {
    const withheld = agentToolRegistry.filter((tool) => !tool.mcp).map((tool) => tool.name);
    expect(withheld).toEqual(['tbo_send_inquiry']);
  });

  it('tells MCP that a write applies immediately, not that it is a proposal', () => {
    for (const tool of mcpToolRegistry.filter((entry) => entry.write)) {
      expect(tool.description.toLowerCase()).not.toContain('confirmation proposal');
    }
  });

  it('marks every destructive tool as a write', () => {
    expect(agentToolRegistry.filter((tool) => tool.destructive).every((tool) => tool.write)).toBe(true);
  });
});

describe('generated Groq tool schemas', () => {
  it('produces one entry per registered tool', () => {
    expect(groqTools).toHaveLength(agentToolRegistry.length);
  });

  it('strips $schema, which the tool-calling API rejects', () => {
    for (const tool of groqTools) {
      expect(tool.function.parameters).not.toHaveProperty('$schema');
    }
  });

  it('describes every tool as a closed object', () => {
    for (const tool of groqTools) {
      expect(tool.function.parameters).toMatchObject({ type: 'object', additionalProperties: false });
    }
  });

  it('gives the chat surface its own wording where writes are proposals', () => {
    const chat = groqTools.find((tool) => tool.function.name === 'portfolio_item_add');
    const mcp = mcpToolRegistry.find((tool) => tool.name === 'portfolio_item_add');
    expect(chat?.function.description).toMatch(/never writes before user confirmation/i);
    expect(mcp?.description).toMatch(/immediately/i);
  });

  it('requires a month wherever a ledger is addressed', () => {
    for (const name of ['ledger_get', 'ledger_entry_add', 'ledger_entry_update', 'ledger_entry_remove']) {
      const tool = groqTools.find((entry) => entry.function.name === name);
      expect((tool?.function.parameters as { required?: string[] }).required).toContain('month');
    }
  });
});

describe('http method mapping', () => {
  it('serves parameterless tools over GET and the rest over POST', () => {
    const byMethod = Object.fromEntries(mcpToolRegistry.map((tool) => [tool.name, httpMethodFor(tool)]));
    expect(byMethod).toMatchObject({
      portfolio_get: 'get',
      snapshots_list: 'get',
      ledgers_list: 'get',
      ledger_get: 'post',
      snapshot_get: 'post',
      portfolio_item_add: 'post',
    });
  });
});

describe('openapi document', () => {
  const spec = buildOpenApiDocument('https://example.com') as {
    paths: Record<string, Record<string, { security?: unknown[] }>>;
    servers: { url: string }[];
  };

  it('documents the MCP endpoint plus one path per exposed tool', () => {
    expect(Object.keys(spec.paths)).toHaveLength(mcpToolRegistry.length + 1);
  });

  it('uses the origin it was given', () => {
    expect(spec.servers[0].url).toBe('https://example.com');
  });

  it('requires an OAuth scope on every operation, and never an API key', () => {
    const serialised = JSON.stringify(spec);
    expect(serialised).not.toContain('bearerAuth');
    expect(serialised).not.toContain('MCP_API_KEY');

    for (const operations of Object.values(spec.paths)) {
      for (const operation of Object.values(operations)) {
        expect(operation.security).toHaveLength(1);
        expect(operation.security?.[0]).toHaveProperty('oauth2');
      }
    }
  });

  it('names each tool own module scope, and a write scope only where it writes', () => {
    for (const tool of mcpToolRegistry) {
      const operations = spec.paths[`/api/mcp/tools/${tool.name}`];
      const [security] = Object.values(operations)[0].security as [{ oauth2: string[] }];
      expect(security.oauth2).toEqual([scopeForTool(tool)]);
      expect(security.oauth2[0].endsWith(':write')).toBe(Boolean(tool.write));
    }
  });
});

describe('scope filtering', () => {
  // The same predicate `registerTools` and the REST wrapper apply.
  const visibleWith = (scopes: string[]) => mcpToolRegistry.filter((tool) => scopes.includes(scopeForTool(tool)));
  const names = (scopes: string[]) => visibleWith(scopes).map((tool) => tool.name);

  it('shows a read-only finance token exactly the finance reads', () => {
    expect(names(['finance:read'])).toEqual([
      'portfolio_get',
      'snapshots_list',
      'snapshot_get',
      'categories_list',
      'ledgers_list',
      'ledger_get',
      'ledger_summary',
      'ledger_accounts_list',
    ]);
  });

  it('keeps one module out of another', () => {
    expect(names(['finance:read', 'finance:write']).some((name) => name.startsWith('prayer'))).toBe(false);
    expect(names(['personal:read', 'personal:write']).some((name) => name.startsWith('portfolio'))).toBe(false);
    expect(names(['tbo:read'])).toEqual(['tbo_info']);
  });

  it('never exposes a write tool to a read-only token', () => {
    expect(visibleWith([...READ_SCOPES]).some((tool) => tool.write)).toBe(false);
  });

  it('exposes every MCP tool when every scope is granted', () => {
    expect(visibleWith([...OAUTH_SCOPES])).toHaveLength(mcpToolRegistry.length);
    expect(agentToolRegistry).toHaveLength(28);
    expect(mcpToolRegistry).toHaveLength(27);
  });

  it('offers no scope that would grant nothing', () => {
    for (const scope of OAUTH_SCOPES) {
      expect(visibleWith([scope]).length).toBeGreaterThan(0);
    }
    // Withdrawing the mail tool withdrew its scope with it.
    expect(OAUTH_SCOPES).not.toContain('tbo:write');
  });

  it('cannot send mail over MCP under any scope', () => {
    expect(names([...OAUTH_SCOPES])).not.toContain('tbo_send_inquiry');
  });
});
