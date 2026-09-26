import { describe, expect, it } from 'vitest';
import { agentToolRegistry, groqTools, httpMethodFor, mcpToolRegistry } from '@/lib/agent/registry';
import { buildOpenApiDocument } from '@/mcp/openapi';

describe('agent tool registry', () => {
  it('has unique tool names', () => {
    const names = agentToolRegistry.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('exposes only finance tools over MCP', () => {
    expect(mcpToolRegistry.every((tool) => tool.module === 'finance')).toBe(true);
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

  it('marks every operation as requiring the bearer token', () => {
    for (const operations of Object.values(spec.paths)) {
      for (const operation of Object.values(operations)) {
        expect(operation.security).toEqual([{ bearerAuth: [] }]);
      }
    }
  });
});
