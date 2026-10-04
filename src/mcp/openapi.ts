import { z } from 'zod/v4';
import { httpMethodFor, mcpToolRegistry } from '@/lib/agent/registry';
import { OAUTH_MODULES, scopeForTool } from '@/lib/oauth/tokens';
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from './server';

type OpenApiDocument = Record<string, unknown>;

const MODULE_TAGS = { finance: 'Finance', personal: 'Personal', tbo: 'The Byte Office' } as const;

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  'finance:read': 'Read the portfolio, snapshots and ledgers',
  'finance:write': 'Create, update and remove holdings, ledger accounts and entries, and categories',
  'personal:read': 'Read missed prayer counts, health metrics and readings',
  'personal:write': 'Set prayer counts; create, update and remove health metrics and readings',
  'tbo:read': 'Read public company information',
  'tbo:write': 'Send inquiry emails to The Byte Office',
};

export function buildOpenApiDocument(origin: string): OpenApiDocument {
  const mcpOperation = (summary: string, description: string, ok: string) => ({
    tags: ['MCP'],
    summary,
    description,
    security: [{ oauth2: [] }],
    responses: { '200': { description: ok }, '401': { description: 'Missing or invalid access token' } },
  });
  const paths: Record<string, unknown> = {
    '/api/mcp': {
      post: mcpOperation(
        'MCP Streamable HTTP endpoint',
        'Primary Model Context Protocol endpoint for ChatGPT, Claude, Cursor, and other MCP clients. Send JSON-RPC over Streamable HTTP.',
        'MCP JSON-RPC response or SSE stream'
      ),
      get: mcpOperation(
        'MCP Streamable HTTP endpoint (GET)',
        'Used by MCP clients for session/stream operations in legacy mode.',
        'MCP response'
      ),
      delete: mcpOperation(
        'MCP Streamable HTTP endpoint (DELETE)',
        'Used by MCP clients for session teardown in legacy mode.',
        'MCP response'
      ),
    },
  };

  for (const tool of mcpToolRegistry) {
    const operation = {
      tags: [`${MODULE_TAGS[tool.module]} ${tool.write ? 'write' : 'read'}`],
      summary: tool.title,
      description: tool.description,
      security: [{ oauth2: [scopeForTool(tool)] }],
      responses: {
        '200': {
          description: 'Tool result',
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true },
            },
          },
        },
        '400': { description: 'Invalid arguments' },
        '401': { description: 'Missing or invalid access token' },
        '403': { description: 'Token lacks the required scope' },
        '404': { description: 'Unknown tool' },
        '500': { description: 'Tool execution failed' },
      },
    };

    paths[`/api/mcp/tools/${tool.name}`] =
      httpMethodFor(tool) === 'get'
        ? { get: operation }
        : {
            post: {
              ...operation,
              requestBody: {
                required: true,
                content: { 'application/json': { schema: z.toJSONSchema(tool.schema) } },
              },
            },
          };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: `${MCP_SERVER_NAME} MCP API`,
      version: MCP_SERVER_VERSION,
      description:
        'HTTP MCP server and REST tool wrappers for The Byte Office tools. Use /api/mcp for MCP clients, or /api/mcp/tools/{name} for direct REST calls and Swagger testing. All access is OAuth 2.1; there is no API key.',
    },
    servers: [{ url: origin }],
    tags: [
      { name: 'MCP', description: 'Model Context Protocol transport' },
      ...OAUTH_MODULES.flatMap((module) => [
        { name: `${MODULE_TAGS[module]} read`, description: `Read-only ${MODULE_TAGS[module]} tools` },
        { name: `${MODULE_TAGS[module]} write`, description: `Mutating ${MODULE_TAGS[module]} tools` },
      ]),
    ],
    components: {
      securitySchemes: {
        oauth2: {
          type: 'oauth2',
          description:
            'Authorize with the workspace OAuth server. Swagger performs the authorization code flow with PKCE; write tools additionally need the write scope of their module.',
          flows: {
            authorizationCode: {
              authorizationUrl: `${origin}/oauth/authorize`,
              tokenUrl: `${origin}/oauth/token`,
              refreshUrl: `${origin}/oauth/token`,
              scopes: SCOPE_DESCRIPTIONS,
            },
          },
        },
      },
    },
    security: [{ oauth2: [] }],
    paths,
  };
}
